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
from typing import Any, Dict, List, Optional, Tuple

from Configs.activity_load import activity_load_hint, read_event_structure
from Configs.strength_catalog import get_exercise
from DB.coach_plan_daily import db_get_planned_range_rows
from DB.coach_plan_meta import db_get_active_plan_meta_for_user
from Services.AI.utils.others import round_sets
from Modules.Supabase.auth import AuthCtx
from Services.user_prefs import service_load_coach_prefs_for_analysis

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


# Dni v jazyku usera. PREČO NIE "Mon".."Sun": model ich prepisoval do
# textu doslova ("futbal vo Wed"). Akuzatív je tvar po "v/vo" - model ho
# potom len použije.
_WEEKDAYS = {
    "sk": ["pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota", "nedeľa"],
    "cs": ["pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota", "neděle"],
    "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
}


def _weekday(d: date, lang: str) -> str:
    return _WEEKDAYS.get(lang, _WEEKDAYS["sk"])[d.weekday()]


def review_window(today: Optional[date] = None) -> Dict[str, Any]:
    """
    Ktorý týždeň sa hodnotí a ktorý plánuje.

    PREČO: v pondelok sa hodnotil "týždeň", ktorý práve začal (prázdny), a
    odporúčania na ďalší týždeň sa prekrývali s kontrolou zvyšku tohto.
      - po-st: hodnotí sa MINULÝ týždeň (celý), plánuje sa AKTUÁLNY
      - št-ne: hodnotí sa AKTUÁLNY týždeň, plánuje sa ĎALŠÍ
    """
    today = today or date.today()
    week_start = today - timedelta(days=today.weekday())
    if today.weekday() <= 2:
        mode = "previous_week"
        review_start, plan_start = week_start - timedelta(days=7), week_start
    else:
        mode = "current_week"
        review_start, plan_start = week_start, week_start + timedelta(days=7)
    return {
        "mode": mode,
        "today": today,
        "review_start": review_start,
        "review_end": review_start + timedelta(days=6),
        "plan_start": plan_start,
        "plan_end": plan_start + timedelta(days=6),
    }


