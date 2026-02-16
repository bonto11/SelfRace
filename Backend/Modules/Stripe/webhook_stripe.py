# Modules/Stripe/webhook_stripe.py
import stripe
from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timezone
from stripe.error import SignatureVerificationError  # type: ignore

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
    except SignatureVerificationError as e:
        print("[STRIPE WEBHOOK] Invalid signature:", e)
        raise HTTPException(status_code=400, detail="Invalid signature")

    # ✅ Použijeme tvoj service klient, ktorý obíde RLS
    sb = get_sb(service_ctx(caller="stripe_webhook"), caller="stripe_webhook")

    # --- 1. ZÁKAZNÍK ZAPLATIL ---
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        user_id_str = session.get('client_reference_id') 
        tier = session.get('metadata', {}).get('tier', 'pro')
        
        stripe_customer_id = session.get('customer')
        stripe_subscription_id = session.get('subscription')

        if user_id_str:
            print(f"[STRIPE] Úspešná platba pre usera: {user_id_str}, Tier: {tier}")
            try:
                sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update({
                    "tier_code": tier,
                    "status": "active",
                    "external_customer_id": stripe_customer_id,
                    "external_subscription_id": stripe_subscription_id,
                    "cancel_at_period_end": False,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("user_id", int(user_id_str)).execute()
            except Exception as e:
                print(f"[STRIPE DB ERROR] Nepodarilo sa updatnúť usera {user_id_str}:", repr(e))

    # --- 2. PREDPLATNÉ BOLO ZRUŠENÉ ---
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        stripe_subscription_id = subscription.get('id')

        print(f"[STRIPE] Predplatné {stripe_subscription_id} zrušené. Prehadzujem na free.")
        try:
            sb.table(TABLE_APP_USER_SUBSCRIPTIONS).update({
                "tier_code": "free",
                "status": "canceled",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("external_subscription_id", stripe_subscription_id).execute()
        except Exception as e:
             print(f"[STRIPE DB ERROR] Nepodarilo sa zrušiť sub {stripe_subscription_id}:", repr(e))

    return {"status": "success"}