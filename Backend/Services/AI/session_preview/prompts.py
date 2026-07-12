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


def _mode_rule(request_change: bool) -> str:
    """
    Kľúčové rozlí
