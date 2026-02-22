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
        # Tu musíme zobrať event data a prehnať to cez json.loads
        # aby sme zhodili "StripeObject" masku a mali čistý Python Dict
        raw_session_dict = json.loads(str(event['data']['object']))
        
        user_id_str = raw_session_dict.get('client_reference_id') 
        tier = raw_session_dict.get('metadata', {}).get('tier', 'pro')
        stripe_customer_id = raw_session_dict.get('customer')
        stripe_subscription_id = raw_session_dict.get('subscription')

        print(f"[DEBUG CHECKOUT] Extrahované IDčka: user_id={user_id_str}, tier={tier}, sub_id={stripe_subscription_id}")

        if user_id_str and stripe_subscription_id:
            try:
                # Zavoláme Stripe API pre detail predplatného
                sub_obj = stripe.Subscription.retrieve(stripe_subscription_id)
                
                # ✅ ULTIMÁTNA OPRAVA: Prevod na čistý Python dict cez JSON stringifikáciu
                # Toto zaručí, že zmizne celá mágia knižnice stripe
                sub_clean_dict = json.loads(str(sub_obj))
                
                # Teraz už normálne funguje klasický .get()
                start_ts = sub_clean_dict.get("current_period_start")
                end_ts = sub_clean_dict.get("current_period_end")
                stripe_status = sub_clean_dict.get("status", "active")

                print(f"[DEBUG CHECKOUT] Čisté TS získané zo sub_clean_dict: start_ts={start_ts}, end_ts={end_ts}, status={stripe_status}")

                # Ošetrenie timestampu
                period_start = None
                period_end = None
                
                if start_ts is not None:
                    period_start = datetime.fromtimestamp(int(start_ts), tz=timezone.utc).isoformat()
                if end_ts is not None:
                    period_end = datetime.fromtimestamp(int(end_ts), tz=timezone.utc).isoformat()

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

                print(f"[DEBUG CHECKOUT] Zápis do Supabase:\n{payload_data}")
                sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(payload_data).eq("user_id", int(user_id_str)).execute()
                print(f"[STRIPE SUCCESS] Úspešný checkout pre usera: {user_id_str}. Zapísané všetky dáta do DB.")
                
            except Exception as e:
                print(f"[STRIPE DB ERROR] Nepodarilo sa prepojiť usera {user_id_str}:", repr(e))
        else:
            print("[DEBUG CHECKOUT WARN] Chýba user_id_str alebo stripe_subscription_id. Zápis sa preskakuje.")

    # --- 2. PREDPLATNÉ VYTVORENÉ / AKTUALIZOVANÉ ---
    elif event_type in ['customer.subscription.created', 'customer.subscription.updated']:
        
        # ✅ Rovnaká finta, preč od Stripe objektu
        sub_clean_dict = json.loads(str(event['data']['object']))
        
        stripe_subscription_id = sub_clean_dict.get('id')
        
        has_cancel_at = sub_clean_dict.get('cancel_at') is not None
        has_cancel_end = sub_clean_dict.get('cancel_at_period_end', False) is True
        is_canceled_future = has_cancel_at or has_cancel_end
        
        stripe_status = sub_clean_dict.get('status', 'active') 
        
        start_ts = sub_clean_dict.get("current_period_start")
        end_ts = sub_clean_dict.get("current_period_end")

        print(f"[DEBUG UPDATE] Natvrdo získané JSON: start_ts={start_ts} | end_ts={end_ts} | cancel_future={is_canceled_future}")
        
        period_start = None
        period_end = None
        
        if start_ts is not None:
            period_start = datetime.fromtimestamp(int(start_ts), tz=timezone.utc).isoformat()
        if end_ts is not None:
            period_end = datetime.fromtimestamp(int(end_ts), tz=timezone.utc).isoformat()

        update_data = {
            "status": stripe_status,
            "cancel_at_period_end": is_canceled_future,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if period_start:
            update_data["current_period_start"] = period_start
        if period_end:
            update_data["current_period_end"] = period_end

        print(f"[DEBUG UPDATE] Posielam do Supabase:\n{update_data}")

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
        sub_clean_dict = json.loads(str(event['data']['object']))
        stripe_subscription_id = sub_clean_dict.get('id')

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
            sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(payload_data).eq("external_subscription_id", stripe_subscription_id).execute()
            print(f"[STRIPE SUCCESS] Subskripcia {stripe_subscription_id} zrušená, účet zmenený na free.")
        except Exception as e:
             print(f"[STRIPE DB ERROR] Nepodarilo sa zrušiť sub {stripe_subscription_id}:", repr(e))

    else:
        print(f"[DEBUG OTHER] Event {event_type} zachytený, ale nevykonávam žiadnu akciu.")

    return {"status": "success"}