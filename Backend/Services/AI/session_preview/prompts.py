# Services/AI/session_preview/prompts.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple


def _remove_empty(d: Any) -> Any:
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d


def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    lang_code = str(settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        return "English", "Use 'you' to talk directly to the athlete."
    if lang_code.startswith("cs"):
        return "Czech", "Používej 2. osobu ('ty') a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu ('ty') a hovor priamo k atlétovi."


def _time_format_rule() -> str:
    return (
        "- TIME/DURATION FORMAT: Never write raw seconds for any duration in free text. "
        "Use 'M:SS' under an hour, 'H:MM:SS' for an hour or more. Pace is always 'mm:ss/km'.\n"
    )


def _name_usage_rule(nickname: Optional[str], lang: str) -> str:
    if not nickname:
        return ""
    l = (lang or "sk").lower()
    if l.startswith("en"):
        return (
            f"- NAME USAGE: Do NOT start with the athlete's name ('{nickname}'). "
            f"Address them directly in 2nd person by default. Use the name only rarely, "
            f"when it adds genuine warmth.\n"
        )
    return (
        f"- POUŽITIE MENA: NEZAČÍNAJ odpoveď menom ('{nickname}'). Predvolene oslovuj "
        f"priamo v 2. osobe. Meno použi len zriedka, keď to pridá skutočné teplo.\n"
    )


def _conversation_rule(thread: List[Dict[str, Any]]) -> str:
    if not thread:
        return ""
    return (
        "\n--- CONVERSATION CONTEXT ---\n"
        "This is a CONTINUING conversation about this specific upcoming session — see "
        "'preview_thread' in CONTEXT_JSON for the prior exchange (oldest first). "
        "The athlete's latest message is a REPLY to your last message there. "
        "Address it directly and specifically. Do NOT repeat your previous reply verbatim.\n"
    )


def _mode_rule(request_change: bool) -> str:
    """
    Kľúčové rozlíšenie: bez zmeny (len rada/vysvetlenie) vs. so zmenou
    (upraví sa structure/duration_min/notes tejto JEDNEJ session).
    """
    if not request_change:
        return (
            "\n--- MODE: ADVICE ONLY (NO CHANGE) ---\n"
            "The athlete wants advice, an explanation, or a question answered about this "
            "upcoming session. They have NOT requested a change.\n"
            "- Set 'changed' to false.\n"
            "- Set 'updated_structure', 'updated_duration_min', and 'updated_notes' to null.\n"
            "- Answer helpfully in 'reply_text': explain pacing, how to approach the session, "
            "adjust for how they feel, weather, fatigue, etc. — but the plan itself stays as-is.\n"
            "- If their message actually implies they want a change but forgot to request it, "
            "gently tell them to check the 'change this session' option and resend.\n"
        )
    return (
        "\n--- MODE: REQUEST CHANGE (THIS SESSION ONLY) ---\n"
        "The athlete has explicitly asked to modify THIS SINGLE SESSION. You MAY update it.\n"
        "- CRITICAL SCOPE: You are ONLY allowed to change THIS ONE session. Do NOT reference or "
        "imply changes to any other day or the rest of the week — that is out of scope here.\n"
        "- If the requested change is reasonable and safe given the athlete's state (recent load, "
        "recovery, injury history), apply it: set 'changed' to true and fill 'updated_structure' "
        "(same shape as the original), 'updated_duration_min', and 'updated_notes'.\n"
        "- If the change is unsafe, contradicts recent health flags, or doesn't make sense "
        "(e.g. asking for a much harder session right after illness), set 'changed' to false, "
        "explain why in 'reply_text', and suggest a safer alternative in words only.\n"
        "- If the request actually needs changes across MULTIPLE days (e.g. 'I'm on vacation next "
        "two weeks'), set 'changed' to false and tell the athlete to use the weekly/daily replan "
        "feature with a coach note instead — this tool only handles a single session.\n"
        "- Keep the original session's sport and overall purpose intact unless the athlete "
        "explicitly asked to change the type of session.\n"
    )


def _schema(lang_label: str) -> str:
    return f"""
{{
  "reply_text": "FREE TEXT, 2-4 sentences, {lang_label}. Direct, conversational reply to the athlete's message.",
  "changed": boolean,
  "updated_duration_min": number | null,
  "updated_notes": "string | null — short session summary in {lang_label}, same role as original 'notes' field",
  "updated_structure": object | null
}}
""".strip()


def build_prompts_for_session_preview(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre session preview (pred-tréningová
    konverzácia/úprava jednej naplánovanej session).
    """
    settings = settings or {}
    lang = (settings.get("language") or "sk").lower()
    lang_label, second_person = _lang_notes(settings)

    user_data = context_payload.get("user") or {}
    nickname = user_data.get("first_name") if isinstance(user_data, dict) else None
    name_rule = _name_usage_rule(nickname, lang)

    request_change = bool((context_payload.get("user_input") or {}).get("request_change"))
    thread = context_payload.get("preview_thread") or []

    system_txt = (
        "You are a supportive, expert endurance coach helping an athlete with ONE upcoming "
        "planned training session. Return ONE valid JSON object only. No markdown."
    )

    context_clean = _remove_empty(json.loads(json.dumps(context_payload, default=str)))

    user_txt = (
        f"The athlete is asking about their upcoming session.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_clean, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label)
        + "\n\nRULES:\n"
        f"- Language: {lang_label}\n"
        f"- {second_person}\n"
        + name_rule
        + _time_format_rule()
        + _mode_rule(request_change)
        + _conversation_rule(thread)
        + "\n- Return ONLY raw JSON."
    )

    return system_txt, user_txt
