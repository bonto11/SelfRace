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
COMEBACK = "comeback"
PRE_NUDGE_HOURS = 24          # skôr nedať userovi šancu dokončiť to sám
NUDGE_MAX_DAYS = 30           # starší „len registrovaní“ idú ako „dlhšie som ťa nevidel“
COMEBACK_DAYS = 14            # toľko dní bez appky = kandidát na „dlhšie som ťa nevidel“
RESEND_DAYS = 60              # po akomkoľvek maile ďalší najskôr o toľko dní (inak len s force)

APP_URL = (FRONTEND_URL or "https://www.selfrace.com").rstrip("/")

# Predloha mailu – upravuje sa v admin paneli (app_settings `outreach.templates`),
# tu je len pôvodná verzia (záloha pre chýbajúce polia a „Vrátiť pôvodnú“).
# Premenné: {meno} = krstné meno (bez mena zmizne aj s čiarkou/medzerou pred ním),
# {kroky} = úvod + zoznam toho, čo userovi chýba (alebo veta pre „nič nechýba“),
# {odkaz} = adresa appky, {follow} = výzva na follow (Instagram / Facebook), keď je zaškrtnutá.
TEMPLATES_KEY = "outreach.templates"
TEMPLATE_FIELDS = (
    "subject", "subject_comeback", "body", "steps_intro",
    "step_profile", "step_strava", "step_goal", "step_strength_log", "nothing_missing", "step_follow",
)
LANGS = ("sk", "cs", "en")

