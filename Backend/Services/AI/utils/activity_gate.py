# Services/AI/utils/activity_gate.py
"""
Brána pre automatické (plánované) AI joby.

PREČO: nedeľný athlete state a hodnotenie týždňa bežali pre všetkých
userov - aj pre tých, čo nemajú pripojenú Stravu alebo appku vôbec
nepoužívajú. Bez aktivít AI nemá čo analyzovať, takže to boli len
spálené tokeny.

PRAVIDLO: automaticky beží len pre toho, kto za posledných
RECENT_TRAINING_DAYS dní niečo odtrénoval - aktivita zo Stravy ALEBO
zapísaný silový tréning. Kto Stravu nemá, aktivity nemá, takže vypadne
sám a netreba to kontrolovať zvlášť.

14 dní a nie 7: týždeň bez tréningu je bežný (choroba, dovolenka) a práve
vtedy je analýza užitočná - pri návrate má tréner vedieť, že sa forma
mohla posunúť.

Ručné spustenie (tlačidlo) túto bránu NEPOUŽÍVA - user si analýzu môže
vyžiadať vždy.
"""

from __future__ import annotations

from datetime import date, timedelta

from DB.activities_summary import db_get_recent_activity_ids
from Modules.Supabase.auth import AuthCtx

RECENT_TRAINING_DAYS = 14


def user_trained_recently(
    user_id: int, *, ctx: AuthCtx, days: int = RECENT_TRAINING_DAYS
) -> bool:
    """
    True, ak má user za posledných `days` dní aspoň jednu aktivitu alebo
    zapísaný silový tréning.

    Pri chybe vráti True - radšej jedna zbytočná analýza než aktívny user,
    ktorému kvôli výpadku DB tréner v nedeľu nič nevyhodnotí.
    """
    since = (date.today() - timedelta(days=days)).isoformat()

    try:
        ids = db_get_recent_activity_ids(
            user_id=user_id, since_iso_date=since, limit=1, ctx=ctx
        )
        if ids:
            return True
    except Exception as e:  # noqa: BLE001
        print(f"[ACTIVITY-GATE] activities check failed user={user_id}: {repr(e)}")
        return True

    # Silový tréning zapísaný ručne, bez Stravy
    try:
        from Services.strength_sessions import service_list_strength_sessions

        weeks = max(1, (days + 6) // 7)
        rows = service_list_strength_sessions(
            user_id=user_id, weeks_back=weeks, limit=20, ctx=ctx
        ) or []
        for r in rows:
            try:
                d = date.fromisoformat(str(r.get("session_date") or "")[:10])
            except ValueError:
                continue
            if (date.today() - d).days <= days:
                return True
    except Exception as e:  # noqa: BLE001
        print(f"[ACTIVITY-GATE] strength check failed user={user_id}: {repr(e)}")
        return True

    return False
