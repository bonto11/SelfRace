
import Modules.API.Strava as api_strava
import Modules.Reporting.reporting as reporting
import Modules.SQL.data_manager as sql_dm
import Modules.User.user_handler as user_hdl
import os
import json
import time
import requests
from requests.exceptions import HTTPError
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta

# ochrana pred 429 – koľko FULL detailov stiahnuť za jeden run
MAX_FULL_DETAILS_PER_RUN = 150

import requests

def _get_full_with_retry(activity_id: int, include_all_efforts=True, max_retries=3):
    tries = 0
    while True:
        try:
            return api_strava.get_activity_full(activity_id, include_all_efforts=include_all_efforts)
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 429 and tries < max_retries:
                wait = 15 * 60 if tries == max_retries - 1 else 60 * (2 ** tries)  # 1m, 2m, ... 15m na posledný
                print(f"⏳ 429 Too Many Requests. Čakám {wait}s a skúšam znova ...")
                time.sleep(wait)
                tries += 1
                continue
            raise

def is_429(err: Exception) -> bool:
    """True ak ide o HTTP 429 (Too Many Requests)."""
    if isinstance(err, requests.exceptions.HTTPError) and err.response is not None:
        return err.response.status_code == 429
    # fallback: niektoré chyby môžu byť zabalené inde
    msg = str(err).lower()
    return "429" in msg and "too many" in msg

def sync_activities(user_id: int, force_full_30d: bool = False, archive_raw: bool = False) -> int:
    """
    Stiahne a uloží nové/aktualizované aktivity zo Stravy:
      - berie last_timestamp z DB (activities_summary.date)
      - filtruje podľa after_timestamp (epoch sekundy, UTC)
      - pre každú aktivitu uloží: activities_summary (SI)
      - uloží iba JEDNU z dvojice: activities_laps (pre intervaly) / activities_splits (pre bežné behy)
      - aktualizuje PR v users (best efforts)
      - voliteľne uloží RAW JSON (activities_raw)

    Vracia počet uložených/aktualizovaných aktivít (summary).
    """
    last_timestamp = sql_dm.get_last_timestamp_from_db(user_id)

    if last_timestamp is None or force_full_30d:
        download_since_utc = datetime.now(timezone.utc) - timedelta(days=90)
    else:
        # nechytaj poslednú uloženú aktivitu znova
        download_since_utc = last_timestamp + timedelta(seconds=1)

    after_epoch = int(download_since_utc.timestamp())
    print(f"➡️  Sťahujem aktivity po {download_since_utc.isoformat()} (epoch={after_epoch})")

    # 0) zoznam aktivít (len hlavičky)
    activities = api_strava.get_activities(after_timestamp=after_epoch)

    # 1) existujúce ID pre istotu (Strava môže vrátiť aj staršie)
    existing_ids = sql_dm.get_existing_activities_ids_from_db(user_id)

    saved_summary = 0
    fetched_full = 0

    # zapisuj od najstaršej po najnovšiu (stabilné poradie)
    for act in reversed(activities):
        activity_id = int(act["id"])

        if not force_full_30d and activity_id in existing_ids:
            continue

        # ochrana proti 429
        if fetched_full >= MAX_FULL_DETAILS_PER_RUN:
            print(f"⏸️  Limit FULL fetchov dosiahnutý ({MAX_FULL_DETAILS_PER_RUN}). Zvyšok nabudúce.")
            break

        try:
            # 2) FULL detail (obsahuje splits, best_efforts, gear)
            full = _get_full_with_retry(activity_id, include_all_efforts=True)
            fetched_full += 1

            # 3) SUMMARY (SI + pace_seconds_per_km)
            ok_summary = sql_dm.upsert_activity_summary_from_full(user_id, full)

            # --- NOVÉ: len behy majú laps/splits ---
            sport = (full.get("sport_type") or full.get("type") or "").lower()
            if sport != "run":
                # pre ne-behy len PR + prípadne RAW; laps/splits preskoč
                sql_dm.maybe_update_user_bests_from_full(user_id, activity_id, full.get("best_efforts"))
                if archive_raw:
                    sql_dm.archive_activity_raw(user_id, activity_id, full)
                if ok_summary:
                    saved_summary += 1
                    print(f"💾 {saved_summary:03d}  Uložené: {full.get('name')} [{full.get('start_date_local')}], id={activity_id} • {sport} (bez laps/splits)")
                continue
            # --- KONIEC beh-checku ---

            # 4) LAPS vs SPLITS – rozhodni
            decision = api_strava.decide_laps_or_splits(activity_id, token=None)
            mode = decision.get("mode")

            if mode == "laps" and decision.get("laps"):
                # ukladáme IBA LAPS, SPLITS zmažeme
                try:
                    sql_dm.delete_activity_splits(user_id, activity_id)
                except Exception:
                    pass
                inserted = sql_dm.replace_activity_laps(user_id, activity_id, decision["laps"])
            else:
                # ukladáme IBA SPLITS, LAPS zmažeme
                try:
                    sql_dm.delete_activity_laps(user_id, activity_id)
                except Exception:
                    pass
                inserted = sql_dm.replace_activity_splits(user_id, activity_id, decision.get("splits") or [])

            # 5) BEST EFFORTS -> USERS (ak lepšie, aktualizuj)
            sql_dm.maybe_update_user_bests_from_full(user_id, activity_id, full.get("best_efforts"))

            # 6) RAW archív (voliteľné)
            if archive_raw:
                sql_dm.archive_activity_raw(user_id, activity_id, full)

            if ok_summary:
                saved_summary += 1
                print(
                    f"💾 {saved_summary:03d}  Uložené: {full.get('name')}  "
                    f"[{full.get('start_date_local')}]  id={activity_id}  • {mode or 'splits'}  "
                    f"(rows={inserted})"
                )
            else:
                print(f"⚠️  Preskočené (summary zlyhalo): id={activity_id}  {full.get('name')}")

        except Exception as e:
            # nech jedno zlyhanie nezabije celý sync
            print(f"❌ Chyba pri spracovaní activity_id={activity_id}: {e}")

    print(f"✅ Hotovo. Uložených/aktualizovaných summary: {saved_summary}")
    return saved_summary

