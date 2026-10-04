# Services/AI/advisor_review/builders.py
"""
Kontext pre hodnotenie týždňa v advisor režime.

ČO SEM PATRÍ: plán týždňa, čo z neho bolo odcvičené, objem na svalové
partie, preteky a cieľ z prefs, a POSLEDNÝ ULOŽENÝ athlete state.

ČO SEM NEPATRÍ: nič, čo by znamenalo počítať trénovanosť nanovo - žiadne
laps, splits, segmenty, PB ani recovery rawdata. Advisor nehodnotí, aký si
športovec, to už vie z athlete state. Hodnotí, či je plán dobre poskladaný.
Vďaka tomu je kontext rádovo menší než pri athlete state.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from Configs.activity_load import activity_load_hint, read_event_structure
from Configs.strength_catalog import get_exercise
from DB.coach_plan_daily import db_get_planned_range_rows
from DB.coach_plan_meta import db_get_active_plan_meta_for_user
from Modules.Supabase.auth import AuthCtx
from Services.user_prefs import service_load_coach_prefs_for_analysis

# Náhľad na nasledujúci týždeň - ak už tam athlete niečo naplánoval,
# má zmysel to skontrolovať spolu so zvyškom tohto týždňa.
NEXT_WEEK_PREVIEW = True

# Koľko dní dozadu pozerať na reálne odcvičené aktivity (mimo plánu).
ACTIVITY_LOOKBACK_DAYS = 14


def _part_seconds(part: Dict[str, Any]) -> Optional[int]:
    """Sekundy časti intervalu - duration_s, fallback z minutes."""
    if part.get("duration_s") is not None:
        try:
            return int(part["duration_s"])
        except (TypeError, ValueError):
            return None
    if part.get("minutes") is not None:
        try:
            return int(round(float(part["minutes"]) * 60))
        except (TypeError, ValueError):
            return None
    return None


def _compact_structure(sport: str, structure: Any) -> Optional[Dict[str, Any]]:
    """
    Zhustená štruktúra session. Silové cviky idú s menom (nie exercise_id),
    intervaly v sekundách alebo metroch.

    🌟 NOVÉ: sport="other" nie je tréning, ale INÁ AKTIVITA / UDALOSŤ -
    svadba, teambuilding, sťahovanie, futbal mimo plánu. Má vlastný druh
    a náročnosť, ktoré sem musia prejsť, inak AI nevie, čo athléta reálne
    unaví a odporučí dlhý beh na deň po svadbe.
    """
    if not isinstance(structure, dict):
        return None

    if sport == "strength":
        exercises: List[Dict[str, Any]] = []
        for block in ("activation", "strength_main_part", "add_ons"):
            for ex in structure.get(block) or []:
                if not isinstance(ex, dict) or not ex.get("exercise_id"):
                    continue
                meta = get_exercise(str(ex["exercise_id"])) or {}
                exercises.append({
                    "name": meta.get("name_en") or str(ex["exercise_id"]),
                    "sets": ex.get("sets"),
                    "reps": ex.get("reps"),
                })
        return {"exercises": exercises} if exercises else None

    # Iná aktivita / udalosť
    event = read_event_structure(structure)
    if event:
        out_ev: Dict[str, Any] = {
            "event_kind": event["kind"],
            "load": event["load"],
            "load_hint": activity_load_hint(event["load"]),
            "counts_as_training": event["counts_as_training"],
        }
        if event.get("description"):
            out_ev["description"] = event["description"]
        return out_ev

    main_out: List[Dict[str, Any]] = []
    for b in structure.get("main_part") or []:
        if not isinstance(b, dict):
            continue
        if b.get("kind") == "interval_block":
            work = b.get("work") or {}
            rest = b.get("rest") or {}
            main_out.append({
                "rounds": b.get("rounds"),
                "work_s": _part_seconds(work) if work.get("distance_m") is None else None,
                "work_m": work.get("distance_m"),
                "rest_s": _part_seconds(rest) if rest.get("distance_m") is None else None,
                "rest_m": rest.get("distance_m"),
                "notes": str(work.get("notes") or "")[:80] or None,
            })
        else:
            main_out.append({
                "minutes": b.get("minutes"),
                "notes": str(b.get("notes") or "")[:80] or None,
            })

    out: Dict[str, Any] = {"main": main_out}
    wu = (structure.get("warmup") or {}).get("minutes")
    cd = (structure.get("cooldown") or {}).get("minutes")
    if wu:
        out["warmup_min"] = wu
    if cd:
        out["cooldown_min"] = cd
    return out


def _build_plan_block(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Plán v rámci AKTUÁLNEHO kalendárneho týždňa (pondelok-nedeľa).

    past_days      = pondelok .. včera (malo byť odcvičené)
    upcoming_days  = dnes .. nedeľa (ešte čaká)
    next_week      = nasledujúci týždeň, ak už tam niečo je

    V nedeľu teda past_days pokryje pondelok až sobotu - hodnotí sa celý
    týždeň. V stredu je to pondelok-utorok dozadu a streda-nedeľa dopredu,
    takže AI vie, že týždeň ešte beží a nesmie ho súdiť ako uzavretý.

    Riadky zahŕňajú aj iné aktivity a udalosti (sport="other"), ktoré sa
    do plánu dostali ručne alebo zlúčením z externých aktivít.
    """
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta:
        return {"has_active_plan": False}

    today = date.today()
    today_iso = today.isoformat()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    next_week_start = week_start + timedelta(days=7)
    next_week_end = next_week_start + timedelta(days=6)

    date_to = next_week_end if NEXT_WEEK_PREVIEW else week_end

    rows = db_get_planned_range_rows(
        user_id=user_id,
        plan_meta_id=meta.get("id"),
        date_from=week_start.isoformat(),
        date_to=date_to.isoformat(),
        ctx=ctx,
    ) or []

    # Externé aktivity z prefs - opakujúce sa veci (futbal v stredu, tanec
    # v piatok). Nie sú v coach_plan_daily, takže sa pridávajú tu.
    rows = rows + _external_event_rows(
        user_id, date_from=week_start, date_to=date_to, ctx=ctx
    )

    past: List[Dict[str, Any]] = []
    upcoming: List[Dict[str, Any]] = []
    next_week: List[Dict[str, Any]] = []

    for r in rows:
        d = str(r.get("plan_date") or "")[:10]
        if not d:
            continue
        try:
            d_obj = date.fromisoformat(d)
        except ValueError:
            continue

        sport = str(r.get("sport") or "other")

        status = r.get("status") or "planned"
        if r.get("activity_id"):
            status = "done"
        elif d < today_iso and status == "planned":
            status = "not_done"

        item = {
            "date": d,
            "weekday": d_obj.strftime("%a"),
            "sport": sport,
            "title": r.get("title"),
            "duration_min": r.get("duration_min"),
            "session_type": r.get("session_type"),
            "status": status,
            "structure": _compact_structure(sport, r.get("structure")),
        }
        if r.get("is_external"):
            item["is_external"] = True

        if d_obj > week_end:
            next_week.append(item)
        elif d < today_iso:
            past.append(item)
        else:
            upcoming.append(item)

    for lst in (past, upcoming, next_week):
        lst.sort(key=lambda x: (x["date"], str(x.get("title") or "")))

    out: Dict[str, Any] = {
        "has_active_plan": True,
        "today": today_iso,
        "today_weekday": today.strftime("%a"),
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "days_left_in_week": (week_end - today).days,
        "plan_end_date": str(meta.get("end_date") or "")[:10] or None,
        "past_days": past,
        "upcoming_days": upcoming,
    }
    if next_week:
        out["next_week"] = {
            "week_start": next_week_start.isoformat(),
            "sessions": next_week,
        }
    return out


