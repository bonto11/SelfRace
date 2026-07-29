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
# LOKALNE PREKLADY PRE PUSH NOTIFIKACIE
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
# POMOCNE FUNKCIE
# =====================================================================


def _get_user_language(user_id: int, ctx: AuthCtx) -> str:
    """Zisti preferovany jazyk uzivatela z DB. Fallback je 'en'."""
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
# UNIVERZALNY ODOSIELATEL
# =====================================================================

# Push sluzby (FCM/Apple/Mozilla) hlasia "tato subscription uz neexistuje"
# bud ako 410 Gone (najcastejsie), alebo 404 Not Found (niektore edge-casy,
# najma pri FCM endpointoch). Oboje znamena to iste: zariadenie/appka bola
# zmazana/preinstalovana alebo subscription bola inak zrusena -> vymaz ju
# z DB hned, necakaj na dalsi pokus.
STALE_SUBSCRIPTION_STATUS_CODES = (404, 410)


def _describe_push_service(endpoint: str) -> str:
    """
    Rozpozna push sluzbu/platformu priamo z domeny endpointu - bez toho
    by si v logoch nevedel, ci ide o iOS (Apple), Android/Chrome (FCM),
    alebo Firefox (Mozilla). Rozne sluzby sa aj rozne spravaju (napr.
    Apple vie nahlasit 410 s oneskorenim oproti FCM).
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
    Kratky identifikator endpointu pre logy - poslednych 12 znakov.
    Endpoint samotny je citlivy/dlhy token (funguje ako pristupovy kluc
    k odoslaniu notifikacie danemu zariadeniu), preto ho nikdy nelogujeme
    cely - len tento "odtlacok" na rozlisenie instancii v logoch.
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
    POZOR na interpretaciu vysledku: "success" tu znamena, ze push sluzba
    (Apple/FCM/Mozilla) POZIADAVKU PRIJALA (zvycajne HTTP 200/201) - nie ze
    sa notifikacia realne dorucila na zariadenie. Web Push protokol vo
    vseobecnosti nevracia potvrdenie o doruceni. Apple vie prijat poziadavku
    aj pre uz neplatny token a zlyhanie (404/410) nahlasi az o par pokusov
    neskor - preto sa moze stat, ze DB kratkodobo ukazuje "uspesne odoslane"
    aj pre zariadenie, ktore appku uz nema. Toto je limitacia protokolu, nie
    chyba v tejto funkcii - presne preto mame last_success_at + planovany
    cron na postupne cistenie davno-neuspesnych zaznamov.
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
                "(push server accepted the request - toto NEZARUCUJE dorucenie "
                "na zariadenie, len ze push sluzba prijala poziadavku)"
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
                # Niektore push endpointy (najma FCM) vedia pre zaniknutu
                # subscription vratit aj 404, nielen 410 - oboje treba mazat
                # rovnako, inak zombie subscription zostane v DB a appka
                # bude tvarit, ze notifikacie funguju, hoci zariadenie uz
                # neexistuje.
                db_delete_push_subscription(endpoint=endpoint, ctx=ctx)
                print(f"{log_prefix} deleted stale subscription (status={status})")

            error_count += 1
            entry["status_code"] = status
            entry["error"] = repr(ex)

        except Exception as ex:  # noqa: BLE001
            # FIX: predtym sa odchytavalo LEN WebPushException - akakolvek
            # ina chyba (network timeout, DNS zlyhanie, chyba VAPID claims...)
            # by zhodila cely cyklus a dalsie subscriptions daneho usera by sa
            # vobec neskusili odoslat. Teraz sa zaloguje a pokracuje dalej.
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
    """Volane z denneho cronu o 11:00."""
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
                body=t["recovery_body"],
                url="/recovery",
                ctx=ctx,
            )
            total_sent += res.get("sent", 0)

    return {"success": True, "sent": total_sent}


def service_cron_notify_review(ctx: AuthCtx) -> Dict[str, Any]:
    """Volane z hodinoveho cronu."""
    users = db_list_users_for_cron(ctx=ctx)
    total_sent = 0

    for u in users:
        user_id = u.get("id")
        if not user_id:
            continue
        pending = db_get_unreviewed_activities_for_push(user_id=user_id, ctx=ctx)
        if not pending:
            continue
        lang = _get_user_language(user_id, ctx)
        t = PUSH_TRANSLATIONS[lang]
        res = service_send_push_notification(
            user_id=user_id,
            title=t["review_title"],
            body=t["review_body"],
            url="/calendar",
            ctx=ctx,
        )
        total_sent += res.get("sent", 0)

    return {"success": True, "sent": total_sent}


def service_cron_notify_training(ctx: AuthCtx) -> Dict[str, Any]:
    """Volane z denneho cronu o 19:00."""
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    users = db_list_users_for_cron(ctx=ctx)
    total_sent = 0

    for u in users:
        user_id = u.get("id")
        if not user_id:
            continue
        if db_has_uncompleted_daily_sessions(
            user_id=user_id, plan_date=today_iso, ctx=ctx
        ):
            lang = _get_user_language(user_id, ctx)
            t = PUSH_TRANSLATIONS[lang]
            res = service_send_push_notification(
                user_id=user_id,
                title=t["training_title"],
                body=t["training_body"],
                url="/coach/ai/dailyPlan",
                ctx=ctx,
            )
            total_sent += res.get("sent", 0)

    return {"success": True, "sent": total_sent}


def service_cron_notify_monthly_summary(ctx: AuthCtx) -> Dict[str, Any]:
    """Volane 1. dna v mesiaci o 09:00. Generuje AI review a notifikuje userov."""
    now = datetime.now(timezone.utc)
    year = now.year - 1 if now.month == 1 else now.year
    month = 12 if now.month == 1 else now.month - 1

    users = db_list_users_for_cron(ctx=ctx)
    total_generated = 0
    total_notified = 0

    for u in users:
        user_id = u.get("id")
        if not user_id:
            continue

        try:
            result = service_generate_monthly_review(
                user_id=user_id,
                year=year,
                month=month,
                ctx=ctx,
                save_result=True,
            )
        except Exception as e:
            print(f"[MONTHLY-CRON] user={user_id} generate failed: {e}")
            continue

        if not result.get("ok"):
            continue

        total_generated += 1

        try:
            lang = _get_user_language(user_id, ctx)
            t = PUSH_TRANSLATIONS[lang]
            res = service_send_push_notification(
                user_id=user_id,
                title=t["monthly_summary_title"],
                body=t["monthly_summary_body"],
                url="/activities/monthlySummary",
                ctx=ctx,
            )
            total_notified += res.get("sent", 0)
        except Exception as e:
            print(f"[MONTHLY-CRON] user={user_id} notify failed: {e}")

    return {
        "success": True,
        "year": year,
        "month": month,
        "generated": total_generated,
        "notified": total_notified,
        "users_checked": len(users),
    }


# =====================================================================
# EVENT NOTIFIKACIE
# =====================================================================


def service_notify_monthly_summary_done(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Posle notifikaciu po manualnom vygenerovani mesacneho suhrnu."""
    lang = _get_user_language(user_id, ctx)
    t = PUSH_TRANSLATIONS[lang]
    return service_send_push_notification(
        user_id=user_id,
        title=t["monthly_summary_title"],
        body=t["monthly_summary_body"],
        url="/activities/monthlySummary",
        ctx=ctx,
    )


