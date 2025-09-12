# backend/Modules/Sync/sync_handler.py
from __future__ import annotations

import time
import requests
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Iterable

from Modules.SQL.db_handler import get_client
from Modules.API.Strava.auth import get_access_token
from Modules.config import (
    STRAVA_BASE,
    TABLE_ACTIVITIES_SUMMARY,   # "activities_summary"
    TABLE_ACTIVITIES_LAPS,      # "activities_laps"
    TABLE_ACTIVITIES_SPLITS,    # "activities_splits"
)

supabase = get_client()

# Koľko detailov (laps/splits) max dotiahnuť v jednej synchronizácii
MAX_FULL_DETAILS_PER_RUN = 150


# -----------------------------------------------------------------------------
# Pomocné konverzie (bezpečné – Strava posiela občas čísla ako stringy)
# -----------------------------------------------------------------------------
def to_int(v, default=None):
    if v is None or v == "":
        return default
    try:
        return int(round(float(v)))
    except Exception:
        return default

def to_float(v, default=None):
    if v is None or v == "":
        return default
    try:
        return float(v)
    except Exception:
        return default

def to_str(v, default=""):
    return str(v) if v is not None else default


def iso_to_timestamptz_str(iso: Optional[str]) -> Optional[str]:
    """
    "2025-09-06T20:03:35Z"        -> "2025-09-06 20:03:35+00"
    "2025-09-06T20:03:35+01:00"   -> "2025-09-06 19:03:35+00" (prevedené do UTC)
    """
    if not iso:
        return None
    try:
        s = iso.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%d %H:%M:%S+00")
    except Exception:
        return None


# -----------------------------------------------------------------------------
# Strava session (token berieme z tvojej auth vrstvy)
# -----------------------------------------------------------------------------
def _get_session() -> requests.Session:
    """
    Číta access token z Modules.API.Strava.auth.get_access_token().
    Ak expirovaný, tento modul si ho má sám refreshnúť.
    """
    token = get_access_token()
    if not token:
        raise RuntimeError(
            "Chýba Strava access token. Spusť autorizáciu a /exchange_token."
        )
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# -----------------------------------------------------------------------------
# DB helpery
# -----------------------------------------------------------------------------
def _upsert_many(table: str, rows: Iterable[dict[str, Any]], on_conflict: str = "activity_id"):
    rows = list(rows)
    if not rows:
        return
    supabase.table(table).upsert(rows, on_conflict=on_conflict).execute()


def _max_saved_start(user_id: int) -> Optional[datetime]:
    """
    Najnovší dátum uložený v summary (ako aware-UTC datetime).
    V stĺpci 'date' očakávame buď timestamptz (napr. '2025-09-06 20:03:34+00')
    alebo ISO bez TZ – normalizujeme do UTC.
    """
    res = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
        .select("date")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None

    s = str(res.data[0].get("date") or "")
    # môže prísť "2025-09-06 20:03:34+00" alebo "2025-09-06T20:03:34"
    s = s.replace(" ", "T")
    if "+" not in s and "Z" not in s:
        s += "Z"  # fallback
    try:
        s = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    except Exception:
        return None


def _existing_ids(user_id: int, since_iso_date: str) -> set[int]:
    """
    ID už uložených aktivít od 'since_iso_date' (YYYY-MM-DD).
    """
    out: set[int] = set()
    rows = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id,date")
        .eq("user_id", user_id)
        .gte("date", since_iso_date)
        .execute()
    )
    for r in rows.data or []:
        try:
            out.add(int(r["activity_id"]))
        except Exception:
            pass
    return out


