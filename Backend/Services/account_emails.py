# Services/account_emails.py
"""
E-mail „tvoj účet bol zmazaný“ po tvrdom zmazaní účtu (cron po lehote aj
okamžité zmazanie z admin panela).

PREČO sa adresát číta pred mazaním: po `account_hard_delete` riadok v users
ani prefs (jazyk) už neexistujú. Chyba mailu nesmie zhodiť zmazanie.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Tuple

from DB.user_prefs import db_get_pref_single
from DB.users import db_get_users_basic
from Modules.Email.smtp import email_configured, send_email
from Modules.Supabase.auth import AuthCtx

DELETED_TEMPLATES: Dict[str, Dict[str, str]] = {
    "sk": {
        "subject": "Tvoj účet v SelfRace bol zmazaný",
        "body": (
            "Ahoj{meno},\n\n"
            "tvoj účet v SelfRace bol natrvalo zmazaný – spolu s aktivitami, plánmi, zápismi "
            "a ďalšími údajmi. Prepojenie so Stravou je zrušené a predplatné, ak si nejaké mal, "
            "sa už nebude obnovovať.\n\n"
            "Ak si o zmazanie nežiadal alebo sa chceš vrátiť, stačí sa znova zaregistrovať "
            "na https://selfrace.com – alebo nám napíš odpoveďou na tento e-mail.\n\n"
            "Ďakujeme, že si s nami trénoval.\n"
            "Tím SelfRace"
        ),
    },
    "cs": {
        "subject": "Tvůj účet v SelfRace byl smazán",
        "body": (
            "Ahoj{meno},\n\n"
            "tvůj účet v SelfRace byl natrvalo smazán – spolu s aktivitami, plány, záznamy "
            "a dalšími údaji. Propojení se Stravou je zrušené a předplatné, pokud jsi nějaké měl, "
            "se už nebude obnovovat.\n\n"
            "Pokud jsi o smazání nežádal nebo se chceš vrátit, stačí se znovu zaregistrovat "
            "na https://selfrace.com – nebo nám napiš odpovědí na tento e-mail.\n\n"
            "Děkujeme, že jsi s námi trénoval.\n"
            "Tým SelfRace"
        ),
    },
    "en": {
        "subject": "Your SelfRace account has been deleted",
        "body": (
            "Hi{meno},\n\n"
            "your SelfRace account has been permanently deleted – together with your activities, "
            "plans, logs and other data. The Strava connection is removed and your subscription, "
            "if you had one, will not renew.\n\n"
            "If you didn't ask for this or want to come back, just sign up again at "
            "https://selfrace.com – or reply to this e-mail.\n\n"
            "Thanks for training with us.\n"
            "The SelfRace team"
        ),
    },
}


def build_deleted_email(name: Optional[str], lang: Optional[str]) -> Tuple[str, str]:
    tpl = DELETED_TEMPLATES.get(lang or "sk") or DELETED_TEMPLATES["sk"]
    first = str(name or "").strip().split(" ")[0]
    return tpl["subject"], tpl["body"].replace("{meno}", f" {first}" if first else "")


def collect_deletion_recipients(user_ids: Iterable[int], *, ctx: AuthCtx) -> Dict[int, Dict[str, Any]]:
    """user_id -> {email, name, lang} – volá sa PRED zmazaním."""
    ids = sorted({int(u) for u in user_ids})
    out: Dict[int, Dict[str, Any]] = {}
    if not ids:
        return out
    try:
        rows = db_get_users_basic(ids, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[ACCOUNT-EMAIL] recipients read failed: {repr(e)}")
        return out
    for r in rows:
        email = str(r.get("mail_address") or "").strip()
        if not email:
            continue
        uid = int(r["id"])
        lang = None
        try:
            settings = (db_get_pref_single(uid, "user.settings", ctx=ctx) or {}).get("value")
            lang = settings.get("language") if isinstance(settings, dict) else None
        except Exception as e:  # noqa: BLE001
            print(f"[ACCOUNT-EMAIL] lang read failed user={uid}: {repr(e)}")
        out[uid] = {"email": email, "name": r.get("display_name"), "lang": lang if lang in DELETED_TEMPLATES else None}
    return out


def send_deleted_email(email: str, *, name: Optional[str] = None, lang: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    subject, body = build_deleted_email(name, lang)
    try:
        return send_email(email, subject, body)
    except Exception as e:  # noqa: BLE001
        return False, repr(e)


def notify_deleted_accounts(items: List[Dict[str, Any]], recipients: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
    """Mail len userom, ktorých SQL funkcia naozaj zmazala (bez `error`)."""
    if not recipients:
        return {"sent": 0, "failed": 0}
    if not email_configured():
        return {"sent": 0, "failed": 0, "skipped": "email_not_configured"}
    sent = failed = 0
    for it in items:
        if not isinstance(it, dict) or it.get("error") or it.get("dry_run"):
            continue
        rec = recipients.get(int(it.get("user_id") or 0))
        if not rec:
            continue
        ok, err = send_deleted_email(rec["email"], name=rec.get("name"), lang=rec.get("lang"))
        if ok:
            sent += 1
        else:
            failed += 1
            print(f"[ACCOUNT-EMAIL] send failed user={it.get('user_id')}: {err}")
    return {"sent": sent, "failed": failed}
