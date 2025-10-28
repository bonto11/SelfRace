# backend/Modules/Sync/sync_handler.py
from __future__ import annotations

import time
import requests
import statistics
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Iterable
from Modules.API.Strava.streams import fetch_and_optionally_store_batch
from Services.activity_zones import preview_zones_for_activities, upsert_enrichment_minutes
from Services.sport_type import infer_sport_type_fe

from Modules.SQL.db_handler import get_client
from Modules.API.Strava.auth import get_access_token
from backend.Configs.config import (
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
    
def clamp_int(v: int | None, lo: int = -32768, hi: int = 32767) -> int | None:
    if v is None:
        return None
    return max(lo, min(hi, v))

def to_int_rounded(v, default=None, clamp_smallint=False):
    if v is None or v == "":
        return default
    try:
        n = int(round(float(v)))
        return clamp_int(n) if clamp_smallint else n
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
def _num(v) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0

def _extract_dt_pairs_from_laps(laps_raw: list[dict]) -> list[tuple[float, float]]:
    # (distance_m, moving_time_s) z raw lapov
    out: list[tuple[float, float]] = []
    for L in laps_raw:
        d = _num(L.get("distance") or L.get("distance_m"))
        t = _num(L.get("moving_time") or L.get("moving_time_s"))
        if d > 0 and t > 0:
            out.append((d, t))
    return out

def _extract_dt_pairs_from_splits(splits_raw: list[dict]) -> list[tuple[float, float]]:
    # (distance_m, moving_time_s) zo splits_metric
    out: list[tuple[float, float]] = []
    for S in splits_raw:
        d = _num(S.get("distance") or S.get("distance_m"))
        t = _num(S.get("moving_time") or S.get("moving_time_s"))
        if d > 0 and t > 0:
            out.append((d, t))
    return out

def _match_ratio(laps_dt: list[tuple[float, float]], splits_dt: list[tuple[float, float]],
                 tol_m: float = 20.0, tol_s: float = 10.0) -> float:
    """
    Spáruje splits s najbližšími lapmi. Vráti pomer úspešne spárovaných párov.
    """
    if not laps_dt or not splits_dt:
        return 0.0

    used = set()
    matches = 0
    for (sd, st) in splits_dt:
        best_i = None
        best_err = 1e18
        for i, (ld, lt) in enumerate(laps_dt):
            if i in used:
                continue
            # preferujeme najmenší súčet chýb (ľahká heuristika)
            err = abs(ld - sd) + 3 * abs(lt - st)
            if err < best_err:
                best_err = err
                best_i = i
        if best_i is None:
            continue
        ld, lt = laps_dt[best_i]
        if abs(ld - sd) <= tol_m and abs(lt - st) <= tol_s:
            matches += 1
            used.add(best_i)

    denom = max(1, min(len(laps_dt), len(splits_dt)))
    return matches / denom

def _median_dist(laps_dt: list[tuple[float, float]]) -> float | None:
    if not laps_dt:
        return None
    try:
        return float(statistics.median([d for (d, _) in laps_dt]))
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

    sport_type = to_str(a.get("sport_type") or a.get("type"))
    name = to_str(a.get("name"))
    sport_type_fe = infer_sport_type_fe(sport_type, name, distance_m, moving_s)

    return {
        "user_id":                 user_id,
        "activity_id":             to_int(a.get("id")),
        "name":                    name,
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
        "sport_type":              sport_type,
        "sport_type_fe":           sport_type_fe,
        "gear_id":                 to_str(a.get("gear_id")),
        "gear_name":              to_str(a.get("gear_name")),            # ak chceš, vieš si dotiahnuť cez /gear a uložiť
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
    """Mapuje Strava lap -> activities_laps podľa tvojej schémy (SMALLINT fix)."""
    return {
        "user_id":             user_id,
        "activity_id":         to_int_rounded(l.get("activity_id") or activity_id),
        "lap_index":           to_int_rounded(l.get("lap_index"), clamp_smallint=True),

        # DB: text/timestamp with tz – nechávame string od Stravy
        "start_date_local":    l.get("start_date") or l.get("start_date_local"),

        # INT polia (v DB pravdepodobne int/smallint)
        "distance_m":          to_int_rounded(l.get("distance")),          # m
        "moving_time_s":       to_int_rounded(l.get("moving_time")),       # s
        "elapsed_time_s":      to_int_rounded(l.get("elapsed_time")),      # s
        "pace_s_per_km":       to_int_rounded(l.get("pace_s_per_km"), clamp_smallint=True),

        # FLOAT polia
        "total_elev_gain_m":   to_float(l.get("total_elevation_gain") or l.get("total_elev_gain_m")),
        "avg_speed_mps":       to_float(l.get("average_speed") or l.get("avg_speed_mps")),
        "max_speed_mps":       to_float(l.get("max_speed") or l.get("max_speed_mps")),
        "avg_cadence_rpm":     to_float(l.get("average_cadence") or l.get("avg_cadence_rpm")),
        "avg_watts":           to_float(l.get("average_watts") or l.get("avg_watts")),

        # HR v DB máš SMALLINT → nutné zaokrúhliť na celé a prípadne ohraničiť
        "avg_hr_bpm":          to_int_rounded(l.get("average_heartrate") or l.get("avg_hr_bpm"),
                                              clamp_smallint=True),
        "max_hr_bpm":          to_int_rounded(l.get("max_heartrate")      or l.get("max_hr_bpm"),
                                              clamp_smallint=True),
    }

def _normalize_split(s: dict, user_id: int, activity_id: int, idx1: int) -> dict:
    """Mapuje Strava splits_metric -> activities_splits (SMALLINT fix)."""
    return {
        "user_id":           user_id,
        "activity_id":       to_int_rounded(s.get("activity_id") or activity_id),
        "split_index":       to_int_rounded(s.get("split") or s.get("split_index") or idx1,
                                            clamp_smallint=True),

        # INT polia
        "distance_m":        to_int_rounded(s.get("distance")),
        "moving_time_s":     to_int_rounded(s.get("moving_time")),
        "elapsed_time_s":    to_int_rounded(s.get("elapsed_time")),
        "pace_s_per_km":     to_int_rounded(s.get("pace_s_per_km"), clamp_smallint=True),

        # FLOAT polia
        "elevation_diff_m":  to_float(s.get("elevation_difference") or s.get("elevation_diff_m")),
        "avg_speed_mps":     to_float(s.get("average_speed") or s.get("avg_speed_mps")),
        "avg_gap_mps":       to_float(s.get("average_grade_adjusted_speed") or s.get("avg_gap_mps")),

        # HR → SMALLINT v DB, Strava dáva často float → zaokrúhliť
        "avg_hr_bpm":        to_int_rounded(s.get("average_heartrate") or s.get("avg_hr_bpm"),
                                            clamp_smallint=True),
        # ak by si niekedy dopĺňal max HR na splits, urob rovnako:
        # "max_hr_bpm":     to_int_rounded(some_value, clamp_smallint=True),
    }

def _decide_laps_or_splits(laps_raw: list[dict], splits_raw: list[dict]) -> str:
    """
    Vráti 'splits' | 'laps' | 'none' podľa podobnosti.
    Pravidlá:
      - ak máme iba jeden typ -> ten
      - ak match_ratio >= 0.70 -> splits
      - fallback: ak median lap ≈ 1000 m a match_ratio >= 0.5 -> splits
      - inak -> laps
    """
    if not laps_raw and not splits_raw:
        return "none"
    if laps_raw and not splits_raw:
        return "laps"
    if splits_raw and not laps_raw:
        return "splits"

    laps_dt   = _extract_dt_pairs_from_laps(laps_raw)
    splits_dt = _extract_dt_pairs_from_splits(splits_raw)

    if not laps_dt and not splits_dt:
        return "none"
    if laps_dt and not splits_dt:
        return "laps"
    if splits_dt and not laps_dt:
        return "splits"

    ratio = _match_ratio(laps_dt, splits_dt, tol_m=20.0, tol_s=10.0)

    # silná zhoda -> splits
    if ratio >= 0.70:
        return "splits"

    # fallback: laps ~ 1km -> pravdepodobne bežné km splitovanie -> skôr splits
    med = _median_dist(laps_dt)
    if med is not None and 900.0 <= med <= 1100.0 and ratio >= 0.50:
        return "splits"

    # inak laps (intervaly / odlišné dĺžky)
    return "laps"

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

    # -------- detaily (laps/splits) --------
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
        ids = [int(r["activity_id"]) for r in ids_rows.data or []]

        for i, aid in enumerate(ids, start=1):
            try:
                # 1) načítaj surové dáta
                rl = ses.get(f"{STRAVA_BASE}/activities/{aid}/laps", timeout=30)
                rl.raise_for_status()
                laps_raw = rl.json() or []

                rd = ses.get(f"{STRAVA_BASE}/activities/{aid}", timeout=30)
                rd.raise_for_status()
                detail = rd.json() or {}
                splits_raw = detail.get("splits_metric") or []

                # 2) rozhodni režim
                mode = _decide_laps_or_splits(laps_raw, splits_raw)

                # 3) najprv vymaž “ten druhý typ”, aby nezostali staré záznamy
                if mode == "splits":
                    supabase.table(TABLE_ACTIVITIES_LAPS).delete().eq("activity_id", aid).execute()
                elif mode == "laps":
                    supabase.table(TABLE_ACTIVITIES_SPLITS).delete().eq("activity_id", aid).execute()

                # 4) ulož podľa režimu (normalizácia rieši smallint vs float)
                if mode == "splits":
                    for idx, S in enumerate(splits_raw, start=1):
                        row = _normalize_split(S, user_id, aid, idx)
                        supabase.table(TABLE_ACTIVITIES_SPLITS).upsert(
                            row, on_conflict="activity_id,split_index"
                        ).execute()
                elif mode == "laps":
                    for L in laps_raw:
                        row = _normalize_lap(L, user_id, aid)
                        supabase.table(TABLE_ACTIVITIES_LAPS).upsert(
                            row, on_conflict="activity_id,lap_index"
                        ).execute()
                else:
                    # nič na uloženie
                    pass

            except Exception as e:
                skipped += 1
                print(f"[SYNC] details failed id={aid}: {e}")

            time.sleep(0.1)

# -------- streams + enrichment zón --------
    try:
        ids_rows = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("activity_id")
            .eq("user_id", user_id)
            .gte("date", since_iso_for_scan)
            .order("date", desc=True)
            .limit(500)
            .execute()
        )
        ids_recent = [int(r["activity_id"]) for r in (ids_rows.data or [])]

        print(f"[SYNC] streams: fetching & storing for {len(ids_recent)} ids …")
        streams_res = fetch_and_optionally_store_batch(user_id, ids_recent, store=True)
        print(f"[SYNC] streams: stored={streams_res.get('stored')} / total={streams_res.get('count')}")

        # teraz výpočet minút v zónach (NECH fetch_if_missing=False, lebo streamy už máme v DB)
        print("[SYNC] zones: computing minutes from cached streams …")
        prev = preview_zones_for_activities(user_id, ids_recent, fetch_if_missing=False)

        # odfiltruj iba tie, ktoré skutočne majú 'minutes'
        to_save = [it for it in (prev.get("items") or []) if it.get("ok") and it.get("minutes")]
        saved = upsert_enrichment_minutes(user_id, to_save)
        print(f"[SYNC] zones: enrichment upsert saved rows = {saved.get('saved', 0)}")
    except Exception as e:
        print(f"[SYNC] zones enrichment failed: {e}")

    print(f"[SYNC] done: imported={imported} updated={updated} skipped={skipped} fetched={fetched}")
    return {
        "imported": int(imported),
        "updated": int(updated),
        "skipped": int(skipped),
        "fetched": int(fetched),
    }