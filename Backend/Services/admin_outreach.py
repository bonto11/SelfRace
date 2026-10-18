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

from Configs.config import FRONTEND_URL
from DB.user_prefs import db_get_pref_single, db_upsert_pref_single
from Modules.Email.smtp import send_email, smtp_configured
from Modules.Supabase.auth import AuthCtx
from Services.user_overview import OUTREACH_KEY, service_user_overview

NUDGE = "nudge"
PRE_NUDGE_HOURS = 24          # skôr nedať userovi šancu dokončiť to sám
NUDGE_MAX_DAYS = 30           # starší „len registrovaní“ už nie sú kandidáti
WELCOME_CLAIM_DAYS = 12       # uvítací týždeň platí pre účet mladší ako 14 dní

APP_URL = (FRONTEND_URL or "https://www.selfrace.com").rstrip("/")

# Texty mailu. Admin ich pred odoslaním môže upraviť – toto je len návrh.
TEXTS: Dict[str, Dict[str, Any]] = {
    "sk": {
        "subject_named": "{name}, tvoj AI tréner je pripravený 💪",
        "subject": "Tvoj AI tréner je pripravený 💪",
        "hello_named": "Ahoj {name},",
        "hello": "Ahoj,",
        "intro": (
            "vďaka, že skúšaš SelfRace! Teší ma, že ti záleží na pohybe a zdravom životnom štýle – "
            "presne o tom to celé je. Jediný súper je tvoje včerajšie ja."
        ),
        "missing_intro": "Všimol som si, že ti ešte chýba pár krokov, aby ti AI tréner mohol naplno pomáhať:",
        "items": {
            "profile": "vybrať si, na čo sa zameriavaš (beh, posilňovanie, OCR, zdravie…) – appka ti potom ukáže len to, čo potrebuješ",
            "strava": "prepojiť Stravu (stačí hodinky alebo mobil) – AI tréner ti potom zhodnotí každý tréning",
            "strava_welcome": ", v prvom týždni zadarmo",
            "goal": "nastaviť si cieľ a koľko času máš na tréning – AI tréner ti podľa toho poskladá plán alebo poradí s tvojím",
            "strength_log": "zapísať prvý silový tréning – AI tréner ti potom ukáže progres a skontroluje týždeň",
        },
        "nothing_missing": "Dlhšie som ťa v appke nevidel – tvoj AI tréner na teba stále čaká.",
        "cta": "Zaberie to pár minút: {url}",
        "contact": (
            "Ak niečo nejde alebo máš otázku, pokojne mi odpíš alebo napíš:\n"
            "✉️ support@selfrace.com\n📸 Instagram: @selfrace\n👍 Facebook: SelfRace"
        ),
        "sign": "Drž sa a teším sa na tvoje prvé tréningy,\nPatrik zo SelfRace",
    },
    "cs": {
        "subject_named": "{name}, tvůj AI trenér je připravený 💪",
        "subject": "Tvůj AI trenér je připravený 💪",
        "hello_named": "Ahoj {name},",
        "hello": "Ahoj,",
        "intro": (
            "díky, že zkoušíš SelfRace! Těší mě, že ti záleží na pohybu a zdravém životním stylu – "
            "přesně o tom to celé je. Jediný soupeř je tvoje včerejší já."
        ),
        "missing_intro": "Všiml jsem si, že ti ještě chybí pár kroků, aby ti AI trenér mohl naplno pomáhat:",
        "items": {
            "profile": "vybrat si, na co se zaměřuješ (běh, posilování, OCR, zdraví…) – aplikace ti pak ukáže jen to, co potřebuješ",
            "strava": "propojit Stravu (stačí hodinky nebo mobil) – AI trenér ti pak vyhodnotí každý trénink",
            "strava_welcome": ", v prvním týdnu zdarma",
            "goal": "nastavit si cíl a kolik času máš na trénink – AI trenér ti podle toho sestaví plán nebo poradí s tvým",
            "strength_log": "zapsat první silový trénink – AI trenér ti pak ukáže pokrok a zkontroluje týden",
        },
        "nothing_missing": "Delší dobu jsem tě v aplikaci neviděl – tvůj AI trenér na tebe pořád čeká.",
        "cta": "Zabere to pár minut: {url}",
        "contact": (
            "Pokud něco nejde nebo máš otázku, klidně mi odepiš nebo napiš:\n"
            "✉️ support@selfrace.com\n📸 Instagram: @selfrace\n👍 Facebook: SelfRace"
        ),
        "sign": "Drž se a těším se na tvoje první tréninky,\nPatrik ze SelfRace",
    },
    "en": {
        "subject_named": "{name}, your AI coach is ready 💪",
        "subject": "Your AI coach is ready 💪",
        "hello_named": "Hi {name},",
        "hello": "Hi,",
        "intro": (
            "thanks for giving SelfRace a try! I'm glad you care about staying active and healthy – "
            "that's what it's all about. Your only rival is who you were yesterday."
        ),
        "missing_intro": "I noticed a few steps are still missing before your AI coach can really help you:",
        "items": {
            "profile": "pick your focus (running, strength, OCR, health…) – the app then shows only what you need",
            "strava": "connect Strava (a watch or just your phone is enough) – your AI coach will then review every workout",
            "strava_welcome": ", free during your first week",
            "goal": "set your goal and how much time you have for training – your AI coach will build a plan or advise on yours",
            "strength_log": "log your first strength workout – your AI coach will then track your progress and check your week",
        },
        "nothing_missing": "I haven't seen you in the app for a while – your AI coach is still waiting for you.",
        "cta": "It only takes a few minutes: {url}",
        "contact": (
            "If anything doesn't work or you have a question, just reply or reach us at:\n"
            "✉️ support@selfrace.com\n📸 Instagram: @selfrace\n👍 Facebook: SelfRace"
        ),
        "sign": "Take care – looking forward to your first workouts,\nPatrik from SelfRace",
    },
}


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
    """Čo userovi chýba, aby mu AI tréner mohol pomáhať (poradie = poradie v maile)."""
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


