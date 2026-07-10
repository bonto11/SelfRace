# Services/AI/activity_review/prompts.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple


# ============================================================
# HELPERS
# ============================================================

def _lang_label(lang: str) -> str:
    l = (lang or "sk").lower()
    if l.startswith("en"):
        return "English"
    if l.startswith("cs"):
        return "Czech"
    return "Slovak"


def _second_person_note(lang: str) -> str:
    l = (lang or "sk").lower()
    if l.startswith("en"):
        return "Use 'you' to address the athlete directly."
    if l.startswith("cs"):
        return "Oslovuj atleta ve 2. osobě ('ty')."
    return "Oslovuj atléta v 2. osobe ('ty')."


def _time_format_rule() -> str:
    return (
        "- TIME/DURATION FORMAT: Never write raw seconds for any duration or time value "
        "(intervals, splits, total time, rest periods, etc). Always format as human-readable time: "
        "use 'M:SS' when under an hour (e.g. 319 seconds -> '5:19', 196 seconds -> '3:16'), "
        "and 'H:MM:SS' when an hour or more (e.g. 17813 seconds -> '4:56:53'). "
        "If minutes or hours are zero, omit that unit rather than writing a leading zero segment "
        "(e.g. 45 seconds -> '0:45', not '00:00:45'). Pace is always 'mm:ss/km'.\n"
    )


def _name_usage_rule(nickname: Optional[str]) -> str:
    """
    Meno atleta sa NEMÁ používať na začiatku každej odpovede — pôsobí to strojovo.
    Model ho má použiť len zriedka pri významnom momente.
    """
    if not nickname:
        return (
            "- NAME USAGE: Do NOT invent or use any name. Address the athlete directly in 2nd person.\n"
        )
    return (
        f"- NAME USAGE (CRITICAL): The athlete's name is '{nickname}'. Do NOT start your response "
        f"with their name — starting every review with the name reads as robotic and repetitive. "
        f"By DEFAULT address them directly in 2nd person ('you') WITHOUT naming them at all. "
        f"Use the name '{nickname}' only RARELY (roughly 1 in every 5-6 responses) and ONLY when it "
        f"genuinely adds warmth at a meaningful moment — a breakthrough, a hard day, a milestone, or "
        f"encouragement after a setback. Never use the name as a routine greeting or opener.\n"
    )


def _conversation_rule(has_prior_review: bool, has_user_followup: bool) -> str:
    """
    Ak už existuje predošlé hodnotenie A užívateľ pridal follow-up komentár,
    model má reagovať na posledný komentár v kontexte celého threadu,
    nie re-reviewovať aktivitu odznova.
    """
    if not (has_prior_review and has_user_followup):
        return ""
    return (
        "\n--- CONVERSATION MODE (CRITICAL) ---\n"
        "- This is an ONGOING CONVERSATION, not a fresh review. The thread below already contains your "
        "previous assessment(s) and the athlete has now replied with a follow-up comment (the LAST user "
        "entry in the thread).\n"
        "- Your 'review_text' MUST DIRECTLY ADDRESS the athlete's MOST RECENT comment, in the context of "
        "the whole thread and the activity data.\n"
        "- DO NOT re-review the activity from scratch. DO NOT repeat observations, praise, or advice you "
        "already gave earlier — the athlete has already read it.\n"
        "- Acknowledge specifically what they said and respond to it. If they asked a question, answer it. "
        "If they shared how they felt, react to that feeling in relation to the numbers. Add only NEW "
        "insight relevant to their comment.\n"
        "- Keep 'review_text' focused and SHORTER than a first-time review — it's a reply, not a full report.\n"
    )


def _time_and_pace_context(latest_paces: Dict[str, Any]) -> str:
    if not latest_paces:
        return ""
    parts = []
    for i in range(1, 6):
        v = latest_paces.get(f"z{i}_pace_s")
        if isinstance(v, (int, float)) and v > 0:
            m = int(v) // 60
            s = int(v) % 60
            parts.append(f"Z{i}={m}:{s:02d}/km")
    if not parts:
        return ""
    return "- CURRENT PACE ZONES (reference): " + ", ".join(parts) + "\n"


def _serialize_thread(thread: List[Dict[str, Any]]) -> str:
    """Serializuje existujúci thread do čitateľného textu pre model."""
    if not thread:
        return ""
    lines: List[str] = []
    for entry in thread:
        role = entry.get("role")
        if role == "assistant":
            review = entry.get("review") or {}
            txt = review.get("review_text") or ""
            plan = review.get("next_day_plan") or ""
            lines.append(f"[COACH]: {txt}")
            if plan:
                lines.append(f"[COACH — next day plan]: {plan}")
        elif role == "user":
            c = entry.get("comment") or ""
            race = " (marked as RACE EFFORT)" if entry.get("is_race_effort") else ""
            if c:
                lines.append(f"[ATHLETE{race}]: {c}")
    return "\n".join(lines)


# ============================================================
# SPORT RULES
# ============================================================