# PREČO 1. osoba („ja“, nie „my“): SelfRace robí jeden človek – mail má byť osobný 1 na 1,
# vďačný a bez tlaku. Userovi sa nehovorí v minulom čase (urobil/urobila), aby text sedel
# bez ohľadu na rod; „nevidel som ťa“ je o odosielateľovi.
DEFAULT_TEMPLATES: Dict[str, Dict[str, str]] = {
    "sk": {
        "subject": "{meno}, ďakujem, že skúšaš SelfRace 🙏",
        "subject_comeback": "{meno}, ako sa máš? 👋",
        "body": (
            "Ahoj {meno},\n\n"
            "ďakujem, že skúšaš SelfRace – naozaj si to vážim. Volám sa Patrik a SelfRace robím sám, "
            "z lásky k behu a pohybu. Každý nový človek, ktorý mu dá šancu, mi spraví obrovskú radosť.\n\n"
            "Teší ma, že ti záleží na pohybe a zdraví – to je ten najdôležitejší krok a ten už máš za sebou. 💪\n\n"
            "{kroky}\n\n"
            "Všetko nájdeš tu: {odkaz}\n\n"
            "Keby čokoľvek nefungovalo, niečo ti chýbalo alebo máš nápad, napíš mi na support@selfrace.com – "
            "každú správu čítam sám a rád pomôžem.\n\n"
            "{follow}\n\n"
            "Drž sa a nech ťa pohyb baví,\nPatrik zo SelfRace"
        ),
        "steps_intro": "Aby ti SelfRace vedel naozaj pomôcť, chýba ešte pár drobností – pokojne, keď sa ti to bude hodiť:",
        "step_profile": "vybrať si, na čo sa zameriavaš (beh, posilňovanie, OCR, zdravie…) – appka ti potom ukáže len to, čo potrebuješ",
        "step_strava": "prepojiť Stravu (je zadarmo, netreba prémiový účet – stačia hodinky alebo len mobil) – AI tréner ti potom zhodnotí každý tréning",
        "step_goal": "nastaviť si cieľ a koľko času máš na tréning – AI tréner ti podľa toho poskladá plán alebo poradí s tým tvojím",
        "step_strength_log": "zapísať prvý silový tréning – potom uvidíš svoj progres a AI tréner ti skontroluje týždeň",
        "nothing_missing": (
            "Dlhšie som ťa v appke nevidel, tak som sa chcel len ozvať – ako sa máš a ako ti ide tréning? "
            "Ak ti v SelfRace niečo nesedí, budem rád, keď mi dáš vedieť. Každá spätná väzba mi pomôže appku zlepšiť."
        ),
        "step_follow": (
            "📸 Ak ťa baví pohyb, budem rád, keď budeš sledovať SelfRace na Instagrame @selfrace.app – "
            "pridávam tam veľa užitočných rád, noviniek a zaujímavostí: https://www.instagram.com/selfrace.app\n"
            "👍 Instagram nepoužívaš? SelfRace nájdeš aj na Facebooku."
        ),
    },
    "cs": {
        "subject": "{meno}, děkuju, že zkoušíš SelfRace 🙏",
        "subject_comeback": "{meno}, jak se máš? 👋",
        "body": (
            "Ahoj {meno},\n\n"
            "děkuju, že zkoušíš SelfRace – opravdu si toho vážím. Jmenuju se Patrik a SelfRace dělám sám, "
            "z lásky k běhu a pohybu. Každý nový člověk, který mu dá šanci, mi udělá obrovskou radost.\n\n"
            "Těší mě, že ti záleží na pohybu a zdraví – to je ten nejdůležitější krok a ten už máš za sebou. 💪\n\n"
            "{kroky}\n\n"
            "Všechno najdeš tady: {odkaz}\n\n"
            "Kdyby cokoli nefungovalo, něco ti chybělo nebo máš nápad, napiš mi na support@selfrace.com – "
            "každou zprávu čtu sám a rád pomůžu.\n\n"
            "{follow}\n\n"
            "Drž se a ať tě pohyb baví,\nPatrik ze SelfRace"
        ),
        "steps_intro": "Aby ti SelfRace mohl opravdu pomoct, chybí ještě pár drobností – klidně, až se ti to bude hodit:",
        "step_profile": "vybrat si, na co se zaměřuješ (běh, posilování, OCR, zdraví…) – aplikace ti pak ukáže jen to, co potřebuješ",
        "step_strava": "propojit Stravu (je zdarma, není potřeba prémiový účet – stačí hodinky nebo jen mobil) – AI trenér ti pak vyhodnotí každý trénink",
        "step_goal": "nastavit si cíl a kolik času máš na trénink – AI trenér ti podle toho sestaví plán nebo poradí s tím tvým",
        "step_strength_log": "zapsat první silový trénink – pak uvidíš svůj pokrok a AI trenér ti zkontroluje týden",
        "nothing_missing": (
            "Delší dobu jsem tě v aplikaci neviděl, tak jsem se chtěl jen ozvat – jak se máš a jak ti jde trénink? "
            "Pokud ti v SelfRace něco nesedí, budu rád, když mi dáš vědět. Každá zpětná vazba mi pomůže aplikaci zlepšit."
        ),
        "step_follow": (
            "📸 Jestli tě baví pohyb, budu rád, když budeš sledovat SelfRace na Instagramu @selfrace.app – "
            "přidávám tam spoustu užitečných rad, novinek a zajímavostí: https://www.instagram.com/selfrace.app\n"
            "👍 Instagram nepoužíváš? SelfRace najdeš i na Facebooku."
        ),
    },
    "en": {
        "subject": "{meno}, thank you for trying SelfRace 🙏",
        "subject_comeback": "{meno}, how are you? 👋",
        "body": (
            "Hi {meno},\n\n"
            "thank you for trying SelfRace – it really means a lot to me. I'm Patrik and I build SelfRace on my own, "
            "out of love for running and movement. Every new person who gives it a chance makes my day.\n\n"
            "I'm glad you care about staying active and healthy – that's the most important step, and you've already taken it. 💪\n\n"
            "{kroky}\n\n"
            "Everything is here: {odkaz}\n\n"
            "If anything doesn't work, something's missing or you have an idea, just write to me at support@selfrace.com – "
            "I read every message myself and I'm happy to help.\n\n"
            "{follow}\n\n"
            "Take care and enjoy moving,\nPatrik from SelfRace"
        ),
        "steps_intro": "To let SelfRace really help you, a few small things are still missing – whenever it suits you:",
        "step_profile": "pick your focus (running, strength, OCR, health…) – the app then shows only what you need",
        "step_strava": "connect Strava (it's free, no premium account needed – a watch or just your phone is enough) – your AI coach will then review every workout",
        "step_goal": "set your goal and how much time you have for training – your AI coach will build a plan or advise on your own one",
        "step_strength_log": "log your first strength workout – you'll see your progress and your AI coach will check your week",
        "nothing_missing": (
            "I haven't seen you in the app for a while, so I just wanted to check in – how are you and how's your training going? "
            "If something in SelfRace doesn't feel right, I'd love to hear it. Every bit of feedback helps me make the app better."
        ),
        "step_follow": (
            "📸 If you enjoy moving, I'd be glad if you followed SelfRace on Instagram @selfrace.app – "
            "I post lots of useful tips, news and interesting stuff: https://www.instagram.com/selfrace.app\n"
            "👍 Not on Instagram? You'll find SelfRace on Facebook too."
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


def _last_sent(row: Dict[str, Any]) -> Optional[str]:
    """Posledný mail akéhokoľvek druhu, alebo None."""
    dates = [o.get("at") for o in row.get("outreach") or [] if o.get("at")]
    return max(dates) if dates else None


def _recently_sent(row: Dict[str, Any], now: datetime) -> bool:
    last = _dt(_last_sent(row))
    return bool(last and now - last < timedelta(days=RESEND_DAYS))


def _last_active(row: Dict[str, Any]) -> Optional[datetime]:
    """Kedy bol user naposledy v appke (zásah, otvorenie appky alebo prihlásenie)."""
    app = row.get("app") if isinstance(row.get("app"), dict) else {}
    dates = [_dt(row.get("last_action_at")), _dt(app.get("last_seen_at")), _dt(row.get("last_sign_in_at"))]
    dates = [d for d in dates if d]
    return max(dates) if dates else _dt(row.get("registered_at"))


def _inactive_days(row: Dict[str, Any], now: datetime) -> Optional[int]:
    last = _last_active(row)
    return (now - last).days if last else None


def _reason(row: Dict[str, Any], now: datetime) -> Optional[str]:
    """
    Prečo je user kandidát: `nudge` = čerstvo registrovaný, nič nenastavil;
    `comeback` = dlhšie nebol v appke (aj starí „len registrovaní“). None = nie je.
    PREČO aj comeback: pôvodne boli kandidáti len čerstvo registrovaní, takže
    useri, čo prestali chodiť, sa v zozname nikdy neukázali.
    """
    reg = _dt(row.get("registered_at"))
    if not reg or not row.get("email") or _recently_sent(row, now):
        return None
    age = now - reg
    if timedelta(hours=PRE_NUDGE_HOURS) <= age <= timedelta(days=NUDGE_MAX_DAYS) and not _sent_nudge(row):
        # nič neurobil, alebo mu chýba zdroj dát (Strava / silový zápis) a nič vlastné nespravil
        if row.get("status") == "registered" or (not row.get("last_action_at") and bool(_missing(row))):
            return NUDGE
    inactive = _inactive_days(row, now)
    if age >= timedelta(days=COMEBACK_DAYS) and inactive is not None and inactive >= COMEBACK_DAYS:
        return COMEBACK
    return None


def _is_candidate(row: Dict[str, Any], now: datetime) -> bool:
    return _reason(row, now) is not None


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

    reason = _reason(row, datetime.now(timezone.utc))
    if steps is None:
        # dlhšie nebol: „dlhšie som ťa nevidel“ + čo mu ešte chýba
        base = ["comeback", *missing] if reason == COMEBACK else (missing or ["comeback"])
        chosen = [k for k in STEP_KEYS if k in base] + ["follow"]
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
        "subject": _fill_name(t["subject_comeback"] if reason == COMEBACK else t["subject"], name),
        "body": body,
        "reason": reason,
        "kind": COMEBACK if reason == COMEBACK else NUDGE,
        "inactive_days": _inactive_days(row, datetime.now(timezone.utc)),
        "sent_at": _last_sent(row),
        "recently_sent": _recently_sent(row, datetime.now(timezone.utc)),
    }


def _brief(row: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "email": row.get("email") or "",
        "name": row.get("name") or "",
        "status": row.get("status"),
        "registered_at": row.get("registered_at"),
        "missing": _missing(row),
        "sent_at": _last_sent(row),
        "reason": _reason(row, now),
        "inactive_days": _inactive_days(row, now),
        "candidate": _is_candidate(row, now),
    }


def service_outreach_candidates(*, ctx: AuthCtx) -> Dict[str, Any]:
    """Všetci useri v skratke + príznak, kto je kandidát na pripomienku (kandidáti prví)."""
    now = datetime.now(timezone.utc)
    rows = service_user_overview(ctx=ctx)["users"]
    users = [_brief(r, now) for r in rows]
    # kandidáti prví, z nich najdlhšie neaktívni hore
    users.sort(key=lambda u: (not u["candidate"], u.get("sent_at") is not None, -(u.get("inactive_days") or 0), -(u.get("id") or 0)))
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


# skúšobné maily adminovi: šablóna → bloky, ktoré sa do mailu dajú
TEST_TEMPLATES: Dict[str, List[str]] = {
    "nudge": ["profile", "strava", "goal", "strength_log", "follow"],
    "comeback": ["comeback", "profile", "strava", "goal", "strength_log", "follow"],
    "comeback_only": ["comeback", "follow"],
}


def build_test_outreach(template: str, lang: str, name: str, *, ctx: AuthCtx) -> Optional[Dict[str, str]]:
    """Mail z uloženej predlohy so všetkými blokmi danej šablóny – nič sa nezapisuje."""
    steps = TEST_TEMPLATES.get(template)
    if steps is None:
        return None
    lang = lang if lang in LANGS else "sk"
    templates = _load_templates(ctx=ctx)
    draft = build_draft({"lang": lang, "name": name}, templates, steps)
    t = templates[lang]
    # PREČO predmet zvlášť: build_draft ho volí podľa stavu usera, tu podľa šablóny
    subject = t["subject"] if template == "nudge" else t["subject_comeback"]
    return {"subject": _fill_name(subject, _first_name(name)), "body": draft["body"]}


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
    if _recently_sent(row, datetime.now(timezone.utc)) and not force:
        return {"ok": False, "code": "already_sent"}
    return _deliver(row, subject, body, kind=kind, ctx=ctx)


def _deliver(row: Dict[str, Any], subject: str, body: str, *, kind: str, ctx: AuthCtx) -> Dict[str, Any]:
    """Odoslanie + záznam k userovi (row už overený volajúcim)."""
    user_id = int(row["id"])
    if kind not in (NUDGE, COMEBACK):
        kind = NUDGE
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


BULK_MAX = 50


def service_outreach_send_bulk(
    user_ids: List[int], *, steps: Optional[List[str]] = None, force: bool = False, ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Hromadné odoslanie: každému userovi sa poskladá vlastný mail (jazyk, meno,
    predmet podľa druhu) z rovnakých blokov – steps=None = podľa toho, čo mu chýba.
    Kto dostal mail za posledných 60 dní, sa bez force preskočí. Chyba jedného
    usera nezastaví ostatných.
    """
    ids = list(dict.fromkeys(int(i) for i in user_ids))[:BULK_MAX]
    if not ids:
        return {"ok": False, "code": "no_users"}
    now = datetime.now(timezone.utc)
    rows = {int(r["id"]): r for r in service_user_overview(ctx=ctx)["users"]}
    templates = _load_templates(ctx=ctx)
    results: List[Dict[str, Any]] = []
    for uid in ids:
        row = rows.get(uid)
        if not row or not row.get("email"):
            results.append({"user_id": uid, "ok": False, "code": "user_not_found"})
            continue
        if _recently_sent(row, now) and not force:
            results.append({"user_id": uid, "ok": False, "code": "already_sent"})
            continue
        draft = build_draft(row, templates, steps)
        try:
            res = _deliver(row, draft["subject"], draft["body"], kind=draft["kind"], ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[OUTREACH] bulk send failed user={uid}: {repr(e)}")
            res = {"ok": False, "code": "send_failed"}
        results.append({"user_id": uid, "email": row.get("email"), **res})
    sent = sum(1 for r in results if r.get("ok"))
    return {"ok": True, "sent": sent, "failed": len(results) - sent, "results": results}


def service_zoho_connect(code: str) -> Dict[str, Any]:
    """Kód zo Zoho API Console → refresh token na prepísanie do Railway (nikam sa neukladá)."""
    if not (code or "").strip():
        return {"ok": False, "code": "zoho_code_invalid"}
    try:
        return zoho_exchange_code(code)
    except Exception as e:  # noqa: BLE001
        print(f"[OUTREACH] zoho connect failed: {repr(e)}")
        return {"ok": False, "code": "zoho_code_invalid"}

