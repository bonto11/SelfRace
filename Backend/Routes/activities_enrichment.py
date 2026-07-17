# Routes_FE/activities_enrichment.py
from fastapi import APIRouter, Request
from typing import Any, Dict, Optional
from pydantic import BaseModel

from Modules.Supabase.auth import get_auth_ctx, require_user
from Services.activities_enrichment import (
    service_request_activity_review_rerun,
    service_get_activity_enrichment,
)
from Services.route_match import (
    service_confirm_route_match,
    service_reject_route_auto_match,
    service_remove_route_match,
    service_get_route_options_for_activity,
    service_get_comparison_for_route,
    service_list_route_names_for_sport,
    service_get_route_overview,
)

router = APIRouter(prefix="/activities/enrichment", tags=["activities/enrichment"])

class ActivityReviewRerunPayload(BaseModel):
    comment: Optional[str] = None
    model: Optional[str] = None
    has_new_injury: Optional[bool] = False
    is_race_effort: Optional[bool] = False

@router.post("/reviewRun/{user_id}/{activity_id}")
def rerun_activity_review(
    user_id: int,
    activity_id: int,
    payload: ActivityReviewRerunPayload,
    req: Request,
) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))

    out = service_request_activity_review_rerun(
        user_id=int(user_id),
        activity_id=int(activity_id),
        comment=payload.comment,
        model=payload.model,
        has_new_injury=payload.has_new_injury,
        is_race_effort=payload.is_race_effort,
        ctx=ctx,
    )

    if not out.get("ok"):
        return {
            "success": False, 
            "data": None, 
            "error_code": out.get("code") or "REQUEST_FAILED",
            "message": out.get("message")
        }

    return {
        "success": True, 
        "data": out, 
        "error_code": None,
        "message": None
    }

@router.get("/{user_id}/{activity_id}")
def get_activity_enrichment(
    user_id: int,
    activity_id: int,
    req: Request,
) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    data = service_get_activity_enrichment(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )
    
    if not data:
        return {
            "success": False, 
            "data": None, 
            "error_code": "NOT_FOUND",
            "message": "Enrichment data not found."
        }
        
    return {
        "success": True, 
        "data": data, 
        "error_code": None,
        "message": None
    }


# ============================================================
# ROUTE MATCH (pomenované trate)
# ============================================================

class RouteMatchConfirmPayload(BaseModel):
    route_name: str


@router.get("/route-match/{user_id}/{activity_id}/options")
def get_route_match_options(
    user_id: int,
    activity_id: int,
    req: Request,
) -> Dict[str, Any]:
    """
    Dáta pre priraďovacie UI danej aktivity: navrhnutý auto_match (ak existuje),
    aktuálne potvrdený route_match (ak existuje), a zoznam existujúcich názvov
    trás pre daný šport. Funguje rovnako pre nové aj staršie (spätne priraďované)
    aktivity.
    """
    ctx = require_user(get_auth_ctx(req))
    out = service_get_route_options_for_activity(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )

    if not out.get("ok"):
        return {
            "success": False,
            "data": None,
            "error_code": out.get("code") or "REQUEST_FAILED",
            "message": None,
        }

    return {"success": True, "data": out, "error_code": None, "message": None}


@router.post("/route-match/{user_id}/{activity_id}/confirm")
def confirm_route_match(
    user_id: int,
    activity_id: int,
    payload: RouteMatchConfirmPayload,
    req: Request,
) -> Dict[str, Any]:
    """
    Potvrdí route_match pre danú aktivitu — prijatie auto-match návrhu, výber
    iného existujúceho názvu, alebo úplne nový názov (rovnaký endpoint pre
    všetky tri prípady, FE vždy pošle finálny zvolený 'route_name').
    """
    ctx = require_user(get_auth_ctx(req))
    out = service_confirm_route_match(
        user_id=user_id,
        activity_id=activity_id,
        route_name=payload.route_name,
        ctx=ctx,
    )

    if not out.get("ok"):
        return {
            "success": False,
            "data": None,
            "error_code": out.get("code") or "REQUEST_FAILED",
            "message": None,
        }

    return {"success": True, "data": out, "error_code": None, "message": None}


@router.post("/route-match/{user_id}/{activity_id}/reject-suggestion")
def reject_route_auto_match(
    user_id: int,
    activity_id: int,
    req: Request,
) -> Dict[str, Any]:
    """Zamietne len navrhnutý auto-match (route_auto_match), bez potvrdenia."""
    ctx = require_user(get_auth_ctx(req))
    ok = service_reject_route_auto_match(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )
    return {
        "success": ok,
        "data": {"cleared": ok},
        "error_code": None if ok else "REQUEST_FAILED",
        "message": None,
    }


@router.post("/route-match/{user_id}/{activity_id}/remove")
def remove_route_match(
    user_id: int,
    activity_id: int,
    req: Request,
) -> Dict[str, Any]:
    """Zruší (odparuje) potvrdené priradenie trate pre danú aktivitu."""
    ctx = require_user(get_auth_ctx(req))
    ok = service_remove_route_match(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )
    return {
        "success": ok,
        "data": {"removed": ok},
        "error_code": None if ok else "REQUEST_FAILED",
        "message": None,
    }


@router.get("/route-match/{user_id}/names")
def list_route_names(
    user_id: int,
    sport: str,
    req: Request,
) -> Dict[str, Any]:
    """
    Zoznam existujúcich potvrdených názvov trás pre daný šport (query param
    ?sport=run). Pre samostatné "Moje trate" prehľady alebo spätné priradenie
    bez otvorenej konkrétnej aktivity.
    """
    ctx = require_user(get_auth_ctx(req))
    names = service_list_route_names_for_sport(
        user_id=user_id, sport_type_fe=sport, ctx=ctx
    )
    return {"success": True, "data": names, "error_code": None, "message": None}


@router.get("/route-match/{user_id}/compare")
def compare_route_match(
    user_id: int,
    route_match: str,
    req: Request,
) -> Dict[str, Any]:
    """
    Dáta pre "podobné behy" widget/detail — všetky aktivity priradené k danému
    potvrdenému route_match názvu (query param ?route_match=Kamzík), plus
    súhrnná štatistika (medián, najlepší čas).
    """
    ctx = require_user(get_auth_ctx(req))
    out = service_get_comparison_for_route(
        user_id=user_id, route_match=route_match, ctx=ctx
    )
    return {"success": True, "data": out, "error_code": None, "message": None}

@router.get("/route-match/{user_id}/overview")
def get_route_overview(
    user_id: int,
    req: Request,
) -> Dict[str, Any]:
    """Prehľad všetkých pomenovaných tratí usera - pre widget a 'Moje trate' zoznam."""
    ctx = require_user(get_auth_ctx(req))
    out = service_get_route_overview(user_id=user_id, ctx=ctx)
    return {"success": True, "data": out, "error_code": None, "message": None}