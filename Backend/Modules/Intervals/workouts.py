# Modules/Intervals/workouts.py
"""
Plán → intervals.icu kalendár (odtiaľ do Garmin Connect a do hodiniek).

intervals.icu z popisu tréningu (`description`) poskladá štruktúrovaný
tréning podľa vlastnej syntaxe (sekcie Warmup / Main Set 5x / Cooldown,
kroky `- 10m 5:30-5:45/km Pace`). Garmin ho dostane, ak má user v
intervals.icu zapnuté nahrávanie plánovaných tréningov do Garminu.

PREČO regex nad textom: AI plán má ciele (tempo, tep, výkon) len vo voľnom
texte `notes` jednotlivých častí. Číslo, ktoré sa nedá spoľahlivo prečítať,
radšej vynecháme (krok bez cieľa) – zlý cieľ v hodinkách je horší ako žiadny.

Každý tréning má `external_id = selfrace-<id riadku plánu>`: opakované
odoslanie ho v intervals.icu aktualizuje (aj pri presune na iný deň)
a naše tréningy vieme odlíšiť od tých, ktoré si user pridal sám.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from DB.coach_plan_daily import db_get_planned_range_rows
from DB.user_prefs import db_get_pref_single, db_upsert_pref_single
from DB.user_zones import db_user_zones_fetch_latest
from Modules.Intervals.client import delete_event, list_events, upsert_events
from Modules.Intervals.db import db_intervals_get_account, db_intervals_list_enabled_user_ids
from Modules.Supabase.auth import AuthCtx

EXTERNAL_PREFIX = "selfrace-"
PUSH_DAYS = 14
PREF_KEY = "integrations.intervals"

# len vytrvalostné športy – silový tréning intervals.icu do Garminu nepošle
SPORT_TYPE = {"run": "Run", "ride": "Ride", "bike": "Ride", "swim": "Swim"}

_PACE_RE = re.compile(
    r"(\d{1,2}):([0-5]\d)\s*(?:[-–]\s*(\d{1,2}):([0-5]\d))?\s*(?:min)?\s*/\s*(km|100\s*m)",
    re.IGNORECASE,
)
_HR_RE = re.compile(
    r"(\d{2,3})\s*(?:[-–]\s*(\d{2,3}))?\s*(?:bpm|tep|úd|ud|beats)",
    re.IGNORECASE,
)
_POWER_RE = re.compile(r"(\d{2,4})\s*(?:[-–]\s*(\d{2,4}))?\s*w\b", re.IGNORECASE)


# ---------------------------------------------------------------- ciele


def _pace_target(text: str) -> Optional[str]:
    m = _PACE_RE.search(text or "")
    if not m:
        return None
    a = f"{int(m.group(1))}:{m.group(2)}"
    unit = "/100m" if "100" in m.group(5) else "/km"
    if m.group(3):
        b = f"{int(m.group(3))}:{m.group(4)}"
        # pri rozsahu musia mať jednotku oba konce (5:30/km-5:45/km)
        return f"{a}{unit}-{b}{unit} Pace"
    return f"{a}{unit} Pace"


def _hr_target(text: str, hr_max: Optional[int]) -> Optional[str]:
    """
    Absolútne bpm intervals.icu syntax nepozná – prepočet na % max tepu.
    Bez známeho max tepu cieľ vynecháme.
    """
    if not hr_max:
        return None
    m = _HR_RE.search(text or "")
    if not m:
        return None
    lo = int(m.group(1))
    hi = int(m.group(2)) if m.group(2) else lo
    if not (60 <= lo <= 230 and 60 <= hi <= 230):
        return None
    lo_p, hi_p = sorted((round(lo / hr_max * 100), round(hi / hr_max * 100)))
    return f"{lo_p}% HR" if lo_p == hi_p else f"{lo_p}-{hi_p}% HR"


def _power_target(text: str) -> Optional[str]:
    m = _POWER_RE.search(text or "")
    if not m:
        return None
    lo = int(m.group(1))
    hi = int(m.group(2)) if m.group(2) else None
    return f"{lo}-{hi}w" if hi else f"{lo}w"


def _target(text: str, sport: str, hr_max: Optional[int]) -> str:
    # tempo má prednosť pri behu a plávaní, výkon pri bicykli; tep ako záloha
    if sport == "ride":
        t = _power_target(text) or _hr_target(text, hr_max)
    else:
        t = _pace_target(text) or _hr_target(text, hr_max)
    return f" {t}" if t else ""


# ---------------------------------------------------------------- kroky


def _duration(part: Dict[str, Any], sport: str) -> Optional[str]:
    dist = part.get("distance_m")
    if isinstance(dist, (int, float)) and dist > 0:
        # m = minúty, metre sa píšu „mtr“
        return f"{dist / 1000:g}km" if dist >= 1000 and sport != "swim" else f"{int(dist)}mtr"
    sec = part.get("duration_s")
    if not isinstance(sec, (int, float)) or sec <= 0:
        mins = part.get("minutes") or part.get("duration_min") or part.get("work_min")
        try:
            sec = float(mins) * 60 if mins else 0
        except (TypeError, ValueError):
            sec = 0
    sec = int(round(sec))
    if sec <= 0:
        return None
    m, s = divmod(sec, 60)
    return f"{m}m{s}s" if m and s else (f"{m}m" if m else f"{s}s")


def _step(part: Any, sport: str, hr_max: Optional[int]) -> Optional[str]:
    if not isinstance(part, dict):
        return None
    dur = _duration(part, sport)
    if not dur:
        return None
    note = str(part.get("notes") or part.get("instruction") or "")
    return f"- {dur}{_target(note, sport, hr_max)}"


def build_workout_text(row: Dict[str, Any], hr_max: Optional[int]) -> str:
    """Popis tréningu v syntaxi intervals.icu (+ účel tréningu ako text)."""
    sport = str(row.get("sport") or "").lower()
    sport = "ride" if sport == "bike" else sport
    st = row.get("structure") or (row.get("payload") or {}).get("structure") or {}
    lines: List[str] = []

    notes = str(row.get("notes") or "").strip()
    if notes:
        lines += [notes, ""]

    wu = _step(st.get("warmup"), sport, hr_max)
    if wu:
        lines += ["Warmup", wu, ""]

    main = st.get("main_part") or []
    main_steps: List[str] = []
    for blk in main if isinstance(main, list) else []:
        if not isinstance(blk, dict):
            continue
        ib = blk.get("interval_block") if isinstance(blk.get("interval_block"), dict) else None
        if blk.get("kind") == "interval_block" or ib:
            data = ib or blk
            rounds = int(data.get("rounds") or data.get("repeats") or 1)
            parts = data.get("intervals") if isinstance(data.get("intervals"), list) else None
            work = (parts[0] if parts else None) or data.get("work")
            rest = (parts[1] if parts and len(parts) > 1 else None) or data.get("rest")
            w = _step(work, sport, hr_max)
            if not w:
                continue
            if main_steps:
                main_steps.append("")
            main_steps.append(f"Main Set {max(1, rounds)}x")
            main_steps.append(w)
            r = _step(rest, sport, hr_max)
            if r:
                main_steps.append(r)
            main_steps.append("")
        else:
            s = _step(blk, sport, hr_max)
            if s:
                if not main_steps or main_steps[-1] == "":
                    main_steps.append("Main Set")
                main_steps.append(s)

    if not main_steps and not wu:
        # bez štruktúry aspoň jeden krok na celú dĺžku – hodinky ukážu čas
        dur = row.get("duration_min")
        if isinstance(dur, (int, float)) and dur > 0:
            main_steps = ["Main Set", f"- {int(dur)}m"]

    lines += main_steps
    if main_steps and main_steps[-1] != "":
        lines.append("")

    cd = _step(st.get("cooldown"), sport, hr_max)
    if cd:
        lines += ["Cooldown", cd]

    return "\n".join(lines).strip()


def _pushable(row: Dict[str, Any]) -> bool:
    sport = str(row.get("sport") or "").lower()
    if sport not in SPORT_TYPE:
        return False
    if str(row.get("session_type") or "").lower() in ("rest", "external_event"):
        return False
    # splnený, odložený či zmeškaný tréning už do hodiniek nepatrí
    if row.get("activity_id") is not None or (row.get("status") or "planned") != "planned":
        return False
    dur = row.get("duration_min")
    return isinstance(dur, (int, float)) and dur > 0


def _event(row: Dict[str, Any], hr_max: Optional[int]) -> Dict[str, Any]:
    sport = str(row.get("sport") or "").lower()
    return {
        "category": "WORKOUT",
        "start_date_local": f"{str(row.get('plan_date'))[:10]}T00:00:00",
        "type": SPORT_TYPE[sport],
        "name": str(row.get("title") or SPORT_TYPE[sport])[:100],
        "description": build_workout_text(row, hr_max),
        "moving_time": int(row.get("duration_min") or 0) * 60,
        "external_id": f"{EXTERNAL_PREFIX}{row.get('id')}",
    }


def _hr_max(user_id: int, ctx: AuthCtx) -> Optional[int]:
    try:
        z = db_user_zones_fetch_latest(user_id=user_id, sport_raw="running", ctx=ctx) or db_user_zones_fetch_latest(
            user_id=user_id, ctx=ctx
        )
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] zones read failed user={user_id}: {repr(e)}")
        return None
    v = (z or {}).get("hr_max") or (z or {}).get("hr_max_bpm")
    try:
        v = int(v)
    except (TypeError, ValueError):
        return None
    return v if 120 <= v <= 230 else None


# ---------------------------------------------------------------- nastavenie


def get_push_enabled(user_id: int, *, ctx: AuthCtx) -> bool:
    try:
        row = db_get_pref_single(user_id, PREF_KEY, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] pref read failed user={user_id}: {repr(e)}")
        return False
    return bool(((row or {}).get("value") or {}).get("push_workouts"))


def set_push_enabled(user_id: int, enabled: bool, *, ctx: AuthCtx) -> None:
    row = db_get_pref_single(user_id, PREF_KEY, ctx=ctx)
    value = dict((row or {}).get("value") or {})
    value["push_workouts"] = bool(enabled)
    db_upsert_pref_single(user_id, PREF_KEY, value, ctx=ctx)


# ---------------------------------------------------------------- odoslanie


def service_intervals_push_workouts(
    user_id: int,
    *,
    ctx: AuthCtx,
    days: int = PUSH_DAYS,
) -> Dict[str, Any]:
    """
    Pošle plán na najbližších `days` dní (od dneška) do intervals.icu
    a zmaže naše tréningy v tom okne, ktoré už v pláne nie sú (presun,
    zrušenie, splnenie). Tréningy, ktoré si user pridal sám, nechá tak.
    """
    account = db_intervals_get_account(user_id)
    if not account:
        return {"ok": False, "code": "intervals_not_enabled"}
    athlete_id, api_key = str(account["athlete_id"]), str(account["api_key"])

    from Modules.Intervals.sync import TZ

    today = datetime.now(TZ).date()
    end = today + timedelta(days=max(1, min(int(days), 28)) - 1)
    rows = db_get_planned_range_rows(user_id, None, today.isoformat(), end.isoformat(), ctx=ctx)
    hr_max = _hr_max(user_id, ctx)
    events = [_event(r, hr_max) for r in rows if _pushable(r)]
    keep: Set[str] = {e["external_id"] for e in events}

    removed = 0
    try:
        if events:
            upsert_events(athlete_id, api_key, events)
        for ev in list_events(athlete_id, api_key, today.isoformat(), end.isoformat()):
            ext = str(ev.get("external_id") or "")
            if ext.startswith(EXTERNAL_PREFIX) and ext not in keep and ev.get("id") is not None:
                delete_event(athlete_id, api_key, ev["id"])
                removed += 1
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] push failed user={user_id}: {repr(e)}")
        return {"ok": False, "code": "intervals_push_failed"}

    return {"ok": True, "sent": len(events), "removed": removed, "from": today.isoformat(), "to": end.isoformat()}


def service_intervals_push_all(*, ctx: AuthCtx) -> Dict[str, Any]:
    """Cron: všetci pripojení useri so zapnutým posielaním tréningov."""
    results: Dict[int, Any] = {}
    for uid in db_intervals_list_enabled_user_ids():
        if not get_push_enabled(uid, ctx=ctx):
            continue
        try:
            results[uid] = service_intervals_push_workouts(uid, ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[INTERVALS] push failed user={uid}: {repr(e)}")
            results[uid] = {"ok": False, "code": "intervals_push_failed"}
    return {"ok": True, "users": results}
