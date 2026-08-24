# Services/activities_wrapped.py
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx

from DB.activities_wrapped import (
    db_insert_activities_wrapped_trigger,
    db_get_active_trigger_for_user,
    db_get_latest_trigger_for_user,
    db_trigger_exists,
    db_insert_activities_wrapped_summary,
    db_list_activities_wrapped_summaries_for_user,
    db_get_activities_wrapped_summary_by_id,
    db_list_all_user_ids_with_prefs,
)
from DB.activities_summary import db_get_activities_recent
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.notifications import service_notify_activities_wrapped_unlocked

RACE_WINDOW_BEFORE_DAYS = 4   # pretek o x dni alebo menej -> odomkni
RACE_WINDOW_AFTER_DAYS = 4    # pretek pred max x dňami -> stále odomknuté
TRIGGER_VALID_DAYS = 8       # ako dlho zostáva trigger aktívny od vytvorenia (cron)

# 🌟 Ktoré metriky dávajú pre daný šport zmysel - beh sa meria tempom
# (min/km), bicykel rýchlosťou (km/h). Iné športy (plávanie, posilňovanie,
# ostatné) egal jednotku nemajú, tak sa im pace/speed jednoducho nepočíta.
PACE_SPORTS = {"run"}
SPEED_SPORTS = {"ride"}


def _canonical_sport(s: Any) -> str:
    """
    🌟 ZJEDNODUŠENÉ: sport_type_fe je už normalizovaný, pre FE pripravený
    názov športu (single source of truth naprieč zdrojmi - Garmin/Apple/
    Whoop atď. by mali byť už zmapované na spoločné mená skôr, než sa
    dostanú sem). Táto funkcia už NEROBÍ žiadnu vlastnú heuristiku
    (žiadne "startswith", žiadne zlučovanie trail/run, žiadne lowercase
    normalizovanie) - len prevezme hodnotu tak, ako prišla, a použije ju
    priamo ako bucket kľúč. "other" je fallback len pre úplne chýbajúcu
    hodnotu.

    ĎALŠÍ KROK (zatiaľ NEROBENÉ tu): overiť, či sport_type_fe naozaj
    konzistentne mapuje naprieč rôznymi zdrojmi (Garmin vs Apple Watch vs
    Whoop) na rovnaké mená - ak nie, treba to opraviť na strane, kde sa
    sport_type_fe napĺňa (import/sync pipeline), nie tu heuristikami.
    """
    if not s:
        return "other"
    v = str(s).strip()
    return v if v else "other"


# ============================================================
# STATUS (pre widget)
# ============================================================

def service_get_activities_wrapped_status(
    *, user_id: int, ctx: AuthCtx
) -> Dict[str, Any]:
    active_trigger = db_get_active_trigger_for_user(user_id, ctx=ctx)
    history = db_list_activities_wrapped_summaries_for_user(user_id, ctx=ctx)

    return {
        "can_generate": active_trigger is not None,
        "active_trigger": active_trigger,
        "history": history,
    }


# ============================================================
# GENEROVANIE (len keď je aktívny trigger)
# ============================================================

