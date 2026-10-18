# Modules/Email/smtp.py
"""
Odoslanie e-mailu (noreply@selfrace.com, odpovede na SMTP_REPLY_TO = support).

Cesty v poradí, prvá nastavená vyhráva:
1. Resend (RESEND_API_KEY) – HTTPS API, doména overená v Resend.
2. ZeptoMail (ZEPTOMAIL_TOKEN, ZEPTOMAIL_URL) – HTTPS API od Zoho.
3. SMTP (SMTP_HOST, SMTP_PORT 465 = SSL inak STARTTLS, SMTP_USER, SMTP_PASSWORD).
PREČO HTTPS: Railway na Free/Hobby pláne blokuje odchádzajúce SMTP porty –
spojenie na smtp.zoho.eu končilo timeoutom. SMTP ostáva pre lokál / iný hosting.
"""
from __future__ import annotations

import html
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid, parseaddr
from typing import Optional, Tuple

import httpx

from Configs.config import (
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

    send = {"resend": _send_resend, "zeptomail": _send_zeptomail, "smtp": _send_smtp}[provider]
    try:
        return send(name, addr, subject, text, reply_to or SMTP_REPLY_TO)
    except Exception as e:  # noqa: BLE001
        print(f"[EMAIL] {provider} send to {addr} failed: {repr(e)}")
        return False, "send_failed"
