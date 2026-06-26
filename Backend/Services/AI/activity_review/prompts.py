# Services/AI/activity_review/prompts.py
from __future__ import annotations

import json
from typing import Dict, Optional, Tuple, Any


# ============================================================
# HELPERS
# ============================================================

def _remove_empty(d: Any) -> Any:
    """Rekurzívne vymaže None, [], {} — znižuje počet tokenov v JSON payload."""
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d


def minify_activity_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Osekáva context_payload pred odoslaním do AI:
    - odstráni interné ID a debug polia
    - z histórie zachová sport, intensity, duration, avg_hr (AI potrebuje vedieť záťaž)
    - odstráni splits/laps/streams z histórie (sú len pre focus aktivitu)
    - odstráni legacy hr_zones_bpm (user_zones sú dostačujúce)
    - review_thread (ak existuje) ostáva — je to kontext na reply
    """
    out = json.loads(json.dumps(context, default=str))

    # Interné polia ktoré AI nepotrebuje
    u = out.get("user")
    if isinstance(u, dict):
        u.pop("id", None)
        u.pop("email", None)
    out.pop("_debug", None)

    # Z focus aktivity odstránime len interné ID (metriky zostanú)
    act = out.get("activity")
    if isinstance(act, dict):
        act.pop("activity_id", None)

    # História — zachováme sport, intensity, duration a avg_hr
    # AI musí vedieť či pred 3 dňami bol hard interval alebo easy Z2
    history = out.get("history", {})
    if isinstance(history, dict):
        for period in ("days_0_7", "days_8_14"):
            days = history.get(period, [])
            if not isinstance(days, list):
                continue
            for day in days:
                day.pop("activity_id", None)
                day.pop("splits_minified", None)
                day.pop("laps_minified", None)
                day.pop("streams_minified", None)
                # Zachováme kľúčové metriky — AI potrebuje vedieť záťaž, nie len dĺžku
                if "metrics" in day and isinstance(day["metrics"], dict):
                    day["metrics"] = {
                        "duration_min": day["metrics"].get("duration_min"),
                        "avg_hr_bpm": day["metrics"].get("avg_hr_bpm"),
                        "distance_km": day["metrics"].get("distance_km"),
                    }
                # sport a intensity zostávajú na roote dňa (nie v metrics)

    # Plan today a tomorrow — odstráni DB metadata, zachová len to čo AI potrebuje
    ctx_block = out.get("context", {})
    if isinstance(ctx_block, dict):
        ctx_block.pop("hr_zones_bpm", None)

        for plan_key in ("plan_today", "plan_tomorrow"):
            plan = ctx_block.get(plan_key)
            if isinstance(plan, dict):
                ctx_block[plan_key] = {
                    "sport": plan.get("sport"),
                    "title": plan.get("title"),
                    "duration_min": plan.get("duration_min"),
                    "notes": plan.get("notes"),
                    "status": plan.get("status"),
                    # intensity/load_phase ak existuje
                    "intensity": plan.get("intensity") or plan.get("session_type"),
                }

    return _remove_empty(out)


def _lang_notes(
    settings: Dict[str, Any], user_data: Optional[Dict[str, Any]] = None
) -> Tuple[str, str, str]:
    """
    Vráti (jazyk_label, pravidlo_oslovovania, health_reminder) podľa nastavení a profilu.
    Podporuje sk/cs/en s rodovými pravidlami.
    """
    lang = (settings.get("language") or "sk").lower()
    user_data = user_data or {}
    first_name = user_data.get("first_name")
    gender = user_data.get("gender")
    address_rule = ""
    health_reminder = ""

    if lang.startswith("en"):
        lang_label = "English"
        address_rule = "Use second person ('you'). Keep it punchy and expert-like. "
        health_reminder = (
            "Don't forget to log this health issue in the Health Log on your Dashboard "
            "so I can properly adjust your training plan."
        )
        if first_name:
            address_rule += f"Address the athlete by their first name: '{first_name}'. "

    elif lang.startswith("cs"):
        lang_label = "Czech"
        address_rule = "Používej 2. osobu (tykání) a mluv přímo k atletovi stručně a expertně. "
        health_reminder = (
            "Nezapomeň si tento zdravotní problém zaevidovat ve Zdravotní kartě na Nástěnce, "
            "abych ti mohl přizpůsobit tréninkový plán."
        )
        if first_name:
            address_rule += f"Oslovuj atlete jménem: '{first_name}'. "
        if gender == "female":
            address_rule += "DŮLEŽITÉ: Atletka je ŽENA. Používej ženský rod. "
        elif gender == "male":
            address_rule += "Atlet je MUŽ. Používej mužský rod. "

    else:  # Slovak default
        lang_label = "Slovak"
        address_rule = (
            "Používaj 2. osobu (tykanie) a hovor priamo k atlétovi ako expert. "
            "Vyjadruj sa stručne a úderne. "
        )
        health_reminder = (
            "Nezabudni si tento zdravotný problém zaevidovať v Zdravotnej karte na Nástenke, "
            "aby som ti mohol prispôsobiť tréningový plán."
        )
        if first_name:
            address_rule += f"Oslovuj atléta menom: '{first_name}'. "
        if gender == "female":
            address_rule += "DÔLEŽITÉ: Atlétka je ŽENA. Používaj výhradne ženský rod. "
        elif gender == "male":
            address_rule += "Atlét je MUŽ. Používaj mužský rod. "

    return lang_label, address_rule, health_reminder


def _canonical_sport(s: Any) -> str:
    """Normalizuje sport na run/ride/strength/swim/other."""
    if not s:
        return "other"
    v = str(s).lower().strip()
    if v in ("run", "trail", "trail_run") or v.startswith("run"):
        return "run"
    if v in ("ride", "bike", "cycle") or v.startswith(("ride", "bike", "cycle")):
        return "ride"
    if v in ("strength", "gym", "weights") or "strength" in v or "gym" in v:
        return "strength"
    if "swim" in v:
        return "swim"
    return "other"


def _system_prompt(sport: str, is_race: bool = False) -> str:
    """Vráti system prompt — pre race audit alebo štandardný review."""
    if is_race:
        return (
            "You are an Elite Performance Analyst. The athlete has performed an ALL-OUT RACE/TEST. "
            "Your primary mission is to audit their physiological thresholds (LTHR/FTP). "
            "You must be analytical, precise, and decisive regarding fitness improvements or regressions. "
            "Return ONE valid JSON object only. No markdown. No extra text."
        )
    base = (
        "You are a highly empathetic coaching assistant evaluating ONE completed training session. "
        "Return ONE valid JSON object only. No markdown. No extra text."
    )
    if sport == "run":
        return base + " Focus on running execution and intensity vs. plan."
    if sport == "ride":
        return base + " Focus on power/HR consistency and execution vs. plan."
    return base + " Focus on general training evaluation."


def _sport_rules(sport_key: str, is_race: bool = False) -> str:
    """Zostaví pravidlá pre AI podľa sportu a módu (race/training)."""
    common = [
        "- Do NOT invent missing data.",
        "- Output must be valid JSON only (no markdown).",
        "- STYLE: Continuous prose. NO bullets, NO lists.",
        "- NO PARROTING: DO NOT recite basic metrics (total distance, duration, average HR). "
        "The user sees these on their screen! Provide INSIGHTS (pacing trends, HR stability, effort validation, fatigue).",
        "- PACE FORMAT: Always write pace in 'mm:ss/km' format. NEVER write raw seconds.",
        "- PLAN ADHERENCE: If 'context.plan_today' exists, evaluate whether the session matched the plan. "
        "If 'context.plan_tomorrow' exists, reference it explicitly in 'next_day_plan'.",
        "- HISTORY CONTEXT: Use 'history.days_0_7' to assess recent fatigue accumulation. "
        "Consider the sport and intensity of recent sessions when giving recovery advice.",
    ]

    if not is_race:
        common.append(
            "- CRITICAL THRESHOLD RULE: Because this is a STANDARD TRAINING session (not a Race Effort), "
            "DO NOT suggest new thresholds. Set 'suggested_thresholds' to null."
        )

    if sport_key == "run_race":
        return "\n".join(
            common
            + [
                "- MANDATORY LTHR AUDIT: You MUST compare the session's Average HR with the current LTHR (Z4/Z5 boundary).",
                "- VERDICT: Explicitly state in 'review_text' whether the LTHR has improved, worsened, or remained stable.",
                "- Mention pacing: did they start too fast or finish with a strong kick?",
                "- Mandatory recovery instruction.",
            ]
        )

    if sport_key == "ride_race":
        return "\n".join(
            common
            + [
                "- MANDATORY FTP AUDIT: Compare Avg/Normalized Power with current FTP.",
                "- VERDICT: Explicitly state whether the FTP threshold has improved, worsened, or remained stable.",
                "- Mandatory recovery advice.",
            ]
        )

    # Splits/laps pravidlo — len ak sú v payload
    if sport_key in ("run", "ride"):
        common.append(
            "- SPLITS/LAPS: If 'activity.splits_minified' or 'activity.laps_minified' are present, "
            "use them to identify pacing consistency or fade. Reference specific km splits if relevant."
        )

    return "\n".join(common + ["- Identify session kind and evaluate intensity vs plan."])


def _schema(lang: str, sport: str, is_race: bool = False) -> str:
    """Vráti JSON schému výstupu — kratšia pre training, dlhšia pre race."""
    review_len = "4–6 sentences" if is_race else "3–4 concise sentences"
    plan_len = "2–3 concise sentences"
    return f"""
{{
  "schema_version": 6,
  "generated_at": "ISO timestamp",
  "model": "string",
  "activity_id": number | null,
  "sport": "{sport}",
  "session_kind": "{"race" if is_race else "training"}",
  "review_text": "FREE TEXT. {review_len}. {lang}. DO NOT list basic stats. Focus on execution insights, pacing, and physiological response.",
  "next_day_plan": "FREE TEXT. {plan_len}. Recovery focus based on load and HRV. Reference plan_tomorrow if available.",
  "key_numbers": {{
    "duration_min": number,
    "distance_km": number,
    "avg_hr_bpm": number,
    "max_hr_bpm": number,
    "dominant_zone": "Z1" | "Z2" | "Z3" | "Z4" | "Z5"
  }},
  "suggested_thresholds": {{
    "sport": "running" | "cycling",
    "threshold_type": "LT2" | "FTP",
    "hr_bpm": number | null,
    "pace_sec_km": number | null,
    "power_watt": number | null,
    "notes": "Scientific reasoning. Use mm:ss/km format when mentioning pace in notes."
  }} | null,
  "flags": {{ "used_user_comment": boolean, "needs_caution": boolean }}
}}
""".strip()


# ============================================================
# HLAVNÁ FUNKCIA
# ============================================================

def build_prompts_for_activity_review(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
    sport: Optional[str] = None,
    is_race: bool = False,
) -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre activity review.
    Minifikuje context, pridá jazykové pravidlá, schému a sport-špecifické rules.
    Ak je v contexte review_thread (predchádzajúce review + komentár usera),
    pridá inštrukciu aby AI reagovalo v kontexte konverzácie, nie izolovane.
    """
    settings = settings or {}

    user_data = context_payload.get("user", {})
    lang_label, second_person_note, health_reminder = _lang_notes(
        settings, user_data=user_data
    )

    # is_race_effort môže prísť aj z user_input (checkbox na FE)
    user_input_data = context_payload.get("user_input") or {}
    actually_is_race = is_race or bool(user_input_data.get("is_race_effort"))

    resolved_sport = _canonical_sport(
        context_payload.get("sport") or sport or "other"
    )
    sport_key = f"{resolved_sport}_race" if actually_is_race else resolved_sport

    # Minifikácia contextu — menej tokenov, rovnaká informácia
    context_for_llm = minify_activity_context_for_ai(context_payload)

    system_txt = _system_prompt(resolved_sport, is_race=actually_is_race)

    # Špeciálny protokol pre race/test — krok po kroku audit prahu
    race_logic = ""
    if actually_is_race:
        race_logic = (
            "\n--- PERFORMANCE AUDIT PROTOCOL ---\n"
            "1. ACCESS CURRENT DATA: Find the current LTHR in `context.user_zones` (Z4/Z5 boundary).\n"
            "2. PERFORM COMPARISON: Compare that value with the session `avg_hr_bpm`.\n"
            "3. MANDATORY STATEMENT: Explicitly mention this comparison in the `review_text`.\n"
            "4. VERDICT: State if the threshold has improved, worsened, or remains stable.\n"
            "5. DATA SUGGESTION: If improved, provide the new suggested LTHR in `suggested_thresholds`.\n"
        )

    # Konverzačný kontext — ak existuje predchádzajúci review_thread, AI reaguje na reply
    thread_ctx = (context_for_llm.get("context") or {}).get("review_thread") or []
    conversation_note = ""
    if thread_ctx:
        conversation_note = (
            "\n--- CONVERSATION CONTEXT ---\n"
            "This is a CONTINUING conversation about this same session — see 'context.review_thread' "
            "in CONTEXT_JSON for the prior exchange (oldest first). "
            "The athlete's latest message in 'user_input.comment' is a REPLY to your last message there. "
            "Address it directly and specifically — explain or reconsider your previous view if the "
            "athlete's reply changes the picture. Do NOT repeat your previous analysis verbatim.\n"
        )

    user_txt = (
        f"Analyze this {resolved_sport.upper()} session. "
        f"Mode: {'[PERFORMANCE AUDIT]' if actually_is_race else '[STANDARD REVIEW]'}\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label, resolved_sport, is_race=actually_is_race)
        + "\n\nRULES:\n"
        f"- Language: {lang_label}\n"
        f"- {second_person_note}\n"
        f"- HEALTH RULE: If the athlete mentions ANY pain, injury, sickness, or illness in their comment, "
        f"YOU MUST include this EXACT sentence in your review_text: '{health_reminder}'\n"
        + _sport_rules(sport_key, is_race=actually_is_race)
        + race_logic
        + conversation_note
        + "\n- Return ONLY raw JSON."
    )

    return system_txt, user_txt