def service_notify_autorecovery_applied(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    lang = _get_user_language(user_id, ctx)
    t = PUSH_TRANSLATIONS[lang]
    return service_send_push_notification(
        user_id=user_id,
        title=t["autorecovery_applied_title"],
        body=t["autorecovery_applied_body"],
        url="/coach/ai/dailyPlan",
        ctx=ctx,
    )


def service_notify_athlete_state_progress(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    lang = _get_user_language(user_id, ctx)
    t = PUSH_TRANSLATIONS[lang]
    return service_send_push_notification(
        user_id=user_id,
        title=t["progress_title"],
        body=t["progress_body"],
        url="/coach/ai/progress",
        ctx=ctx,
    )


def service_notify_new_activity(
    user_id: int,
    activity_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """Posle notifikaciu ked je nova aktivita importovana a pripravena na pozretie."""
    lang = _get_user_language(user_id, ctx)
    t = PUSH_TRANSLATIONS[lang]
    return service_send_push_notification(
        user_id=user_id,
        title=t["new_activity_title"],
        body=t["new_activity_body"],
        url=f"/activities/detail/{activity_id}",
        ctx=ctx,
    )



def service_notify_test(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    lang = _get_user_language(user_id, ctx)
    t = PUSH_TRANSLATIONS[lang]
    return service_send_push_notification(
        user_id=user_id,
        title=t["test_title"],
        body=t["test_body"],
        url="/activities",
        ctx=ctx,
    )


def service_cron_notify_check_ai(admin_email: str, ctx: AuthCtx) -> Dict[str, Any]:
    is_ok, warning_message = get_ai_health_status()
    if is_ok:
        return {"success": True, "message": "Všetky AI modely sú dostupné."}

    sb = get_service_client()
    user_resp = (
        sb.table("users")
        .select("id")
        .eq("mail_address", admin_email)
        .single()
        .execute()
    )
    admin_id = user_resp.data.get("id") if user_resp.data else None
    if not admin_id:
        raise ValueError(f"Admin email {admin_email} nenájdený v DB.")

    push_result = service_send_push_notification(
        user_id=int(admin_id),
        title="⚠️ AI Model Výpadok",
        body=warning_message,
        url="/hq-secure-zone",
        ctx=ctx,
    )
    return {
        "success": True,
        "message": "Problém detegovaný.",
        "push_details": push_result,
    }


def service_notify_global(
    messages: Dict[str, Dict[str, str]], ctx: AuthCtx
) -> Dict[str, Any]:
    if not messages:
        return {"success": False, "sent": 0, "message": "Prázdny payload správ."}

    users = db_list_users_for_cron(ctx=ctx)
    total_sent = 0

    for u in users:
        user_id = u.get("id")
        if not user_id:
            continue
        lang = _get_user_language(user_id, ctx)
        user_msg = (
            messages.get(lang)
            or messages.get("en")
            or next(iter(messages.values()), None)
        )
        if not user_msg:
            continue
        res = service_send_push_notification(
            user_id=user_id,
            title=user_msg.get("title", "Oznámenie"),
            body=user_msg.get("body", ""),
            url=user_msg.get("url", "/"),
            ctx=ctx,
        )
        total_sent += res.get("sent", 0)

    return {"success": True, "sent": total_sent}

def service_notify_new_record(
    user_id: int,
    records: List[Dict[str, Any]],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Posle notifikaciu za KAZDY novy rekord v zozname (zvycajne 1, ale
    jedna aktivita moze prekonat viac segmentov naraz).
    """
    if not records:
        return {"success": False, "message": "No records to notify."}

    lang = _get_user_language(user_id, ctx)
    t = PUSH_TRANSLATIONS[lang]

    total_sent = 0
    for rec in records:
        rec_type = rec.get("type", "")
        label = rec.get("label", "")
        value_fmt = rec.get("value_fmt", "")
        delta_fmt = rec.get("delta_fmt")

        if rec_type == "total_distance":
            body = t["new_record_body_distance"].format(value=value_fmt, delta=delta_fmt or "—")
        elif rec_type == "total_time":
            body = t["new_record_body_time"].format(value=value_fmt, delta=delta_fmt or "—")
        elif delta_fmt:
            body = t["new_record_body_with_delta"].format(delta=delta_fmt, label=label, value=value_fmt)
        else:
            body = t["new_record_body_no_delta"].format(label=label, value=value_fmt)

        res = service_send_push_notification(
            user_id=user_id,
            title=t["new_record_title"],
            body=body,
            url="/performance/pb",
            ctx=ctx,
        )
        total_sent += res.get("sent", 0)

    return {"success": True, "sent": total_sent, "records_notified": len(records)}
