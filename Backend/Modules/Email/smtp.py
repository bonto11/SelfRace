# Modules/Email/smtp.py
"""
Odoslanie e-mailu (noreply@selfrace.com, odpovede na SMTP_REPLY_TO = support).

Cesty v poradí, prvá nastavená vyhráva:
1. Zoho Mail API (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNT_ID)
   – HTTPS, posiela priamo zo schránky v Zohu (noreply@ musí byť jej adresa alebo alias).
2. Resend (RESEND_API_KEY) – HTTPS API, doména overená v Resend.
3. ZeptoMail (ZEPTOMAIL_TOKEN, ZEPTOMAIL_URL) – HTTPS API od Zoho.
4. SMTP (SMTP_HOST, SMTP_PORT 465 = SSL inak STARTTLS, SMTP_USER, SMTP_PASSWORD).
PREČO HTTPS: Railway na Free/Hobby pláne blokuje odchádzajúce SMTP porty –
spojenie na smtp.zoho.eu končilo timeoutom. SMTP ostáva pre lokál / iný hosting.
"""
from __future__ import annotations

import html
import re
import smtplib
import ssl
import threading
import time
from email.message import EmailMessage
from email.utils import formataddr, make_msgid, parseaddr
from typing import Any, Dict, List, Optional, Tuple

import httpx

from Configs.config import (
    ZOHO_ACCOUNT_ID,
    ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET,
    ZOHO_DC,
    ZOHO_REFRESH_TOKEN,
    RESEND_API_KEY,
    ZEPTOMAIL_TOKEN,
    ZEPTOMAIL_URL,
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_REPLY_TO,
    SMTP_USER,
)

_URL_RE = re.compile(r"(https?://[^\s<]+|[\w.+-]+@[\w-]+\.[\w.-]+)")


def email_provider() -> Optional[str]:
    if ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN:
        return "zoho"
    if RESEND_API_KEY:
        return "resend"
    if ZEPTOMAIL_TOKEN:
        return "zeptomail"
    if SMTP_HOST:
        return "smtp"
    return None


def email_configured() -> bool:
    return email_provider() is not None


def _text_to_html(text: str) -> str:
    """Jednoduché HTML z textu: odstavce, zalomenia, klikateľné odkazy a e-maily."""
    def link(m: "re.Match[str]") -> str:
        v = m.group(0)
        href = v if v.startswith("http") else f"mailto:{v}"
        return f'<a href="{href}" style="color:#4d7c0f">{v}</a>'

    paras = []
    for block in re.split(r"\n\s*\n", text.strip()):
        escaped = html.escape(block)
        escaped = _URL_RE.sub(link, escaped)
        paras.append(f"<p style=\"margin:0 0 14px\">{escaped.replace(chr(10), '<br>')}</p>")
    return (
        '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;'
        'line-height:1.55;color:#111;max-width:560px">' + "".join(paras) + "</div>"
    )


def _sender() -> Tuple[str, str]:
    name, addr = parseaddr(SMTP_FROM)
    return name or "SelfRace", addr or "noreply@selfrace.com"


# ---------------- Zoho Mail API ----------------
# Access token žije 1 h – držíme ho v pamäti a obnovujeme refresh tokenom.
_ZOHO_ACCOUNTS = f"https://accounts.zoho.{ZOHO_DC}"
_ZOHO_MAIL = f"https://mail.zoho.{ZOHO_DC}"
_zoho_lock = threading.Lock()
_zoho_cache: Dict[str, Any] = {"token": None, "exp": 0.0, "account_id": ZOHO_ACCOUNT_ID}


def _zoho_access_token() -> str:
    with _zoho_lock:
        if _zoho_cache["token"] and _zoho_cache["exp"] > time.time() + 60:
            return str(_zoho_cache["token"])
        r = httpx.post(
            f"{_ZOHO_ACCOUNTS}/oauth/v2/token",
            params={
                "refresh_token": ZOHO_REFRESH_TOKEN,
                "client_id": ZOHO_CLIENT_ID,
                "client_secret": ZOHO_CLIENT_SECRET,
                "grant_type": "refresh_token",
            },
            timeout=15,
        )
        data = r.json() if r.content else {}
        token = data.get("access_token")
        if not token:
            raise RuntimeError(f"zoho token refresh failed: {r.status_code} {str(data)[:200]}")
        _zoho_cache["token"] = token
        _zoho_cache["exp"] = time.time() + float(data.get("expires_in") or 3600)
        return str(token)


def _zoho_accounts(token: str) -> List[Dict[str, Any]]:
    """Zoho účty pod tokenom: accountId + adresy, z ktorých sa dá posielať."""
    r = httpx.get(f"{_ZOHO_MAIL}/api/accounts", headers={"Authorization": f"Zoho-oauthtoken {token}"}, timeout=15)
    out: List[Dict[str, Any]] = []
    for a in (r.json() or {}).get("data") or []:
        addrs = {str(a.get("primaryEmailAddress") or "").lower()}
        for e in a.get("emailAddress") or []:
            addrs.add(str(e.get("mailId") or "").lower())
        for e in a.get("sendMailDetails") or []:
            addrs.add(str(e.get("fromAddress") or "").lower())
        out.append({"account_id": str(a.get("accountId")), "addresses": sorted(x for x in addrs if x)})
    return out


def _zoho_account_id(token: str) -> str:
    if _zoho_cache.get("account_id"):
        return str(_zoho_cache["account_id"])
    accounts = _zoho_accounts(token)
    sender = _sender()[1].lower()
    pick = next((a for a in accounts if sender in a["addresses"]), accounts[0] if accounts else None)
    if not pick:
        raise RuntimeError("zoho: žiadny účet pod tokenom")
    _zoho_cache["account_id"] = pick["account_id"]
    return pick["account_id"]