def sync_activities_for_window(user_id: int,
                               after_dt: datetime,
                               before_dt: datetime,
                               archive_raw: bool = False) -> int:
    """
    Stiahne a uloží aktivity v intervale <after_dt, before_dt).
    - activities list: použijeme `after` (epoch); následne lokálne odfiltrujeme podľa before_dt
    - pre každú aktivitu stiahneme FULL; rozhodneme laps vs splits; upsertneme summary, splits/laps, bests
    """
    after_epoch = int(after_dt.timestamp())
    all_headers = api_strava.get_activities(after_timestamp=after_epoch)

    # odfiltruj tie, ktoré sú >= before_dt (Strava nepozná 'before' v tomto liste)
    def iso_to_dt(iso: str) -> datetime:
        # Strava dáva Z → urob z toho aware UTC
        if iso.endswith("Z"):
            iso = iso.replace("Z", "+00:00")
        return datetime.fromisoformat(iso).astimezone(timezone.utc)

    headers = [
        a for a in all_headers
        if "start_date_local" in a and iso_to_dt(a["start_date_local"]) < before_dt
    ]

    saved = 0
    existing_ids = sql_dm.get_existing_activities_ids_from_db(user_id)

    for act in reversed(headers):
        activity_id = int(act["id"])
        # keďže ideme po oknách a môžeme reštartovať, duplicitám sa nevyhneme → upsert to vyrieši
        # ak chceš šetriť volania, môžeš preskočiť už známe ID:
        # if activity_id in existing_ids: continue

        full = api_strava.get_activity_full(activity_id, include_all_efforts=True)

        # summary
        ok_summary = sql_dm.upsert_activity_summary_from_full(user_id, full)

        # pre ne-run aktivity (walk, ride, …) ukladáme len summary (podľa priania)
        sport = (full.get("sport_type") or full.get("type") or "").lower()
        if sport != "run":
            if ok_summary:
                saved += 1
                print(f"💾 {saved:03d}  Uložené: {full.get('name')} [{full.get('start_date_local')}] • {sport} (bez laps/splits)")
            continue

        # laps vs splits (intervaly vs. bežné km auto-lapy)
        decision = api_strava.decide_laps_or_splits(activity_id)
        mode = decision.get("mode")

        if mode == "laps" and decision.get("laps"):
            # ulož lapy, splits nemaž/ignoruj (alebo môžeš mazať, ak máš helpery)
            sql_dm.replace_activity_laps(user_id, activity_id, decision["laps"])
            rows_flag = True
        else:
            sql_dm.replace_activity_splits(user_id, activity_id, decision.get("splits") or [])
            rows_flag = True

        # best efforts → users
        sql_dm.maybe_update_user_bests_from_full(user_id, activity_id, full.get("best_efforts"))

        # raw archív (voliteľné)
        if archive_raw:
            sql_dm.archive_activity_raw(user_id, activity_id, full)

        if ok_summary:
            saved += 1
            print(f"💾 {saved:03d}  Uložené: {full.get('name')}  [{full.get('start_date_local')}]  id={activity_id}  • {mode or sport}  (rows={rows_flag})")
        else:
            print(f"⚠️ Preskočené (summary zlyhalo): id={activity_id} {full.get('name')}")

    return saved