# -----------------------------------------------------------------------------
# Normalizácia na tvoju schému (presne podľa sample JSONu z DB)
# -----------------------------------------------------------------------------
def _normalize_summary(user_id: int, a: dict) -> dict:
    """
    Mapuje Strava activity JSON → presne tvoje stĺpce v activities_summary.
    (viď tvoje polia: date, elevation_gain_m, timezone, utc_offset_s, ... calories_kcal, ...)
    """
    # primárne dátumy
    start_utc_iso   = a.get("start_date")           # "2025-09-06T20:03:35Z"
    start_local_iso = a.get("start_date_local")     # "2025-09-06T22:03:35Z"
    date_for_db     = iso_to_timestamptz_str(start_utc_iso) or iso_to_timestamptz_str(start_local_iso)

    distance_m  = to_int(a.get("distance"))
    moving_s    = to_int(a.get("moving_time"))
    elapsed_s   = to_int(a.get("elapsed_time"))
    avg_speed   = to_float(a.get("average_speed"))
    max_speed   = to_float(a.get("max_speed"))
    elev_gain_m = to_int(a.get("total_elevation_gain"))
    elev_high_m = to_float(a.get("elev_high"))
    elev_low_m  = to_float(a.get("elev_low"))

    avg_hr      = to_float(a.get("average_heartrate"))
    max_hr      = to_float(a.get("max_heartrate"))

    avg_cad_rpm = to_float(a.get("average_cadence"))
    avg_temp    = to_int(a.get("average_temp"))
    avg_watts   = to_float(a.get("average_watts") or a.get("weighted_average_watts"))
    max_watts   = to_int(a.get("max_watts"))

    # výpočet pace (sekundy/km)
    pace_s_per_km = None
    if distance_m and moving_s and distance_m > 0:
        pace_s_per_km = int(round(moving_s / (distance_m / 1000.0)))

    tz_label      = to_str(a.get("timezone"))               # "(GMT+01:00) Europe/Bratislava"
    utc_offset_s  = to_int(a.get("utc_offset"))

    calories_kcal = to_int(a.get("calories"))
    if calories_kcal is None:
        kj = to_float(a.get("kilojoules"))
        if kj is not None:
            calories_kcal = int(round(kj * 0.239006))  # 1 kJ ≈ 0.239 kcal

    return {
        "user_id":                 user_id,
        "activity_id":             to_int(a.get("id")),
        "name":                    to_str(a.get("name")),
        "date":                    date_for_db,  # "YYYY-MM-DD HH:MM:SS+00" (UTC)
        # meta
        "timezone":                tz_label,
        "utc_offset_s":            utc_offset_s,
        # vzdialenosť/čas/tempo
        "distance_m":              distance_m,
        "moving_time_s":           moving_s,
        "elapsed_time_s":          elapsed_s,
        "average_speed_mps":       avg_speed,
        "max_speed_mps":           max_speed,
        "pace_seconds_per_km":     pace_s_per_km,
        # výškové
        "elevation_gain_m":        elev_gain_m,
        "elev_high_m":             elev_high_m,
        "elev_low_m":              elev_low_m,
        # HR
        "average_heartrate_bpm":   avg_hr,
        "max_heartrate_bpm":       max_hr,
        # výkon/teplota/kadencia
        "average_watts":           avg_watts,
        "max_watts":               max_watts,
        "average_temp_c":          avg_temp,
        "average_cadence_rpm":     avg_cad_rpm,
        # šport a vybavenie
        "sport_type":              to_str(a.get("sport_type") or a.get("type")),
        "gear_id":                 to_str(a.get("gear_id")),
        "gear_name":               None,            # ak chceš, vieš si dotiahnuť cez /gear a uložiť
        # popisy / PR
        "description":             a.get("description"),
        "comment":                 None,
        "achievement_count":       to_int(a.get("achievement_count")),
        "pr_count":                to_int(a.get("pr_count")),
        # energetika
        "calories_kcal":           calories_kcal,
        # voliteľné
        "user_uid":                None,
    }


