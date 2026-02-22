import stripe
import json
from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import service_ctx
from Configs.config import STRIPE_WEBHOOK_SECRET, TABLE_APP_USER_SUBSCRIPTIONS

router = APIRouter(tags=["Stripe Webhooks"])

def extract_timestamps(stripe_obj_dict):
    """
    Pomocná funkcia, ktorá sa pokúsi vydolovať dátumy zo Stripe objektu,
    nech sú skryté kdekoľvek (či na vrchu, alebo vo vnútri items).
    """
    start_ts = stripe_obj_dict.get('current_period_start')
    end_ts = stripe_obj_dict.get('current_period_end')
    
    if start_ts is None or end_ts is None:
        items = stripe_obj_dict.get('items', {})
        if isinstance(items, dict):
            data_arr = items.get('data', [])
            if isinstance(data_arr, list) and len(data_arr) > 0:
                first_item = data_arr[0]
                if start_ts is None:
                    start_ts = first_item.get('current_period_start')
                if end_ts is None:
                    end_ts = first_item.get('current_period_end')
                    
    return start_ts, end_ts

@router.post("/stripe-webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Missing signature or webhook secret")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    sb = get_sb(service_ctx(caller="stripe_webhook"), caller="stripe_webhook")
    event_type = event.get('type')
    
    try:
        raw_event_data = event.get('data', {}).get('object', {})
        if hasattr(raw_event_data, 'to_dict'):
            raw_dict = raw_event_data.to_dict()
        else:
            raw_dict = json.loads(str(raw_event_data).replace("'", '"')) 
    except Exception:
        raw_dict = {}

    # --- 1. Časť: Spracovanie zmazania ---
    if event_type == 'customer.subscription.deleted':
        sub_id = raw_dict.get('id')
        if not sub_id: return {"status": "ok"}
            
        print(f"[STRIPE] Predplatné zrušené: {sub_id}")
        payload_data = {
            "tier_code": "free",
            "status": "canceled",
            "cancel_at_period_end": False,
            "current_period_start": None,
            "current_period_end": None,
            "meta": {"source": "stripe_deleted"},
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(payload_data).eq("external_subscription_id", sub_id).execute()
        return {"status": "success"}

    # --- 2. Časť: Spracovanie platieb a zmien ---
    if event_type in [
        'checkout.session.completed', 
        'customer.subscription.created', 
        'customer.subscription.updated'
    ]:
        user_id_str = None
        tier_code = None
        customer_id = None
        sub_id = None

        if event_type == 'checkout.session.completed':
            user_id_str = raw_dict.get('client_reference_id')
            metadata = raw_dict.get('metadata', {})
            if isinstance(metadata, str):
                try: metadata = json.loads(metadata)
                except: metadata = {}
            tier_code = metadata.get('tier', 'pro')
            customer_id = raw_dict.get('customer')
            sub_id = raw_dict.get('subscription')
        else:
            sub_id = raw_dict.get('id')
            customer_id = raw_dict.get('customer')

        if not sub_id: return {"status": "ok"}

        try:
            # Zavoláme API pre najnovšie dáta
            fresh_sub_obj = stripe.Subscription.retrieve(sub_id)
            fresh_sub = fresh_sub_obj.to_dict() if hasattr(fresh_sub_obj, 'to_dict') else dict(fresh_sub_obj)
            
            fresh_status = fresh_sub.get('status', 'active')
            start_ts, end_ts = extract_timestamps(fresh_sub)
            
            if start_ts is None or end_ts is None:
                raw_start, raw_end = extract_timestamps(raw_dict)
                start_ts = start_ts or raw_start
                end_ts = end_ts or raw_end
            
            has_cancel_at = fresh_sub.get('cancel_at') is not None
            has_cancel_end = fresh_sub.get('cancel_at_period_end') is True
            is_canceled_future = has_cancel_at or has_cancel_end

            # Formátovanie dátumov
            period_start = datetime.fromtimestamp(int(start_ts), tz=timezone.utc).isoformat() if start_ts else None
            period_end = datetime.fromtimestamp(int(end_ts), tz=timezone.utc).isoformat() if end_ts else None

            # Identifikácia usera v našej DB
            target_user_id = None
            if user_id_str:
                target_user_id = int(user_id_str)
            else:
                res = sb.table(TABLE_APP_USER_SUBSCRIPTIONS).select("user_id").eq("external_subscription_id", sub_id).limit(1).execute()
                if res.data and len(res.data) > 0:
                    target_user_id = res.data[0].get("user_id")

            if not target_user_id: return {"status": "ok"}

            # Zostavenie dát na uloženie
            payload = {
                "status": fresh_status,
                "cancel_at_period_end": is_canceled_future,
                "external_subscription_id": sub_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if customer_id: payload["external_customer_id"] = customer_id
            if tier_code: payload["tier_code"] = tier_code
            if period_start: payload["current_period_start"] = period_start
            if period_end: payload["current_period_end"] = period_end

            # Update databázy
            sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(payload).eq("user_id", target_user_id).execute()
            print(f"[STRIPE SUCCESS] Zápis úspešný. Typ: {event_type}, Sub_ID: {sub_id}")

        except Exception as e:
            print(f"[STRIPE ERROR] Zlyhanie pri spracovaní eventu {event_type} pre sub_id {sub_id}: {repr(e)}")

    return {"status": "success"}