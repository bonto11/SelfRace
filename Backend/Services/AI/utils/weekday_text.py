# Services/AI/utils/weekday_text.py
"""
Poistka proti anglickým skratkám dní v texte pre usera.

PREČO: kontext posiela dni ako "Mon".."Sun" (jazykovo neutrálne a lacné
na tokeny). Model ich občas prepíše doslova - "futbal vo Wed". Pravidlo
v prompte to väčšinou zachytí, toto opraví zvyšok bez ďalšieho volania AI.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Tuple

# skratka -> (nominatív, akuzatív po "v/vo", predložka)
_SK: Dict[str, Tuple[str, str, str]] = {
    "Mon": ("pondelok", "pondelok", "v"),
    "Tue": ("utorok", "utorok", "v"),
    "Wed": ("streda", "stredu", "v"),
    "Thu": ("štvrtok", "štvrtok", "vo"),
    "Fri": ("piatok", "piatok", "v"),
    "Sat": ("sobota", "sobotu", "v"),
    "Sun": ("nedeľa", "nedeľu", "v"),
}
_CS: Dict[str, Tuple[str, str, str]] = {
    "Mon": ("pondělí", "pondělí", "v"),
    "Tue": ("úterý", "úterý", "v"),
    "Wed": ("středa", "středu", "ve"),
    "Thu": ("čtvrtek", "čtvrtek", "ve"),
    "Fri": ("pátek", "pátek", "v"),
    "Sat": ("sobota", "sobotu", "v"),
    "Sun": ("neděle", "neděli", "v"),
}

_ABBR = "Mon|Tue|Wed|Thu|Fri|Sat|Sun"
# predložka (v/vo/ve, aj s veľkým písmenom) + skratka
_PREP_RE = re.compile(rf"\b([vV][oe]?)\s+({_ABBR})\b")
_BARE_RE = re.compile(rf"\b({_ABBR})\b")


def _fix_text(s: str, table: Dict[str, Tuple[str, str, str]]) -> str:
    def prep(m: "re.Match[str]") -> str:
        _nom, acc, p = table[m.group(2)]
        if m.group(1)[0].isupper():
            p = p.capitalize()
        return f"{p} {acc}"

    def bare(m: "re.Match[str]") -> str:
        word = table[m.group(1)][0]
        # začiatok vety -> veľké písmeno
        before = s2[: m.start()].rstrip()
        return word.capitalize() if not before or before[-1] in ".!?" else word

    s2 = _PREP_RE.sub(prep, s)
    return _BARE_RE.sub(bare, s2)


def localize_weekdays(obj: Any, lang: str) -> Any:
    """Rekurzívne prejde výstup AI a preloží skratky dní v textoch (SK/CS)."""
    code = (lang or "sk").lower()
    if code.startswith("en"):
        return obj
    table = _CS if code.startswith("cs") else _SK

    def walk(v: Any) -> Any:
        if isinstance(v, str):
            return _fix_text(v, table) if _BARE_RE.search(v) else v
        if isinstance(v, list):
            return [walk(x) for x in v]
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        return v

    return walk(obj)