def _send_zoho(name: str, addr: str, subject: str, text: str, reply_to: str) -> Tuple[bool, Optional[str]]:
    # reply_to Zoho API nemá – odpovede idú na odosielateľa (alias v tej istej schránke)
    token = _zoho_access_token()
    account_id = _zoho_account_id(token)
    r = httpx.post(
        f"{_ZOHO_MAIL}/api/accounts/{account_id}/messages",
        headers={"Authorization": f"Zoho-oauthtoken {token}"},
        json={
            # čisté adresy (tak ich uvádza dokumentácia) – meno odosielateľa berie Zoho z nastavení aliasu
            "fromAddress": _sender()[1],
            "toAddress": addr,
            "subject": subject,
            "content": _text_to_html(text),
            "mailFormat": "html",
        },
        timeout=20,
    )
    code = ((r.json() if r.content else {}) or {}).get("status", {}).get("code")
    if r.status_code >= 300 or (code and int(code) >= 300):
        print(f"[EMAIL] zoho {r.status_code}: {r.text[:300]}")
        return False, "send_failed"
    return True, None


def zoho_exchange_code(code: str) -> Dict[str, Any]:
    """
    Jednorazovo: kód zo Zoho API Console (Self Client → Generate Code) → refresh token
    a zoznam účtov. Admin si ich prepíše do Railway (ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNT_ID).
    """
    if not (ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET):
        return {"ok": False, "code": "zoho_client_missing"}
    r = httpx.post(
        f"{_ZOHO_ACCOUNTS}/oauth/v2/token",
        params={
            "code": (code or "").strip(),
            "client_id": ZOHO_CLIENT_ID,
            "client_secret": ZOHO_CLIENT_SECRET,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    data = r.json() if r.content else {}
    refresh = data.get("refresh_token")
    access = data.get("access_token")
    if not refresh or not access:
        print(f"[EMAIL] zoho exchange failed: {r.status_code} {str(data)[:200]}")
        return {"ok": False, "code": "zoho_code_invalid", "detail": str(data.get("error") or "")}
    try:
        accounts = _zoho_accounts(str(access))
    except Exception as e:  # noqa: BLE001
        print(f"[EMAIL] zoho accounts failed: {repr(e)}")
        accounts = []
    return {"ok": True, "refresh_token": refresh, "accounts": accounts, "sender": _sender()[1]}


def _send_resend(name: str, addr: str, subject: str, text: str, reply_to: str) -> Tuple[bool, Optional[str]]:
    from_name, from_addr = _sender()
    r = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={
            "from": formataddr((from_name, from_addr)),
            "to": [formataddr((name, addr)) if name else addr],
            "subject": subject,
            "text": text,
            "html": _text_to_html(text),
            "reply_to": reply_to,
        },
        timeout=15,
    )
    if r.status_code >= 300:
        print(f"[EMAIL] resend {r.status_code}: {r.text[:300]}")
        return False, "send_failed"
    return True, None


def _send_zeptomail(name: str, addr: str, subject: str, text: str, reply_to: str) -> Tuple[bool, Optional[str]]:
    from_name, from_addr = _sender()
    token = str(ZEPTOMAIL_TOKEN or "")
    auth = token if token.lower().startswith("zoho-enczapikey") else f"Zoho-enczapikey {token}"
    r = httpx.post(
        ZEPTOMAIL_URL,
        headers={"Authorization": auth, "Accept": "application/json"},
        json={
            "from": {"address": from_addr, "name": from_name},
            "to": [{"email_address": {"address": addr, "name": name or addr}}],
            "reply_to": [{"address": reply_to}],
            "subject": subject,
            "textbody": text,
            "htmlbody": _text_to_html(text),
        },
        timeout=15,
    )
    if r.status_code >= 300:
        print(f"[EMAIL] zeptomail {r.status_code}: {r.text[:300]}")
        return False, "send_failed"
    return True, None


def _send_smtp(name: str, addr: str, subject: str, text: str, reply_to: str) -> Tuple[bool, Optional[str]]:
    msg = EmailMessage()
    msg["From"] = formataddr(_sender())
    msg["To"] = formataddr((name, addr))
    msg["Subject"] = subject
    msg["Reply-To"] = reply_to
    msg["Message-ID"] = make_msgid(domain=_sender()[1].split("@")[-1])
    msg.set_content(text)
    msg.add_alternative(_text_to_html(text), subtype="html")

    ctx = ssl.create_default_context()
    if int(SMTP_PORT) == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx, timeout=15) as s:
            if SMTP_USER:
                s.login(SMTP_USER, SMTP_PASSWORD or "")
            s.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
            s.starttls(context=ctx)
            if SMTP_USER:
                s.login(SMTP_USER, SMTP_PASSWORD or "")
            s.send_message(msg)
    return True, None


def send_email(to: str, subject: str, text: str, *, reply_to: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """(ok, chyba). Neposiela nič, keď nie je nastavená žiadna cesta."""
    provider = email_provider()
    if not provider:
        return False, "email_not_configured"
    name, addr = parseaddr(to or "")
    if "@" not in addr:
        return False, "invalid_recipient"

    send = {"zoho": _send_zoho, "resend": _send_resend, "zeptomail": _send_zeptomail, "smtp": _send_smtp}[provider]
    try:
        return send(name, addr, subject, text, reply_to or SMTP_REPLY_TO)
    except Exception as e:  # noqa: BLE001
        print(f"[EMAIL] {provider} send to {addr} failed: {repr(e)}")
        return False, "send_failed"
