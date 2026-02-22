import stripe
import json
from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import service_ctx
from Configs.config import STRIPE_WEBHOOK_SECRET, TABLE_APP_USER_SUBSCRIPTIONS

router = APIRouter(tags=["Stripe Webhooks"])

@router.post("/stripe-webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header or not STRIPE_WEBHOOK_SECRET:
        print("[STRIPE WEBHOOK ERROR] Chýba hlavička alebo secret!")
        raise HTTPException(status_code=400, detail="Missing signature or webhook secret")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        print("[STRIPE WEBHOOK ERROR] Invalid payload:", e)
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError as e:
        print("[STRIPE WEBHOOK ERROR] Invalid signature:", e)
        raise HTTPException(status_code=400, detail="Invalid signature")

    sb = get_sb(service_ctx(caller="stripe_webhook"), caller="stripe_webhook")

    event_type = event.get('type')
    print(f"\n{'='*60}")
    print(f"[STRIPE WEBHOOK IN] Prichádza event: {event_type}")
    print(f"{'='*60}")

    # --- 1. ZÁKAZNÍK ÚSPEŠNE DOKONČIL CHECKOUT ---
    if event_type == 'checkout.session.completed':
        session = event['data']['object']
        
        # Prevod checkout session na čistý dict
        sess_dict = session.to_dict() if hasattr(session, "to_dict") else dict(session)
        
        user_id_str = sess_dict.get('client_reference_id') 
        tier = sess_dict.get('metadata', {}).get('tier', 'pro')
        
        stripe_customer_id = sess_dict.get('customer')
        stripe_subscription_id = sess_dict.get('subscription')

        print(f"[DEBUG CHECKOUT] Extrahované z checkout session:")
        print(f"  -> user_id (z client_reference_id): {user_id_str}")
        print(f"  -> tier (z metadata): {tier}")
        print(f"  -> stripe_customer_id: {stripe_customer_id}")
        print(f"  -> stripe_subscription_id: {stripe_subscription_id}")

        if user_id_str and stripe_subscription_id:
            try:
                print(f"[DEBUG CHECKOUT] Volám API pre detaily subskripcie: {stripe_subscription_id}")
                sub_obj = stripe.Subscription.retrieve(stripe_subscription_id)
                
                # ✅ KLÚČOVÁ OPRAVA: Prevod na čistý Python slovník
                sub_dict = sub_obj.to_dict() if hasattr(sub_obj, "to_dict") else dict(sub_obj)
                
                print(f"[DEBUG CHECKOUT] Extrahovaný ČISTÝ DICT zo Stripe:\n{json.dumps(sub_dict, indent=2)}")
                
                start_ts = sub_dict.get("current_period_start")
                end_ts = sub_dict.get("current_period_end")
                stripe_status = sub_dict.get("status", "active")

                print(f"[DEBUG CHECKOUT] Vytiahnuté z dictu: start_ts={start_ts}, end_ts={end_ts}, status={stripe_status}")

                period_start = datetime.fromtimestamp(start_ts, tz=timezone.utc).isoformat() if start_ts else None
                period_end = datetime.fromtimestamp(end_ts, tz=timezone.utc).isoformat() if end_ts else None

                payload_data = {
                    "tier_code": tier,
                    "status": stripe_status,
                    "external_customer_id": stripe_customer_id,
                    "external_subscription_id": stripe_subscription_id,
                    "current_period_start": period_start,
                    "current_period_end": period_end,
                    "meta": {"source": "stripe_checkout"},
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }

                print(f"[DEBUG CHECKOUT] Pripravený PAYLOAD na zápis do DB:\n{payload_data}")

                sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(payload_data).eq("user_id", int(user_id_str)).execute()
                print(f"[STRIPE SUCCESS] Úspešný checkout pre usera: {user_id_str}. Zapísané všetky dáta do DB.")
            except Exception as e:
                print(f"[STRIPE DB ERROR] Nepodarilo sa prepojiť usera {user_id_str}:", repr(e))
        else:
            print("[DEBUG CHECKOUT WARN] Chýba user_id_str alebo stripe_subscription_id. Zápis sa preskakuje.")

    # --- 2. PREDPLATNÉ VYTVORENÉ / AKTUALIZOVANÉ ---
    elif event_type in ['customer.subscription.created', 'customer.subscription.updated']:
        raw_obj = event['data']['object']
        
        # ✅ KLÚČOVÁ OPRAVA
        sub_dict = raw_obj.to_dict() if hasattr(raw_obj, "to_dict") else dict(raw_obj)
        
        stripe_subscription_id = sub_dict.get('id')
        
        has_cancel_at = sub_dict.get('cancel_at') is not None
        has_cancel_end = sub_dict.get('cancel_at_period_end') is True
        is_canceled_future = has_cancel_at or has_cancel_end
        
        stripe_status = sub_dict.get('status') 
        start_ts = sub_dict.get("current_period_start")
        end_ts = sub_dict.get("current_period_end")

        print(f"[DEBUG UPDATE] Event: {event_type} pre subskripciu: {stripe_subscription_id}")
        print(f"  -> RAW cancel_at: {sub_dict.get('cancel_at')}")
        print(f"  -> RAW cancel_at_period_end: {sub_dict.get('cancel_at_period_end')}")
        print(f"  -> Vyhodnotené is_canceled_future: {is_canceled_future}")
        print(f"  -> RAW start_ts: {start_ts} | end_ts: {end_ts}")
        print(f"  -> status: {stripe_status}")
        
        update_data = {
            "status": stripe_status,
            "cancel_at_period_end": is_canceled_future,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if start_ts:
            update_data["current_period_start"] = datetime.fromtimestamp(start_ts, tz=timezone.utc).isoformat()
        if end_ts:
            update_data["current_period_end"] = datetime.fromtimestamp(end_ts, tz=timezone.utc).isoformat()

        print(f"[DEBUG UPDATE] Pripravený UPDATE PAYLOAD do DB:\n{update_data}")

        try:
            res = sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(update_data).eq("external_subscription_id", stripe_subscription_id).execute()
            
            if not res.data:
                 print(f"[STRIPE IGNORED] Update pre {stripe_subscription_id} ignorovaný (záznam s týmto ID v DB ešte nie je).")
            else:
                 print(f"[STRIPE SUCCESS] Update predplatného {stripe_subscription_id} úspešný.")
                 
        except Exception as e:
            print(f"[STRIPE DB ERROR] Nepodarilo sa updatnúť sub {stripe_subscription_id}:", repr(e))

    # --- 3. PREDPLATNÉ BOLO ÚPLNE ZRUŠENÉ ---
    elif event_type == 'customer.subscription.deleted':
        raw_obj = event['data']['object']
        sub_dict = raw_obj.to_dict() if hasattr(raw_obj, "to_dict") else dict(raw_obj)
        stripe_subscription_id = sub_dict.get('id')

        print(f"[DEBUG DELETE] Predplatné natvrdo zrušené. ID: {stripe_subscription_id}")

        try:
            payload_data = {
                "tier_code": "free",
                "status": "canceled",
                "cancel_at_period_end": False,
                "current_period_start": None,
                "current_period_end": None,
                "meta": {"source": "stripe_deleted"},
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            print(f"[DEBUG DELETE] Zapisujem PAYLOAD do DB:\n{payload_data}")
            
            sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(payload_data).eq("external_subscription_id", stripe_subscription_id).execute()
            print(f"[STRIPE SUCCESS] Subskripcia {stripe_subscription_id} zrušená, účet zmenený na free.")
        except Exception as e:
             print(f"[STRIPE DB ERROR] Nepodarilo sa zrušiť sub {stripe_subscription_id}:", repr(e))

    else:
        print(f"[DEBUG OTHER] Event {event_type} zachytený, ale nevykonávam žiadnu akciu.")

    return {"status": "success"}