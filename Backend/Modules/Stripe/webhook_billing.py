# Modules/Stripe/webhook_billing.py
import os
import stripe
from fastapi import APIRouter, Request, HTTPException
from Modules.Supabase.client import get_sb  # Predpokladám, že tu máš inicializáciu Supabase
from datetime import datetime, timezone

router = APIRouter(tags=["Stripe Webhooks"])

# Sem si Stripe neskôr pošle tajný kľúč, aby sme vedeli, že správa je fakt od nich
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

@router.post("/stripe-webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Missing signature or webhook secret")

    try:
        # Overenie, či správa naozaj prišla od Stripe (bezpečnosť)
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        # Neplatný payload
        print("[STRIPE] Invalid payload:", e)
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Neplatný podpis (niekto sa tvári ako Stripe)
        print("[STRIPE] Invalid signature:", e)
        raise HTTPException(status_code=400, detail="Invalid signature")

    # --- SPRACOVANIE EVENTOV ZO STRIPE ---
    
    sb = get_sb(caller="stripe_webhook") # Získame prístup do databázy (použi tvoj spôsob, ak ho máš iný)

    # 1. EVENT: Zákazník úspešne zaplatil (Checkout session dokončená)
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        # Toto je to user_id, ktoré sme Stripeu poslali pri vytváraní checkoutu
        user_id_str = session.get('client_reference_id') 
        tier = session.get('metadata', {}).get('tier', 'pro') # Zistíme, či kúpil classic alebo pro
        
        stripe_customer_id = session.get('customer')
        stripe_subscription_id = session.get('subscription')

        if user_id_str:
            print(f"[STRIPE] Úspešná platba pre usera: {user_id_str}, Tier: {tier}")
            
            try:
                # Aktualizujeme tvoju tabuľku predplatného
                # Názov tabuľky si uprav podľa tvojej reality (napr. 'user_subscriptions')
                sb.table("NÁZOV_TVOJEJ_TABULKY").update({
                    "tier_code": tier,
                    "status": "active",
                    "external_customer_id": stripe_customer_id,
                    "external_subscription_id": stripe_subscription_id,
                    "cancel_at_period_end": False,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("user_id", int(user_id_str)).execute()
            except Exception as e:
                print(f"[STRIPE DB ERROR] Nepodarilo sa updatnúť usera {user_id_str}:", e)

    # 2. EVENT: Predplatné bolo zrušené (Dobehol mu mesiac a nechcel pokračovať)
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        stripe_subscription_id = subscription.get('id')

        print(f"[STRIPE] Predplatné {stripe_subscription_id} bolo zrušené. Prehadzujem na free.")
        
        try:
            # Nájdeme usera podľa subscription ID a dáme mu free
            sb.table("NÁZOV_TVOJEJ_TABULKY").update({
                "tier_code": "free",
                "status": "canceled",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("external_subscription_id", stripe_subscription_id).execute()
        except Exception as e:
             print(f"[STRIPE DB ERROR] Nepodarilo sa zrušiť sub {stripe_subscription_id}:", e)

    # Akékoľvek iné eventy vrátime ako 200 OK, aby Stripe vedel, že žijeme
    return {"status": "success"}