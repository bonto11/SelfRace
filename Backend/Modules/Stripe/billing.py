import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any

# Tu si naimportuj svoje vlastné funkcie na overenie usera
from Modules.Supabase.auth import AuthCtx, require_user, get_auth_ctx
from Configs.config import STRIPE_PRICE_CLASSIC, STRIPE_PRICE_PRO, STRIPE_API_KEY, FRONTEND_URL
router = APIRouter(prefix="/billing", tags=["Billing"])

# Inicializácia Stripe knižnice
stripe.api_key = STRIPE_API_KEY

class CheckoutRequest(BaseModel):
    tier: str  # Očakávame "classic" alebo "pro"

@router.post("/create-checkout-session")
def create_checkout_session(
    payload: CheckoutRequest, 
    req: Request
) -> Dict[str, Any]:
    
    # 1. Overíme používateľa (vezme si token z hlavičky tak ako všade inde)
    ctx = require_user(get_auth_ctx(req))
    user_id = ctx.user_id 
    
    # 2. Zistíme, aké Price ID ideme použiť
    if payload.tier == "classic":
        price_id = STRIPE_PRICE_CLASSIC
    elif payload.tier == "pro":
        price_id = STRIPE_PRICE_PRO
    else:
        raise HTTPException(status_code=400, detail="Neplatný tier. Musí byť 'classic' alebo 'pro'.")

    frontend_url = FRONTEND_URL

    try:
        # 3. Vytvoríme Stripe Checkout Session
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price": price_id,
                "quantity": 1,
            }],
            mode="subscription", # Hovoríme Stripeu, že ide o pravidelné predplatné
            
            # Kam ho Stripe presmeruje, keď zaplatí / zruší platbu
            success_url=f"{frontend_url}/settings/billing?status=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/settings/billing?status=canceled",
            
            # ✅ KĽÚČOVÉ: Týmto Stripe povieme, aké je tvoje interné ID používateľa
            client_reference_id=str(user_id),
            
            # Metadáta si Stripe uloží a vráti nám ich vo Webhooku
            metadata={
                "user_id": str(user_id),
                "tier": payload.tier
            }
        )
        
        # 4. Vrátime Frontendu adresu, kam má používateľa presmerovať
        return {"ok": True, "checkout_url": session.url}

    except Exception as e:
        print("[STRIPE] Chyba pri vytváraní checkoutu:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))