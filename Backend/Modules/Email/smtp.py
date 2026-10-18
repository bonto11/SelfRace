# Modules/Email/smtp.py
"""
Odoslanie e-mailu cez SMTP (noreply@selfrace.com) – len stdlib, bez ďalšieho balíka.

Údaje sú rovnaké ako vlastné SMTP v Supabase Auth (Authentication → SMTP Settings):
SMTP_HOST, SMTP_PORT (465 = SSL, inak STARTTLS), SMTP_USER, SMTP_PASSWORD,
SMTP_FROM, SMTP_REPLY_TO (odpovede idú na support).
"""
from __future__ import annotations

import html
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid, parseaddr
from typing import Optional, Tuple

from Configs.config import (
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_REPLY_TO,
    SMTP_USER,
)

_URL_RE = re.compile(r"(https?://[^\s<]+|[\w.+-]+@[\w-]+\.[\w.-]+)")


def smtp_configured() -> bool:
    return bool(SMTP_HOST)


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


def send_email(to: str, subject: str, text: str, *, reply_to: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """(ok, chyba). Neposiela nič, keď SMTP nie je nastavené."""
    if not smtp_configured():
        return False, "smtp_not_configured"
    name, addr = parseaddr(to or "")
    if "@" not in addr:
        return False, "invalid_recipient"

    msg = EmailMessage()
    from_name, from_addr = parseaddr(SMTP_FROM)
    msg["From"] = formataddr((from_name or "SelfRace", from_addr or "noreply@selfrace.com"))
    msg["To"] = formataddr((name, addr))
    msg["Subject"] = subject
    msg["Reply-To"] = reply_to or SMTP_REPLY_TO
    msg["Message-ID"] = make_msgid(domain=(from_addr or "selfrace.com").split("@")[-1])
    msg.set_content(text)
    msg.add_alternative(_text_to_html(text), subtype="html")

    try:
        ctx = ssl.create_default_context()
        if int(SMTP_PORT) == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx, timeout=20) as s:
                if SMTP_USER:
                    s.login(SMTP_USER, SMTP_PASSWORD or "")
                s.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
                s.starttls(context=ctx)
                if SMTP_USER:
                    s.login(SMTP_USER, SMTP_PASSWORD or "")
                s.send_message(msg)
    except Exception as e:  # noqa: BLE001
        print(f"[EMAIL] send to {addr} failed: {repr(e)}")
        return False, "send_failed"
    return True, None
