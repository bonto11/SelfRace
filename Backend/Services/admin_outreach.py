# Services/admin_outreach.py
"""
Pripomienkový e-mail pre userov, ktorí sa len zaregistrovali (admin panel).

Tok: kandidáti (zaregistrovaný aspoň PRE_NUDGE_HOURS, nič nenastavil) →
návrh mailu v jazyku usera s menom a tým, čo mu chýba → admin ho upraví a
odošle → záznam v users_preferences `admin.outreach` (kto, kedy, predmet).
PREČO záznam pri userovi: rovnaký mail sa mu druhýkrát nepošle (bez `force`)
a admin panel aj upozornenie adminovi ho už neponúkajú.

Nič sa neposiela automaticky – vždy rozhoduje admin.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import re

from Configs.config import FRONTEND_URL
from DB.app_settings import db_get_app_setting, db_set_app_setting
from DB.user_prefs import db_get_pref_single, db_upsert_pref_single
from Modules.Email.smtp import email_configured, email_provider, send_email, zoho_exchange_code, zoho_missing
from Modules.Supabase.auth import AuthCtx
from Services.user_overview import OUTREACH_KEY, service_user_overview

NUDGE = "nudge"
PRE_NUDGE_HOURS = 24          # skôr nedať userovi šancu dokončiť to sám
NUDGE_MAX_DAYS = 30           # starší „len registrovaní“ už nie sú kandidáti

APP_URL = (FRONTEND_URL or "https://www.selfrace.com").rstrip("/")

# Predloha mailu – upravuje sa v admin paneli (app_settings `outreach.templates`),
# tu je len pôvodná verzia (záloha pre chýbajúce polia a „Vrátiť pôvodnú“).
# Premenné: {meno} = krstné meno (bez mena zmizne aj s čiarkou/medzerou pred ním),
# {kroky} = úvod + zoznam toho, čo userovi chýba (alebo veta pre „nič nechýba“),
# {odkaz} = adresa appky, {follow} = výzva na follow (Instagram / Facebook), keď je zaškrtnutá.
TEMPLATES_KEY = "outreach.templates"
TEMPLATE_FIELDS = (
    "subject", "body", "steps_intro",
    "step_profile", "step_strava", "step_goal", "step_strength_log", "nothing_missing", "step_follow",
)
LANGS = ("sk", "cs", "en")

DEFAULT_TEMPLATES: Dict[str, Dict[str, str]] = {
    "sk": {
        "subject": "{meno}, SelfRace na teba čaká! 💪",
        "body": (
            "Ahoj {meno},\n\n"
            "vďaka, že skúšaš SelfRace! Teší ma, že ti záleží na pohybe a zdravom životnom štýle – "
            "presne o tom to celé je. Jediný súper je tvoje včerajšie ja.\n\n"
            "{kroky}\n\n"
            "Zaberie to pár minút: {odkaz}\n\n"
            "Ak niečo nejde alebo máš otázku, pokojne mi odpíš alebo napíš:\n"
            "✉️ support@selfrace.com\n\n"
            "{follow}\n\n"
            "Drž sa a teším sa na tvoje tréningy,\nPatrik zo SelfRace"
        ),
        "steps_intro": "Všimol som si, že ti ešte chýba pár krokov, aby ti aplikácia vedela naplno pomôcť:",
        "step_profile": "vybrať si, na čo sa zameriavaš (beh, posilňovanie, OCR, zdravie…) – appka ti potom ukáže len to, čo potrebuješ",
        "step_strava": "prepojiť Stravu (je zadarmo, netreba prémiový účet – stačia hodinky alebo len mobil) – AI tréner ti potom zhodnotí každý tréning",
        "step_goal": "nastaviť si cieľ a koľko času máš na tréning – AI tréner ti podľa toho poskladá plán alebo poradí s tvojím",
        "step_strength_log": "zapísať prvý silový tréning – AI tréner ti potom ukáže progres a skontroluje týždeň",
        "nothing_missing": "Dlhšie som ťa v appke nevidel – SelfRace na teba čaká.",
        "step_follow": (
            "📸 A daj nám follow na Instagrame @selfrace.app – pridávame tam veľa užitočných rád, "
            "noviniek a zaujímavostí: https://www.instagram.com/selfrace.app\n"
            "👍 Instagram nemáš? Nájdeš nás aj na Facebooku – SelfRace."
        ),
    },
    "cs": {
        "subject": "{meno}, SelfRace na tebe čeká! 💪",
        "body": (
            "Ahoj {meno},\n\n"
            "díky, že zkoušíš SelfRace! Těší mě, že ti záleží na pohybu a zdravém životním stylu – "
            "přesně o tom to celé je. Jediný soupeř je tvoje včerejší já.\n\n"
            "{kroky}\n\n"
            "Zabere to pár minut: {odkaz}\n\n"
            "Pokud něco nejde nebo máš otázku, klidně mi odepiš nebo napiš:\n"
            "✉️ support@selfrace.com\n\n"
            "{follow}\n\n"
            "Drž se a těším se na tvoje tréninky,\nPatrik ze SelfRace"
        ),
        "steps_intro": "Všiml jsem si, že ti ještě chybí pár kroků, aby ti aplikace mohla naplno pomoct:",
        "step_profile": "vybrat si, na co se zaměřuješ (běh, posilování, OCR, zdraví…) – aplikace ti pak ukáže jen to, co potřebuješ",
        "step_strava": "propojit Stravu (je zdarma, není potřeba prémiový účet – stačí hodinky nebo jen mobil) – AI trenér ti pak vyhodnotí každý trénink",
        "step_goal": "nastavit si cíl a kolik času máš na trénink – AI trenér ti podle toho sestaví plán nebo poradí s tvým",
        "step_strength_log": "zapsat první silový trénink – AI trenér ti pak ukáže pokrok a zkontroluje týden",
        "nothing_missing": "Delší dobu jsem tě v aplikaci neviděl – SelfRace na tebe čeká.",
        "step_follow": (
            "📸 A dej nám follow na Instagramu @selfrace.app – přidáváme tam spoustu užitečných rad, "
            "novinek a zajímavostí: https://www.instagram.com/selfrace.app\n"
            "👍 Instagram nemáš? Najdeš nás i na Facebooku – SelfRace."
        ),
    },
    "en": {
        "subject": "{meno}, SelfRace is waiting for you! 💪",
        "body": (
            "Hi {meno},\n\n"
            "thanks for giving SelfRace a try! I'm glad you care about staying active and healthy – "
            "that's what it's all about. Your only rival is who you were yesterday.\n\n"
            "{kroky}\n\n"
            "It only takes a few minutes: {odkaz}\n\n"
            "If anything doesn't work or you have a question, just reply or reach us at:\n"
            "✉️ support@selfrace.com\n\n"
            "{follow}\n\n"
            "Take care – looking forward to your workouts,\nPatrik from SelfRace"
        ),
        "steps_intro": "I noticed a few steps are still missing before the app can really help you:",
        "step_profile": "pick your focus (running, strength, OCR, health…) – the app then shows only what you need",
        "step_strava": "connect Strava (it's free, no premium account needed – a watch or just your phone is enough) – your AI coach will then review every workout",
        "step_goal": "set your goal and how much time you have for training – your AI coach will build a plan or advise on yours",
        "step_strength_log": "log your first strength workout – your AI coach will then track your progress and check your week",
        "nothing_missing": "I haven't seen you in the app for a while – SelfRace is waiting for you.",
        "step_follow": (
            "📸 And follow us on Instagram @selfrace.app – we post lots of useful tips, news and "
            "interesting stuff: https://www.instagram.com/selfrace.app\n"
            "👍 Not on Instagram? You'll find us on Facebook too – SelfRace."
        ),
    },
}


def _load_templates(*, ctx: AuthCtx) -> Dict[str, Dict[str, str]]:
    """Uložená predloha z admin panelu, chýbajúce polia doplní pôvodná."""
    stored: Any = None
    try:
        stored = db_get_app_setting(TEMPLATES_KEY, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[OUTREACH] templates load failed: {repr(e)}")
    out: Dict[str, Dict[str, str]] = {}
    for lang in LANGS:
        saved = stored.get(lang) if isinstance(stored, dict) and isinstance(stored.get(lang), dict) else {}
        out[lang] = {
            f: (saved[f] if isinstance(saved.get(f), str) and saved[f].strip() else DEFAULT_TEMPLATES[lang][f])
            for f in TEMPLATE_FIELDS
        }
    return out


def _fill_name(text: str, name: str) -> str:
    """{meno} → krstné meno; bez mena zmizne aj s „, “ / medzerou a prvé písmeno bude veľké."""
    if name:
        return text.replace("{meno}", name)
    out = re.sub(r"\{meno\},\s*|\s*,?\s*\{meno\}", "", text).strip()
    return out[:1].upper() + out[1:] if out else out


def _dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return None


def _first_name(name: str) -> str:
    # z Google príde celé meno – v oslovení stačí krstné
    return (name or "").strip().split(" ")[0] if name else ""


def _missing(row: Dict[str, Any]) -> List[str]:
    """Čo userovi chýba, aby mu appka vedela pomôcť (poradie = poradie v maile)."""
    out: List[str] = []
    profile = row.get("profile")
    if not profile:
        out.append("profile")
    # silový profil Stravu nepotrebuje – jeho krok je prvý zápis
    if profile == "strength":
        if not row.get("strength_total"):
            out.append("strength_log")
    elif not row.get("strava"):
        out.append("strava")
    if not row.get("coach"):
        out.append("goal")
    return out


def _sent_nudge(row: Dict[str, Any]) -> Optional[str]:
    """Kedy dostal pripomienku (posledná), alebo None."""
    dates = [o.get("at") for o in row.get("outreach") or [] if o.get("kind") == NUDGE and o.get("at")]
    return max(dates) if dates else None


def _is_candidate(row: Dict[str, Any], now: datetime) -> bool:
    reg = _dt(row.get("registered_at"))
    if not reg or now - reg < timedelta(hours=PRE_NUDGE_HOURS) or now - reg > timedelta(days=NUDGE_MAX_DAYS):
        return False
    if _sent_nudge(row):
        return False
    # nič neurobil, alebo mu chýba zdroj dát (Strava / silový zápis) a nič vlastné nespravil
    return row.get("status") == "registered" or (not row.get("last_action_at") and bool(_missing(row)))


# Čo sa dá do mailu zaškrtnúť (poradie = poradie v maile). „comeback“ = veta
# „dlhšie som ťa nevidel“ (nothing_missing) – predvolene len keď userovi nič nechýba.
# „follow“ = výzva na Instagram / Facebook ({follow}) – predvolene vždy.
STEP_KEYS = ("profile", "strava", "goal", "strength_log", "comeback", "follow")


def build_draft(
    row: Dict[str, Any], templates: Dict[str, Dict[str, str]], steps: Optional[List[str]] = None
) -> Dict[str, Any]:
    """steps=None → podľa toho, čo userovi chýba; inak presne to, čo admin zaškrtol (aj nič)."""
    lang = row.get("lang") if row.get("lang") in LANGS else "sk"
    t = templates.get(lang) or DEFAULT_TEMPLATES[lang]
    name = _first_name(row.get("name") or "")
    missing = _missing(row)

    if steps is None:
        chosen = (missing or ["comeback"]) + ["follow"]
    else:
        chosen = [k for k in STEP_KEYS if k in steps]
    items = [k for k in chosen if k not in ("comeback", "follow")]

    parts: List[str] = []
    if items:
        parts.append("\n".join([t["steps_intro"], *[f"– {t['step_' + key]}" for key in items]]))
    if "comeback" in chosen:
        parts.append(t["nothing_missing"])
    body = _fill_name(t["body"], name).replace("{kroky}", "\n\n".join(parts)).replace("{odkaz}", APP_URL)
    follow = t["step_follow"] if "follow" in chosen else ""
    if "{follow}" in body:
        body = body.replace("{follow}", follow)
    elif follow:
        # staršia uložená predloha bez {follow}: výzva pred posledný odsek (podpis)
        paras = body.strip().split("\n\n")
        paras.insert(max(len(paras) - 1, 0), follow)
        body = "\n\n".join(paras)
    # bez krokov ostane po {kroky} prázdny riadok navyše
    body = re.sub(r"\n{3,}", "\n\n", body).strip()

    return {
        "user_id": row.get("id"),
        "to": row.get("email") or "",
        "name": row.get("name") or "",
        "lang": lang,
        "missing": missing,
        "steps": chosen,
        "subject": _fill_name(t["subject"], name),
        "body": body,
        "sent_at": _sent_nudge(row),
    }


def _brief(row: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "email": row.get("email") or "",
        "name": row.get("name") or "",
        "status": row.get("status"),
        "registered_at": row.get("registered_at"),
        "missing": _missing(row),
        "sent_at": _sent_nudge(row),
        "candidate": _is_candidate(row, now),
    }


def service_outreach_candidates(*, ctx: AuthCtx) -> Dict[str, Any]:
    """Všetci useri v skratke + príznak, kto je kandidát na pripomienku (kandidáti prví)."""
    now = datetime.now(timezone.utc)
    rows = service_user_overview(ctx=ctx)["users"]
    users = [_brief(r, now) for r in rows]
    users.sort(key=lambda u: (not u["candidate"], u.get("sent_at") is not None, -(u.get("id") or 0)))
    return {"ok": True, "smtp": email_configured(), "provider": email_provider(), "zoho_missing": zoho_missing(), "users": users}


def list_nudge_candidates(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Kandidáti na pripomienku (pre upozornenie adminovi)."""
    now = datetime.now(timezone.utc)
    return [_brief(r, now) for r in service_user_overview(ctx=ctx)["users"] if _is_candidate(r, now)]