def service_generate_activities_wrapped(
    *,
    user_id: int,
    title: str,
    range_start: str,
    range_end: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    active_trigger = db_get_active_trigger_for_user(user_id, ctx=ctx)
    if not active_trigger:
        return {"ok": False, "reason": "no_active_trigger"}

    if not title or not title.strip():
        return {"ok": False, "reason": "missing_title"}

    try:
        d_from = date.fromisoformat(range_start[:10])
        d_to = date.fromisoformat(range_end[:10])
    except Exception:
        return {"ok": False, "reason": "invalid_date_range"}

    if d_from > d_to:
        return {"ok": False, "reason": "invalid_date_range"}

    activities = db_get_activities_recent(
        ctx=ctx, user_id=user_id, since_iso_date=d_from.isoformat()
    )
    activities = [
        a for a in activities
        if a.get("date") and str(a["date"])[:10] <= d_to.isoformat()
    ]

    hard_stats = _aggregate_activities(activities)

    row = {
        "user_id": user_id,
        "title": title.strip(),
        "range_start": d_from.isoformat(),
        "range_end": d_to.isoformat(),
        "hard_stats": hard_stats,
    }
    saved = db_insert_activities_wrapped_summary(row, ctx=ctx)
    if not saved:
        return {"ok": False, "reason": "save_failed"}

    return {"ok": True, "data": saved}


def _aggregate_activities(activities: List[Dict[str, Any]]) -> Dict[str, Any]:
    buckets: Dict[str, Dict[str, Any]] = {}
    overall_distance_m = 0.0
    overall_time_s = 0.0
    overall_elevation_m = 0.0
    overall_hr_sum = 0.0
    overall_hr_count = 0

    for a in activities:
        sport = _canonical_sport(a.get("sport_type_fe") or a.get("sport_type"))
        b = buckets.setdefault(sport, {
            "sport": sport,
            "count": 0,
            "distance_m_sum": 0.0,
            "moving_time_s_sum": 0.0,
            "elevation_m_sum": 0.0,
            "hr_sum": 0.0,
            "hr_count": 0,
        })
        b["count"] += 1

        try:
            dist_m = float(a.get("distance_m") or 0)
            b["distance_m_sum"] += dist_m
            overall_distance_m += dist_m
        except (TypeError, ValueError):
            pass

        try:
            time_s = float(a.get("moving_time_s") or 0)
            b["moving_time_s_sum"] += time_s
            overall_time_s += time_s
        except (TypeError, ValueError):
            pass

        try:
            elev = float(a.get("elevation_gain_m") or 0)
            b["elevation_m_sum"] += elev
            overall_elevation_m += elev
        except (TypeError, ValueError):
            pass

        # 🌟 FIX: predtým sa sem pripočítavala aj vzdialenosť/čas z "ride",
        # aby sa z toho ďalej dole spočítal JEDEN spoločný "overall pace" pre
        # beh+bicykel dokopy - to je fyzikálne nezmyselné (tempo min/km a
        # rýchlosť km/h sú iné jednotky, miešanie ich do jedného čísla dávalo
        # zavádzajúci výsledok). Overall pace sa už vôbec nepočíta - pozri
        # nižšie, kde je natvrdo None. Pace/rýchlosť majú zmysel len PER
        # ŠPORT (samostatné buckety nižšie), nikdy naprieč viacerými.

        hr = a.get("average_heartrate_bpm")
        if hr:
            try:
                b["hr_sum"] += float(hr)
                b["hr_count"] += 1
                overall_hr_sum += float(hr)
                overall_hr_count += 1
            except (TypeError, ValueError):
                pass

    by_sport: List[Dict[str, Any]] = []
    for b in buckets.values():
        dist_km = round(b["distance_m_sum"] / 1000.0, 2) if b["distance_m_sum"] else 0.0
        time_min = round(b["moving_time_s_sum"] / 60.0, 1) if b["moving_time_s_sum"] else 0.0

        avg_pace: Optional[int] = None
        avg_speed_kmh: Optional[float] = None
        if b["distance_m_sum"] > 0 and b["moving_time_s_sum"] > 0:
            dist_km_b = b["distance_m_sum"] / 1000.0
            # 🌟 Porovnanie case-insensitive - bucket kľúč (b["sport"]) sa
            # zobrazuje vo FE presne tak, ako prišiel v sport_type_fe (bez
            # akejkoľvek úpravy), ale klasifikácia pace/speed nesmie zlyhať
            # len kvôli inej veľkosti písmen naprieč zdrojmi (Garmin/Apple/
            # Whoop).
            sport_lower = b["sport"].lower()
            if sport_lower in PACE_SPORTS:
                avg_pace = round(b["moving_time_s_sum"] / dist_km_b)
            elif sport_lower in SPEED_SPORTS:
                time_h_b = b["moving_time_s_sum"] / 3600.0
                avg_speed_kmh = round(dist_km_b / time_h_b, 1) if time_h_b > 0 else None

        avg_hr = round(b["hr_sum"] / b["hr_count"]) if b["hr_count"] > 0 else None
        by_sport.append({
            "sport": b["sport"],
            "count": b["count"],
            "total_distance_km": dist_km,
            "total_time_min": time_min,
            "total_elevation_m": round(b["elevation_m_sum"]) if b["elevation_m_sum"] else 0,
            "avg_pace_s_per_km": avg_pace,
            "avg_speed_kmh": avg_speed_kmh,
            "avg_hr_bpm": avg_hr,
        })
    # 🌟 Zoradené podľa total_time_min zostupne - hlavný šport athléta
    # (typicky ten, čomu venuje najviac času) ide prvý. FE si toto poradie
    # aj tak nezávisle prepočítava, ale nech je konzistentné aj tu (napr. pre
    # iné budúce použitia tohto endpointu, admin panel a pod.).
    by_sport.sort(key=lambda x: x["total_time_min"], reverse=True)

    overall_avg_hr = round(overall_hr_sum / overall_hr_count) if overall_hr_count > 0 else None

    return {
        "count": len(activities),
        "total_distance_km": round(overall_distance_m / 1000.0, 2) if overall_distance_m else 0.0,
        "total_time_min": round(overall_time_s / 60.0, 1) if overall_time_s else 0.0,
        "total_elevation_m": round(overall_elevation_m) if overall_elevation_m else 0,
        # 🌟 FIX: natvrdo None - miešaný pace naprieč športmi sa už nepočíta
        # (pozri komentár vyššie v cykle). Pole ostáva v odpovedi kvôli
        # spätnej kompatibilite typu na FE, ale reálnu hodnotu už nikdy
        # neobsahuje.
        "avg_pace_s_per_km": None,
        "avg_hr_bpm": overall_avg_hr,
        "by_sport": by_sport,
    }


# ============================================================
# CRON: SCAN VŠETKÝCH USEROV, VYTVOR TRIGGERY
# ============================================================

def service_run_activities_wrapped_trigger_scan(*, ctx: AuthCtx) -> Dict[str, Any]:
    today = date.today()
    window_start = today - timedelta(days=RACE_WINDOW_AFTER_DAYS)
    window_end = today + timedelta(days=RACE_WINDOW_BEFORE_DAYS)

    user_ids = db_list_all_user_ids_with_prefs(ctx=ctx)
    created = 0
    checked = 0

    for uid in user_ids:
        try:
            prefs = service_load_coach_prefs_for_analysis(uid, ctx=ctx)
            targets = prefs.get("targets") or {}
            run_targets = targets.get("run") or {}
            races = run_targets.get("races") or []
            if not isinstance(races, list):
                continue

            for race in races:
                if not isinstance(race, dict):
                    continue
                race_date_raw = race.get("date")
                if not race_date_raw:
                    continue
                try:
                    race_date = date.fromisoformat(str(race_date_raw)[:10])
                except Exception:
                    continue

                checked += 1
                if not (window_start <= race_date <= window_end):
                    continue

                race_name = race.get("name") or "Pretek"

                if db_trigger_exists(
                    user_id=uid,
                    reason="race_window",
                    trigger_label=race_name,
                    trigger_date=race_date.isoformat(),
                    ctx=ctx,
                ):
                    continue

                expires_at = datetime.now(timezone.utc) + timedelta(days=TRIGGER_VALID_DAYS)
                db_insert_activities_wrapped_trigger(
                    {
                        "user_id": uid,
                        "reason": "race_window",
                        "trigger_label": race_name,
                        "trigger_date": race_date.isoformat(),
                        "expires_at": expires_at.isoformat(),
                    },
                    ctx=ctx,
                )
                created += 1

                # 🌟 NOVÉ: hneď ako sa userovi odomkne súhrn, pošli mu aj
                # push notifikáciu - nech sa o tom dozvie, nemusí čakať kým
                # si to sám všimne v appke.
                try:
                    service_notify_activities_wrapped_unlocked(
                        uid, ctx=ctx, trigger_label=race_name
                    )
                except Exception as e:  # noqa: BLE001
                    print(
                        f"[ACTIVITIES_WRAPPED][cron] notify failed for "
                        f"user_id={uid}: {repr(e)}"
                    )
        except Exception as e:  # noqa: BLE001
            print(f"[ACTIVITIES_WRAPPED][cron] user_id={uid} failed: {repr(e)}")

    return {"ok": True, "users_checked": len(user_ids), "races_checked": checked, "triggers_created": created}


# ============================================================
# ADMIN: MANUÁLNE ODOMKNUTIE PRE KONKRÉTNEHO USERA
# ============================================================

def service_admin_unlock_activities_wrapped(
    *,
    user_id: int,
    label: Optional[str] = None,
    valid_days: int = 14,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    valid_days = max(1, min(int(valid_days or 14), 365))
    expires_at = datetime.now(timezone.utc) + timedelta(days=valid_days)
    row = db_insert_activities_wrapped_trigger(
        {
            "user_id": user_id,
            "reason": "admin_manual",
            "trigger_label": label or "Manuálne odomknutie",
            "trigger_date": None,
            "expires_at": expires_at.isoformat(),
        },
        ctx=ctx,
    )
    if not row:
        return {"ok": False, "reason": "insert_failed"}
    return {"ok": True, "data": row}


def service_admin_get_trigger_status(
    *, user_id: int, ctx: AuthCtx
) -> Dict[str, Any]:
    """Pre admin panel - zobrazí aktuálny/posledný trigger a či je ešte platný."""
    active = db_get_active_trigger_for_user(user_id, ctx=ctx)
    latest = db_get_latest_trigger_for_user(user_id, ctx=ctx)
    return {
        "is_active": active is not None,
        "active_trigger": active,
        "latest_trigger": latest,
    }