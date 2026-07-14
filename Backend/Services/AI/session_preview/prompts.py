# Services/AI/session_preview/prompts.py
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


def minify_session_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Osekáva context_payload pred odoslaním do AI:
    - odstráni interné ID a debug polia
    - preview_thread ostáva (je to kontext na reply)
    """
    out = json.loads(json.dumps(context, default=str))

    u = out.get("user")
    if isinstance(u, dict):
        u.pop("id", None)
        u.pop("email", None)
    out.pop("_debug", None)

    return _remove_empty(out)


def _lang_notes(
    settings: Dict[str, Any], user_data: Optional[Dict[str, Any]] = None
) -> Tuple[str, str]:
    """
    Vráti (jazyk_label, pravidlo_oslovovania) podľa nastavení a profilu.
    Podporuje sk/cs/en s rodovými pravidlami.
    Meno atléta sa NEinštruuje tu — to rieši samostatná _name_usage_rule() nižšie.
    """
    lang = (settings.get("language") or "sk").lower()
    user_data = user_data or {}
    gender = user_data.get("gender")
    address_rule = ""

    if lang.startswith("en"):
        lang_label = "English"
        address_rule = "Use second person ('you'). Keep it punchy and supportive. "

    elif lang.startswith("cs"):
        lang_label = "Czech"
        address_rule = "Používej 2. osobu (tykání) a mluv přímo k atletovi stručně a věcně. "
        if gender == "female":
            address_rule += "DŮLEŽITÉ: Atletka je ŽENA. Používej ženský rod. "
        elif gender == "male":
            address_rule += "Atlet je MUŽ. Používej mužský rod. "

    else:  # Slovak default
        lang_label = "Slovak"
        address_rule = (
            "Používaj 2. osobu (tykanie) a hovor priamo k atlétovi. "
            "Vyjadruj sa stručne a vecne. "
        )
        if gender == "female":
            address_rule += "DÔLEŽITÉ: Atlétka je ŽENA. Používaj výhradne ženský rod. "
        elif gender == "male":
            address_rule += "Atlét je MUŽ. Používaj mužský rod. "

    return lang_label, address_rule


def _name_usage_rule(nickname: Optional[str], lang: str) -> str:
    """
    Meno atléta sa NEMÁ používať na začiatku každej odpovede — pôsobí to strojovo
    a opakovane. Model ho má použiť len zriedka, pri významnom momente.
    Rovnaké pravidlo ako v activity_review/prompts.py.
    """
    if not nickname:
        return ""

    l = (lang or "sk").lower()
    if l.startswith("en"):
        return (
            f"- NAME USAGE (CRITICAL): Do NOT start your response with the athlete's name "
            f"('{nickname}') — starting every reply with the name reads as robotic and repetitive. "
            f"By DEFAULT address them directly in 2nd person ('you') WITHOUT naming them. "
            f"Use the name '{nickname}' only RARELY (roughly 1 in every 5-6 responses) and ONLY when "
            f"it genuinely adds warmth at a meaningful moment. Never use it as a routine greeting or opener.\n"
        )
    if l.startswith("cs"):
        return (
            f"- POUŽITÍ JMÉNA (KRITICKÉ): NEZAČÍNEJ odpověď jménem atleta ('{nickname}') — "
            f"začínat každou odpověď jménem působí strojově a opakovaně. "
            f"VÝCHOZÍ chování je oslovovat atleta přímo v 2. osobě BEZ použití jména. "
            f"Jméno '{nickname}' použij jen ZŘÍDKA (zhruba 1 z 5-6 odpovědí), jen když to přidá "
            f"skutečné teplo. Nikdy ho nepoužívej jako rutinní pozdrav.\n"
        )
    return (
        f"- POUŽITIE MENA (KRITICKÉ): NEZAČÍNAJ odpoveď menom atléta ('{nickname}') — "
        f"začínať každú odpoveď menom pôsobí strojovo a opakovane. "
        f"PREDVOLENE oslovuj atléta priamo v 2. osobe BEZ použitia mena. "
        f"Meno '{nickname}' použi len ZRIEDKA (zhruba 1 z 5-6 odpovedí), len keď to pridá "
        f"skutočné teplo. Nikdy ho nepoužívaj ako rutinný pozdrav.\n"
    )


def _time_format_rule() -> str:
    """Rovnaké pravidlo formátovania času ako activity_review — bez raw sekúnd."""
    return (
        "- TIME/DURATION FORMAT: Never write raw seconds for any duration or time value "
        "in free text. Use 'M:SS' when under an hour (e.g. '5:19'), 'H:MM:SS' when an hour "
        "or more. Pace is always 'mm:ss/km'.\n"
    )


def _terminology_rule(lang_label: str) -> str:
    """
    Zabraňuje AI substitúcii sémanticky/foneticky podobných, ale nesprávnych
    slov v generovanom texte (reply_text, updated_title, updated_notes) —
    bežná chyba LLM pri generovaní v slovenčine/češtine.
    Rovnaké pravidlo ako v daily_plan/prompts.py.
    """
    return (
        "- WORD ACCURACY (CRITICAL): Use ONLY standard, correct sport/anatomy terminology. "
        "Before finalizing any text, double-check every word is the one you actually meant — "
        "LLMs sometimes substitute a phonetically or visually similar but WRONG word (a known "
        "failure mode), especially in Slovak/Czech.\n"
        "  Examples of this exact mistake to AVOID:\n"
        "  - Slovak: 'nohy' (legs) MUST NOT become 'nohavice' (trousers/pants).\n"
        "  - Slovak: 'ruky'/'ramená' (arms/shoulders) MUST NOT become unrelated clothing words.\n"
        "  - Czech: 'nohy' (legs) MUST NOT become 'nohavice' (kalhoty).\n"
        "  - Do not invent or drift into clothing, furniture, or unrelated nouns when describing "
        "body parts, muscle groups, or exercise focus areas.\n"
        f"  Re-read each generated {lang_label} sentence once and confirm every noun matches "
        "its intended meaning before including it in the output.\n"
    )


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


def _system_prompt(sport: str) -> str:
    """System prompt pre session preview — konverzačný, nie hodnotiaci ako review."""
    base = (
        "You are a supportive, expert endurance coach helping an athlete with ONE upcoming "
        "planned training session. Return ONE valid JSON object only. No markdown. No extra text."
    )
    if sport == "run":
        return base + " Focus on running-specific pacing and execution guidance."
    if sport == "ride":
        return base + " Focus on power/HR guidance and execution."
    return base


def _mode_rule(request_change: bool, has_strength_catalog: bool = False) -> str:
    if not request_change:
        return (
            "\n--- MODE: ADVICE ONLY (NO CHANGE) ---\n"
            "The athlete wants advice, an explanation, or a question answered about this "
            "upcoming session. They have NOT requested a change.\n"
            "- Set 'changed' to false.\n"
            "- Set 'updated_title', 'updated_structure', 'updated_duration_min', and 'updated_notes' to null.\n"
            "- Answer helpfully in 'reply_text': explain pacing, how to approach the session, "
            "adjust for how they feel, fatigue, etc. — but the plan itself stays as-is.\n"
            "- If their message actually implies they want a change but forgot to request it, "
            "gently tell them to check the 'change this session' option and resend.\n"
        )

    strength_rule = (
        "- STRENGTH SESSIONS: 'updated_structure' for a strength session uses the SAME shape as "
        "the original ('activation', 'strength_main_part', 'add_ons' arrays of exercise_id/sets/reps/"
        "rest_s/notes). You MAY change the exercise selection (exercise_id) if the athlete asked for "
        "a different focus (e.g. 'more upper body', 'skip squats, my knee hurts'). "
        + (
            "ONLY use exercise_id values that appear in 'context.strength_catalog' (each entry has "
            "'id' and 'target' — match the target muscle group/focus the athlete wants). NEVER invent "
            "an exercise_id not in that list. If none of the available exercises fit what the athlete "
            "asked for, do NOT guess: keep 'updated_structure' null, set 'changed' to false, and "
            "explain in 'reply_text' what focus/adjustment you'd suggest instead.\n"
            if has_strength_catalog
            else
            "'context.strength_catalog' is NOT available for this request, so you do NOT have the list "
            "of valid exercise_id values — do NOT invent or guess any exercise_id. Keep 'updated_structure' "
            "null, set 'changed' to false, and instead describe in 'reply_text' what focus/adjustment "
            "(e.g. muscle group, intensity) you'd suggest, in words only.\n"
        )
    )

    return (
        "\n--- MODE: REQUEST CHANGE (THIS SESSION ONLY) ---\n"
        "The athlete has explicitly asked to modify THIS SINGLE SESSION. You MAY update it.\n"
        "- CRITICAL SCOPE: You are ONLY allowed to change THIS ONE session. Do NOT reference or "
        "imply changes to any other day or the rest of the week — that is out of scope here.\n"
        "- If the requested change is reasonable and safe given the athlete's recovery/wellness "
        "context, apply it: set 'changed' to true and fill 'updated_structure' (same shape as the "
        "original 'session.structure'), 'updated_duration_min', and 'updated_notes'.\n"
        "- CRITICAL: 'updated_title' MUST also reflect the new session type whenever the nature "
        "of the session changes (e.g. original title 'Prahový beh - Z4 tempo' becomes something "
        "like 'Ľahký regeneračný beh' if the athlete asked to make it easy). The title must never "
        "be left describing the OLD session type after a change — this is a common mistake, avoid it. "
        "If the sport/focus genuinely didn't change, you may keep the title as-is.\n"
        + strength_rule
        + "- If the change is unsafe or doesn't make sense (e.g. asking for a much harder session "
        "right after reporting exhaustion), set 'changed' to false, explain why in 'reply_text', "
        "and suggest a safer alternative in words only.\n"
        "- If the request actually needs changes across MULTIPLE days (e.g. 'I'm on vacation next "
        "two weeks'), set 'changed' to false and tell the athlete to use the weekly/daily replan "
        "feature with a coach note instead — this tool only handles a single session.\n"
        "- Keep the original session's sport and overall purpose intact unless the athlete "
        "explicitly asked to change the type of session.\n"
    )


def _conversation_rule(thread_ctx: list) -> str:
    """Ak existuje predchádzajúci preview_thread, AI reaguje na posledný komentár, nie odznova."""
    if not thread_ctx:
        return ""
    return (
        "\n--- CONVERSATION CONTEXT ---\n"
        "This is a CONTINUING conversation about this specific upcoming session — see "
        "'context.preview_thread' in CONTEXT_JSON for the prior exchange (oldest first). "
        "The athlete's latest message in 'user_input.comment' is a REPLY to your last message there. "
        "Address it directly and specifically. Do NOT repeat your previous reply verbatim.\n"
    )


def _schema(lang: str) -> str:
    """JSON schéma výstupu pre session preview."""
    return f"""
{{
  "schema_version": 1,
  "generated_at": "ISO timestamp",
  "model": "string",
  "reply_text": "FREE TEXT, 2-4 sentences, {lang}. Direct, conversational reply to the athlete's message.",
  "changed": boolean,
  "updated_title": "string | null — short session title in {lang} (e.g. 'Ľahký beh', 'Intervaly 6x400m'), MUST be updated whenever the session type/nature changes so it matches the new structure",
  "updated_duration_min": number | null,
  "updated_notes": "string | null — short session summary in {lang}, same role as original session.notes",
  "updated_structure": object | null
}}
""".strip()


# ============================================================
# HLAVNÁ FUNKCIA
# ============================================================

def build_prompts_for_session_preview(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre session preview (pred-tréningová
    konverzácia/úprava jednej naplánovanej session).
    Minifikuje context, pridá jazykové pravidlá, meno-pravidlo, schému,
    mode rule (advice vs change) a conversation rule ak existuje história.
    """
    settings = settings or {}
    lang = (settings.get("language") or "sk").lower()

    user_data = context_payload.get("user", {})
    lang_label, second_person_note = _lang_notes(settings, user_data=user_data)

    nickname = user_data.get("first_name") if isinstance(user_data, dict) else None
    name_rule = _name_usage_rule(nickname, lang)

    user_input_data = context_payload.get("user_input") or {}
    request_change = bool(user_input_data.get("request_change"))

    resolved_sport = _canonical_sport(context_payload.get("sport") or "other")

    context_for_llm = minify_session_context_for_ai(context_payload)

    system_txt = _system_prompt(resolved_sport)

    thread_ctx = (context_for_llm.get("context") or {}).get("preview_thread") or []
    conversation_note = _conversation_rule(thread_ctx)

    # Katalóg cvikov je v context_payload["context"]["strength_catalog"] len keď
    # sport === "strength" AND request_change === True (nastavuje builders.py) —
    # posiela sa podmienene, aby sa nezbytočne neplytvali tokeny pri iných športoch
    # alebo pri "len poraď" dopyte.
    has_strength_catalog = bool(
        (context_for_llm.get("context") or {}).get("strength_catalog")
    )

    user_txt = (
        f"The athlete is asking about their upcoming {resolved_sport.upper()} session.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label)
        + "\n\nRULES:\n"
        f"- Language: {lang_label}\n"
        f"- {second_person_note}\n"
        + name_rule
        + _time_format_rule()
        + _terminology_rule(lang_label)
        + _mode_rule(request_change, has_strength_catalog=has_strength_catalog)
        + conversation_note
        + "\n- Return ONLY raw JSON."
    )

    return system_txt, user_txt