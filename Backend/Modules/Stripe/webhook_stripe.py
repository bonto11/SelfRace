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
    print(f"[STRIPE WEBHOOK] Zachytený event: {event_type}")
    
    try:
        raw_event_data = event.get('data', {}).get('object', {})
        # Pokus o prevod do čistého dictionary
        if hasattr(raw_event_data, 'to_dict'):
            raw_dict = raw_event_data.to_dict()
        else:
            raw_dict = json.loads(str(raw_event_data).replace("'", '"')) # Hack, ale funguje pre Stripe repr
            
        print(f"[DEBUG LINE 1] STRIPE POSLAL TOTO (Surové dáta vnútri objektu):")
        print(json.dumps(raw_dict, indent=2, default=str)) # default=str zabráni pádu na divných typoch
        
    except Exception as e:
        print(f"[STRIPE WEBHOOK ERROR] Nepodarilo sa zobraziť / parsovať event dáta: {repr(e)}")
        raw_dict = {}

    # 1. Časť: Spracovanie zmazania (toto je izolované)
    if event_type == 'customer.subscription.deleted':
        sub_id = raw_dict.get('id')
        if not sub_id:
            return {"status": "ok", "note": "missing sub_id in deleted"}
            
        print(f"[DEBUG DELETE] Natvrdo ruším v DB subskripciu: {sub_id}")
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

    # 2. Časť: KLADIVO (Checkout, Created, Updated)
    if event_type in [
        'checkout.session.completed', 
        'customer.subscription.created', 
        'customer.subscription.updated'
    ]:
        user_id_str = None
        tier_code = None
        customer_id = None
        sub_id = None

        # Vytiahnutie IDčok podľa toho, aký event zrovna prišiel
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

        if not sub_id:
            print(f"[STRIPE WARN] Event {event_type} neobsahuje subscription ID. (Typické pre jednorazové platby, nie predplatné). Preskakujem.")
            return {"status": "ok"}

        print(f"[STRIPE API] Volám natvrdo Stripe API pre čerstvé dáta o subskripcii: {sub_id}")
        
        try:
            # Zavoláme API a prevedieme na 100% čistý dict
            fresh_sub_obj = stripe.Subscription.retrieve(sub_id)
            fresh_sub = fresh_sub_obj.to_dict() if hasattr(fresh_sub_obj, 'to_dict') else dict(fresh_sub_obj)
            
            print(f"[DEBUG LINE 2] Z TOHTO BUDEM ČÍTAŤ (API Odpoveď pre predplatné):")
            print(json.dumps(fresh_sub, indent=2, default=str))

            # ČÍTANIE DÁT 
            fresh_status = fresh_sub.get('status', 'active')
            start_ts = fresh_sub.get('current_period_start')
            end_ts = fresh_sub.get('current_period_end')
            
            has_cancel_at = fresh_sub.get('cancel_at') is not None
            has_cancel_end = fresh_sub.get('cancel_at_period_end') is True
            is_canceled_future = has_cancel_at or has_cancel_end

            # Formátovanie
            period_start = datetime.fromtimestamp(int(start_ts), tz=timezone.utc).isoformat() if start_ts else None
            period_end = datetime.fromtimestamp(int(end_ts), tz=timezone.utc).isoformat() if end_ts else None

            print(f"[DEBUG LINE 3] ČO SOM PREČÍTAL: status={fresh_status}, start={period_start}, end={period_end}, cancel={is_canceled_future}")

            # Identifikácia usera
            target_user_id = None
            if user_id_str:
                target_user_id = int(user_id_str)
            else:
                res = sb.table(TABLE_APP_USER_SUBSCRIPTIONS).select("user_id").eq("external_subscription_id", sub_id).limit(1).execute()
                if res.data and len(res.data) > 0:
                    target_user_id = res.data[0].get("user_id")

            if not target_user_id:
                 print(f"[STRIPE IGNORED] Nemám user_id pre sub {sub_id}. (Toto sa stane, keď 'created' dobehne skôr ako 'checkout'). Čakám.")
                 return {"status": "ok"}

            # Zostavenie payloadu pre DB
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

            print(f"[DB UPDATE] Pripravený payload pre usera {target_user_id}:\n{payload}")
            
            # Zapíšeme to
            sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(payload).eq("user_id", target_user_id).execute()
            print(f"[STRIPE SUCCESS] Zápis pre usera {target_user_id} s predplatným {sub_id} bol úspešný a kompletný.")

        except Exception as e:
            print(f"[STRIPE ERROR] Zlyhanie pri spracovaní sub {sub_id}: {repr(e)}")

    print(f"{'='*60}\n")
    return {"status": "success"}