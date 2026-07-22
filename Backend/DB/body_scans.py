# DB/body_scans.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx

TABLE_BODY_SCANS = "body_scans"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# =========================
# INSERT
# =========================

# Zmena v DB/body_scans.py - db_insert_body_scan signature
def db_insert_body_scan(
    user_id: int,
    *,
    scan_date: str,
    fields: Dict[str, Any],
    scan_source: str = "inbody",
    segmental_analysis: Optional[Dict[str, Any]] = None,
    raw_extraction: Optional[Dict[str, Any]] = None,
    source_image_path: Optional[str] = None,
    ai_model_used: Optional[str] = None,
    confirmed_by_user: bool = False,
    manually_edited: bool = False,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="body_scans.db_insert_body_scan")

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "scan_date": scan_date,
        "scan_source": scan_source,
        **fields,
        "segmental_analysis": segmental_analysis,
        "raw_extraction": raw_extraction,
        "source_image_path": source_image_path,
        "ai_model_used": ai_model_used,
        "confirmed_by_user": confirmed_by_user,
        "manually_edited": manually_edited, 
    }

    try:
        res = sb.table(TABLE_BODY_SCANS).insert(row).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-BODYSCAN] insert error:", repr(e))
        return None
# =========================
# READ - single
# =========================

def db_get_body_scan_by_id(
    user_id: int,
    scan_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """Načíta jeden konkrétny scan (musí patriť danému userovi)."""
    sb = get_sb(ctx, caller="body_scans.db_get_body_scan_by_id")
    try:
        res = (
            sb.table(TABLE_BODY_SCANS)
            .select("*")
            .eq("user_id", int(user_id))
            .eq("id", int(scan_id))
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-BODYSCAN] get_by_id error:", repr(e))
        return None


def db_get_latest_body_scan(
    user_id: int,
    *,
    scan_source: Optional[str] = None,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """Najnovší (podľa scan_date) scan usera, voliteľne filtrovaný podľa zdroja."""
    sb = get_sb(ctx, caller="body_scans.db_get_latest_body_scan")
    try:
        q = (
            sb.table(TABLE_BODY_SCANS)
            .select("*")
            .eq("user_id", int(user_id))
            .is_("deleted_at", "null")
        )
        if scan_source:
            q = q.eq("scan_source", scan_source)
        res = q.order("scan_date", desc=True).limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-BODYSCAN] get_latest error:", repr(e))
        return None


# =========================
# READ - list (pre trendy)
# =========================

def db_get_body_scans_for_user(
    user_id: int,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    only_confirmed: bool = True,
    scan_source: Optional[str] = None,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Zoznam scanov usera, zoradený od najstaršieho po najnovší (vhodné priamo
    pre trend graf bez ďalšieho sortovania na FE). Defaultne len potvrdené
    (confirmed_by_user=True), aby draft/neoverené scany nekazili trendy.
    """
    sb = get_sb(ctx, caller="body_scans.db_get_body_scans_for_user")
    try:
        q = (
            sb.table(TABLE_BODY_SCANS)
            .select("*")
            .eq("user_id", int(user_id))
            .is_("deleted_at", "null")
        )
        if only_confirmed:
            q = q.eq("confirmed_by_user", True)
        if scan_source:
            q = q.eq("scan_source", scan_source)
        if start_date:
            q = q.gte("scan_date", start_date)
        if end_date:
            q = q.lte("scan_date", end_date)

        res = q.order("scan_date", desc=False).execute()
        return res.data or []
    except Exception as e:
        print("[DB-BODYSCAN] get_for_user error:", repr(e))
        return []


# =========================
# UPDATE (edit + confirm)
# =========================

def db_update_body_scan(
    user_id: int,
    scan_id: int,
    *,
    fields: Dict[str, Any],
    mark_manually_edited: bool = True,
    ctx: AuthCtx,
) -> bool:
    """
    Aktualizuje ľubovoľné stĺpce existujúceho scanu (ručná korekcia po AI
    extrakcii). Nastaví manually_edited=True (pokiaľ nie je explicitne
    vypnuté), aby bolo jasné že hodnoty už nezodpovedajú čisto raw_extraction.
    Nemení raw_extraction ani source_image_path - tie ostávajú ako pôvodný
    audit trail AI výstupu.
    """
    if not fields:
        return False

    sb = get_sb(ctx, caller="body_scans.db_update_body_scan")
    payload = dict(fields)
    payload["updated_at"] = _now_iso()
    if mark_manually_edited:
        payload["manually_edited"] = True

    try:
        sb.table(TABLE_BODY_SCANS).update(payload).eq("user_id", int(user_id)).eq(
            "id", int(scan_id)
        ).execute()
        return True
    except Exception as e:
        print("[DB-BODYSCAN] update error:", repr(e))
        return False


def db_confirm_body_scan(
    user_id: int,
    scan_id: int,
    *,
    ctx: AuthCtx,
) -> bool:
    """Označí scan ako potvrdený userom (po review AI extrakcie na FE)."""
    sb = get_sb(ctx, caller="body_scans.db_confirm_body_scan")
    try:
        sb.table(TABLE_BODY_SCANS).update(
            {"confirmed_by_user": True, "updated_at": _now_iso()}
        ).eq("user_id", int(user_id)).eq("id", int(scan_id)).execute()
        return True
    except Exception as e:
        print("[DB-BODYSCAN] confirm error:", repr(e))
        return False


# =========================
# DELETE (soft)
# =========================

def db_delete_body_scan(
    user_id: int,
    scan_id: int,
    *,
    ctx: AuthCtx,
) -> bool:
    """Soft-delete scanu (nastaví deleted_at), konzistentné s activities_summary vzorom."""
    sb = get_sb(ctx, caller="body_scans.db_delete_body_scan")
    try:
        sb.table(TABLE_BODY_SCANS).update(
            {"deleted_at": _now_iso()}
        ).eq("user_id", int(user_id)).eq("id", int(scan_id)).execute()
        return True
    except Exception as e:
        print("[DB-BODYSCAN] delete error:", repr(e))
        return False