def build_draft(row: Dict[str, Any], now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    lang = row.get("lang") if row.get("lang") in TEXTS else "sk"
    t = TEXTS[lang]
    name = _first_name(row.get("name") or "")
    missing = _missing(row)

    reg = _dt(row.get("registered_at"))
    welcome = bool(reg and now - reg <= timedelta(days=WELCOME_CLAIM_DAYS) and not row.get("activities30"))

    lines: List[str] = [t["hello_named"].format(name=name) if name else t["hello"], "", t["intro"], ""]
    if missing:
        lines.append(t["missing_intro"])
        for key in missing:
            item = t["items"][key]
            if key == "strava" and welcome:
                item += t["items"]["strava_welcome"]
            lines.append(f"– {item}")
    else:
        lines.append(t["nothing_missing"])
    lines += ["", t["cta"].format(url=APP_URL), "", t["contact"], "", t["sign"]]

    return {
        "user_id": row.get("id"),
        "to": row.get("email") or "",
        "name": row.get("name") or "",
        "lang": lang,
        "missing": missing,
        "subject": t["subject_named"].format(name=name) if name else t["subject"],
        "body": "\n".join(lines),
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
    return {"ok": True, "smtp": smtp_configured(), "users": users}


def list_nudge_candidates(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Kandidáti na pripomienku (pre upozornenie adminovi)."""
    now = datetime.now(timezone.utc)
    return [_brief(r, now) for r in service_user_overview(ctx=ctx)["users"] if _is_candidate(r, now)]


def _row_for(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    # PREČO celý prehľad: rovnaké pravidlá (stav, čo chýba) ako v paneli; userov je málo
    return next((r for r in service_user_overview(ctx=ctx)["users"] if int(r["id"]) == int(user_id)), None)


def service_outreach_draft(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    row = _row_for(user_id, ctx=ctx)
    if not row:
        return {"ok": False, "code": "user_not_found"}
    return {"ok": True, "smtp": smtp_configured(), **build_draft(row)}


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
