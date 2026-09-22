# Services/AI/daily_plan/prompts/common.py
"""
Zdieľané helpery pre celý prompts/ balík - bezpečné konverzie, dict
helpery, jazykové poznámky a minify_daily_context_for_ai (osekanie
context_payload pred odoslaním do AI).
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Tuple


def _safe_int(
    v: Any,
    default: int = 0,
    *,
    min_v: Optional[int] = None,
    max_v: Optional[int] = None,
) -> int:
    try:
        if v is None:
            out = default
        elif isinstance(v, (int, float)):
            out = int(v)
        elif isinstance(v, str):
            s = v.strip()
            out = int(float(s)) if s else default
        else:
            out = int(v)
    except Exception:
        out = default
    if min_v is not None and out < min_v:
        out = min_v
    if max_v is not None and out > max_v:
        out = max_v
    return out


def _as_dict(v: Any) -> Dict[str, Any]:
    return v if isinstance(v, dict) else {}


def _get_dict(d: Dict[str, Any], key: str) -> Dict[str, Any]:
    return _as_dict(d.get(key))


def _flatten_prefs(raw_prefs: Any) -> Dict[str, Any]:
    """Unwrapuje vnorený 'value' kľúč z prefs."""
    if isinstance(raw_prefs, dict) and isinstance(raw_prefs.get("value"), dict):
        return raw_prefs["value"]
    return raw_prefs if isinstance(raw_prefs, dict) else {}


def _remove_empty(d: Any) -> Any:
    """Rekurzívne vymaže None, [], {} — menej tokenov."""
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d


def _format_pace(seconds_per_km: Any) -> str:
    """Formátuje sekundy/km na mm:ss string."""
    if not isinstance(seconds_per_km, (int, float)) or seconds_per_km <= 0:
        return ""
    minutes = int(seconds_per_km) // 60
    seconds = int(seconds_per_km) % 60
    return f"{minutes}:{seconds:02d}"


def _days_until(date_str: Optional[str]) -> Optional[int]:
    """Počet dní do dátumu od dnes."""
    if not date_str:
        return None
    try:
        return (date.fromisoformat(str(date_str)[:10]) - date.today()).days
    except Exception:
        return None


def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    """Vráti (jazyk_label, pravidlo_oslovovania)."""
    lang_code = str(settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        return "English", "Always speak directly to the athlete and use 'you'."
    if lang_code.startswith("cs"):
        return "Czech", "Vždy mluv přímo k atletovi a používej 2. osobu."
    return "Slovak", "Vždy hovor priamo k atlétovi a používej 2. osobu."


def _time_format_rule() -> str:
    """
    Spoločné pravidlo pre formátovanie akéhokoľvek trvania vo voľnom texte
    (notes, titles). Zabraňuje AI písať surové sekundy namiesto čitateľného formátu.
    """
    return (
        "- TIME/DURATION FORMAT: Never write raw seconds for any duration in `notes` or `title` "
        "(e.g. interval work/rest length). Always format as human-readable time: "
        "use 'M:SS' when under an hour (e.g. 90 seconds -> '1:30', 45 seconds -> '0:45'), "
        "and 'H:MM:SS' when an hour or more. Pace is always 'mm:ss/km'.\n"
    )


def _terminology_rule(lang_label: str) -> str:
    """
    Zabraňuje AI substitúcii sémanticky/foneticky podobných, ale nesprávnych
    slov v generovanom texte (notes, title) — bežná chyba LLM pri generovaní
    v slovenčine/češtine, keď si model "prehodí" podobne znejúce slovo.
    """
    return (
        "- WORD ACCURACY (CRITICAL): Use ONLY standard, correct sport/anatomy terminology "
        "in `title` and `notes`. Before finalizing any text, double-check every word is the "
        "one you actually meant — LLMs sometimes substitute a phonetically or visually similar "
        "but WRONG word (a known failure mode), especially in Slovak/Czech.\n"
        "  Examples of this exact mistake to AVOID:\n"
        "  - Slovak: 'nohy' (legs) MUST NOT become 'nohavice' (trousers/pants).\n"
        "  - Do not invent or drift into clothing, furniture, or unrelated nouns when describing "
        "body parts, muscle groups, or exercise focus areas.\n"
        f"  Re-read each generated {lang_label} sentence once and confirm every noun matches "
        "its intended meaning before including it in the output.\n"
    )


def _slim_strength_constraints(pc: Dict[str, Any]) -> Dict[str, Any]:
    """
    🌟 NOVÉ: silová kostra obsahuje polia pre backend/logy (name_en,
    load_type, unilateral, intensity_pct, rir, last_used_days_ago,
    rozpočty, warnings, ...). AI z nej potrebuje len to, čo kopíruje do
    výstupu (exercise_id, block, sets/reps/rest_s), čo používa pri
    rozmiestnení (pattern, tier) a na title/duration. Orezanie ušetrí
    ~55 % tokenov silovej kostry (3 sessiony: ~2.8k -> ~1.25k).
    Progresný kontext: AI používa len záznamy so should_progress=true.
    """
    out = dict(pc)
    plan = pc.get("strength_sessions_plan")
    if isinstance(plan, list):
        slim_plan: List[Dict[str, Any]] = []
        for sess in plan:
            if not isinstance(sess, dict):
                continue
            slim_plan.append({
                "template_name_en": sess.get("template_name_en"),
                "estimated_core_duration_min": sess.get("estimated_core_duration_min"),
                "estimated_total_duration_min": sess.get("estimated_total_duration_min"),
                "is_deload": True if sess.get("is_deload") else None,
                "exercises": [
                    {
                        "exercise_id": e.get("exercise_id"),
                        "block": e.get("block"),
                        "pattern": e.get("pattern"),
                        "tier": e.get("tier"),
                        "planned": {
                            k: (e.get("planned") or {}).get(k)
                            for k in ("sets", "reps", "rest_s")
                        },
                    }
                    for e in (sess.get("exercises") or [])
                    if isinstance(e, dict)
                ],
            })
        out["strength_sessions_plan"] = slim_plan

    prog = pc.get("strength_progression_context")
    if isinstance(prog, list):
        out["strength_progression_context"] = [
            {
                "exercise_id": p.get("exercise_id"),
                "should_progress": True,
                "last_weight_kg": p.get("last_weight_kg"),
                "suggested_weight_kg": p.get("suggested_weight_kg"),
            }
            for p in prog
            if isinstance(p, dict) and p.get("should_progress")
        ]
    return out


def minify_daily_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Osekáva daily context pred odoslaním do AI.

    Optimalizácie:
    - latest_paces: odstráni id, user_id, measured_at (DB metadata)
    - external_events: posiela len ak má reálne eventy (nie prázdny window)
    - recent_load: max 4 týždne namiesto 6-7
    - athlete_state: odstráni user_summary (dlhé texty nepotrebné pre daily)
      a plan_adjustment (nie je relevantný pre daily plánovač)
    - races: odstráni UUID id, pridá days_until_race
    - zones: posiela len run zóny (nie všetky sporty)
    - planning_constraints: posiela CELÝ blok tak, ako ho poslal builder -
      vrátane strength_sessions_plan / strength_progression_context (vrstva
      1+2 z build_daily_context_from_db) - tu netreba nič naviac robiť,
      _remove_empty() na konci sám vyhodí prázdny zoznam, ak žiadny
      strength tento týždeň nie je naplánovaný.
    """
    context = dict(context) if isinstance(context, dict) else {}
    ctx2: Dict[str, Any] = {}

    if "week" in context:
        ctx2["week"] = context["week"]

    zones_raw = context.get("zones")
    if isinstance(zones_raw, dict):
        ctx2["zones"] = zones_raw

    if "thresholds" in context:
        ctx2["thresholds"] = context["thresholds"]

    paces = context.get("latest_paces")
    if isinstance(paces, dict):
        ctx2["latest_paces"] = {
            k: v for k, v in paces.items()
            if k not in ("id", "user_id", "measured_at")
        }

    recent_load = context.get("recent_load")
    if isinstance(recent_load, dict):
        weeks = recent_load.get("weeks") or []
        trimmed_weeks = [
            w for w in weeks
            if isinstance(w, dict) and int(w.get("week_index_from_now", -99)) >= -4
        ]
        ctx2["recent_load"] = {**recent_load, "weeks": trimmed_weeks}

    if "recovery" in context:
        ctx2["recovery"] = context["recovery"]

    raw_prefs = context.get("prefs") or {}
    prefs = _flatten_prefs(raw_prefs)
    preferences = _get_dict(prefs, "preferences")
    volume = _get_dict(prefs, "volume")
    targets = _get_dict(prefs, "targets")

    ctx_targets: Dict[str, Any] = {}
    for sport_key, sport_val in targets.items():
        if not isinstance(sport_val, dict):
            continue
        if sport_key == "strength":
            ctx_targets["strength"] = {
                "focus": sport_val.get("focus"),
                "sessions_per_week": sport_val.get("sessions_per_week"),
            }
        else:
            races_raw = sport_val.get("races")
            races_clean = None
            if isinstance(races_raw, list):
                races_clean = []
                for r in races_raw:
                    if not isinstance(r, dict):
                        continue
                    race_date = r.get("date") or r.get("start_date")
                    races_clean.append({
                        "name": r.get("name"),
                        "date": race_date,
                        "days_until_race": _days_until(race_date),
                        "race_goal": r.get("race_goal"),
                        "race_type": r.get("race_type"),
                        "target_time": r.get("target_time"),
                        "custom_distance_km": r.get("custom_distance_km"),
                        "elevation_gain_m": r.get("elevation_gain_m"),
                        "terrain": r.get("terrain"),
                        "priority": r.get("priority"),
                    })
            ctx_targets[sport_key] = {
                "race_goal": sport_val.get("race_goal"),
                "race_type": sport_val.get("race_type"),
                "target_time": sport_val.get("target_time"),
                "races": races_clean,
            }

    ctx2["prefs"] = {
        "main_sport": prefs.get("main_sport"),
        "add_on_sports": prefs.get("add_on_sports"),
        "included_sports": prefs.get("included_sports"),
        "goal_kind": prefs.get("goal_kind"),
        "volume": {"mode": volume.get("mode"), "value": volume.get("value")} if volume else {},
        "preferences": {
            "days_off": preferences.get("days_off"),
            "long_run_days": preferences.get("long_run_days"),
            "avoid_two_a_day": preferences.get("avoid_two_a_day"),
            "avoid_back_to_back_hard": preferences.get("avoid_back_to_back_hard"),
        } if preferences else {},
        "targets": ctx_targets if targets else {},
    }

    athlete_state = context.get("athlete_state")
    if isinstance(athlete_state, dict):
        ai_state = dict(_as_dict(athlete_state.get("ai_state")))
        ai_state.pop("metrics", None)
        ai_state.pop("plan_adjustment", None)
        ctx2["athlete_state"] = {
            "ai_state": ai_state,
            "is_returning_beginner": athlete_state.get("is_returning_beginner"),
        }

    # 🌟 FIX: builder (_build_external_block) ukladá externé aktivity pod
    # kľúč "occurrences", no tento kód ich hľadal len pod "events" /
    # "window.events". Nenašiel nič a celý blok vyhodil - AI v prompte videla
    # "External events: 1", ale v CONTEXT_JSON žiadny event, takže ho nemala
    # kam naplánovať (napr. futbal v stredu vo výsledku chýbal). Teraz sa
    # číta "occurrences" (primárne), s fallbackom na staré tvary.
    ext = context.get("external_events")
    if isinstance(ext, dict):
        raw_events: List[Dict[str, Any]] = []
        for key in ("occurrences", "events"):
            if isinstance(ext.get(key), list):
                raw_events = [e for e in ext[key] if isinstance(e, dict)]
                break
        if not raw_events:
            win = ext.get("window")
            if isinstance(win, dict) and isinstance(win.get("events"), list):
                raw_events = [e for e in win["events"] if isinstance(e, dict)]

        if raw_events:
            cleaned_events: List[Dict[str, Any]] = []
            for e in raw_events:
                dt = (
                    e.get("occurrence_date")
                    or e.get("date")
                    or e.get("start_date_local")
                    or e.get("start_date")
                    or e.get("start_date_iso")
                )
                dt_ymd = str(dt)[:10] if dt else None
                base_fields = {
                    "sport": e.get("session_sport") or e.get("sport") or e.get("sport_raw"),
                    "sport_raw": e.get("sport_raw"),
                    "title": e.get("title"),
                    "duration_min": e.get("duration_min"),
                    "priority": e.get("priority"),
                    # 🌟 NOVÉ: intenzita a čas sú pre plánovanie okolo
                    # eventu podstatné (tvrdý futbal = žiadny kvalitný beh
                    # ani ťažké nohy v ten deň / deň predtým)
                    "intensity": e.get("intensity"),
                    "start_time_local": e.get("start_time_local"),
                    "allow_other_training": e.get("allow_other_training"),
                }
                dft = e.get("days_from_today")
                if dt_ymd is None and isinstance(dft, (int, float)):
                    cleaned_events.append({"days_from_today": int(dft), **base_fields})
                    continue
                if not dt_ymd:
                    continue
                cleaned_events.append({
                    "occurrence_date": dt_ymd,
                    "weekday": e.get("weekday"),
                    **base_fields,
                })

            win2 = ext.get("window")
            if isinstance(win2, dict):
                ctx2["external_events"] = {
                    "window": {
                        "from": str(win2.get("from"))[:10] if win2.get("from") else None,
                        "to": str(win2.get("to"))[:10] if win2.get("to") else None,
                        "events": cleaned_events,
                    }
                }
            else:
                ctx2["external_events"] = {"events": cleaned_events}
        # Ak nie sú žiadne eventy — external_events sa do ctx2 nevloží

    for k in ("week_meta", "replan_trigger", "generate_reason", "is_replan", "planning_constraints"):
        if k in context:
            ctx2[k] = context[k]
    # 🌟 NOVÉ: orezaná silová kostra (viď _slim_strength_constraints)
    if isinstance(ctx2.get("planning_constraints"), dict):
        ctx2["planning_constraints"] = _slim_strength_constraints(ctx2["planning_constraints"])

    coach_notes = context.get("coach_notes")
    if isinstance(coach_notes, dict):
        sticky = coach_notes.get("sticky_notes") or []
        ephemeral = coach_notes.get("ephemeral_note")
        if sticky or ephemeral:
            ctx2["coach_notes"] = {
                "sticky_notes": sticky,
                **({"ephemeral_note": ephemeral} if ephemeral else {}),
            }

    return _remove_empty(ctx2)