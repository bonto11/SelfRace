# Routes/coach_plan_db.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4
from datetime import date

from fastapi import APIRouter, Body, HTTPException, Query

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_PLAN_LOG

router = APIRouter(prefix="/coach/plan", tags=["coach-plan"])
supabase = get_client()


# ====== HELPERY ======


def _parse_iso_date(s: str) -> date:
    try:
        y, m, d = map(int, str(s).split("-"))
        return date(y, m, d)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date: {s}")


def _canonical_sport(sport: Any) -> str:
    s = str(sport or "").lower()
    if s in ("bike", "cycling"):
        return "ride"
    if s in ("gym",):
        return "strength"
    if s not in ("run", "ride", "strength", "swim", "other"):
        return "other"
    return s


def _hr_zone_text_from_session(sess: Dict[str, Any]) -> Optional[str]:
    """
    Pre plán – vytiahne target_hr_bpm_range a spraví text "HR a–b".
    """
    hr = sess.get("target_hr_bpm_range")
    if isinstance(hr, list) and len(hr) == 2:
        try:
            low, high = int(hr[0]), int(hr[1])
            return f"HR {low}–{high}"
        except Exception:
            return None
    return None


def _structure_from_session(sess: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Do stĺpca structure uložíme len plánovanú štruktúru (ak existuje).
    """
    struct = sess.get("structure")
    return struct if isinstance(struct, dict) else None


def _group_rows_to_plan(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Z riadkov v DB spraví JSON plánu:
    {
      "plan_id": "...",
      "next_10_days": [
        { "day": "YYYY-MM-DD", "sessions": [ { ...plan... }, ... ] },
        ...
      ]
    }
    Berieme payload["plan"] ako zdroj pravdy.
    """
    by_date: Dict[str, List[Dict[str, Any]]] = {}
    plan_id: Optional[str] = None

    for r in rows:
        d = str(r.get("plan_date"))
        if not d:
            continue
        if plan_id is None and r.get("plan_id"):
            plan_id = str(r["plan_id"])

        sess_payload = r.get("payload") or {}
        if isinstance(sess_payload, dict) and "plan" in sess_payload:
            sess = sess_payload["plan"]
        else:
            # fallback – zložíme minimal session z top-level stĺpcov
            sess = {
                "title": r.get("title"),
                "sport": r.get("sport"),
                "duration_min": r.get("duration_min"),
                "intensity": r.get("intensity"),
                "session_type": r.get("session_type"),
                "structure": r.get("structure") or None,
                "notes": r.get("notes") or None,
            }

        by_date.setdefault(d, []).append(
            {"idx": r.get("session_index") or 0, "sess": sess}
        )

    # zoradíme podľa dátumu a session_index
    next_10_days: List[Dict[str, Any]] = []
    for day in sorted(by_date.keys()):
        items = sorted(by_date[day], key=lambda x: int(x["idx"]))
        sessions = [x["sess"] for x in items]
        next_10_days.append({"day": day, "sessions": sessions})

    return {
        "plan_id": plan_id,
        "next_10_days": next_10_days,
    }


# ====== READ – načítanie (aktuálneho) plánu ======


@router.get("/{user_id}")
def get_active_plan(
    user_id: int,
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    plan_id: Optional[str] = Query(None, description="Filter by plan_id"),
):
    """
    Vráti plán pre daného usera:
    - keď je zadaný plan_id → len tento plán
    - inak vezme najnovší plán (podľa created_at a plan_id)
    Výstup:
    {
      "success": true,
      "plan": {
        "plan_id": "...",
        "next_10_days": [...]
      }
    }
    """
    try:
        base_q = supabase.table(TABLE_COACH_PLAN_LOG).select("*").eq("user_id", user_id)

        if plan_id:
            base_q = base_q.eq("plan_id", plan_id)

        # ak nemáme plan_id, vezmeme najnovší existujúci
        if not plan_id:
            # distinct plan_id, najnovší created_at
            pid_res = (
                supabase.table(TABLE_COACH_PLAN_LOG)
                .select("plan_id, created_at")
                .eq("user_id", user_id)
                .not_.is_("plan_id", "null")  # len tie, čo majú plan_id
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            rows_pid = pid_res.data or []
            if rows_pid:
                plan_id = rows_pid[0]["plan_id"]
                base_q = base_q.eq("plan_id", plan_id)

        if date_from:
            base_q = base_q.gte("plan_date", date_from)
        if date_to:
            base_q = base_q.lte("plan_date", date_to)

        q = base_q.order("plan_date", desc=False)
        try:
            q = q.order("session_index", desc=False)
        except Exception:
            pass

        res = q.execute()
        rows = res.data or []

        if not rows:
            return {"success": True, "plan": None}

        plan_json = _group_rows_to_plan(rows)
        return {"success": True, "plan": plan_json}

    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ====== WRITE – uloženie plánu z AI (Start plan) ======


@router.put("/{user_id}")
def save_plan(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
):
    """
    Uloží plán z FE do DB.
    Očakávaný payload z FE (CoachPlanActions.handleStart):
    {
      "plan": { ... analysis ... },  // AI výsledok (analysis)
      "meta": {
        "started_at_iso": "...",
        "plan_start_date": "YYYY-MM-DD" | null,
        "weeks": number | null,
        "overwrite"?: bool
      }
    }

    Server:
      - vytvorí nové plan_id (uuid4)
      - z plan.next_10_days spraví riadky v tabuľke
      - (voliteľne) zmaže staré sessions v danom rozsahu, ak overwrite = true
    """
    plan = payload.get("plan") or {}
    meta = payload.get("meta") or {}

    next_10_days = plan.get("next_10_days") or []
    if not isinstance(next_10_days, list) or not next_10_days:
        raise HTTPException(
            status_code=400,
            detail="plan.next_10_days is required and must be a non-empty array",
        )

    overwrite: bool = bool(meta.get("overwrite", True))

    # dátumový rozsah (podľa day z next_10_days)
    all_dates: List[date] = []
    for d in next_10_days:
        if not isinstance(d, dict) or "day" not in d:
            raise HTTPException(
                status_code=400,
                detail="Invalid entry in next_10_days (missing 'day')",
            )
        all_dates.append(_parse_iso_date(str(d["day"])))

    start_d = min(all_dates)
    end_d = max(all_dates)

    plan_id = str(uuid4())

    # Overwrite – zmažeme existujúce sessions v rozsahu
    if overwrite:
        try:
            (
                supabase.table(TABLE_COACH_PLAN_LOG)
                .delete()
                .eq("user_id", user_id)
                .gte("plan_date", start_d.isoformat())
                .lte("plan_date", end_d.isoformat())
                .execute()
            )
        except Exception as e:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"Failed to clear existing plan: {e}"
            )

    rows: List[Dict[str, Any]] = []

    for d in next_10_days:
        day_str = str(d["day"])
        sessions = d.get("sessions") or []
        if not isinstance(sessions, list):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid 'sessions' for day {day_str}",
            )

        for idx, sess in enumerate(sessions):
            if not isinstance(sess, dict):
                continue

            sport = _canonical_sport(sess.get("sport"))
            title = sess.get("title") or None
            duration = sess.get("duration_min")
            intensity = sess.get("intensity")
            session_type = sess.get("session_type") or None
            notes = sess.get("notes") or None
            zone_text = _hr_zone_text_from_session(sess)
            structure = _structure_from_session(sess)

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": day_str,
                "sport": sport,
                "title": title,
                "duration_min": duration,
                "intensity": intensity,
                "zone_text": zone_text,
                "structure": structure,
                "notes": notes,
                "source": "ai",
                "plan_id": plan_id,
                "session_index": idx,
                "session_type": session_type,
                "payload": {
                    "plan": sess,  # celý plánovaný session
                    # "actual": null – doplníme neskôr pri Strava sync
                },
                "activity_id": None,
            }
            rows.append(row)

    if not rows:
        raise HTTPException(status_code=400, detail="No sessions to save")

    try:
        res = supabase.table(TABLE_COACH_PLAN_LOG).insert(rows).execute()
        inserted = len(res.data or rows)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Insert failed: {e}")

    return {
        "success": True,
        "plan_id": plan_id,
        "inserted": inserted,
        "date_range": {
            "from": start_d.isoformat(),
            "to": end_d.isoformat(),
        },
    }


# ====== UPDATE – jednoduchý reconcile (zatiaľ len vráti aktívny plán) ======


@router.patch("/{user_id}")
def update_plan(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
):
    """
    Zatiaľ jednoduché:
      - očakáva { "action": "reconcile" }
      - vráti aktuálny plán (rovnako ako GET), aby FE mal jednotný kontrakt.
    Neskôr sem môžeš doplniť smart logiku (napr. posun dní, preplánovanie, atď.).
    """
    action = str(payload.get("action") or "").lower()
    if action not in ("reconcile", "refresh", "reload"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported action; use { action: 'reconcile' }",
        )

    # použijeme get_active_plan a len wrapneme odpoveď
    result = get_active_plan(user_id)
    return {
        "success": True,
        "plan": result.get("plan"),
    }
