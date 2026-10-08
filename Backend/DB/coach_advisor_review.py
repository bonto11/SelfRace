# DB/coach_advisor_review.py
"""
Hodnotenie týždňa v advisor režime.

ODDELENÉ OD coach_athlete_state ZÁMERNE:
athlete_state hovorí "aký si športovec" (trénovanosť, únava, tempá) a mení
sa pomaly - týždne. Advisor review hovorí "je tvoj plán dobre poskladaný"
a mení sa pri každej úprave plánu. Spoločné AI volanie znamenalo, že
kontrola plánu zbytočne prepočítavala aj VO2max a tempá, a naopak nedeľný
prepočet stavu prepísal hodnotenie plánu.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_ADVISOR_REVIEWS

# Živý tréner: hodnotenie pre trénera má v review JSON "audience": "trainer"
# (staré a bežné = "athlete"). PREČO v JSON a nie stĺpec: netreba migráciu
# a staré riadky ostávajú platné. Hodnotení je pár za týždeň, filter nad
# posledných _AUDIENCE_SCAN riadkov v Pythone stačí.
_AUDIENCE_SCAN = 20


def review_audience(row: Optional[Dict[str, Any]]) -> str:
    review = (row or {}).get("review")
    aud = review.get("audience") if isinstance(review, dict) else None
    return "trainer" if aud == "trainer" else "athlete"


def db_insert_advisor_review(
    user_id: int,
    week_start: str,
    review: Dict[str, Any],
    *,
    model: Optional[str] = None,
    version: int = 1,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """Uloží nové hodnotenie týždňa. Vracia vložený riadok alebo None."""
    sb = get_sb(ctx, caller="coach_advisor_review.db_insert_advisor_review")

    row = {
        "user_id": int(user_id),
        "week_start": str(week_start)[:10],
        "model": model,
        "version": int(version),
        "review": review,
    }

    try:
        res = sb.table(TABLE_COACH_ADVISOR_REVIEWS).insert(row).execute()
        rows = list(res.data or [])
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print(f"[DB-ADVISOR-REVIEW] insert error: {repr(e)}")
        return None


def db_get_latest_advisor_review(
    user_id: int,
    *,
    version: Optional[int] = 1,
    audience: str = "athlete",
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """Najnovšie hodnotenie týždňa pre usera (pre atléta alebo pre jeho trénera)."""
    sb = get_sb(ctx, caller="coach_advisor_review.db_get_latest_advisor_review")

    try:
        q = (
            sb.table(TABLE_COACH_ADVISOR_REVIEWS)
            .select("id,user_id,week_start,model,version,review,created_at")
            .eq("user_id", int(user_id))
        )
        if version is not None:
            q = q.eq("version", version)

        res = q.order("created_at", desc=True).limit(_AUDIENCE_SCAN).execute()
        for row in res.data or []:
            if review_audience(row) == audience:
                return row
        return None
    except Exception as e:  # noqa: BLE001
        print(f"[DB-ADVISOR-REVIEW] get latest error: {repr(e)}")
        return None


def db_list_advisor_reviews(
    user_id: int,
    *,
    limit: int = 10,
    audience: str = "athlete",
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """História hodnotení (bez obsahu) - na prehľad v UI."""
    sb = get_sb(ctx, caller="coach_advisor_review.db_list_advisor_reviews")

    try:
        # review sa číta len kvôli audience a do výstupu nejde
        res = (
            sb.table(TABLE_COACH_ADVISOR_REVIEWS)
            .select("id,user_id,week_start,model,version,created_at,review")
            .eq("user_id", int(user_id))
            .order("created_at", desc=True)
            .limit(int(limit) + _AUDIENCE_SCAN)
            .execute()
        )
        out = []
        for row in res.data or []:
            if review_audience(row) != audience:
                continue
            row.pop("review", None)
            out.append(row)
        return out[: int(limit)]
    except Exception as e:  # noqa: BLE001
        print(f"[DB-ADVISOR-REVIEW] list error: {repr(e)}")
        return []