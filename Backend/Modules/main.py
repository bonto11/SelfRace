from datetime import datetime, timezone, timedelta
import Modules.API.api_strava as api_strava
import Modules.Reporting.reporting as reporting
import Modules.SQL.data_manager as sql_dm
from Modules.User.user_handler import get_or_create_user_id, user_crud

MAX_FULL_DETAILS_PER_RUN = 150  # (môžeš použiť neskôr na dávkovanie full detailov)

def sync_activities(user_id: int, force_full_30d: bool = False, archive_raw: bool = False) -> int:
    """
    Stiahne a uloží nové/aktualizované aktivity zo Stravy:
      - berie last_timestamp z DB (activities_summary.date)
      - filtruje podľa after_timestamp (epoch sekundy, UTC)
      - pre každú aktivitu uloží: activities_summary (SI)
      - uloží iba JEDNU z dvojice: activities_laps (pre intervaly) / activities_splits (pre bežné behy)
      - aktualizuje PR v users (best efforts)
      - voliteľne uloží RAW JSON (activities_raw)

    Vracia počet uložených/aktualizovaných aktivít.
    """
    last_timestamp = sql_dm.get_last_timestamp_from_db(user_id)

    if last_timestamp is None or force_full_30d:
        download_since_utc = datetime.now(timezone.utc) - timedelta(days=31)
    else:
        # nechytaj poslednú uloženú aktivitu znova
        download_since_utc = last_timestamp + timedelta(seconds=1)

    after_epoch = int(download_since_utc.timestamp())
    print(f"➡️  Sťahujem aktivity po {download_since_utc.isoformat()} (epoch={after_epoch})")

    # zoznam aktivít (len hlavičky)
    activities = api_strava.get_activities(after_timestamp=after_epoch)

    # existujúce ID, pre istotu
    existing_ids = sql_dm.get_existing_activities_ids_from_db(user_id)

    saved = 0

    # zapisuj od najstaršej po najnovšiu
    for act in reversed(activities):
        activity_id = int(act["id"])
        if not force_full_30d and activity_id in existing_ids:
            continue

        # FULL detail (obsahuje splits, best_efforts, gear)
        full = api_strava.get_activity_full(activity_id, include_all_efforts=True)

        # 1) SUMMARY (SI + pace_seconds_per_km)
        ok_summary = sql_dm.upsert_activity_summary_from_full(user_id, full)

        # 2) LAPS vs SPLITS – rozhodni podľa reálnych lapov
        decision = api_strava.decide_laps_or_splits(activity_id, token=None)
        mode = decision.get("mode")

        if mode == "laps" and decision.get("laps"):
            # ukladáme IBA LAPS, splits zmažeme (ak by boli z predchádzajúcich behov)
            try:
                sql_dm.delete_activity_splits(user_id, activity_id)
            except Exception:
                pass  # ak helper ešte nemáš, preskoč; odporúčam doplniť
            sql_dm.replace_activity_laps(user_id, activity_id, decision["laps"])
        else:
            # ukladáme IBA SPLITS, lapy zmažeme (ak by boli z predchádzajúcich behov)
            try:
                sql_dm.delete_activity_laps(user_id, activity_id)
            except Exception:
                pass
            sql_dm.replace_activity_splits(user_id, activity_id, decision.get("splits") or [])

        # 3) BEST EFFORTS -> USERS (PR, len ak lepšie)
        sql_dm.maybe_update_user_bests_from_full(user_id, activity_id, full.get("best_efforts"))

        # 4) RAW archív (voliteľné)
        if archive_raw:
            sql_dm.archive_activity_raw(user_id, activity_id, full)

        if ok_summary:
            saved += 1
            print(f"💾 {saved:03d}  Uložené: {full.get('name')}  [{full.get('start_date_local')}]  id={activity_id}  • {mode or 'splits'}")
        else:
            print(f"⚠️  Preskočené (summary zlyhalo): id={activity_id}  {full.get('name')}")

    print(f"✅ Hotovo. Uložených/aktualizovaných aktivít: {saved}")
    return saved


def cache_streams_for_activity(user_id: int, activity_id: int, activity_date: str | None = None) -> bool:
    """
    Na vyžiadanie stiahne STREAMS pre konkrétnu aktivitu a nahradí existujúce time-series v activity_details.
    Drž to mimo hlavného syncu (streams sú veľké).
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
    user_id = get_or_create_user_id(email)

    # 2) SYNC – nastav si, či chceš „force posledných 30 dní“ a či chceš RAW archív
    sync_activities(user_id, force_full_30d=False, archive_raw=False)

    # 3) Report
    reporting.generate_report(user_id)

    # 4) STREAMS pre jednu aktivitu (príklad)
    activity_id = 15342917851
    cache_streams_for_activity(user_id, activity_id, activity_date=None)


if __name__ == "__main__":
    main()