def _external_event_rows(
    user_id: int, *, date_from: date, date_to: date, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """
    🌟 NOVÉ: opakujúce sa externé aktivity z prefs ako riadky plánu.

    Žijú v coach_external_events, nie v coach_plan_daily - preto sa sem
    pridávajú až pri čítaní. Tvar je zhodný s riadkom plánu, aby s nimi
    ostatný kód nemusel pracovať zvlášť.
    """
    try:
        from Services.coach_external_events import service_list_external_events_window

        res = service_list_external_events_window(
            user_id=user_id,
            from_iso=date_from.isoformat(),
            to_iso=date_to.isoformat(),
            ctx=ctx,
        )
        occurrences = res.get("occurrences") or []
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR][builder] external events failed: {repr(e)}")
        return []

    out: List[Dict[str, Any]] = []
    for ev in occurrences:
        if not isinstance(ev, dict):
            continue
        d = str(ev.get("occurrence_date") or "")[:10]
        if not d:
            continue

        # Externá aktivita so športom je tréning, životná udalosť (svadba,
        # cestovanie) nie - tá nesie štruktúru udalosti s náročnosťou,
        # ktorú user zadal (viď external_event_structure).
        sport = str(ev.get("sport") or "").strip() or "other"
        ev_structure = ev.get("structure") if isinstance(ev.get("structure"), dict) else None
        ev_kind = ((ev_structure or {}).get("event") or {}).get("kind")
        structure: Optional[Dict[str, Any]] = ev_structure if ev_kind and ev_kind != "sport" else None

        out.append({
            "plan_date": d,
            "sport": sport,
            "title": ev.get("title") or "Externá aktivita",
            "duration_min": ev.get("duration_min"),
            "session_type": "external_event",
            "status": "planned",
            "structure": structure,
            "is_external": True,
        })
    return out


