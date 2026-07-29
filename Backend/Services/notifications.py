# Services/notifications.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from pywebpush import webpush, WebPushException
from DB.notifications import (
    db_upsert_push_subscription,
    db_get_user_subscriptions,
    db_delete_push_subscription,
    db_mark_push_subscription_success,
)
from Modules.Supabase.auth import AuthCtx

from Services.AI.monthly_review.generate import service_generate_monthly_review

from DB.activities_enrichment import db_get_unreviewed_activities_for_push
from DB.user_recovery import db_get_recovery_record
from DB.coach_plan_daily import db_has_uncompleted_daily_sessions
from DB.users import db_list_users_for_cron
from DB.user_prefs import db_get_pref_single
from Services.AI.provider.provider import get_ai_health_status
from Modules.Supabase.client import get_service_client

from Configs.config import VAPID_PRIVATE_KEY, VAPID_CLAIM_EMAIL

# =====================================================================
# LOKÁLNE PREKLADY PRE PUSH NOTIFIKÁCIE
# =====================================================================
PUSH_TRANSLATIONS = {
    "sk": {
        "recovery_title": "Nezabudni na Ranné Recovery 🔋",
        "recovery_body": "Zadaj info o spánku a HR nech presne vieme, ako si na tom.",
        "review_title": "Ako sa ti dnes išlo? 🏃",
        "review_body": "Ohodnoť svoj posledný tréning.",
        "training_title": "Dnes ťa ešte čaká tréning! 👟",
        "training_body": "Tvoj plán na dnes ešte nie je splnený. Stíhaš to?",
        "progress_title": "Nová Analýza Výkonnosti 📈",
        "progress_body": "Tvoj Athlete State bol práve aktualizovaný. Pozri si svoj progres!",
        "test_title": "Test Notifikácie 🚀",
        "test_body": "Všetko funguje! PWA je pripravená a smeruje ťa na domovskú obrazovku.",
        "autorecovery_applied_title": "Úprava dnešného tréningu 🧘",
        "autorecovery_applied_body": "Dnes si mal horšiu noc. Zmenili sme tvoj tréning na ľahkú regeneráciu.",
        "monthly_summary_title": "Mesačný prehľad je hotový 📊",
        "monthly_summary_body": "Tvoj tréningový súhrn za minulý mesiac je pripravený. Pozri si, čo sa podarilo!",
        "new_activity_title": "Nová aktivita je v appke! 🏃",
        "new_activity_body": "Tvoja nová aktivita bola pridaná. Pozri si detaily.",
        "new_record_title": "Nový osobný rekord! 🏆",
        "new_record_body_with_delta": "Čas zlepšený o {delta} na {label}. Nový čas je {value}.",
        "new_record_body_no_delta": "Nový čas na {label}: {value}.",
        "new_record_body_distance": "Nová najdlhšia vzdialenosť: {value} (o {delta} viac).",
        "new_record_body_time": "Nový najdlhší čas: {value} (o {delta} viac).",
    },
    "en": {
        "recovery_title": "Morning Recovery Reminder 🔋",
        "recovery_body": "Log your sleep and HR so we know exactly how you're doing.",
        "review_title": "How did it go today? 🏃",
        "review_body": "Rate and review your latest training session.",
        "training_title": "Training pending today! 👟",
        "training_body": "Your plan for today is not finished yet. Will you make it?",
        "progress_title": "New Performance Analysis 📈",
        "progress_body": "Your Athlete State was just updated. Check out your progress!",
        "test_title": "Test Notification 🚀",
        "test_body": "Everything works! The PWA is ready and routing you to the home screen.",
        "autorecovery_applied_title": "Today's training adjusted 🧘",
        "autorecovery_applied_body": "You had a rough night. We changed today's training to a light recovery session.",
        "monthly_summary_title": "Monthly summary ready 📊",
        "monthly_summary_body": "Your training summary for last month is ready. Check out what you achieved!",
        "new_activity_title": "New activity imported! 🏃",
        "new_activity_body": "Your new activity was added. Check out the details.",
        "new_record_title": "New personal record! 🏆",
        "new_record_body_with_delta": "Time improved by {delta} for {label}. New time is {value}.",
        "new_record_body_no_delta": "New time for {label}: {value}.",
        "new_record_body_distance": "New longest distance: {value} ({delta} more).",
        "new_record_body_time": "New longest time: {value} ({delta} more).",
    },
}