def _sport_rules(sport_key: str, is_race: bool = False) -> str:
    common = [
        "- Do NOT invent missing data.",
        "- Output must be valid JSON only (no markdown).",
        "- STYLE: Continuous prose. NO bullets, NO lists.",
        "- NO PARROTING: DO NOT recite basic metrics (total distance, duration, average HR). "
        "The user sees these on their screen! Provide INSIGHTS (pacing trends, HR stability, effort validation, fatigue).",
        "- PACE FORMAT: Always write pace in 'mm:ss/km' format. NEVER write raw seconds.",
        _time_format_rule().strip(),
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

    if sport_key in ("run", "ride"):
        common.append(
            "- SPLITS/LAPS: If 'activity.splits_minified' or 'activity.laps_minified' are present, "
            "use them to identify pacing consistency or fade. Reference specific km splits if relevant."
        )

    return "\n".join(common + ["- Identify session kind and evaluate intensity vs plan."])


# ============================================================
# SCHEMA
# ============================================================

def _review_schema(lang_label: str) -> str:
    return f"""
{{
  "schema_version": 2,
  "sport": "run" | "ride" | "swim" | "strength" | "other",
  "session_kind": "easy" | "long" | "interval" | "tempo" | "recovery" | "race" | "other",
  "review_text": "Main coaching feedback in {lang_label}. Continuous prose.",
  "next_day_plan": "Concrete recommendation for tomorrow in {lang_label}.",
  "key_numbers": {{
    "dominant_zone": "Z1" | "Z2" | "Z3" | "Z4" | "Z5" | null
  }},
  "suggested_thresholds": {{
    "threshold_type": "LT2" | "FTP" | null,
    "hr_bpm": number | null,
    "pace_sec_km": number | null,
    "notes": "short reason in {lang_label}"
  }} | null,
  "flags": {{
    "needs_caution": boolean,
    "used_user_comment": boolean
  }}
}}
""".strip()


# ============================================================
# HLAVNÁ FUNKCIA
# ============================================================

def _build_prompt(
    *,
    context: Dict[str, Any],
    thread: List[Dict[str, Any]],
    version: int,
    sport_key: str,
    is_race: bool,
    nickname: Optional[str],
    lang: str,
    latest_paces: Dict[str, Any],
    user_comment: Optional[str],
) -> Tuple[str, str]:
    lang_label = _lang_label(lang)
    second_person = _second_person_note(lang)

    is_first = version <= 1

    # Detekcia konverzačného módu: existuje predošlé hodnotenie + posledný záznam
    # v threade je užívateľov follow-up komentár.
    prior_assistant_count = sum(1 for e in (thread or []) if e.get("role") == "assistant")
    has_prior_review = prior_assistant_count > 0
    last_entry = thread[-1] if thread else None
    has_user_followup = bool(
        last_entry
        and last_entry.get("role") == "user"
        and last_entry.get("comment")
    )
    # Ak nový komentár nie je ešte v threade (posiela sa zvlášť), ber do úvahy aj user_comment
    if not has_user_followup and user_comment:
        has_user_followup = True

    conversation_rule = _conversation_rule(has_prior_review, has_user_followup)
    history_text = _serialize_thread(thread)

    system_txt = (
        "You are an elite endurance coaching assistant reviewing a single training session. "
        "You return exactly ONE valid JSON object. Do NOT output prose or markdown fences."
    )

    rules = _sport_rules(sport_key, is_race=is_race)

    user_parts: List[str] = [
        f"Review this {sport_key} session and fill the schema.\n",
        _name_usage_rule(nickname),
        f"- {second_person}\n",
        _time_and_pace_context(latest_paces),
        "\nRULES:\n",
        rules,
        conversation_rule,
    ]

    if history_text:
        user_parts.append(
            "\n\n--- CONVERSATION THREAD SO FAR (oldest first) ---\n"
            + history_text
            + "\n--- END THREAD ---\n"
        )

    if user_comment:
        user_parts.append(
            f"\n\nThe athlete's NEW comment to respond to:\n\"{user_comment}\"\n"
            "Set flags.used_user_comment = true and make sure your review_text addresses it.\n"
        )

    user_parts.append(
        "\n\nCONTEXT_JSON:\n"
        + json.dumps(context, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _review_schema(lang_label)
        + "\n\nReturn ONLY the JSON object."
    )

    user_txt = "".join(p for p in user_parts if p)
    return system_txt, user_txt


def build_messages_for_review(
    *,
    context: Dict[str, Any],
    thread: Optional[List[Dict[str, Any]]] = None,
    version: int = 1,
    sport_key: str = "run",
    is_race: bool = False,
    nickname: Optional[str] = None,
    lang: str = "sk",
    latest_paces: Optional[Dict[str, Any]] = None,
    user_comment: Optional[str] = None,
) -> List[Dict[str, str]]:
    system_txt, user_txt = _build_prompt(
        context=context,
        thread=thread or [],
        version=version,
        sport_key=sport_key,
        is_race=is_race,
        nickname=nickname,
        lang=lang,
        latest_paces=latest_paces or {},
        user_comment=user_comment,
    )
    return [
        {"role": "system", "content": system_txt},
        {"role": "user", "content": user_txt},
    ]