def _load_history_checkpoint(path: str = "data/history_checkpoint.json") -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception:
        return {}

def _save_history_checkpoint(payload: dict, path: str = "data/history_checkpoint.json") -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def sync_history(user_id: int,
                 from_date: datetime,
                 to_date: datetime,
                 window_months: int = 1,
                 archive_raw: bool = False,
                 use_checkpoint: bool = True,
                 wait_minutes_on_429: int = 16,
                 pause_between_months_s: int = 0) -> int:
    """
    Ide po mesiacoch (vrátane from_date, exkluzívne to_date).
    Pri 429 NEROBÍ skip: čaká wait_minutes_on_429 minút a zopakuje ten istý mesiac,
    až kým mesiac neprejde úspešne. Checkpoint sa ukladá až po úspechu.
    """
    assert from_date.tzinfo is not None and to_date.tzinfo is not None, "Použi timezone-aware UTC dátumy"

    ck = _load_history_checkpoint()
    ck_key = f"user_{user_id}_history"

    current = from_date

    # ak existuje checkpoint a je v rozsahu, začni odtiaľ
    if use_checkpoint and ck.get(ck_key):
        try:
            cki = datetime.fromisoformat(ck[ck_key]).astimezone(timezone.utc)
            if from_date <= cki <= to_date:
                current = cki
        except Exception:
            pass

    total_saved = 0

    while current < to_date:
        window_end = min(current + relativedelta(months=window_months), to_date)
        print(f"\n========== SYNC {current:%Y-%m} ==========")
        print(f"=== Window {current:%Y-%m-%d} → {window_end:%Y-%m-%d} (epoch after={int(current.timestamp())}) ===")

        # retry slučka pre tento mesiac
        while True:
            try:
                saved = sync_activities_for_window(
                    user_id=user_id,
                    after_dt=current,
                    before_dt=window_end,
                    archive_raw=archive_raw
                )
                total_saved += saved

                # checkpoint posuň až po úspechu tohto mesiaca
                if use_checkpoint:
                    _save_history_checkpoint({ck_key: window_end.isoformat()})
                break  # hotovo s týmto mesiacom, ideme ďalej

            except Exception as e:
                if is_429(e):
                    wait = max(1, int(wait_minutes_on_429)) * 60
                    print(f"⏳ 429 Too Many Requests. Čakám {wait//60} min a skúšam ZNOVU tento mesiac …")
                    time.sleep(wait)
                    continue  # zopakuj rovnaké okno
                else:
                    print(f"❌ Chyba pri sync okna {current:%Y-%m}: {e}")
                    # nechceme sa zacykliť na inej chybe -> preskoč mesiac, ale checkpoint NEPOSÚVAJ
                    break

        # až teraz posuň „current“ na ďalší mesiac
        current = window_end

        # dobrovoľná pauza medzi mesiacmi
        if current < to_date and pause_between_months_s > 0:
            print(f"⏸️ Pauza {pause_between_months_s}s pred ďalším mesiacom…")
            time.sleep(pause_between_months_s)

    print(f"\n✅ História hotová. Celkovo uložené/aktualizované: {total_saved}")
    return total_saved