def _row_for(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    # PREČO celý prehľad: rovnaké pravidlá (stav, čo chýba) ako v paneli; userov je málo
    return next((r for r in service_user_overview(ctx=ctx)["users"] if int(r["id"]) == int(user_id)), None)


def service_outreach_draft(user_id: int, *, steps: Optional[List[str]] = None, ctx: AuthCtx) -> Dict[str, Any]:
    row = _row_for(user_id, ctx=ctx)
    if not row:
        return {"ok": False, "code": "user_not_found"}
    draft = build_draft(row, _load_templates(ctx=ctx), steps)
    return {"ok": True, "smtp": email_configured(), "provider": email_provider(), "zoho_missing": zoho_missing(), **draft}


def service_outreach_templates_get(*, ctx: AuthCtx) -> Dict[str, Any]:
    return {"ok": True, "templates": _load_templates(ctx=ctx), "defaults": DEFAULT_TEMPLATES}


def service_outreach_templates_save(templates: Any, *, ctx: AuthCtx) -> Dict[str, Any]:
    """Uloží predlohu z admin panelu. Prázdne pole = pôvodný text (nič sa neuloží)."""
    if not isinstance(templates, dict):
        return {"ok": False, "code": "invalid_templates"}
    clean: Dict[str, Dict[str, str]] = {}
    for lang in LANGS:
        src = templates.get(lang) if isinstance(templates.get(lang), dict) else {}
        clean[lang] = {
            f: str(src[f])[:5000]
            for f in TEMPLATE_FIELDS
            if isinstance(src.get(f), str) and src[f].strip() and src[f] != DEFAULT_TEMPLATES[lang][f]
        }
    try:
        db_set_app_setting(TEMPLATES_KEY, clean, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[OUTREACH] templates save failed: {repr(e)}")
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "templates": _load_templates(ctx=ctx)}


def service_outreach_send(
    user_id: int, subject: str, body: str, *, force: bool = False, kind: str = NUDGE, ctx: AuthCtx
) -> Dict[str, Any]:
    subject = (subject or "").strip()
    body = (body or "").strip()
    if not subject or not body:
        return {"ok": False, "code": "empty_message"}

    row = _row_for(user_id, ctx=ctx)
    if not row or not row.get("email"):
        return {"ok": False, "code": "user_not_found"}
    if kind == NUDGE and _sent_nudge(row) and not force:
        return {"ok": False, "code": "already_sent"}

    ok, err = send_email(row["email"], subject, body)
    if not ok:
        return {"ok": False, "code": err or "send_failed"}

    # záznam až po úspešnom odoslaní; jeho chyba mail nevráti, len zaloguje
    sent_at = datetime.now(timezone.utc).isoformat()
    try:
        prev = (db_get_pref_single(user_id, OUTREACH_KEY, ctx=ctx) or {}).get("value")
        prev = prev if isinstance(prev, dict) else {}
        sent = [o for o in (prev.get("sent") or []) if isinstance(o, dict)]
        sent.append({"kind": kind, "at": sent_at, "subject": subject[:200]})
        db_upsert_pref_single(user_id, OUTREACH_KEY, {**prev, "sent": sent[-20:]}, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[OUTREACH] record failed user={user_id}: {repr(e)}")
    return {"ok": True, "sent_at": sent_at}


def service_zoho_connect(code: str) -> Dict[str, Any]:
    """Kód zo Zoho API Console → refresh token na prepísanie do Railway (nikam sa neukladá)."""
    if not (code or "").strip():
        return {"ok": False, "code": "zoho_code_invalid"}
    try:
        return zoho_exchange_code(code)
    except Exception as e:  # noqa: BLE001
        print(f"[OUTREACH] zoho connect failed: {repr(e)}")
        return {"ok": False, "code": "zoho_code_invalid"}

