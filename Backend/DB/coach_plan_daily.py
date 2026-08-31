# DB/coach_plan_daily.py
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta, date
from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_PLAN_DAILY
from DB.coach_plan_meta import db_get_active_plan_meta_for_user
from DB.activities_summary import db_get_activities_recent


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_insert_daily_rows(rows: List[Dict[str, Any]], *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """
    ZMENA: vracia vložené RIADKY (s id), nie počet - rovnaký dôvod ako
    v db_insert_weekly_rows (weekly.py): plan_meta_id sa pri prvotnom
    generovaní dopisuje AŽ PO vytvorení coach_plan_meta záznamu, cez
    db_set_plan_meta_id_for_daily_rows nižšie.
    """
    if not rows:
        return []
    sb = get_sb(ctx, caller="coach_plan_daily.db_insert_daily_rows")
    try:
        res = sb.table(TABLE_COACH_PLAN_DAILY).insert(rows).execute()
        return res.data or []
    except Exception as e:
        print("[DB-COACH-DAILY] insert error:", repr(e))
        return []


def db_set_plan_meta_id_for_daily_rows(
    row_ids: List[int], plan_meta_id: int, *, ctx: AuthCtx
) -> int:
    """NOVÉ: dodatočne priradí plan_meta_id už vloženým daily riadkom."""
    if not row_ids:
        return 0
    sb = get_sb(ctx, caller="coach_plan_daily.db_set_plan_meta_id_for_daily_rows")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .update({"plan_meta_id": plan_meta_id})
            .in_("id", row_ids)
            .execute()
        )
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-DAILY] set_plan_meta_id error:", repr(e))
        return 0


def db_clear_daily_for_user_week(
    user_id: int, plan_meta_id: Optional[int], week_start: str, week_end: str, *, ctx: AuthCtx
) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_clear_daily_for_user_week")
    try:
        q = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("user_id", user_id)
            .gte("plan_date", week_start)
            .lte("plan_date", week_end)
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.execute()
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-DAILY] clear error:", repr(e))
        return 0