def _normalize_lap(l: dict, user_id: int, activity_id: int) -> dict:
    """Strava lap -> activities_laps (názvy podľa tvojej DB)."""
    return {
        "user_id":             user_id,
        "activity_id":         int(l.get("activity_id") or activity_id),
        "lap_index":           to_int(l.get("lap_index")),
        "start_date_local":    l.get("start_date") or l.get("start_date_local"),
        "distance_m":          to_int(l.get("distance")),
        "moving_time_s":       to_int(l.get("moving_time")),
        "elapsed_time_s":      to_int(l.get("elapsed_time")),
        "total_elev_gain_m":   to_float(l.get("total_elevation_gain") or l.get("total_elev_gain_m")),
        "avg_speed_mps":       to_float(l.get("average_speed") or l.get("avg_speed_mps")),
        "max_speed_mps":       to_float(l.get("max_speed") or l.get("max_speed_mps")),
        "avg_cadence_rpm":     to_float(l.get("average_cadence") or l.get("avg_cadence_rpm")),
        "avg_watts":           to_float(l.get("average_watts") or l.get("avg_watts")),
        "avg_hr_bpm":          to_float(l.get("average_heartrate") or l.get("avg_hr_bpm")),
        "max_hr_bpm":          to_float(l.get("max_heartrate") or l.get("max_hr_bpm")),
        "pace_s_per_km":       to_int(l.get("pace_s_per_km")),
        # user_uid je u teba voliteľné – ak ho chceš dopĺňať, pridaj si ho z user profilu
        # "user_uid":          "...",
    }

def _normalize_split(s: dict, user_id: int, activity_id: int, idx1: int) -> dict:
    """Strava splits_metric -> activities_splits (názvy podľa tvojej DB)."""
    return {
        "user_id":            user_id,
        "activity_id":        int(s.get("activity_id") or activity_id),
        "split_index":        to_int(s.get("split") or s.get("split_index") or idx1),
        "distance_m":         to_int(s.get("distance")),
        "moving_time_s":      to_int(s.get("moving_time")),
        "elapsed_time_s":     to_int(s.get("elapsed_time")),
        "elevation_diff_m":   to_float(s.get("elevation_difference") or s.get("elevation_diff_m")),
        "avg_speed_mps":      to_float(s.get("average_speed") or s.get("avg_speed_mps")),
        "avg_gap_mps":        to_float(s.get("average_grade_adjusted_speed") or s.get("avg_gap_mps")),
        "avg_hr_bpm":         to_float(s.get("average_heartrate") or s.get("avg_hr_bpm")),
        "pace_s_per_km":      to_int(s.get("pace_s_per_km")),
        # ak by si neskôr chcel aj max HR: "max_hr_bpm": to_float(...),
    }