def _build_plan_block(user_id: int, *, lang: str, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Plán rozdelený podľa review_window:
      reviewed_week.sessions = hodnotený týždeň (so stavom done / not_done /
                               planned, ak týždeň ešte beží)
      plan_week.sessions     = týždeň, pre ktorý sa radí - čo v ňom už je

    Riadky zahŕňajú aj iné aktivity a udalosti (sport="other") a externé
    aktivity z nastavení (zlúčené pri čítaní, s poznámkou usera).
    """
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta:
        return {"has_active_plan": False}

    w = review_window()
    today = w["today"]
    today_iso = today.isoformat()
    date_from = min(w["review_start"], w["plan_start"])
    date_to = max(w["review_end"], w["plan_end"])

    rows = db_get_planned_range_rows(
        user_id=user_id,
        plan_meta_id=meta.get("id"),
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        ctx=ctx,
    ) or []

    # Externé aktivity z prefs - opakujúce sa veci (futbal v stredu, tanec
    # v piatok). Nie sú v coach_plan_daily, takže sa pridávajú tu.
    rows = rows + _external_event_rows(
        user_id, date_from=date_from, date_to=date_to, ctx=ctx
    )

    reviewed: List[Dict[str, Any]] = []
    planned: List[Dict[str, Any]] = []

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
            "weekday": _weekday(d_obj, lang),
            "sport": sport,
            "title": r.get("title"),
            "duration_min": r.get("duration_min"),
            "session_type": r.get("session_type"),
            "status": status,
            "structure": _compact_structure(sport, r.get("structure")),
        }
        if r.get("is_external"):
            item["is_external"] = True
            if r.get("notes"):
                item["athlete_note"] = r.get("notes")

        if w["review_start"] <= d_obj <= w["review_end"]:
            reviewed.append(item)
        if w["plan_start"] <= d_obj <= w["plan_end"]:
            planned.append(item)

    for lst in (reviewed, planned):
        lst.sort(key=lambda x: (x["date"], str(x.get("title") or "")))

    return {
        "has_active_plan": True,
        "today": today_iso,
        "today_weekday": _weekday(today, lang),
        "review_mode": w["mode"],
        "reviewed_week": {
            "start": w["review_start"].isoformat(),
            "end": w["review_end"].isoformat(),
            "days_left": max(0, (w["review_end"] - today).days),
            "sessions": reviewed,
        },
        "plan_week": {
            "start": w["plan_start"].isoformat(),
            "end": w["plan_end"].isoformat(),
            "already_planned": planned,
        },
        "plan_end_date": str(meta.get("end_date") or "")[:10] or None,
    }


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
            "notes": ev.get("notes") or None,
            "duration_min": ev.get("duration_min"),
            "session_type": "external_event",
            "status": "planned",
            "structure": structure,
            "is_external": True,
        })
    return out


def _build_done_activities_block(user_id: int, *, lang: str, ctx: AuthCtx) -> List[Dict[str, Any]]:
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
            weekday = _weekday(d_obj, lang)
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


def fmt_minutes(m: Optional[float]) -> Optional[str]:
    """573 -> '9 h 33 min', 45 -> '45 min', 120 -> '2 h'."""
    if m is None:
        return None
    m = int(round(float(m)))
    h, mm = divmod(m, 60)
    if not h:
        return f"{mm} min"
    return f"{h} h" if not mm else f"{h} h {mm} min"


def _build_week_totals(
    done: List[Dict[str, Any]], *, start: date, end: date
) -> Dict[str, Any]:
    """
    Súčty za hodnotený týždeň z done_activities. PREČO V KÓDE: model sám
    sčítaval a delil zle (3 tréningy za 28 dní = "1,5 týždenne").
    """
    by_sport: Dict[str, Dict[str, Any]] = {}
    total = 0
    for a in done:
        try:
            d = date.fromisoformat(str(a.get("date") or "")[:10])
        except ValueError:
            continue
        if not (start <= d <= end):
            continue
        mins = int(a.get("duration_min") or 0)
        sport = str(a.get("sport") or "other")
        s = by_sport.setdefault(sport, {"sessions": 0, "minutes": 0})
        s["sessions"] += 1
        s["minutes"] += mins
        total += mins
    for s in by_sport.values():
        s["volume"] = fmt_minutes(s.pop("minutes"))
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total_volume": fmt_minutes(total),
        "by_sport": by_sport,
    }


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
            "sets_done": round_sets(m["sets_this_week"]),
            "sets_planned": round_sets(m["sets_planned"]),
            "target": round_sets(m["target"]),
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


def _build_goal_block(user_id: int, *, lang: str, ctx: AuthCtx) -> Dict[str, Any]:
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
        try:
            race_day = date.fromisoformat(str(d)[:10])
        except ValueError:
            continue
        # Do ktorého týždňa pretek padne - bez toho model plánoval kopce
        # a dlhý beh "v sobotu alebo nedeľu" priamo na deň preteku.
        w = review_window()
        week = (
            "plan_week" if w["plan_start"] <= race_day <= w["plan_end"]
            else "week_after_plan" if w["plan_end"] < race_day <= w["plan_end"] + timedelta(days=7)
            else "reviewed_week" if w["review_start"] <= race_day <= w["review_end"]
            else "this_week" if race_day - timedelta(days=race_day.weekday())
            == date.today() - timedelta(days=date.today().weekday())
            else "later"
        )
        races_out.append({
            "name": r.get("name"),
            "date": race_day.isoformat(),
            "weekday": _weekday(race_day, lang),
            "week": week,
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

    vol = ai_state.get("volume_tolerance") or {}
    inten = ai_state.get("intensity_tolerance") or {}
    vmin, vmax = vol.get("weekly_minutes_min"), vol.get("weekly_minutes_max")
    limits: Dict[str, Any] = {
        "hard_sessions_per_week_max": inten.get("hard_sessions_per_week_max"),
    }
    if vmin is not None and vmax is not None:
        # hotový text - advisor ho len dosadí, nepočíta si vlastný rozsah
        limits["weekly_volume"] = f"{fmt_minutes(vmin)} – {fmt_minutes(vmax)}"

    return {
        "age_days": age_days,
        "limits": limits,
        "fatigue_level": ai_state.get("fatigue_level"),
        "injury_risk": ai_state.get("injury_risk"),
        "suggested_block_kind": ai_state.get("suggested_block_kind"),
        "capabilities": ai_state.get("capabilities"),
    }


def _build_health_block(user_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """
    Zdravotné záznamy: aktívne + vyriešené za 14 dní (návrat po chorobe).
    Bez nich nemá zmysel hodnotiť tvrdý týždeň.
    """
    from Services.user_health_log import service_health_context_for_ai

    return service_health_context_for_ai(user_id, ctx=ctx)


# Koľko posledných rán recovery ide advisorovi - stačí na "ako sa mám teraz"
ADVISOR_RECOVERY_DAYS = 5


def _build_recovery_block(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """
    Ranné recovery (HRV, pokojový tep, spánok, faktory, poznámka) za
    posledné dni + baseline. PREČO: user mal v poznámkach k noci príznaky
    choroby, ale advisor ich nevidel a v texte ich nespomenul. Len pár
    posledných dní - trénovanosť z nich nepočíta, len vie, ako sa athlete má.
    """
    try:
        from Services.user_recovery import service_build_recovery_block_for_analysis

        rec = service_build_recovery_block_for_analysis(user_id, ctx=ctx) or {}
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR][builder] recovery failed: {repr(e)}")
        return None
    days = (rec.get("recent_days") or [])[:ADVISOR_RECOVERY_DAYS]
    if not days:
        return None
    return {
        "baseline_hrv_ms": rec.get("baseline_hrv_ms"),
        "baseline_rhr_bpm": rec.get("baseline_rhr_bpm"),
        "hrv_trend": rec.get("hrv_trend"),
        "recent_days": days,
    }


# Vstavané šablóny tréningov - zrkadlo FE features/coach/constants/
# sessionTemplates.ts (BUILTIN_SESSION_TEMPLATES). Pri zmene uprav obe.
# Krátke popisy zámerne: idú do každého hodnotenia, nech to nestojí tokeny.
BUILTIN_TEMPLATES: List[str] = [
    "easy_run: run, easy Z2 40 min",
    "recovery_run: run, very easy 30 min",
    "long_run: run, long easy 75 min",
    "tempo_run: run, 15 warm-up + 20 tempo + 10 cool-down",
    "intervals_400: run, 8x400 m",
    "vo2max_4x4: run, 4x4 min hard",
    "hill_repeats: run, 8x1 min uphill",
    "easy_ride: bike, easy 60 min",
    "easy_swim: swim, easy 30 min",
    "full_body_home: strength, bodyweight full body 30 min",
    "full_body_a: strength, full body with weights 50 min",
    "full_body_b: strength, full body with weights 50 min",
    "upper_body: strength, upper body 45 min",
    "lower_body: strength, legs 45 min",
    "core_stability: strength, core 20 min",
]
_BUILTIN_TEMPLATE_IDS = {s.split(":", 1)[0] for s in BUILTIN_TEMPLATES}
_MAX_OWN_TEMPLATES = 15


def _build_templates_block(user_id: int, *, ctx: AuthCtx) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """
    Šablóny, ktoré si user vie jedným ťuknutím pridať do plánu. AI ich
    priraďuje k odporúčaniam, aby nevymýšľala tréningy mimo knižnice.

    Vlastné šablóny dostanú krátke id (u1, u2...) - UUID by stálo tokeny.
    Druhá hodnota je mapa krátke id -> id pre FE ("b:easy_run" / "u:<uuid>").
    """
    id_map: Dict[str, str] = {tid: f"b:{tid}" for tid in _BUILTIN_TEMPLATE_IDS}
    own: List[str] = []
    try:
        from DB.user_prefs import db_get_pref_single

        row = db_get_pref_single(user_id=user_id, key="advisor.session_templates", ctx=ctx)
        items = ((row or {}).get("value") or {}).get("items") or []
        for it in items[:_MAX_OWN_TEMPLATES]:
            if not isinstance(it, dict) or not it.get("id") or not it.get("name"):
                continue
            short = f"u{len(own) + 1}"
            sport = ((it.get("data") or {}).get("sport")) or "other"
            own.append(f"{short}: {sport}, {str(it['name'])[:40]}")
            id_map[short] = f"u:{it['id']}"
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR][builder] templates failed: {repr(e)}")

    block: Dict[str, Any] = {"builtin": BUILTIN_TEMPLATES}
    if own:
        block["own"] = own
    return block, id_map


def build_advisor_review_input(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Kompletný kontext pre hodnotenie týždňa. Rádovo menší než athlete state
    input - žiadne laps, splits, segmenty, PB ani recovery rawdata.
    """
    try:
        from Services.user_prefs import service_load_user_settings

        settings = service_load_user_settings(ctx=ctx, user_id=user_id) or {}
    except Exception:  # noqa: BLE001
        settings = {}
    lang = str(settings.get("language") or "sk").lower()[:2]
    lang = lang if lang in _WEEKDAYS else "sk"

    done = _build_done_activities_block(user_id, lang=lang, ctx=ctx)
    w = review_window()
    out: Dict[str, Any] = {
        "schema_version": 1,
        "plan": _build_plan_block(user_id, lang=lang, ctx=ctx),
        "goal": _build_goal_block(user_id, lang=lang, ctx=ctx),
        "done_activities": done,
        "reviewed_week_totals": _build_week_totals(
            done, start=w["review_start"], end=w["review_end"]
        ),
    }

    muscle = _build_muscle_volume_block(user_id, ctx=ctx)
    if muscle:
        out["muscle_volume"] = muscle

    state = _build_state_block(user_id, ctx=ctx)
    if state:
        out["athlete_state"] = state

    health = _build_health_block(user_id, ctx=ctx)
    if health:
        out["health_records"] = health

    recovery = _build_recovery_block(user_id, ctx=ctx)
    if recovery:
        out["recovery"] = recovery

    templates, id_map = _build_templates_block(user_id, ctx=ctx)
    out["templates"] = templates
    # neposiela sa AI - main.py ho vyberie pred generovaním
    out["_template_id_map"] = id_map

    return out
