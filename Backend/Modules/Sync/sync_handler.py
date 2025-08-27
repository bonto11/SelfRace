# Modules/Sync/sync_handler.py

import os
import json
import time
import requests
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta

import Modules.API.Strava as api_strava
import Modules.SQL.data_manager as sql_dm


# ochrana pred 429 – koľko FULL detailov stiahnuť za jeden run
MAX_FULL_DETAILS_PER_RUN = 150


# ===============================
# Helpery pre retry a 429
# ===============================
def _get_full_with_retry(activity_id: int, include_all_efforts=True, max_retries=3):
    tries = 0
    while True:
        try:
            return api_strava.get_activity_full(activity_id, include_all_efforts=include_all_efforts)
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 429 and tries < max_retries:
                wait = 15 * 60 if tries == max_retries - 1 else 60 * (2 ** tries)  # 1m, 2m, ... 15m
                print(f"⏳ 429 Too Many Requests. Čakám {wait}s a skúšam znova ...")
                time.sleep(wait)
                tries += 1
                continue
            raise


def is_429(err: Exception) -> bool:
    """True ak ide o HTTP 429 (Too Many Requests)."""
    if isinstance(err, requests.exceptions.HTTPError) and err.response is not None:
        return err.response.status_code == 429
    msg = str(err).lower()
    return "429" in msg and "too many" in msg


# ===============================
# Sync nových aktivít
# ===============================
def sync_activities(user_id: int, force_full_30d: bool = False, archive_raw: bool = False) -> int:
    last_timestamp = sql_dm.get_last_timestamp_from_db(user_id)

    if last_timestamp is None or force_full_30d:
        download_since_utc = datetime.now(timezone.utc) - timedelta(days=30)
    else:
        download_since_utc = last_timestamp + timedelta(seconds=1)

    after_epoch = int(download_since_utc.timestamp())
    print(f"➡️  Sťahujem aktivity po {download_since_utc.isoformat()} (epoch={after_epoch})")

    activities = api_strava.get_activities(after_timestamp=after_epoch)
    existing_ids = sql_dm.get_existing_activities_ids_from_db(user_id)

    saved_summary = 0
    fetched_full = 0

    for act in reversed(activities):
        activity_id = int(act["id"])

        if not force_full_30d and activity_id in existing_ids:
            continue
        if fetched_full >= MAX_FULL_DETAILS_PER_RUN:
            print(f"⏸️  Limit FULL fetchov dosiahnutý ({MAX_FULL_DETAILS_PER_RUN}). Zvyšok nabudúce.")
            break

        try:
            full = _get_full_with_retry(activity_id, include_all_efforts=True)
            fetched_full += 1

            ok_summary = sql_dm.upsert_activity_summary_from_full(user_id, full)
            sport = (full.get("sport_type") or full.get("type") or "").lower()

            if sport != "run":
                sql_dm.maybe_update_user_bests_from_full(user_id, activity_id, full.get("best_efforts"))
                if archive_raw:
                    sql_dm.archive_activity_raw(user_id, activity_id, full)
                if ok_summary:
                    saved_summary += 1
                    print(f"💾 {saved_summary:03d}  Uložené: {full.get('name')} [{full.get('start_date_local')}], id={activity_id} • {sport} (bez laps/splits)")
                continue

            # LAPS vs SPLITS
            decision = api_strava.decide_laps_or_splits(activity_id, token=None)
            mode = decision.get("mode")

            if mode == "laps" and decision.get("laps"):
                try:
                    sql_dm.delete_activity_splits(user_id, activity_id)
                except Exception:
                    pass
                inserted = sql_dm.replace_activity_laps(user_id, activity_id, decision["laps"])
            else:
                try:
                    sql_dm.delete_activity_laps(user_id, activity_id)
                except Exception:
                    pass
                inserted = sql_dm.replace_activity_splits(user_id, activity_id, decision.get("splits") or [])

            sql_dm.maybe_update_user_bests_from_full(user_id, activity_id, full.get("best_efforts"))
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
            print(f"❌ Chyba pri spracovaní activity_id={activity_id}: {e}")

    print(f"✅ Hotovo. Uložených/aktualizovaných summary: {saved_summary}")
    return saved_summary


