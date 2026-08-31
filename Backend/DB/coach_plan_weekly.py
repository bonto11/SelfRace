# DB/coach_plan_weekly.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_PLAN_WEEKLY


def db_insert_weekly_rows(
    rows: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Bulk INSERT do coach_plan_weekly.

    ZMENA: vracia vložené RIADKY (s id), nie počet. Dôvod: pri prvotnom
    generovaní plánu (full_reset) plan_meta_id ešte neexistuje v čase tohto
    insertu (coach_plan_meta záznam sa vytvára AŽ PO uložení weekly riadkov,
    lebo jeho start_date/end_date/weeks_total sa počíta z reálneho AI
    výstupu). Volajúci preto potrebuje id práve vložených riadkov, aby im
    mohol plan_meta_id dopísať hneď po vytvorení meta záznamu -
    db_set_plan_meta_id_for_weekly_rows nižšie. Počet vložených riadkov
    zistíš ako len(výsledok).
    """
    if not rows:
        return []

    sb = get_sb(ctx, caller="coach_plan_weekly.db_insert_weekly_rows")

    try:
        res = sb.table(TABLE_COACH_PLAN_WEEKLY).insert(rows).execute()
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] insert error:", repr(e))
        return []


def db_set_plan_meta_id_for_weekly_rows(
    row_ids: List[int],
    plan_meta_id: int,
    *,
    ctx: AuthCtx,
) -> int:
    """
    NOVÉ: dodatočne priradí plan_meta_id už vloženým weekly riadkom -
    pozri docstring db_insert_weekly_rows vyššie.
    """
    if not row_ids:
        return 0
    sb = get_sb(ctx, caller="coach_plan_weekly.db_set_plan_meta_id_for_weekly_rows")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .update({"plan_meta_id": plan_meta_id})
            .in_("id", row_ids)
            .execute()
        )
        return len(res.data or [])
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] set_plan_meta_id error:", repr(e))
        return 0


def db_clear_weekly_for_user_plan(
    user_id: int,
    plan_meta_id: Optional[int],
    *,
    ctx: AuthCtx,
) -> int:
    """
    DELETE weekly riadkov PRE KONKRÉTNY plan_meta_id (nie celé user_id ako
    predtým). POZOR: Maže úplne všetko vrátane histórie (minulých týždňov)
    TOHTO KONKRÉTNEHO plánu. Používaj len pri úplnom resete plánu od nuly -
    pri bežnom replane cez service_generate_weekly_plan sa namiesto tejto
    funkcie používa db_delete_current_and_future_weekly_plans, ktorá
    zachováva históriu.

    FIX: predtým mazalo VŠETKY weekly riadky usera bez ohľadu na to,
    ktorému plánu patrili - ak mal user rozbehnutý aktívny plán A zároveň
    generoval draft nového plánu, tento full_reset draftu vymazal aj dáta
    aktívneho plánu. plan_meta_id=None je poistka pre legacy volania bez
    scope (radšej nič nezmaž, než zmazať naslepo celého usera).
    """
    if plan_meta_id is None:
        print("[DB-COACH-WEEKLY] clear SKIPPED - no plan_meta_id provided (would have deleted ALL user rows)")
        return 0

    sb = get_sb(ctx, caller="coach_plan_weekly.db_clear_weekly_for_user_plan")

    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .delete()
            .eq("user_id", user_id)
            .eq("plan_meta_id", plan_meta_id)
            .execute()
        )
        return len(res.data or [])
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] clear error:", repr(e))
        return 0


def db_get_weekly_for_user_plan(
    user_id: int,
    plan_meta_id: Optional[int],
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Načítanie weekly riadkov PRE KONKRÉTNY plán (plan_meta_id).

    FIX: predtým vracalo VŠETKY weekly riadky usera naprieč všetkými
    jeho plánmi (aktívnymi aj draftmi) zlepené dokopy - presne to
    spôsobovalo kontamináciu (replan aktívneho plánu si "požičal" week_index
    z nesúvisiaceho draftu). plan_meta_id=None necháva staré správanie ako
    núdzový fallback (napr. pre legacy dáta bez priradenia).
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_get_weekly_for_user_plan")

    try:
        q = sb.table(TABLE_COACH_PLAN_WEEKLY).select("*").eq("user_id", user_id)
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.order("week_index", desc=False).execute()
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] get_for_plan error:", repr(e))
        return []


def db_get_week_row_for_plan(
    user_id: int,
    plan_meta_id: Optional[int],
    week_index: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """Načíta konkrétny týždeň (1 riadok) pre daný plán + week_index."""
    sb = get_sb(ctx, caller="coach_plan_weekly.db_get_week_row_for_plan")

    try:
        q = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .select("*")
            .eq("user_id", user_id)
            .eq("week_index", week_index)
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] get_week_row error:", repr(e))
        return None


def db_check_weekly_data_exists(
    user_id: int, plan_meta_id: Optional[int], *, ctx: AuthCtx
) -> bool:
    """Vráti True, ak pre daný plán existuje aspoň jeden weekly záznam."""
    sb = get_sb(ctx, caller="coach_plan_weekly.db_check_weekly_data_exists")
    try:
        q = sb.table(TABLE_COACH_PLAN_WEEKLY).select("id").eq("user_id", user_id)
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.limit(1).execute()
        return bool(res.data)
    except Exception as e:
        print("[DB-COACH-WEEKLY] check_exists error:", repr(e))
        return False


def db_get_weekly_row_by_date(
    user_id: int,
    plan_meta_id: Optional[int],
    target_date_iso: str,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """Nájde weekly riadok DANÉHO PLÁNU, do ktorého patrí zadaný dátum."""
    sb = get_sb(ctx, caller="coach_plan_weekly.db_get_weekly_row_by_date")
    date_only = target_date_iso[:10]
    try:
        q = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .select("id, week_start, week_end, week_index")
            .eq("user_id", user_id)
            .lte("week_start", date_only)
            .gte("week_end", date_only)
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.limit(1).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        print("[DB-COACH-WEEKLY] get_row_by_date error:", repr(e))
        return None


def db_update_weekly_actual_stats(
    row_id: int, actual_stats: Dict[str, Any], *, ctx: AuthCtx
) -> bool:
    """
    Zaktualizuje JSONB stĺpec 'actual_stats' pre konkrétny weekly riadok.
    Nezmenené - operuje na konkrétnom row_id, ten je už jednoznačný.
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_update_weekly_actual_stats")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .update({"actual_stats": actual_stats})
            .eq("id", row_id)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        print("[DB-COACH-WEEKLY] update_actual_stats error:", repr(e))
        return False


def db_delete_future_weekly_plans(
    user_id: int,
    plan_meta_id: Optional[int],
    from_date_iso: str,
    *,
    ctx: AuthCtx,
) -> bool:
    """
    Vymaže týždenné riadky DANÉHO PLÁNU, ktoré ZAČÍNAJÚ po zadanom dátume.
    Aktuálny týždeň nechá nedotknutý.
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_delete_future_weekly_plans")
    date_only = from_date_iso[:10]

    try:
        q = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .delete()
            .eq("user_id", user_id)
            .gt("week_start", date_only)
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        q.execute()
        return True
    except Exception as e:
        print("[DB-COACH-WEEKLY] delete future error:", repr(e))
        return False


def db_delete_current_and_future_weekly_plans(
    user_id: int,
    plan_meta_id: Optional[int],
    from_date_iso: str,
    *,
    ctx: AuthCtx,
) -> int:
    """
    Vymaže týždenné riadky DANÉHO PLÁNU, ktoré OBSAHUJÚ from_date_iso alebo
    začínajú po ňom (aktuálny prebiehajúci týždeň aj všetky budúce). Minulé,
    už uzavreté týždne (week_end < from_date_iso) ostávajú netknuté.

    FIX: predtým mazalo naprieč VŠETKÝMI plánmi usera - presne toto
    zasiahlo aktívny plán 61, keď autoadjust replanoval, čo si myslel že je
    "ten istý" plán, ale bola to dátovo zmiešaná zmes s draftom.
    """
    sb = get_sb(ctx, caller="coach_plan_weekly.db_delete_current_and_future_weekly_plans")
    date_only = from_date_iso[:10]

    try:
        q = (
            sb.table(TABLE_COACH_PLAN_WEEKLY)
            .delete()
            .eq("user_id", user_id)
            .gte("week_end", date_only)
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.execute()
        return len(res.data or [])
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-WEEKLY] delete current+future error:", repr(e))
        return 0