def cache_streams_for_activity(user_id: int, activity_id: int, activity_date: str | None = None) -> bool:
    """
    Na vyžiadanie stiahne STREAMS pre konkrétnu aktivitu a nahradí existujúce
    time-series v activity_details. (Mimo hlavného syncu – streams sú veľké.)
    """
    streams = api_strava.get_activity_streams_all(activity_id)
    ok = sql_dm.replace_activity_details(
        user_id=user_id,
        activity_id=activity_id,
        streams=streams,
        activity_date=activity_date,
    )
    if ok:
        print(f"✅ activity_details nahradené (user_id={user_id}, activity_id={activity_id})")
    else:
        print(f"❌ Ukladanie streamov zlyhalo (activity_id={activity_id})")
    return ok


def main():
    # 1) získať user_id (alebo vytvoriť)
    email = "patrikmbontar@gmail.com"
    user_id = user_hdl.get_or_create_user_id(email)
    
    # 1) História 2023-01 → 2025-08 (po mesiacoch)
    #sync_history(user_id, datetime(2023,5,1,tzinfo=timezone.utc), datetime.now(timezone.utc))

    # 2) SYNC – nastav si, či chceš „force posledných 30 dní“ a či chceš RAW archív
    #sync_activities(user_id, force_full_30d=False, archive_raw=False)
    
     # Test – vlož profil
        #user_hdl.insert_or_update_user_profile(user_id, weight_kg=82.3, height_cm=186, body_fat_pct=7.7, HR_max=201, RHR=52, birth_date = "1996-11-19", VO2Max = 46.5)

    # Test – vlož zóny
        #user_hdl.insert_or_update_user_zones(user_id, sport = "running", zone_type = 1, HR_min_bpm=120, HR_max_bpm=147)
        #user_hdl.insert_or_update_user_zones(user_id, sport = "running", zone_type = 2, HR_min_bpm=148, HR_max_bpm=164)
        #user_hdl.insert_or_update_user_zones(user_id, sport = "running", zone_type = 3, HR_min_bpm=165, HR_max_bpm=175)
        #user_hdl.insert_or_update_user_zones(user_id, sport = "running", zone_type = 4, HR_min_bpm=176, HR_max_bpm=184)
        #user_hdl.insert_or_update_user_zones(user_id, sport = "running", zone_type = 5, HR_min_bpm=185, HR_max_bpm=201)

    # Test – vlož prahy
        #user_hdl.insert_or_update_user_thresholds(user_id, sport = "running", threshold_type = "LT2", HR_bpm=184, pace_sec_km=295, measurement_type = "estimate garmin")
    
        #user_hdl.insert_or_update_user_thresholds(user_id, sport = "running", threshold_type = LT1, HR_bpm=164, measurement_type = "laboratory test")
        #user_hdl.insert_or_update_user_thresholds(user_id, sport = "running", threshold_type = MLSS, value=10)
        #user_hdl.insert_or_update_user_thresholds(user_id, sport = "cycling", threshold_type = LT2, HR_bpm=184, power_watt=295)

    # Test – vlož osobáky
        #user_hdl.insert_or_update_user_bests(user_id, distance_m = 400, best_time_s=1393)
        #user_hdl.insert_or_update_user_bests(user_id, distance_m = 10000, best_time_s=3017)
        #user_hdl.insert_or_update_user_bests(user_id, distance_m = 21097, best_time_s=8527)
        
    # Test – vlož resting_values
    #   user_hdl.insert_or_update_user_recovery(user_id, date = "2025-08-24", RHR_bpm=53, HRV_avg_ms=64, HRV_max_ms=86, sleep_duration_min = 487, sleep_start_timestampz = "2025-08-23T23:10:00+02:00", alcohol_volume_ml = 1000, alcohol_type_pct = 12, food_2h_before = False)
 
    #print(user_hdl.get_user_profile(user_id))
    #print(user_hdl.get_user_zones(user_id))
    #print(user_hdl.get_user_thresholds(user_id))
    #print(user_hdl.get_user_bests(user_id))
    #print(user_hdl.get_user_recovery(user_id))
    
    # 3) Report (pracuje nad activities_summary)
    #reporting.generate_report(user_id)

    # 4) STREAMS pre jednu aktivitu (príklad)
    #activity_id = 15342917851
    #cache_streams_for_activity(user_id, activity_id, activity_date=None)


if __name__ == "__main__":
    main()
