import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any

from Modules.Supabase.auth import require_user, get_auth_ctx
from Modules.Supabase.client import get_sb
from Configs.config import STRIPE_PRICE_CLASSIC, STRIPE_PRICE_PRO, STRIPE_API_KEY, FRONTEND_URL, TABLE_APP_USER_SUBSCRIPTIONS

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
    
    ctx = require_user(get_auth_ctx(req))
    
    price_id: str = "" 
    if payload.tier == "classic":
        price_id = str(STRIPE_PRICE_CLASSIC or "")
    elif payload.tier == "pro":
        price_id = str(STRIPE_PRICE_PRO or "")
    else:
        raise HTTPException(status_code=400, detail="Neplatný tier.")

    if not price_id:
        raise HTTPException(status_code=500, detail="Error configure Stripe Price ID")
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": price_id,
                "quantity": 1,
            }],
            mode="subscription",
            # ✅ OPRAVENÁ NÁVRATOVÁ URL
            success_url=f"{FRONTEND_URL}/account?status=success",
            cancel_url=f"{FRONTEND_URL}/account?status=canceled",
            client_reference_id=str(user_id),
            metadata={
                "user_id": str(user_id),
                "tier": payload.tier
            }
        )
        return {"ok": True, "checkout_url": session.url}

    except Exception as e:
        print("[STRIPE] Error create checkout:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-portal-session/{user_id}")
def create_portal_session(user_id: int, req: Request) -> Dict[str, Any]:
    
    ctx = require_user(get_auth_ctx(req))
    sb = get_sb(ctx, caller="create_portal_session")
    
    try:
        res = sb.table(TABLE_APP_USER_SUBSCRIPTIONS).select("external_customer_id").eq("user_id", user_id).limit(1).execute()
        rows = res.data or []
        if not rows or not rows[0].get("external_customer_id"):
             raise HTTPException(status_code=404, detail="Stripe Customer ID not connected to user id.")
        customer_id = rows[0]["external_customer_id"]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error read from DB: " + str(e))

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            # ✅ OPRAVENÁ NÁVRATOVÁ URL
            return_url=f"{FRONTEND_URL}/account",
        )
        return {"ok": True, "portal_url": session.url}
    except Exception as e:
        print("[STRIPE] Error create portalu:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))
    
def disconnect_stripe_subscription(*, user_id: int, ctx: Any) -> Dict[str, Any]:
    """
    Pomocná funkcia pre bezpečné zrušenie predplatného (Cancel at Period End).
    Volá sa napríklad pri vymazaní účtu.
    """
    sb = get_sb(ctx, caller="stripe_disconnect")
    
    try:
        sub_res = sb.table(TABLE_APP_USER_SUBSCRIPTIONS)\
                    .select("external_subscription_id, status")\
                    .eq("user_id", user_id)\
                    .limit(1)\
                    .execute()

        if not sub_res.data:
            return {"ok": True, "note": "no_subscription_record"}

        sub_data = sub_res.data[0]
        stripe_sub_id = sub_data.get("external_subscription_id")
        
        if not stripe_sub_id:
            return {"ok": True, "note": "no_stripe_id"}

        # Ak má aktívne predplatné v Stripe, zrušíme ho kľudne na konci mesiaca
        if sub_data.get("status") in ["active", "trialing", "past_due"]:
            stripe.Subscription.modify(
                stripe_sub_id, 
                cancel_at_period_end=True
            )
            print(f"[STRIPE DISCONNECT] Predplatné {stripe_sub_id} pre usera {user_id} naplánované na zrušenie.")
            return {"ok": True, "stripe_sub_id": stripe_sub_id, "canceled_at_period_end": True}
        
        return {"ok": True, "note": f"status_is_{sub_data.get('status')}"}
        
    except Exception as e:
        print(f"[STRIPE DISCONNECT] Chyba pri rušení predplatného pre usera {user_id}: {repr(e)}")
        return {"ok": False, "error": str(e)}