def db_get_planned_range_rows(
    user_id: int, plan_meta_id: Optional[int], date_from: str, date_to: str, *, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_planned_range_rows")
    try:
        q = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("*")
            .eq("user_id", user_id)
            .gte("plan_date", date_from)
            .lte("plan_date", date_to)
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = (
            q.order("plan_date", desc=False)
            .order("session_index", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print("[DB-COACH-DAILY] get_planned_range_rows error:", repr(e))
        return []


def db_link_session_to_activity(user_id: int, *, ctx: AuthCtx, id: int, activity_id: Optional[int]) -> Optional[Dict[str, Any]]:
    # Nezmenené - operuje na konkrétnom (user_id, id), to je už jednoznačné
    # bez ohľadu na to, ktorému plánu session patrí.
    sb = get_sb(ctx, caller="coach_plan_daily.db_link_session_to_activity")

    try:
        session_res = sb.table(TABLE_COACH_PLAN_DAILY).select("plan_date").eq("id", int(id)).eq("user_id", int(user_id)).execute()
        session_data = session_res.data or []

        if not session_data:
            return None

        plan_date_str = session_data[0].get("plan_date")

        if activity_id:
            new_status = "done"
        else:
            today_str = date.today().isoformat()
            if plan_date_str and plan_date_str < today_str:
                new_status = "missed"
            else:
                new_status = "planned"

        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .update({
                "activity_id": activity_id,
                "status": new_status,
                "updated_at": _now_iso()
            })
            .eq("id", int(id))
            .eq("user_id", int(user_id))
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-DAILY] link_session_to_activity error:", repr(e))
        return None


def db_has_uncompleted_daily_sessions(
    user_id: int, plan_meta_id: Optional[int], plan_date: str, *, ctx: AuthCtx
) -> bool:
    sb = get_sb(ctx, caller="coach_plan_daily.db_has_uncompleted_daily_sessions")
    try:
        q = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("id")
            .eq("user_id", int(user_id))
            .eq("plan_date", plan_date)
            .eq("status", "planned")
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.limit(1).execute()
        return len(res.data or []) > 0
    except Exception as e:
        print("[DB-COACH-DAILY] has_uncompleted_sessions error:", repr(e))
        return False


def db_list_daily_for_user_horizon(
    user_id: int, plan_meta_id: Optional[int], horizon_days: int, *, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    if horizon_days <= 0:
        horizon_days = 7
    today = date.today()
    date_from = today.isoformat()
    date_to = (today + timedelta(days=horizon_days)).isoformat()
    sb = get_sb(ctx, caller="coach_plan_daily.db_list_daily_for_user_horizon")
    try:
        query = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("*")
            .eq("user_id", user_id)
            .gte("plan_date", date_from)
            .lte("plan_date", date_to)
        )
        if plan_meta_id is not None:
            query = query.eq("plan_meta_id", plan_meta_id)
        res = (
            query.order("plan_date", desc=False)
            .order("session_index", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print("[DB-COACH-DAILY] db_list_daily_for_user_horizon error:", repr(e))
        return []


def db_clear_daily_for_user_plan(user_id: int, plan_meta_id: Optional[int], *, ctx: AuthCtx) -> int:
    """
    FIX: predtým mazalo VŠETKY daily riadky usera bez ohľadu na plán -
    teraz scoped na plan_meta_id (None = poistka, nezmaže nič naslepo).
    """
    if plan_meta_id is None:
        print("[DB-COACH-DAILY] clear_plan SKIPPED - no plan_meta_id provided")
        return 0
    sb = get_sb(ctx, caller="coach_plan_daily.db_clear_daily_for_user_plan")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("user_id", user_id)
            .eq("plan_meta_id", plan_meta_id)
            .execute()
        )
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-DAILY] clear_plan error:", repr(e))
        return 0


def db_clear_daily_for_user_range(
    user_id: int,
    plan_meta_id: Optional[int],
    date_from: str,
    date_to: str,
    *,
    ctx: AuthCtx,
) -> int:
    """
    FIX: pridaný plan_meta_id scope. Predtým malo aj mŕtvy nepoužívaný
    parameter global_user_clear (nikdy sa v query nepoužil) - odstránený,
    volania s ním boli aktualizované na nový signature.
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_clear_daily_for_user_range")
    try:
        query = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("user_id", user_id)
            .gte("plan_date", date_from)
            .lte("plan_date", date_to)
        )
        if plan_meta_id is not None:
            query = query.eq("plan_meta_id", plan_meta_id)
        res = query.execute()
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-DAILY] clear_range error:", repr(e))
        return 0


def db_get_daily_session_by_id(user_id: int, id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    # Nezmenené - jednoznačné cez (user_id, id)
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_daily_session_by_id")
    try:
        res = sb.table(TABLE_COACH_PLAN_DAILY).select("id,user_id,plan_date,session_index").eq("id", int(id)).eq("user_id", int(user_id)).limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-DAILY] get_session_by_id error:", repr(e))
        return None


def db_count_sessions_on_day(
    user_id: int, plan_meta_id: Optional[int], plan_date: str, *, ctx: AuthCtx
) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_count_sessions_on_day")
    try:
        q = sb.table(TABLE_COACH_PLAN_DAILY).select("id").eq("user_id", int(user_id)).eq("plan_date", str(plan_date))
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.execute()
        return len(res.data or [])
    except Exception as e:
        print("[DB-COACH-DAILY] count_sessions_on_day error:", repr(e))
        return 0


def db_get_max_session_index_on_day(
    user_id: int, plan_meta_id: Optional[int], plan_date: str, *, ctx: AuthCtx
) -> int:
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_max_session_index_on_day")
    try:
        q = sb.table(TABLE_COACH_PLAN_DAILY).select("session_index").eq("user_id", int(user_id)).eq("plan_date", str(plan_date))
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.order("session_index", desc=True).limit(1).execute()
        rows = res.data or []
        if not rows:
            return -1
        v = rows[0].get("session_index")
        return int(v) if v is not None else -1
    except Exception as e:
        print("[DB-COACH-DAILY] max_session_index_on_day error:", repr(e))
        return -1


def db_update_daily_session_date(user_id: int, id: int, *, plan_date: str, session_index: int, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    # Nezmenené - jednoznačné cez (user_id, id)
    sb = get_sb(ctx, caller="coach_plan_daily.db_update_daily_session_date")
    try:
        res = sb.table(TABLE_COACH_PLAN_DAILY).update({"plan_date": str(plan_date), "session_index": int(session_index), "updated_at": _now_iso()}).eq("id", int(id)).eq("user_id", int(user_id)).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-DAILY] update_daily_session_date error:", repr(e))
        return None


def db_reschedule_daily_sessions_bulk(
    user_id: int, plan_meta_id: Optional[int], *, moves: List[Dict[str, Any]], max_per_day: int = 2, ctx: AuthCtx
) -> Dict[str, Any]:
    if not moves:
        return {"ok": True, "updated": 0}
    updated = 0
    errors: List[Dict[str, Any]] = []

    for m in moves:
        try:
            sid = m.get("id")
            from_date = str(m.get("from_date") or "")[:10]
            to_date = str(m.get("to_date") or "")[:10]

            if not sid or not to_date:
                raise ValueError("missing id/to_date")
            row = db_get_daily_session_by_id(user_id=user_id, id=sid, ctx=ctx)
            if not row:
                raise ValueError("session_not_found_or_not_owned")

            current_date = str(row.get("plan_date") or "")[:10]

            if to_date == current_date:
                continue

            rest_row = db_get_rest_session_on_day(user_id=user_id, plan_meta_id=plan_meta_id, plan_date=to_date, ctx=ctx)
            if rest_row and rest_row.get("id") is not None:
                deleted = db_delete_daily_session(user_id=user_id, session_id=int(rest_row["id"]), ctx=ctx)
                if not deleted:
                    raise ValueError("rest_day_delete_failed")

            cnt = db_count_sessions_on_day(user_id=user_id, plan_meta_id=plan_meta_id, plan_date=to_date, ctx=ctx)
            if cnt >= int(max_per_day or 2):
                raise ValueError("target_day_full")

            max_idx = db_get_max_session_index_on_day(user_id=user_id, plan_meta_id=plan_meta_id, plan_date=to_date, ctx=ctx)
            next_idx = int(max_idx + 1)
            upd = db_update_daily_session_date(user_id=user_id, id=sid, plan_date=to_date, session_index=next_idx, ctx=ctx)
            if not upd:
                raise ValueError("update_failed")
            updated += 1
        except Exception as e:
            errors.append({"id": m.get("id"), "error": str(e)})

    if errors:
        return {"ok": False, "updated": updated, "error": "some_moves_failed", "errors": errors}
    return {"ok": True, "updated": updated}


def db_get_rest_session_on_day(
    user_id: int, plan_meta_id: Optional[int], plan_date: str, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Nájde rest-day session (duration_min NULL alebo 0) na danom dni pre daný plán, ak existuje."""
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_rest_session_on_day")
    try:
        q = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("id, duration_min")
            .eq("user_id", int(user_id))
            .eq("plan_date", str(plan_date))
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.execute()
        for row in (res.data or []):
            dur = row.get("duration_min")
            if dur is None or int(dur) == 0:
                return row
        return None
    except Exception as e:
        print("[DB-COACH-DAILY] get_rest_session_on_day error:", repr(e))
        return None


def db_check_daily_data_exists(user_id: int, plan_meta_id: Optional[int], *, ctx: AuthCtx) -> bool:
    sb = get_sb(ctx, caller="coach_plan_daily.db_check_daily_data_exists")
    try:
        q = sb.table(TABLE_COACH_PLAN_DAILY).select("id").eq("user_id", user_id)
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.limit(1).execute()
        return bool(res.data)
    except Exception as e:
        print("[DB-COACH-DAILY] check_exists error:", repr(e))
        return False


def db_delete_future_daily_plans(
    user_id: int, plan_meta_id: Optional[int], from_date: str, *, ctx: AuthCtx
) -> bool:
    sb = get_sb(ctx, caller="coach_plan_daily.db_delete_future")
    try:
        q = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("user_id", user_id)
            .gte("plan_date", from_date)
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.execute()
        return bool(res.data)
    except Exception as e:
        print("[DB-COACH-DAILY] delete future error:", repr(e))
        return False


def db_delete_daily_session(user_id: int, session_id: int, *, ctx: AuthCtx) -> bool:
    # Nezmenené - jednoznačné cez (user_id, id)
    sb = get_sb(ctx, caller="coach_plan_daily.db_delete_daily_session")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .delete()
            .eq("id", int(session_id))
            .eq("user_id", int(user_id))
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        print(f"[DB-COACH-DAILY] delete_daily_session error: {repr(e)}")
        return False


def db_update_daily_session_data(user_id: int, session_id: int, update_data: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    # Nezmenené - jednoznačné cez (user_id, id)
    sb = get_sb(ctx, caller="coach_plan_daily.db_update_daily_session_data")
    try:
        session_res = sb.table(TABLE_COACH_PLAN_DAILY).select("plan_date").eq("id", int(session_id)).eq("user_id", int(user_id)).execute()
        session_data = session_res.data or []

        if not session_data:
            return None

        plan_date_str = session_data[0].get("plan_date")

        payload = dict(update_data)
        payload["updated_at"] = _now_iso()

        if "activity_id" in payload and payload["activity_id"] is None and "status" not in payload:
            today_str = date.today().isoformat()
            if plan_date_str and plan_date_str < today_str:
                payload["status"] = "missed"
            else:
                payload["status"] = "planned"

        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .update(payload)
            .eq("id", int(session_id))
            .eq("user_id", int(user_id))
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print(f"[DB-COACH-DAILY] update_daily_session_data error: {repr(e)}")
        return None


def db_get_compliance_stats(
    user_id: int, plan_meta_id: Optional[int], days: int = 30, *, ctx: AuthCtx
) -> Dict[str, int]:
    """
    FIX: teraz filtruje priamo podľa plan_meta_id namiesto "od start_date
    aktívneho plánu" - presnejšie (fungovalo by nesprávne, ak by v tom
    dátumovom okne existovali riadky iného plánu toho istého usera).
    plan_meta_id=None necháva starý fallback (podľa start_date aktívneho
    plánu / posledných `days` dní).
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_compliance_stats")
    try:
        query = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("status, plan_date, duration_min, sport")
            .eq("user_id", user_id)
        )

        if plan_meta_id is not None:
            query = query.eq("plan_meta_id", plan_meta_id)
        else:
            active_plan = db_get_active_plan_meta_for_user(user_id, ctx=ctx)
            if active_plan and active_plan.get("start_date"):
                query = query.gte("plan_date", active_plan["start_date"])
            else:
                since = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
                query = query.gte("plan_date", since)

        today = date.today().isoformat()
        query = query.lte("plan_date", today)

        res = query.execute()
        data = res.data or []

        stats = {"done": 0, "postponed": 0, "missed": 0, "planned": 0}
        for row in data:
            s = row.get("status") or "planned"
            plan_date = str(row.get("plan_date") or "")
            duration = row.get("duration_min")
            sport = str(row.get("sport") or "")

            is_rest_day = (sport == "other" and (duration is None or int(duration) == 0))

            if s == "planned" and plan_date and plan_date < today:
                s = "done" if is_rest_day else "missed"

            if s in stats:
                stats[s] += 1

        return stats
    except Exception as e:
        print("[DB-COACH-DAILY] stats error:", repr(e))
        return {"done": 0, "postponed": 0, "missed": 0, "planned": 0}


def db_get_unmatched_activities(
    user_id: int,
    plan_meta_id: Optional[int],
    *,
    ctx: AuthCtx,
    days: int = 30,
) -> List[Dict[str, Any]]:
    """
    Aktivity zo Stravy (activities_summary), ktoré NIE SÚ napárované na
    žiadnu session DANÉHO PLÁNU (plan_meta_id).

    FIX: "matched_ids" (activity_id, ktoré sú už napárované na plán) sa
    teraz vytiahnu scoped podľa plan_meta_id, nie len podľa dátumového
    okna od start_date - to isté dátumové okno mohlo predtým obsahovať
    riadky INÉHO plánu toho istého usera.
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_unmatched_activities")
    try:
        if plan_meta_id is not None:
            plan_res_q = (
                sb.table(TABLE_COACH_PLAN_DAILY)
                .select("activity_id")
                .eq("user_id", user_id)
                .eq("plan_meta_id", plan_meta_id)
            )
            active_plan = db_get_active_plan_meta_for_user(user_id, ctx=ctx)
            since_iso = (
                active_plan["start_date"]
                if active_plan and active_plan.get("start_date")
                else (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
            )
        else:
            active_plan = db_get_active_plan_meta_for_user(user_id, ctx=ctx)
            if active_plan and active_plan.get("start_date"):
                since_iso = active_plan["start_date"]
            else:
                since_iso = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
            plan_res_q = (
                sb.table(TABLE_COACH_PLAN_DAILY)
                .select("activity_id")
                .eq("user_id", user_id)
                .gte("plan_date", since_iso)
            )

        plan_res = plan_res_q.execute()
        matched_ids = {
            int(r["activity_id"]) for r in (plan_res.data or [])
            if r.get("activity_id") is not None
        }

        activities = db_get_activities_recent(ctx=ctx, user_id=user_id, since_iso_date=since_iso)

        unmatched = [
            a for a in activities
            if int(a["activity_id"]) not in matched_ids
        ]
        return unmatched
    except Exception as e:
        print("[DB-COACH-DAILY] get_unmatched_activities error:", repr(e))
        return []


def db_get_unmatched_activities_summary(
    user_id: int,
    plan_meta_id: Optional[int],
    *,
    ctx: AuthCtx,
    days: int = 30,
) -> List[Dict[str, Any]]:
    """
    Aktivity zo Stravy bez napárovania na plán, agregované podľa športu.
    """
    unmatched = db_get_unmatched_activities(user_id, plan_meta_id, ctx=ctx, days=days)

    agg: Dict[str, Dict[str, Any]] = {}
    for a in unmatched:
        sport = str(a.get("sport_type_fe") or a.get("sport_type") or "other")
        dist = a.get("distance_m") or 0
        moving = a.get("moving_time_s") or 0
        elev = a.get("elevation_gain_m") or 0

        if sport not in agg:
            agg[sport] = {
                "sport": sport,
                "count": 0,
                "distance_m": 0,
                "moving_time_s": 0,
                "elevation_gain_m": 0,
            }

        agg[sport]["count"] += 1
        try:
            agg[sport]["distance_m"] += float(dist)
        except (TypeError, ValueError):
            pass
        try:
            agg[sport]["moving_time_s"] += float(moving)
        except (TypeError, ValueError):
            pass
        try:
            agg[sport]["elevation_gain_m"] += float(elev)
        except (TypeError, ValueError):
            pass

    return sorted(agg.values(), key=lambda x: x["count"], reverse=True)


def db_get_postponed_sessions(
    user_id: int, plan_meta_id: Optional[int], *, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_postponed_sessions")
    try:
        q = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "postponed")
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.order("plan_date", desc=True).execute()
        return res.data or []
    except Exception as e:
        print("[DB-COACH-DAILY] get_postponed error:", repr(e))
        return []


def db_get_done_sessions_with_activity(
    user_id: int, plan_meta_id: Optional[int], *, ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Done sessiony z plánu s activity_id (pre join s activities_summary).
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_done_sessions_with_activity")
    try:
        q = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("sport, duration_min, activity_id")
            .eq("user_id", user_id)
            .eq("status", "done")
        )
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = q.execute()
        return res.data or []
    except Exception as e:
        print("[DB-COACH-STREAK] done_with_activity error:", repr(e))
        return []


def db_get_daily_session_by_id_full(user_id: int, id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    # Nezmenené - jednoznačné cez (user_id, id)
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_daily_session_by_id_full")
    try:
        res = sb.table(TABLE_COACH_PLAN_DAILY).select("*").eq("id", int(id)).eq("user_id", int(user_id)).limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-DAILY] get_daily_session_by_id_full error:", repr(e))
        return None


def db_append_preview_thread_entry(user_id: int, id: int, entry: Dict[str, Any], *, ctx: AuthCtx) -> bool:
    sb = get_sb(ctx, caller="coach_plan_daily.db_append_preview_thread_entry")
    try:
        row = db_get_daily_session_by_id_full(user_id, id, ctx=ctx)
        if not row:
            return False
        thread = row.get("preview_thread") or []
        entry = dict(entry)
        entry["created_at"] = _now_iso()
        thread.append(entry)
        sb.table(TABLE_COACH_PLAN_DAILY).update({"preview_thread": thread, "updated_at": _now_iso()}).eq("id", int(id)).eq("user_id", int(user_id)).execute()
        return True
    except Exception as e:
        print("[DB-COACH-DAILY] append_preview_thread_entry error:", repr(e))
        return False


def db_apply_session_preview_update(
    user_id: int, id: int, *,
    title: Optional[str] = None,
    duration_min: Optional[int] = None,
    notes: Optional[str] = None,
    structure: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> bool:
    sb = get_sb(ctx, caller="coach_plan_daily.db_apply_session_preview_update")
    payload: Dict[str, Any] = {"updated_at": _now_iso()}
    if title is not None:
        payload["title"] = title
    if duration_min is not None:
        payload["duration_min"] = duration_min
    if notes is not None:
        payload["notes"] = notes
    if structure is not None:
        payload["structure"] = structure
    try:
        sb.table(TABLE_COACH_PLAN_DAILY).update(payload).eq("id", int(id)).eq("user_id", int(user_id)).execute()
        return True
    except Exception as e:
        print("[DB-COACH-DAILY] apply_session_preview_update error:", repr(e))
        return False


def db_get_daily_session_by_activity_id(
    user_id: int, activity_id: int, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    from DB.activities_summary import db_get_summary_one

    sb = get_sb(ctx, caller="coach_plan_daily.db_get_daily_session_by_activity_id")
    try:
        activity = db_get_summary_one(ctx, int(activity_id))
        if not activity:
            return None

        res = (
            sb.table(TABLE_COACH_PLAN_DAILY)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", int(activity_id))
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print("[DB-COACH-DAILY] get_daily_session_by_activity_id error:", repr(e))
        return None


def db_get_last_planned_daily_session_for_user(
    user_id: int, plan_meta_id: Optional[int], *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """
    Vráti poslednú (chronologicky) NEODPOČINKOVÚ session DANÉHO PLÁNU -
    t.j. posledný reálny tréning, ktorý ten konkrétny plán obsahuje.

    FIX: toto je presne funkcia, ktorá pri tebe zlyhala - hľadala
    "poslednú session usera" naprieč VŠETKÝMI jeho plánmi, takže namiesto
    29.8. (koniec aktívneho plánu 61) našla poslednú session z draftu
    (niekde v októbri) a plán sa preto nikdy neoznačil za dokončený.
    """
    sb = get_sb(ctx, caller="coach_plan_daily.db_get_last_planned_daily_session_for_user")
    try:
        q = sb.table(TABLE_COACH_PLAN_DAILY).select("*").eq("user_id", int(user_id))
        if plan_meta_id is not None:
            q = q.eq("plan_meta_id", plan_meta_id)
        res = (
            q.order("plan_date", desc=True)
            .order("session_index", desc=True)
            .limit(20)
            .execute()
        )
        rows = res.data or []
        for row in rows:
            dur = row.get("duration_min")
            is_rest = dur is None or int(dur) == 0
            if not is_rest:
                return row
        return None
    except Exception as e:
        print("[DB-COACH-DAILY] get_last_planned_daily_session error:", repr(e))
        return None