# =====================================================================
# POMOCNÉ FUNKCIE
# =====================================================================


def _get_user_language(user_id: int, ctx: AuthCtx) -> str:
    """Zistí preferovaný jazyk užívateľa z DB. Fallback je 'en'."""
    pref = db_get_pref_single(user_id=user_id, key="user.settings", ctx=ctx)
    if pref and isinstance(pref.get("value"), dict):
        lang = pref["value"].get("language")
        if lang in ["sk", "en"]:
            return lang
    return "en"


def service_save_push_subscription(
    user_id: int,
    subscription_data: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    endpoint = subscription_data.get("endpoint")
    keys = subscription_data.get("keys", {})
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")

    if not endpoint or not p256dh or not auth:
        raise ValueError("Neplatný formát push subscription objektu.")

    return db_upsert_push_subscription(
        user_id=user_id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
        ctx=ctx,
    )


def service_delete_push_subscription(
    user_id: int,
    endpoint: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    if not endpoint:
        raise ValueError("Chýba endpoint na vymazanie.")
    db_delete_push_subscription(endpoint=endpoint, ctx=ctx)
    return {"success": True, "message": "Odber bol úspešne vymazaný."}


# =====================================================================
# UNIVERZÁLNY ODOSIELATEĽ
# =====================================================================

# Push služby (FCM/Apple/Mozilla) hlásia "táto subscription už neexistuje"
# buď ako 410 Gone (najčastejšie), alebo 404 Not Found (niektoré edge-casy,
# najmä pri FCM endpointoch). Oboje znamená to isté: zariadenie/appka bola
# zmazaná/preinštalovaná alebo subscription bola inak zrušená -> vymaž ju
# z DB hneď, nečakaj na ďalší pokus.
STALE_SUBSCRIPTION_STATUS_CODES = (404, 410)


def _describe_push_service(endpoint: str) -> str:
    """
    Rozpozná push službu/platformu priamo z domény endpointu — bez toho
    by si v logoch nevedel, či ide o iOS (Apple), Android/Chrome (FCM),
    alebo Firefox (Mozilla). Rôzne služby sa aj rôzne správajú (napr.
    Apple vie nahlásiť 410 s oneskorením oproti FCM).
    """
    e = (endpoint or "").lower()
    if "web.push.apple.com" in e:
        return "apple"
    if "fcm.googleapis.com" in e or "android.googleapis.com" in e:
        return "fcm"
    if "updates.push.services.mozilla.com" in e:
        return "mozilla"
    return "unknown"


def _endpoint_fingerprint(endpoint: str) -> str:
    """
    Krátky identifikátor endpointu pre logy — posledných 12 znakov.
    Endpoint samotný je citlivý/dlhý token (funguje ako prístupový kľúč
    k odoslaniu notifikácie danému zariadeniu), preto ho nikdy nelogujeme
    celý — len tento "odtlačok" na rozlíšenie inštancií v logoch.
    """
    if not endpoint:
        return "?"
    return endpoint[-12:]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def service_send_push_notification(
    user_id: int,
    title: str,
    body: str,
    url: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    POZOR na interpretáciu výsledku: "success" tu znamená, že push služba
    (Apple/FCM/Mozilla) POŽIADAVKU PRIJALA (zvyčajne HTTP 200/201) — nie že
    sa notifikácia reálne doručila na zariadenie. Web Push protokol vo
    všeobecnosti nevracia potvrdenie o doručení. Apple vie prijať požiadavku
    aj pre už neplatný token a zlyhanie (404/410) nahlási až o pár pokusov
    neskôr — preto sa môže stať, že DB krátkodobo ukazuje "úspešne odoslané"
    aj pre zariadenie, ktoré appku už nemá. Toto je limitácia protokolu, nie
    chyba v tejto funkcii — presne preto máme last_success_at + plánovaný
    cron na postupné čistenie dávno-neúspešných záznamov.
    """
    subs = db_get_user_subscriptions(user_id=user_id, ctx=ctx)
    if not subs:
        print(f"[Push][user={user_id}] no subscriptions in DB, nothing to send")
        return {"success": False, "message": "User has no active subscriptions."}

    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "url": url,
            "icon": "/logo/actual/selfrace_icon.svg",
        }
    )

    success_count = 0
    error_count = 0
    details: List[Dict[str, Any]] = []

    print(
        f"[Push][user={user_id}] sending to {len(subs)} subscription(s) "
        f"title={title!r} url={url!r}"
    )

    for sub in subs:
        endpoint = sub.get("endpoint") or ""
        sub_id = sub.get("id")
        service_name = _describe_push_service(endpoint)
        fp = _endpoint_fingerprint(endpoint)
        log_prefix = f"[Push][user={user_id}][sub_id={sub_id}][service={service_name}][ep=...{fp}]"

        sub_info = {
            "endpoint": endpoint,
            "keys": {"p256dh": sub.get("p256dh"), "auth": sub.get("auth")},
        }

        entry: Dict[str, Any] = {
            "sub_id": sub_id,
            "service": service_name,
            "endpoint_fingerprint": fp,
            "ok": False,
            "status_code": None,
        }

        try:
            res = webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_CLAIM_EMAIL},
            )
            status_code = getattr(res, "status_code", None)
            print(
                f"{log_prefix} OK status={status_code} "
                "(push server accepted the request — toto NEZARUČUJE doručenie "
                "na zariadenie, len že push služba prijala požiadavku)"
            )
            db_mark_push_subscription_success(endpoint=endpoint, ctx=ctx)
            success_count += 1
            entry["ok"] = True
            entry["status_code"] = status_code

        except WebPushException as ex:
            status = ex.response.status_code if ex.response is not None else None
            body_text: Optional[str] = None
            headers_dict: Optional[Dict[str, str]] = None
            if ex.response is not None:
                try:
                    body_text = ex.response.text[:500]
                except Exception:
                    body_text = None
                try:
                    headers_dict = dict(ex.response.headers)
                except Exception:
                    headers_dict = None

            print(
                f"{log_prefix} FAIL status={status} "
                f"body={body_text!r} headers={headers_dict} "
                f"exception={repr(ex)}"
            )

            if status in STALE_SUBSCRIPTION_STATUS_CODES:
                # 🌟 Niektoré push endpointy (najmä FCM) vedia pre zaniknutú
                # subscription vrátiť aj 404, nielen 410 — oboje treba mazať
                # rovnako, inak zombie subscription zostane v DB a appka
                # bude tváriť, že notifikácie fungujú, hoci zariadenie už
                # neexistuje (presne bug, čo riešime).
                db_delete_push_subscription(endpoint=endpoint, ctx=ctx)
                print(f"{log_prefix} deleted stale subscription (status={status})")

            error_count += 1
            entry["status_code"] = status
            entry["error"] = repr(ex)

        except Exception as ex:  # noqa: BLE001
            # 🌟 FIX: predtým sa odchytávalo LEN WebPushException — akákoľvek
            # iná chyba (network timeout, DNS zlyhanie, chyba VAPID claims...)
            # by zhodila celý cyklus a ďalšie subscriptions daného usera by sa
            # vôbec neskúsili odoslať. Teraz sa zaloguje a pokračuje ďalej.
            print(f"{log_prefix} FAIL unexpected_error exception={repr(ex)}")
            error_count += 1
            entry["error"] = repr(ex)

        details.append(entry)

    print(
        f"[Push][user={user_id}] done: {success_count} ok, {error_count} failed "
        f"at {_now_iso()} | details={details}"
    )

    return {
        "success": True,
        "sent": success_count,
        "failed": error_count,
        "details": details,
    }


# =====================================================================
# CRON FUNKCIE
# =====================================================================


def service_cron_notify_recovery(ctx: AuthCtx) -> Dict[str, Any]:
    """Volané z denného cronu o 11:00."""
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    users = db_list_users_for_cron(ctx=ctx)
    total_sent = 0

    for u in users:
        user_id = u.get("id")
        if not user_id:
            continue
        if not db_get_recovery_record(user_id=user_id, date_iso=today_iso, ctx=ctx):
            lang = _get_user_language(user_id, ctx)
            t = PUSH_TRANSLATIONS[lang]
            res = service_send_push_notification(
                user_id=user_id,
                title=t["recovery_title"],
