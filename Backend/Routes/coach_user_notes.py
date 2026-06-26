# Routes_FE/coach_user_notes.py
from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel

from Modules.Supabase.auth import get_auth_ctx, require_user
from Services.coach_user_notes import (
    service_list_notes,
    service_create_sticky,
    service_update_sticky,
    service_delete_note,
    service_add_ephemeral,
)

router = APIRouter(prefix="/coach/notes", tags=["coach/notes"])


# =========================
# PAYLOADS
# =========================

class NoteTextPayload(BaseModel):
    text: str


# =========================
# GET
# =========================

@router.get("/{user_id}")
def get_notes(user_id: int, req: Request) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    data = service_list_notes(user_id=user_id, ctx=ctx)
    return {"success": True, "data": data}


# =========================
# STICKY CRUD
# =========================

@router.post("/{user_id}/sticky")
def create_sticky(user_id: int, payload: NoteTextPayload, req: Request) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    out = service_create_sticky(user_id=user_id, text=payload.text, ctx=ctx)
    if not out.get("ok"):
        return {"success": False, "error_code": out.get("code"), "message": out.get("message")}
    return {"success": True, "data": out.get("note")}


@router.patch("/{user_id}/sticky/{note_id}")
def update_sticky(user_id: int, note_id: int, payload: NoteTextPayload, req: Request) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    out = service_update_sticky(user_id=user_id, note_id=note_id, text=payload.text, ctx=ctx)
    if not out.get("ok"):
        return {"success": False, "error_code": out.get("code"), "message": out.get("message")}
    return {"success": True}


@router.delete("/{user_id}/{note_id}")
def delete_note(user_id: int, note_id: int, req: Request) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    out = service_delete_note(user_id=user_id, note_id=note_id, ctx=ctx)
    if not out.get("ok"):
        return {"success": False, "error_code": out.get("code"), "message": out.get("message")}
    return {"success": True}


# =========================
# EPHEMERAL
# =========================

@router.post("/{user_id}/ephemeral")
def add_ephemeral(user_id: int, payload: NoteTextPayload, req: Request) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    out = service_add_ephemeral(user_id=user_id, text=payload.text, ctx=ctx)
    if not out.get("ok"):
        return {"success": False, "error_code": out.get("code"), "message": out.get("message")}
    return {"success": True, "data": out.get("note")}
