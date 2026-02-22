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
        print("[STRIPE WEBHOOK ERROR] Chýba hlavička alebo secret!")
        raise HTTPException(status_code=400, detail="Missing signature or webhook secret")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
<<<<<<< HEAD
    except ValueError as e:
        print("[STRIPE WEBHOOK ERROR] Invalid payload:", e)
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError as e:
        print("[STRIPE WEBHOOK ERROR] Invalid signature:", e)
=======
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
>>>>>>> 87c969a97e5520228d2482d57be50121b3fb44ac
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

<<<<<<< HEAD
    event_type = event.get('type')
    print(f"\n{'='*60}")
    print(f"[STRIPE WEBHOOK IN] Prichádza event: {event_type}")
    print(f"{'='*60}")

    # --- 1. ZÁKAZNÍK ÚSPEŠNE DOKONČIL CHECKOUT ---
    if event_type == 'checkout.session.completed':
        session = event['data']['object']
        
        user_id_str = session.get('client_reference_id') 
        tier = session.get('metadata', {}).get('tier', 'pro')
        
        stripe_customer_id = session.get('customer')
        stripe_subscription_id = session.get('subscription')

        print(f"[DEBUG CHECKOUT] Extrahované z checkout session:")
        print(f"  -> user_id (z client_reference_id): {user_id_str}")
        print(f"  -> tier (z metadata): {tier}")
        print(f"  -> stripe_customer_id: {stripe_customer_id}")
        print(f"  -> stripe_subscription_id: {stripe_subscription_id}")

        if user_id_str and stripe_subscription_id:
            try:
                print(f"[DEBUG CHECKOUT] Volám API pre detaily subskripcie: {stripe_subscription_id}")
                sub_obj = stripe.Subscription.retrieve(stripe_subscription_id)
                
                start_ts = sub_obj.get("current_period_start")
                end_ts = sub_obj.get("current_period_end")
                stripe_status = sub_obj.get("status", "active")

                print(f"[DEBUG CHECKOUT] Vrátený objekt zo Stripe:")
                print(f"  -> RAW start_ts: {start_ts}")
                print(f"  -> RAW end_ts: {end_ts}")
                print(f"  -> status: {stripe_status}")

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
        subscription = event['data']['object']
        stripe_subscription_id = subscription.get('id')
        
        has_cancel_at = subscription.get('cancel_at') is not None
        has_cancel_end = subscription.get('cancel_at_period_end') is True
        is_canceled_future = has_cancel_at or has_cancel_end
        
        stripe_status = subscription.get('status') 
        start_ts = subscription.get("current_period_start")
        end_ts = subscription.get("current_period_end")

        print(f"[DEBUG UPDATE] Event: {event_type} pre subskripciu: {stripe_subscription_id}")
        print(f"  -> RAW cancel_at: {subscription.get('cancel_at')}")
        print(f"  -> RAW cancel_at_period_end: {subscription.get('cancel_at_period_end')}")
        print(f"  -> Vyhodnotené is_canceled_future: {is_canceled_future}")
        print(f"  -> RAW start_ts: {start_ts} | end_ts: {end_ts}")
        print(f"  -> status: {stripe_status}")
        
        update_data = {
            "status": stripe_status,
            "cancel_at_period_end": is_canceled_future,
=======
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
>>>>>>> 87c969a97e5520228d2482d57be50121b3fb44ac
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

        print(f"[DEBUG UPDATE] Pripravený UPDATE PAYLOAD do DB:\n{update_data}")

        try:
<<<<<<< HEAD
            res = sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(update_data).eq("external_subscription_id", stripe_subscription_id).execute()
            
            if not res.data:
                 print(f"[STRIPE IGNORED] Update pre {stripe_subscription_id} ignorovaný (záznam s týmto ID v DB ešte nie je).")
            else:
                 print(f"[STRIPE SUCCESS] Update predplatného {stripe_subscription_id} úspešný.")
                 
        except Exception as e:
            print(f"[STRIPE DB ERROR] Nepodarilo sa updatnúť sub {stripe_subscription_id}:", repr(e))

    # --- 3. PREDPLATNÉ BOLO ÚPLNE ZRUŠENÉ ---
    elif event_type == 'customer.subscription.deleted':
        subscription = event['data']['object']
        stripe_subscription_id = subscription.get('id')

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
=======
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

>>>>>>> 87c969a97e5520228d2482d57be50121b3fb44ac
        except Exception as e:
            print(f"[STRIPE ERROR] Zlyhanie pri spracovaní eventu {event_type} pre sub_id {sub_id}: {repr(e)}")

    else:
        print(f"[DEBUG OTHER] Event {event_type} zachytený, ale nevykonávam žiadnu akciu.")

    return {"status": "success"}