# Services/coach_plan_log.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import date

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_PLANNED_SESSIONS

supabase = get_client()


# ───────────────────────────── základné CRUD operácie ─────────────────────────────

def insert_planned_session(data: Dict[str, Any]) -> Dict[str, Any]:
  """
  Vloží jeden riadok do coach_planned_sessions.
  `data` by malo obsahovať povinné polia (user_id, plan_date, sport, ...).
  Vráti vložený riadok (alebo prázdny dict, ak nič).
  """
  res = (
    supabase.table(TABLE_COACH_PLANNED_SESSIONS)
    .insert(data)
    .execute()
  )
  rows = res.data or []
  return rows[0] if rows else {}


def update_planned_session(
  session_id: int,
  data: Dict[str, Any],
) -> Dict[str, Any]:
  """
  Upraví coach_planned_sessions.id = session_id danými dátami.
  Vráti upravený riadok (alebo prázdny dict).
  """
  res = (
    supabase.table(TABLE_COACH_PLANNED_SESSIONS)
    .update(data)
    .eq("id", session_id)
    .execute()
  )
  rows = res.data or []
  return rows[0] if rows else {}


def delete_planned_session(session_id: int) -> int:
  """
  Zmaže jeden riadok podľa id.
  Vráti počet zmazaných riadkov.
  """
  res = (
    supabase.table(TABLE_COACH_PLANNED_SESSIONS)
    .delete()
    .eq("id", session_id)
    .execute()
  )
  rows = res.data or []
  return len(rows)


# ───────────────────────── špecializované helpery pre plán ─────────────────────────

def fetch_plan_rows_in_range(
  user_id: int,
  start_d: date,
  end_d: date,
) -> List[Dict[str, Any]]:
  """
  Vráti všetky planned sessions pre usera v rozsahu dátumov (vrátane).
  Používané v auto-mapovaní a môžeš použiť aj inde.
  """
  start_iso = start_d.isoformat()
  end_iso = end_d.isoformat()

  rows = (
    supabase.table(TABLE_COACH_PLANNED_SESSIONS)
    .select(
      "id,user_id,plan_date,sport,title,duration_min,intensity,"
      "plan_id,activity_id,session_type,session_index,payload"
    )
    .eq("user_id", user_id)
    .gte("plan_date", start_iso)
    .lte("plan_date", end_iso)
    .execute()
  )
  data = rows.data or []
  print(
    f"[COACH-PLAN-LOG] fetch_plan_rows_in_range rows={len(data)} "
    f"user={user_id} range={start_iso}..{end_iso}"
  )
  return data


def link_session_to_activity(
  session_id: int,
  activity_id: Optional[int],
) -> int:
  """
  Nastaví / zresetuje väzbu plánovanej session na konkrétnu aktivitu.
  `activity_id=None` → odmapovanie.
  Vráti počet upravených riadkov.
  """
  payload: Dict[str, Any] = {
    "activity_id": int(activity_id) if activity_id is not None else None
  }

  res = (
    supabase.table(TABLE_COACH_PLANNED_SESSIONS)
    .update(payload)
    .eq("id", session_id)
    .execute()
  )
  rows = res.data or []
  print(
    f"[COACH-PLAN-LOG] link_session_to_activity session_id={session_id} "
    f"activity_id={activity_id} updated_rows={len(rows)}"
  )
  return len(rows)