# -----------------------------------------------------------------------------
# Hlavná sync funkcia
# -----------------------------------------------------------------------------
def sync_activities(
    user_id: int,
    force_last_days: Optional[int] = 30,
    fetch_details: bool = True
) -> dict[str, int]:
    """
    Stiahne aktivity zo Stravy a uloží do Supabase.
    - Ak v DB niečo je → sťahuje len po 'after' od poslednej uloženéj.
    - Ak nie je → sťahuje posledných `force_last_days` (default 30).
    - `fetch_details` → dotiahne laps/splits (limitované MAX_FULL_DETAILS_PER_RUN).
    """
    ses = _get_session()

    # AFTER (epoch)
    after_epoch = 0
    since_iso_for_scan = "1970-01-01"
    last_dt = _max_saved_start(user_id)
    if last_dt:
        after_epoch = int(last_dt.timestamp())
        since_iso_for_scan = last_dt.strftime("%Y-%m-%d")
    elif force_last_days is not None:
        after_dt = datetime.now(timezone.utc) - timedelta(days=force_last_days)
        after_epoch = int(after_dt.timestamp())
        since_iso_for_scan = after_dt.strftime("%Y-%m-%d")

    existing = _existing_ids(user_id, since_iso_for_scan)

    imported = updated = skipped = fetched = 0
    to_upsert: list[dict[str, Any]] = []

    print(f"[SYNC] user={user_id} after_epoch={after_epoch} (since={since_iso_for_scan})")

    page = 1
    while True:
        r = ses.get(
            f"{STRAVA_BASE}/athlete/activities",
            params={"after": after_epoch, "per_page": 100, "page": page},
            timeout=30,
        )
        r.raise_for_status()
        items: list[dict[str, Any]] = r.json() or []
        if not items:
            break

        fetched += len(items)
        print(f"[SYNC] page={page} fetched={len(items)} (total={fetched})")

        for a in items:
            row = _normalize_summary(user_id, a)
            aid = int(row["activity_id"]) if row.get("activity_id") else None
            if not aid:
                skipped += 1
                continue

            if aid in existing:
                updated += 1
            else:
                imported += 1
                existing.add(aid)

            to_upsert.append(row)

        # dávkuj upserty
        if len(to_upsert) >= 200:
            _upsert_many(TABLE_ACTIVITIES_SUMMARY, to_upsert, on_conflict="activity_id")
            print(f"[SYNC] upsert batch summary rows={200}")
            to_upsert.clear()

        page += 1
        time.sleep(0.1)  # šetrenie

    if to_upsert:
        _upsert_many(TABLE_ACTIVITIES_SUMMARY, to_upsert, on_conflict="activity_id")
        print(f"[SYNC] upsert remaining summary rows={len(to_upsert)}")
        to_upsert.clear()

    # ---------- detaily (laps/splits) ----------
    if fetch_details and fetched:
        ids_rows = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("activity_id")
            .eq("user_id", user_id)
            .gte("date", since_iso_for_scan)
            .order("date", desc=True)
            .limit(MAX_FULL_DETAILS_PER_RUN)
            .execute()
        )
        ids = [int(r["activity_id"]) for r in (ids_rows.data or [])]
        print(f"[SYNC] fetching details for last {len(ids)} activities")

        for aid in ids:
            # LAPS
            try:
                rl = ses.get(f"{STRAVA_BASE}/activities/{aid}/laps", timeout=30)
                rl.raise_for_status()
                laps = rl.json() or []
                for L in laps:
                    Lrow = _normalize_lap(L, user_id, aid)
                    supabase.table(TABLE_ACTIVITIES_LAPS).upsert(
                        Lrow, on_conflict="activity_id,lap_index"
                    ).execute()
            except Exception as e:
                print(f"[SYNC] laps failed id={aid}: {e}")
                skipped += 1

            # SPLITS (z detailu)
            try:
                rd = ses.get(f"{STRAVA_BASE}/activities/{aid}", timeout=30)
                rd.raise_for_status()
                detail = rd.json() or {}
                for idx, S in enumerate(detail.get("splits_metric") or []):
                    Srow = _normalize_split(S, user_id, aid, idx + 1)
                    supabase.table(TABLE_ACTIVITIES_SPLITS).upsert(
                        Srow, on_conflict="activity_id,split_index"
                    ).execute()
            except Exception as e:
                print(f"[SYNC] splits failed id={aid}: {e}")
                skipped += 1

            time.sleep(0.1)

    print(f"[SYNC] done: imported={imported} updated={updated} skipped={skipped} fetched={fetched}")
    return {
        "imported": int(imported),
        "updated": int(updated),
        "skipped": int(skipped),
        "fetched": int(fetched),
    }


