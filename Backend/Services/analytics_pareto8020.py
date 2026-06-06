from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set

from Configs.config_sport import (
    normalize_sport,
    normalize_sport_list,
    PARETO_DEFAULT_SET,
)
from Services.pareto_source import get_pareto_source
from Services.activity_zones import (
    preview_zones_for_activities,
    upsert_enrichment_minutes,
)
from DB.activities_summary import db_fetch_summary_since
from DB.activities_enrichment import db_get_enrichment_for_activities
from Modules.Supabase.auth import AuthCtx


# ─── helpers ────────────────────────────────────────────────────────────────

def _easy(row: dict) -> int:
    return int(round(float(row.get("z1_min") or 0))) + int(round(float(row.get("z2_min") or 0)))


def _hard(row: dict) -> int:
    return (
        int(round(float(row.get("z3_min") or 0)))
        + int(round(float(row.get("z4_min") or 0)))
        + int(round(float(row.get("z5_min") or 0)))
    )


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")


def _to_dt(s: str) -> datetime:
    x = str(s or "").replace(" ", "T")
    if x.endswith("+00"):
        x += ":00"
    if x.endswith("Z"):
        x = x.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(x)
    except Exception:
        dt = datetime.strptime(x[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _week_bucket(dt: datetime) -> Dict[str, str]:
    """Vráti začiatok ISO týždňa (pondelok) pre daný datetime."""
    dt = dt.astimezone(timezone.utc)
    start = dt - timedelta(days=dt.weekday())
    end = start + timedelta(days=6)
    year, week, _ = start.isocalendar()
    # Kratší label: ak rovnaký mesiac → "1–7.6.", inak "28.5.–3.6."
    if start.month == end.month:
        label = f"{start.day}–{end.day}.{end.month}."
    else:
        label = f"{start.day}.{start.month}.–{end.day}.{end.month}."
    return {
        "key": f"{year}-W{week:02d}",
        "label": label,
        "start": _iso(start),
        "end": _iso(end),
    }


def _parse_sport_query(sport: str | None) -> Optional[Set[str]]:
    if not sport or sport.strip().lower() == "all":
        return None
    parts = [p.strip() for p in str(sport).split(",") if p.strip()]
    norm = normalize_sport_list(parts)
    return norm or None


def _norm_db(x: Any) -> Optional[str]:
    return normalize_sport(x)


# ─── SOURCE ─────────────────────────────────────────────────────────────────

def service_pareto_source(
    user_id: int,
    months: int = 3,
    count_no_hr_as_easy: bool = True,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    return get_pareto_source(
        user_id=user_id,
        months=months,
        count_no_hr_as_easy=count_no_hr_as_easy,
        ctx=ctx,
    )


# ─── WIDGET ─────────────────────────────────────────────────────────────────

def service_pareto_widget(
    user_id: int,
    days: int = 14,
    sport: str = "all",
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    days = int(days)
    sports = _parse_sport_query(sport)

    since_iso = _iso(datetime.now(timezone.utc) - timedelta(days=days))

    rows = db_fetch_summary_since(user_id=user_id, since_iso=since_iso, ctx=ctx)

    allowed = sports if sports is not None else PARETO_DEFAULT_SET
    rows = [r for r in rows if _norm_db(r.get("sport_type_fe")) in allowed]

    ids = [int(r["activity_id"]) for r in rows if r.get("activity_id")]
    if not ids:
        return {"easy_min": 0, "hard_min": 0, "total_min": 0, "days": days}

    enr = db_get_enrichment_for_activities(user_id=user_id, activity_ids=ids, ctx=ctx)
    easy = sum(_easy(r) for r in enr)
    hard = sum(_hard(r) for r in enr)

    return {"easy_min": int(easy), "hard_min": int(hard), "total_min": int(easy + hard), "days": days}


# ─── TREND ──────────────────────────────────────────────────────────────────

def service_pareto_trend(
    user_id: int,
    weeks: int = 8,
    sport: str = "all",
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Trend po FIXNÝCH ISO týždňoch — rýchly, bez volania Strava API.

    Čo sa zmenilo oproti pôvodnej verzii:
    - ODSTRÁNENÉ: preview_zones_for_activities(fetch_if_missing=True)
      → zóny sú obohacované pri IMPORTE aktivity (webhook), nie tu.
    - ODSTRÁNENÉ: upsert_enrichment_minutes vo trend endpoint
      → trend je READ-ONLY operácia, nič nezapisuje.
    - Ak enrichment chýba pre nejakú aktivitu, jednoducho ju preskočíme
      (nezapočítame) — nefailujeme a nevolíme Strava API.
    - Výsledok: request trvá ~200-500ms namiesto niekoľkých sekúnd.
    """

    weeks = max(1, int(weeks))
    sports_query = _parse_sport_query(sport)

    # +1 týždeň buffer pre prípad neúplného prvého týždňa
    since_iso = _iso(datetime.now(timezone.utc) - timedelta(weeks=weeks + 1))

    # 1. Aktivity zo summary
    rows = db_fetch_summary_since(user_id=user_id, since_iso=since_iso, ctx=ctx)
    rows.sort(key=lambda r: str(r.get("date") or ""))

    # Reálne športy v období (pre available_sports filter v FE)
    real_sports = {
        s for r in rows if (s := _norm_db(r.get("sport_type_fe")))
    }

    # Sport filter
    allowed = sports_query if sports_query is not None else PARETO_DEFAULT_SET
    rows = [r for r in rows if _norm_db(r.get("sport_type_fe")) in allowed]

    if not rows:
        return {"trend": [], "available_sports": list(real_sports)}

    # 2. Skupinovanie activity_id podľa týždňa
    aid_by_week: Dict[str, List[int]] = {}
    week_meta: Dict[str, Dict[str, str]] = {}
    for r in rows:
        wb = _week_bucket(_to_dt(r["date"]))
        k = wb["key"]
        aid_by_week.setdefault(k, []).append(int(r["activity_id"]))
        week_meta.setdefault(k, wb)

    # 3. Enrichment — JEDNODUCHÝ READ, žiadne API volania
    all_ids = list({aid for ids in aid_by_week.values() for aid in ids})
    enr = db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=all_ids,
        ctx=ctx,
    )
    # Len aktivity ktoré majú enrichment (ostatné preskočíme — nie failujeme)
    emap = {
        int(e["activity_id"]): (_easy(e), _hard(e))
        for e in enr
        if e.get("activity_id") is not None
    }

    # 4. Generuj posledných `weeks` pondelkov (vrátane prázdnych týždňov = nuly)
    today = datetime.now(timezone.utc)
    this_monday = today - timedelta(days=today.weekday())

    out: List[Dict[str, Any]] = []
    for i in range(weeks - 1, -1, -1):
        monday = this_monday - timedelta(weeks=i)
        wb = _week_bucket(monday)
        k = wb["key"]
        meta = week_meta.get(k, wb)

        e_sum = h_sum = 0
        for aid in aid_by_week.get(k, []):
            e, h = emap.get(aid, (0, 0))  # ak chýba enrichment → 0 (nie error)
            e_sum += e
            h_sum += h

        total = e_sum + h_sum
        ep = int(round(100 * e_sum / total)) if total else 0

        out.append({
            "label": meta["label"],
            "easy_pct": ep,
            "hard_pct": max(0, 100 - ep),
            "easy_min": e_sum,
            "hard_min": h_sum,
            "start": meta["start"],
            "end": meta["end"],
        })

    return {"trend": out, "available_sports": list(real_sports)}


# ─── ENRICH ON IMPORT (volaj toto z webhooku, nie z trend) ──────────────────

def service_enrich_activity_zones(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> bool:
    """
    Zavolaj toto pri IMPORTE aktivity (webhook) — NIE v trend endpointe.
    Fetchne streamy z Strava, vypočíta zóny a uloží do enrichment.
    Vracia True ak úspešne, False ak streamy nie sú dostupné.
    """
    try:
        prev = preview_zones_for_activities(
            user_id,
            [activity_id],
            fetch_if_missing=True,
            ctx=ctx,
        )
        if not prev.get("ok"):
            return False

        items = prev.get("items") or []
        if not items:
            return False

        upsert_enrichment_minutes(user_id, items, ctx=ctx)
        return True

    except Exception as e:
        print(f"[PARETO][enrich] activity {activity_id} failed: {e}")
        return False