def _build_done_activities_block(user_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """
    Čo athlete reálne odcvičil za posledné 2 týždne - vrátane aktivít,
    ktoré v pláne neboli vôbec. Bez segmentov a splitov; tu nejde o
    hodnotenie výkonu, len o to, či sedí štruktúra týždňa.
    """
    try:
        from DB.activities_summary import (
            db_get_recent_activity_ids,
            db_get_summary_for_activities,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR][builder] activities import failed: {repr(e)}")
        return []

    today = date.today()
    since = (today - timedelta(days=ACTIVITY_LOOKBACK_DAYS)).isoformat()

    try:
        ids = db_get_recent_activity_ids(
            user_id=user_id, since_iso_date=since, limit=25, ctx=ctx
        )
        if not ids:
            return []
        rows = db_get_summary_for_activities(
            user_id=user_id, activity_ids=ids, ctx=ctx
        ) or []
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR][builder] activities fetch failed: {repr(e)}")
        return []

    out: List[Dict[str, Any]] = []
    for r in sorted(rows, key=lambda x: str(x.get("date") or ""), reverse=True):
        d = str(r.get("date") or "")[:10]
        if not d:
            continue
        moving_s = r.get("moving_time_s")
        dist_m = r.get("distance_m")
        try:
            d_obj = date.fromisoformat(d)
            weekday = d_obj.strftime("%a")
        except ValueError:
            weekday = None

        out.append({
            "date": d,
            "weekday": weekday,
            "sport": r.get("sport_type_fe") or r.get("sport_type"),
            "duration_min": round(float(moving_s) / 60) if moving_s else None,
            "distance_km": round(float(dist_m) / 1000, 1) if dist_m else None,
            "avg_hr": r.get("average_heartrate_bpm"),
        })
    return out