# -----------------------------------------------------------------------------
# LEGACY / STARŠIE FUNKCIE (NEPOUŽÍVAJÚ SA) – ponechané pre prípadnú migráciu.
# Na želanie sú komplet zachované, ale KOMENTOVANÉ, aby nerušili.
# -----------------------------------------------------------------------------
r"""
# --- (LEGACY) z pôvodného súboru --------------------------------------------

import Modules.API.Strava as api_strava
import Modules.SQL.data_manager as sql_dm

# ochrana pred 429 (detaily si vieme dávkovať)
MAX_FULL_DETAILS_PER_RUN = 150

def _get_last_saved_utc(user_id: int) -> datetime | None:
    res = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
        .select("date")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    row = res.data[0] if res.data else None
    if not row:
        return None
    s = (row.get("date") or "")[:19]
    if "T" not in s:
        s = s + "T00:00:00"
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)

def _get_strava_session(user_id: int) -> requests.Session:
    token = _load_access_token_for_user(user_id)  # TODO: implementuj podľa seba
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {token}"})
    return sess

def _save_summary_rows(user_id: int, items: Iterable[dict[str, Any]]) -> tuple[int, int, int]:
    imported = updated = skipped = 0
    for it in items:
        activity_id = it.get("id")
        if not activity_id:
            skipped += 1
            continue
        row = {
            "user_id": user_id,
            "activity_id": activity_id,
            "name": it.get("name"),
            "sport_type": it.get("sport_type"),
            "distance_m": it.get("distance"),
            "moving_time_s": it.get("moving_time"),
            "average_heartrate_bpm": it.get("average_heartrate"),
            "max_heartrate_bpm": it.get("max_heartrate"),
            "date": it.get("start_date"),
        }
        existing = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("activity_id")
            .eq("activity_id", activity_id)
            .limit(1)
            .execute()
        ).data
        if existing:
            supabase.table(TABLE_ACTIVITIES_SUMMARY).update(row).eq("activity_id", activity_id).execute()
            updated += 1
        else:
            supabase.table(TABLE_ACTIVITIES_SUMMARY).insert(row).execute()
            imported += 1
    return imported, updated, skipped

def _get_full_with_retry(activity_id: int, include_all_efforts=True, max_retries=3):
    tries = 0
    while True:
        try:
            return api_strava.get_activity_full(
                activity_id, include_all_efforts=include_all_efforts
            )
        except requests.HTTPError as e:
            if (
                e.response is not None
                and e.response.status_code == 429
                and tries < max_retries
            ):
                wait = (15 * 60 if tries == max_retries - 1 else 60 * (2**tries))
                print(f"⏳ 429 Too Many Requests. Čakám {wait}s a skúšam znova ...")
                time.sleep(wait)
                tries += 1
                continue
            raise

def is_429(err: Exception) -> bool:
    if isinstance(err, requests.exceptions.HTTPError) and err.response is not None:
        return err.response.status_code == 429
    msg = str(err).lower()
    return "429" in msg and "too many" in msg

def _to_epoch_utc(dt: datetime | str | None) -> int:
    if not dt:
        return 0
    if isinstance(dt, str):
        s = dt.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return int(max(0, dt.timestamp()))

def _iso_date(s: str | None) -> str:
    if not s:
        return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
    try:
        s2 = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s2)
    except Exception:
        return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
    return dt.strftime("%Y-%m-%dT%H:%M:%S")

def _load_access_token_for_user(user_id: int) -> str:
    raise NotImplementedError("Doplň získanie Strava access tokenu pre usera.")

# ===============================
# Sync pre okno (mesiac)
# ===============================
def sync_activities_for_window(
    user_id: int, after_dt: datetime, before_dt: datetime, archive_raw: bool = False
) -> int:
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
                print(f"💾 {saved:03d}  Uložené: {full.get('name')} [...]")
            continue

        decision = api_strava.decide_laps_or_splits(activity_id)
        mode = decision.get("mode")

        if mode == "laps" and decision.get("laps"):
            sql_dm.replace_activity_laps(user_id, activity_id, decision["laps"])
            rows_flag = True
        else:
            sql_dm.replace_activity_splits(user_id, activity_id, decision.get("splits") or [])
            rows_flag = True

        if archive_raw:
            sql_dm.archive_activity_raw(user_id, activity_id, full)

        if ok_summary:
            saved += 1
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

def sync_history(
    user_id: int,
    from_date: datetime,
    to_date: datetime,
    window_months: int = 1,
    archive_raw: bool = False,
    use_checkpoint: bool = True,
    wait_minutes_on_429: int = 16,
    pause_between_months_s: int = 0,
) -> int:
    return 0

def cache_streams_for_activity(
    user_id: int, activity_id: int, activity_date: str | None = None
) -> bool:
    return False
"""