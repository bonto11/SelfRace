# Modules/Stripe/billing_stripe.py
import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any

from Modules.Supabase.auth import require_user, get_auth_ctx
from Modules.Supabase.client import get_sb
from Configs.config import STRIPE_PRICE_CLASSIC, STRIPE_PRICE_PRO, STRIPE_API_KEY, FRONTEND_URL

stripe.api_key = STRIPE_API_KEY

class CheckoutRequest(BaseModel):
    tier: str 

router = APIRouter(prefix="/billingStripe", tags=["billingStripe"])

@router.post("/create-checkout-session")
def create_checkout_session(
    payload: CheckoutRequest, 
    req: Request
) -> Dict[str, Any]:
    
    ctx = require_user(get_auth_ctx(req))
    
    user_id = getattr(ctx, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Nenájdené user_id v tokene")
    
    price_id: str = "" 
    
    if payload.tier == "classic":
        price_id = str(STRIPE_PRICE_CLASSIC or "")
    elif payload.tier == "pro":
        price_id = str(STRIPE_PRICE_PRO or "")
    else:
        raise HTTPException(status_code=400, detail="Neplatný tier.")

    if not price_id:
        raise HTTPException(status_code=500, detail="Chýba konfigurácia pre Stripe Price ID")
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": price_id,
                "quantity": 1,
            }],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/settings/billing?status=success",
            cancel_url=f"{FRONTEND_URL}/settings/billing?status=canceled",
            client_reference_id=str(user_id),
            metadata={
                "user_id": str(user_id),
                "tier": payload.tier
            }
        )
        
        return {"ok": True, "checkout_url": session.url}

    except Exception as e:
        print("[STRIPE] Chyba pri vytváraní checkoutu:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))

# ✅ NOVÝ ENDPOINT: Vytvorenie linku do Customer Portalu pre správu (zrušenie) predplatného
@router.post("/create-portal-session")
def create_portal_session(req: Request) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    user_id = getattr(ctx, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Nenájdené user_id v tokene")

    sb = get_sb(ctx, caller="create_portal_session")
    
    # Najprv musíme zistiť, aké je jeho stripe_customer_id z databázy
    # Uisti sa, že názov tabuľky sedí s tvojou DB!
    try:
        res = sb.table("ai_wallet_transactions").select("external_customer_id").eq("user_id", int(user_id)).limit(1).execute()
        rows = res.data or []
        if not rows or not rows[0].get("external_customer_id"):
             raise HTTPException(status_code=404, detail="Nenájdený Stripe Customer ID pre tohto usera.")
        customer_id = rows[0]["external_customer_id"]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Chyba pri čítaní z DB: " + str(e))

    try:
        # Vytvoríme jednorázový link do spravovacieho portálu
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{FRONTEND_URL}/settings/billing",
        )
        return {"ok": True, "portal_url": session.url}
    except Exception as e:
        print("[STRIPE] Chyba pri vytváraní portalu:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))