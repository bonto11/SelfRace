# Services/retention_stats.py
"""
Udržanie nových userov pre admin panel - koľko ich je po 4 týždňoch stále
aktívnych. Rovnaká logika ako Backend/sql/retention.sql.

trains_w4 = aspoň 1 aktivita v 4. týždni (dni 21-27 od registrácie)
uses_w4   = v 4. týždni si sám niečo vyžiadal od AI (ai_usage_events.source='user')
PREČO dve čísla: aktivity zo Stravy chodia aj userovi, ktorý appku už
neotvára - uses_w4 ukazuje, či má appka preňho hodnotu.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from DB.retention import (
    db_list_users_basic,
    db_users_with_activity,
    db_users_with_own_ai_usage,
)
from Modules.Supabase.auth import AuthCtx

MAX_COHORTS = 12


def _parse_dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return None


def _auth_created_map() -> Dict[str, datetime]:
    """auth_uid -> dátum registrácie zo Supabase Auth (stránkované)."""
    from Services.supabase_auth_admin import supabase

    out: Dict[str, datetime] = {}
    page = 1
    while True:
        res = supabase.auth.admin.list_users(page=page, per_page=1000)  # type: ignore[attr-defined]
        users = res if isinstance(res, list) else getattr(res, "users", None) or []
        for u in users:
            created = _parse_dt(getattr(u, "created_at", None))
            uid = getattr(u, "id", None)
            if uid and created:
                out[str(uid)] = created
        if len(users) < 1000:
            return out
        page += 1


def _pct(part: int, whole: int) -> Optional[float]:
    return round(100.0 * part / whole, 1) if whole else None


def service_retention_stats(*, ctx: AuthCtx) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    created = _auth_created_map()

    # user_id -> registrácia, len kohorty staršie ako 28 dní (4. týždeň je za nimi)
    signups: Dict[int, datetime] = {}
    for row in db_list_users_basic(ctx=ctx):
        dt = created.get(str(row.get("auth_uid") or ""))
        if dt and now - dt >= timedelta(days=28):
            signups[int(row["id"])] = dt

    cohorts: Dict[str, List[int]] = defaultdict(list)
    for uid, dt in signups.items():
        week = (dt - timedelta(days=dt.weekday())).date().isoformat()
        cohorts[week].append(uid)

    out: List[Dict[str, Any]] = []
    for week in sorted(cohorts.keys(), reverse=True)[:MAX_COHORTS]:
        uids = cohorts[week]
        started = trains = uses = 0
        # okno 4. týždňa je pre každého usera iné (podľa dňa registrácie)
        for uid in uids:
            s = signups[uid]
            w4_from = (s + timedelta(days=21)).isoformat()
            w4_to = (s + timedelta(days=28)).isoformat()
            if db_users_with_activity([uid], s.isoformat(), now.isoformat(), ctx=ctx):
                started += 1
            if db_users_with_activity([uid], w4_from, w4_to, ctx=ctx):
                trains += 1
            if db_users_with_own_ai_usage([uid], w4_from, w4_to, ctx=ctx):
                uses += 1
        out.append({
            "cohort_week": week,
            "signups": len(uids),
            "started": started,
            "trains_w4": trains,
            "uses_w4": uses,
            "trains_w4_pct": _pct(trains, len(uids)),
            "uses_w4_pct": _pct(uses, len(uids)),
            "uses_w4_of_started_pct": _pct(uses, started),
        })

    total = {
        k: sum(c[k] for c in out) for k in ("signups", "started", "trains_w4", "uses_w4")
    }
    total["uses_w4_of_started_pct"] = _pct(total["uses_w4"], total["started"])
    return {"cohorts": out, "total": total, "generated_at": now.isoformat()}
