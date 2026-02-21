import stripe
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
        raise HTTPException(status_code=400, detail="Missing signature or webhook secret")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        print("[STRIPE WEBHOOK] Invalid payload:", e)
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError as e:
        print("[STRIPE WEBHOOK] Invalid signature:", e)
        raise HTTPException(status_code=400, detail="Invalid signature")

    sb = get_sb(service_ctx(caller="stripe_webhook"), caller="stripe_webhook")

    # --- 1. ZÁKAZNÍK ÚSPEŠNE DOKONČIL CHECKOUT ---
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        user_id_str = session.get('client_reference_id') 
        tier = session.get('metadata', {}).get('tier', 'pro')
        
        stripe_customer_id = session.get('customer')
        stripe_subscription_id = session.get('subscription')

        if user_id_str and stripe_subscription_id:
            try:
                # ✅ KROK 1: Iba priradíme Stripe IDčka nášmu používateľovi.
                # O dátumy sa postará ďalší webhook (subscription.updated).
                # Použijeme UPSERT, aby sme predišli chybe, ak by záznam neexistoval.
                
                payload_data = {
                    "user_id": int(user_id_str), # Toto je náš primárny kľúč (alebo unikátny)
                    "tier_code": tier,
                    "external_customer_id": stripe_customer_id,
                    "external_subscription_id": stripe_subscription_id,
                    "meta": {"source": "stripe_checkout"},
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }

                # V Supabase musíš mať v tabuľke app_user_subscriptions nastavený "user_id" ako UNIQUE,
                # aby upsert() vedel, že má aktualizovať riadok, nie vložiť nový.
                # Ak to tak nemáš, nechaj len .update().eq("user_id", int(user_id_str))
                
                sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(payload_data).eq("user_id", int(user_id_str)).execute()
                
                print(f"[STRIPE] Úspešný checkout pre usera: {user_id_str}. Priradené sub_id: {stripe_subscription_id}")
            except Exception as e:
                print(f"[STRIPE DB ERROR] Nepodarilo sa prepojiť usera {user_id_str}:", repr(e))

    # --- 2. PREDPLATNÉ VYTVORENÉ / AKTUALIZOVANÉ (Tu sú tie dátumy!) ---
    elif event['type'] in ['customer.subscription.created', 'customer.subscription.updated']:
        subscription = event['data']['object']
        stripe_subscription_id = subscription.get('id')
        
        # Logika pre kontrolu zrušenia
        has_cancel_at = subscription.get('cancel_at') is not None
        has_cancel_end = subscription.get('cancel_at_period_end') is True
        is_canceled_future = has_cancel_at or has_cancel_end
        
        stripe_status = subscription.get('status') # 'active', 'past_due', 'canceled'...
        
        # ✅ TUTO SÚ DÁTUMY PRIAMO Z EVENTU (Netreba robiť retrieve())
        start_ts = subscription.get("current_period_start")
        end_ts = subscription.get("current_period_end")
        
        update_data = {
            "status": stripe_status,
            "cancel_at_period_end": is_canceled_future,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if start_ts:
            update_data["current_period_start"] = datetime.fromtimestamp(start_ts, tz=timezone.utc).isoformat()
        if end_ts:
            update_data["current_period_end"] = datetime.fromtimestamp(end_ts, tz=timezone.utc).isoformat()

        try:
            # Aktualizujeme záznam na základe stripe_subscription_id
            # Tento event môže prísť zlomok sekundy po checkout.session.completed
            res = sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update(update_data).eq("external_subscription_id", stripe_subscription_id).execute()
            
            # Kontrola, či sa niečo reálne updatlo
            if not res.data:
                 print(f"[STRIPE WARNING] Prišiel update pre sub {stripe_subscription_id}, ale v našej DB sa tento ID nenachádza. (Možno ešte nedobehol checkout event?)")
            else:
                 print(f"[STRIPE] Update predplatného {stripe_subscription_id} úspešný. Status: {stripe_status}, Do: {update_data.get('current_period_end')}")
                 
        except Exception as e:
            print(f"[STRIPE DB ERROR] Nepodarilo sa updatnúť sub {stripe_subscription_id}:", repr(e))

    # --- 3. PREDPLATNÉ BOLO ÚPLNE ZRUŠENÉ (Expirovalo / Zmazané) ---
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        stripe_subscription_id = subscription.get('id')

        print(f"[STRIPE] Predplatné {stripe_subscription_id} natvrdo zrušené. Prehadzujem na free.")
        try:
            sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update({
                "tier_code": "free",
                "status": "canceled",
                "cancel_at_period_end": False,
                "meta": {"source": "stripe_deleted"},
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("external_subscription_id", stripe_subscription_id).execute()
        except Exception as e:
             print(f"[STRIPE DB ERROR] Nepodarilo sa zrušiť sub {stripe_subscription_id}:", repr(e))

    return {"status": "success"}