# ===============================
# Sync pre okno (mesiac)
# ===============================
def sync_activities_for_window(user_id: int,
                               after_dt: datetime,
                               before_dt: datetime,
                               archive_raw: bool = False) -> int:
    after_epoch = int(after_dt.timestamp())
    all_headers = api_strava.get_activities(after_timestamp=after_epoch)

    def iso_to_dt(iso: str) -> datetime:
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
        full = api_strava.get_activity_full(activity_id, include_all_efforts=True)

        ok_summary = sql_dm.upsert_activity_summary_from_full(user_id, full)
        sport = (full.get("sport_type") or full.get("type") or "").lower()

        if sport != "run":
            if ok_summary:
                saved += 1
                print(f"💾 {saved:03d}  Uložené: {full.get('name')} [{full.get('start_date_local')}] • {sport} (bez laps/splits)")
            continue

        decision = api_strava.decide_laps_or_splits(activity_id)
        mode = decision.get("mode")

        if mode == "laps" and decision.get("laps"):
            sql_dm.replace_activity_laps(user_id, activity_id, decision["laps"])
            rows_flag = True
        else:
            sql_dm.replace_activity_splits(user_id, activity_id, decision.get("splits") or [])
            rows_flag = True

        sql_dm.maybe_update_user_bests_from_full(user_id, activity_id, full.get("best_efforts"))
        if archive_raw:
            sql_dm.archive_activity_raw(user_id, activity_id, full)

        if ok_summary:
            saved += 1
            print(f"💾 {saved:03d}  Uložené: {full.get('name')}  [{full.get('start_date_local')}]  id={activity_id}  • {mode or sport}  (rows={rows_flag})")
        else:
            print(f"⚠️ Preskočené (summary zlyhalo): id={activity_id} {full.get('name')}")

    return saved


# ===============================
# Checkpointy pre históriu
# ===============================
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


# ===============================
# História po mesiacoch
# ===============================
def sync_history(user_id: int,
                 from_date: datetime,
                 to_date: datetime,
                 window_months: int = 1,
                 archive_raw: bool = False,
                 use_checkpoint: bool = True,
                 wait_minutes_on_429: int = 16,
                 pause_between_months_s: int = 0) -> int:
    assert from_date.tzinfo is not None and to_date.tzinfo is not None, "Použi timezone-aware UTC dátumy"

    ck = _load_history_checkpoint()
    ck_key = f"user_{user_id}_history"
    current = from_date

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

        while True:
            try:
                saved = sync_activities_for_window(user_id, current, window_end, archive_raw=archive_raw)
                total_saved += saved
                if use_checkpoint:
                    _save_history_checkpoint({ck_key: window_end.isoformat()})
                break
            except Exception as e:
                if is_429(e):
                    wait = max(1, int(wait_minutes_on_429)) * 60
                    print(f"⏳ 429 Too Many Requests. Čakám {wait//60} min a skúšam ZNOVU tento mesiac …")
                    time.sleep(wait)
                    continue
                else:
                    print(f"❌ Chyba pri sync okna {current:%Y-%m}: {e}")
                    break

        current = window_end
        if current < to_date and pause_between_months_s > 0:
            print(f"⏸️ Pauza {pause_between_months_s}s pred ďalším mesiacom…")
            time.sleep(pause_between_months_s)

    print(f"\n✅ História hotová. Celkovo uložené/aktualizované: {total_saved}")
    return total_saved


# ===============================
# Cache pre streams
# ===============================
def cache_streams_for_activity(user_id: int, activity_id: int, activity_date: str | None = None) -> bool:
    streams = api_strava.get_activity_streams_all(activity_id)
    ok = sql_dm.replace_activity_details(user_id, activity_id, streams, activity_date=activity_date)
    if ok:
        print(f"✅ activity_details nahradené (user_id={user_id}, activity_id={activity_id})")
    else:
        print(f"❌ Ukladanie streamov zlyhalo (activity_id={activity_id})")
    return ok
