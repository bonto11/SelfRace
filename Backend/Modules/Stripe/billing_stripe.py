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

router = APIRouter(prefix="/billingStripe", tags=["Stripe Billing"])

@router.post("/create-checkout-session/{user_id}")
def create_checkout_session(
    user_id: int, 
    payload: CheckoutRequest, 
    req: Request
) -> Dict[str, Any]:
    
    # Len overíme, že požiadavka má platný token (či je to reálny prihlásený človek)
    ctx = require_user(get_auth_ctx(req))
    
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

# ✅ Pridané {user_id} priamo do URL cesty
@router.post("/create-portal-session/{user_id}")
def create_portal_session(user_id: int, req: Request) -> Dict[str, Any]:
    
    # Znova len skontrolujeme, že prišiel token
    ctx = require_user(get_auth_ctx(req))

    sb = get_sb(ctx, caller="create_portal_session")
    
    try:
        res = sb.table("TABLE_APP_USER_SUBSCRIPTIONS").select("external_customer_id").eq("user_id", user_id).limit(1).execute()
        rows = res.data or []
        if not rows or not rows[0].get("external_customer_id"):
             raise HTTPException(status_code=404, detail="Nenájdený Stripe Customer ID pre tohto usera.")
        customer_id = rows[0]["external_customer_id"]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Chyba pri čítaní z DB: " + str(e))

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{FRONTEND_URL}/settings/billing",
        )
        return {"ok": True, "portal_url": session.url}
    except Exception as e:
        print("[STRIPE] Chyba pri vytváraní portalu:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))