def _build_muscle_volume_block(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """
    Objem na svalové partie - to isté, čo athlete vidí v karte "Objem na
    partie". Advisor tak hovorí rovnakou rečou ako UI.
    """
    try:
        from Services.strength_sessions import service_get_muscle_volume_overview

        vol = service_get_muscle_volume_overview(user_id=user_id, weeks_back=4, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR][builder] muscle volume failed: {repr(e)}")
        return None

    muscles = [
        {
            "muscle": m["muscle"],
            "sets_done": m["sets_this_week"],
            "sets_planned": m["sets_planned"],
            "target": m["target"],
            "status": m["status"],
        }
        for m in (vol.get("muscles") or [])
        if m["sets_this_week"] > 0 or m["sets_planned"] > 0
    ]
    if not muscles:
        return None

    return {
        "goal": vol.get("goal"),
        "run_volume_tier": vol.get("run_volume_tier"),
        "muscles": muscles,
    }


def _days_until(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    try:
        return (date.fromisoformat(str(date_str)[:10]) - date.today()).days
    except Exception:  # noqa: BLE001
        return None


def _build_goal_block(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """Cieľ a najbližšie preteky - voči čomu sa plán hodnotí."""
    try:
        prefs = service_load_coach_prefs_for_analysis(user_id, ctx=ctx) or {}
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR][builder] prefs failed: {repr(e)}")
        return {}

    run = ((prefs.get("targets") or {}).get("run") or {})
    races_out: List[Dict[str, Any]] = []
    for r in (run.get("races") or []):
        if not isinstance(r, dict):
            continue
        d = r.get("date") or r.get("start_date")
        days = _days_until(d)
        if days is None or days < 0:
            continue
        races_out.append({
            "name": r.get("name"),
            "days_until": days,
            "distance_km": r.get("custom_distance_km"),
            "elevation_gain_m": r.get("elevation_gain_m"),
            "terrain": r.get("terrain"),
            "race_type": r.get("race_type"),
            "priority": r.get("priority"),
            "target_time": r.get("target_time"),
        })
    races_out.sort(key=lambda x: x["days_until"])

    prefs_block = prefs.get("preferences") or {}
    strength = prefs.get("strength_settings") or {}

    return {
        "main_sport": prefs.get("main_sport"),
        "race_goal": run.get("race_goal"),
        "races": races_out[:3],
        "days_off": prefs_block.get("days_off") or [],
        "long_run_days": prefs_block.get("long_run_days") or [],
        "avoid_back_to_back_hard": prefs_block.get("avoid_back_to_back_hard"),
        "strength_sessions_per_week": strength.get("sessions_per_week"),
        "strength_volume_goal": strength.get("volume_goal"),
    }


def _build_state_block(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """
    POSLEDNÝ ULOŽENÝ athlete state - advisor si trénovanosť nepočíta, len
    ju prečíta. Berie len to, čo pri hodnotení plánu reálne potrebuje:
    únavu, riziko zranenia, tolerancie a odporúčaný blok. Žiadne tempá,
    VO2max ani odhady časov - tie plán neovplyvňujú.
    """
    try:
        from Services.AI.athlete_state.main import service_get_latest_athlete_state

        row = service_get_latest_athlete_state(user_id, version=1, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR][builder] athlete state failed: {repr(e)}")
        return None

    if not row:
        return None

    state = row.get("state") or {}
    ai_state = state.get("ai_state") or {}
    if not ai_state:
        return None

    created = row.get("created_at")
    age_days = None
    if created:
        try:
            dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - dt).days
        except Exception:  # noqa: BLE001
            age_days = None

    return {
        "age_days": age_days,
        "fatigue_level": ai_state.get("fatigue_level"),
        "injury_risk": ai_state.get("injury_risk"),
        "volume_tolerance": ai_state.get("volume_tolerance"),
        "intensity_tolerance": ai_state.get("intensity_tolerance"),
        "suggested_block_kind": ai_state.get("suggested_block_kind"),
        "capabilities": ai_state.get("capabilities"),
    }


def _build_health_block(user_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Aktívne zdravotné záznamy - bez nich nemá zmysel hodnotiť tvrdý týždeň."""
    try:
        from DB.user_health_log import db_get_active_health_logs

        rows = db_get_active_health_logs(user_id, ctx=ctx) or []
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR][builder] health logs failed: {repr(e)}")
        return []

    return [
        {
            "event_type": r.get("event_type"),
            "severity": r.get("severity"),
            "start_date": str(r.get("start_date") or "")[:10],
            "notes": (r.get("notes") or None),
        }
        for r in rows
    ]


def build_advisor_review_input(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Kompletný kontext pre hodnotenie týždňa. Rádovo menší než athlete state
    input - žiadne laps, splits, segmenty, PB ani recovery rawdata.
    """
    out: Dict[str, Any] = {
        "schema_version": 1,
        "plan": _build_plan_block(user_id, ctx=ctx),
        "goal": _build_goal_block(user_id, ctx=ctx),
        "done_activities": _build_done_activities_block(user_id, ctx=ctx),
    }

    muscle = _build_muscle_volume_block(user_id, ctx=ctx)
    if muscle:
        out["muscle_volume"] = muscle

    state = _build_state_block(user_id, ctx=ctx)
    if state:
        out["athlete_state"] = state

    health = _build_health_block(user_id, ctx=ctx)
    if health:
        out["active_health_issues"] = health

    return out
