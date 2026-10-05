from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from DB.coach_external_events import (
    db_list_external_events_for_user,
    db_delete_external_events_by_ids,
    db_delete_external_events_except,
    db_insert_external_events_returning,
)
from Modules.Supabase.auth import AuthCtx
from Configs.config import WEEKDAY_TO_ABBR, PY_WEEKDAY_TO_INT

# JS/Python weekday for date.weekday(): 0=Mon..6=Sun


def _normalize_weekday_int(v: Any) -> Optional[int]:
    """
    Vráti 1..7 alebo None.
    Podporí:
      - int 1..7
      - string "1".."7"
      - stringy: Mon/Wed, wed, Wednesday
      - SK: pondelok, utorok, streda, štvrtok, piatok, sobota, nedeľa
    """
    if isinstance(v, bool):
        return None

    if isinstance(v, int):
        return v if 1 <= v <= 7 else None

    if isinstance(v, float) and v.is_integer():
        n = int(v)
        return n if 1 <= n <= 7 else None

    if not isinstance(v, str):
        return None

    s = v.strip().lower()
    if not s:
        return None

    if s in ("1", "2", "3", "4", "5", "6", "7"):
        return int(s)

    # EN abbrev / full
    if s.startswith("mon") or s == "monday":
        return 1
    if s.startswith("tue") or s == "tuesday":
        return 2
    if s.startswith("wed") or s == "wednesday":
        return 3
    if s.startswith("thu") or s == "thursday":
        return 4
    if s.startswith("fri") or s == "friday":
        return 5
    if s.startswith("sat") or s == "saturday":
        return 6
    if s.startswith("sun") or s == "sunday":
        return 7

    # SK (bez diakritiky aj s)
    if s in ("pondelok",):
        return 1
    if s in ("utorok",):
        return 2
    if s in ("streda",):
        return 3
    if s in ("stvrtok", "štvrtok"):
        return 4
    if s in ("piatok",):
        return 5
    if s in ("sobota",):
        return 6
    if s in ("nedela", "nedeľa"):
        return 7

    return None


def _normalize_event_input(user_id: int, ev: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizácia jedného eventu z FE.

    Nové:
      - weekday_int: 1..7 (1=Mon)
    Legacy:
      - weekday: "Mon".."Sun" alebo hocijaký text -> preložíme
    """
    recurrence_kind = (ev.get("recurrence_kind") or "weekly").lower()
    if recurrence_kind not in ("weekly", "single"):
        raise ValueError("recurrence_kind must be 'weekly' or 'single'")

    # weekday_int len pre weekly
    weekday_int: Optional[int] = None
    if recurrence_kind == "weekly":
        weekday_int = _normalize_weekday_int(ev.get("weekday_int"))
        if weekday_int is None:
            # fallback legacy field
            weekday_int = _normalize_weekday_int(ev.get("weekday"))
        if weekday_int is None:
            raise ValueError("weekday_int is required for weekly events (1=Mon..7=Sun)")

    single_date = ev.get("single_date") or None
    if recurrence_kind == "single":
        if not single_date:
            raise ValueError("single_date is required when recurrence_kind='single'")
        try:
            date.fromisoformat(single_date)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Invalid single_date: {single_date}") from exc
    else:
        # weekly -> single_date must be null
        single_date = None

    start_time_local = ev.get("start_time_local") or None

    intensity = str(ev.get("intensity") or "").strip().lower()
    if intensity not in INTENSITY_TO_LOAD:
        intensity = "moderate"

    # optional legacy weekday text for debugging/compat (not a source of truth)
    weekday_abbr = WEEKDAY_TO_ABBR.get(weekday_int) if weekday_int else None

    return {
        "user_id": user_id,
        "title": str(ev.get("title") or "").strip() or "Externá aktivita",
        "sport": ev.get("sport") or None,

        "weekday_int": weekday_int,

        # optional legacy column (keep if your DB still has it)
        "weekday": weekday_abbr,

        "duration_min": int(ev["duration_min"]) if ev.get("duration_min") is not None else None,
        "priority": ev.get("priority") or "fixed",
        "notes": ev.get("notes") or None,
        "start_date": ev.get("start_date") or None,
        "end_date": ev.get("end_date") or None,
        "recurrence_kind": recurrence_kind,
        "single_date": single_date,
        "start_time_local": start_time_local,
        "intensity": intensity,
    }


# ============================================================
# NÁROČNOSŤ A DRUH (pre zobrazenie v pláne a kalendári)
# ============================================================

# low/moderate/high z formulára -> stupne udalosti v dennom pláne
INTENSITY_TO_LOAD = {"low": "easy", "moderate": "moderate", "high": "hard"}

# Životné udalosti z formulára -> druh udalosti. Všetko ostatné je šport.
_EVENT_SPORT_TO_KIND = {
    "wedding": "social",
    "party": "social",
    "family": "social",
    "travel": "travel",
    "work": "work",
    "other_event": "other",
}


def external_title(ev: Dict[str, Any]) -> str:
    """
    Názov bez poznámky. Staré záznamy mali názov "Futbal – <poznámka>" -
    poznámka sa tak opakovala v kalendári aj v AI texte. Odreže sa pri
    čítaní, kým ich user znova neuloží.
    """
    title = str(ev.get("title") or "").strip()
    notes = str(ev.get("notes") or "").strip()
    if notes:
        for sep in (" – ", " - "):
            suffix = f"{sep}{notes}"
            if title.endswith(suffix) and len(title) > len(suffix):
                return title[: -len(suffix)].strip()
    return title or "Externá aktivita"


def external_intensity(ev: Dict[str, Any]) -> str:
    """
    low / moderate / high. Riadky spred stĺpca intensity ju nemajú - FE ju
    vtedy ukladal len ako priority (high = fixed, inak optional).
    """
    v = str(ev.get("intensity") or "").strip().lower()
    if v in INTENSITY_TO_LOAD:
        return v
    return "high" if ev.get("priority") == "fixed" else "low"


def external_event_structure(ev: Dict[str, Any]) -> Dict[str, Any]:
    """
    Štruktúra udalosti pre riadok v dennom pláne / kalendári. Každá externá
    aktivita ju má (aj futbal), aby sa nevykresľovala ako tréning s AI
    náhľadom a presunom - neplánuje ju appka, len o nej vie.
    """
    from Configs.activity_load import build_event_structure

    sport = str(ev.get("sport") or "other")
    kind = _EVENT_SPORT_TO_KIND.get(sport, "sport")
    return build_event_structure(
        kind=kind,
        load=INTENSITY_TO_LOAD[external_intensity(ev)],
        counts_as_training=kind == "sport",
    )


# ============================================================
# SPÁROVANIE S AKTIVITAMI (automapping)
# ============================================================
#
# PREČO PRI ČÍTANÍ A NIE ZÁPISOM: externá aktivita nemá riadok v
# coach_plan_daily (viď daily_plan._external_event_sessions) a jej id sa pri
# každom uložení mení (ukladá sa ako celý zoznam). Odkaz by nemal kam ísť a
# rýchlo by zastaral. Párovanie je deterministické z dátumu, športu a času,
# takže ho stačí spočítať vždy, keď sa výskyty čítajú.

# externý šport -> sport_type_fe aktivít zo Stravy, ktoré ho splnia
_ACTIVITY_SPORTS_FOR_EXTERNAL: Dict[str, Set[str]] = {
    "run": {"run"},
    "ride": {"ride"},
    "swim": {"swim"},
    "strength": {"strength", "hiit", "mixed"},
    "football": {"soccer"},
    "padel": {"padel"},
    "badminton": {"badminton"},
    # Strava tenis ani florbal samostatne nemá - padajú do "other"
    "tennis": {"other"},
    "floorbal": {"other", "hiit", "mixed"},
    "other": {"other", "hiit", "mixed"},
}

_NAME_HINTS = {
    "tennis": re.compile(r"tenis|tennis", re.I),
    "floorbal": re.compile(r"florbal|floorbal", re.I),
    "football": re.compile(r"futbal|fotbal|football|soccer", re.I),
}

# Aktivita viac ako 3 h od času externej aktivity je iný tréning
# (ranný beh vs. večerný klubový beh v ten istý deň).
_MAX_TIME_DIFF_MIN = 180


def _minutes_of(hhmm: Any) -> Optional[int]:
    try:
        h, m = str(hhmm).split(":")[:2]
        return int(h) * 60 + int(m)
    except Exception:  # noqa: BLE001
        return None


def _activity_local(act: Dict[str, Any]) -> Optional[datetime]:
    """Lokálny začiatok aktivity (date je UTC, utc_offset_s posun pásma)."""
    raw = act.get("date")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00").replace(" ", "T"))
    except Exception:  # noqa: BLE001
        return None
    try:
        offset = int(act.get("utc_offset_s") or 0)
    except Exception:  # noqa: BLE001
        offset = 0
    return dt.replace(tzinfo=None) + timedelta(seconds=offset)


def _activity_sport(act: Dict[str, Any]) -> str:
    return str(
        act.get("sport_type_ovrd") or act.get("sport_type_fe") or act.get("sport_type") or ""
    ).strip().lower()


def match_occurrences_to_activities(
    occurrences: List[Dict[str, Any]],
    activities: List[Dict[str, Any]],
    *,
    used_activity_ids: Optional[Set[int]] = None,
) -> None:
    """
    Doplní do výskytov activity_id + status (done / planned). Mení zoznam
    na mieste. Jedna aktivita splní najviac jeden výskyt; aktivity už
    spárované s plánom (used_activity_ids) sa nepoužijú - plán má prednosť.
    """
    used: Set[int] = set(used_activity_ids or set())

    acts_by_day: Dict[str, List[Dict[str, Any]]] = {}
    for a in activities or []:
        local = _activity_local(a)
        if local is None:
            continue
        acts_by_day.setdefault(local.date().isoformat(), []).append(
            {"row": a, "local": local, "sport": _activity_sport(a)}
        )

    for occ in occurrences:
        occ["activity_id"] = None
        occ["status"] = "planned"

        sport = str(occ.get("sport") or "")
        allowed = _ACTIVITY_SPORTS_FOR_EXTERNAL.get(sport)
        if not allowed:
            continue  # životná udalosť (svadba...) sa nespáruje

        day = str(occ.get("occurrence_date") or "")[:10]
        occ_min = _minutes_of(occ.get("start_time_local"))
        hint = _NAME_HINTS.get(sport)

        best = None
        best_key = None
        for c in acts_by_day.get(day, []):
            aid = c["row"].get("activity_id")
            if aid is None or int(aid) in used or c["sport"] not in allowed:
                continue
            diff = 0
            if occ_min is not None:
                diff = abs(c["local"].hour * 60 + c["local"].minute - occ_min)
                if diff > _MAX_TIME_DIFF_MIN:
                    continue
            has_hint = bool(hint and hint.search(str(c["row"].get("name") or "")))
            # názov s menom športu vyhráva, potom najbližší čas
            key = (0 if has_hint else 1, diff)
            if best_key is None or key < best_key:
                best, best_key = c, key

        if best is not None:
            aid = int(best["row"]["activity_id"])
            used.add(aid)
            occ["activity_id"] = aid
            occ["status"] = "done"


def _match_window(
    user_id: int,
    occurrences: List[Dict[str, Any]],
    d_from: date,
    d_to: date,
    *,
    ctx: AuthCtx,
) -> None:
    """Načíta aktivity a väzby plánu v okne a spáruje. Chyba = bez párovania."""
    try:
        from DB.activities_summary import db_get_activities_in_range_basic
        from DB.coach_plan_daily import db_get_planned_range_rows

        # +-1 deň: date je UTC, lokálny deň aktivity môže byť susedný
        acts = db_get_activities_in_range_basic(
            ctx,
            user_id,
            (d_from - timedelta(days=1)).isoformat(),
            (d_to + timedelta(days=2)).isoformat(),
        )
        plan_rows = db_get_planned_range_rows(
            user_id,
            None,
            (d_from - timedelta(days=1)).isoformat(),
            (d_to + timedelta(days=1)).isoformat(),
            ctx=ctx,
        )
        used = {
            int(r["activity_id"]) for r in plan_rows if r.get("activity_id") is not None
        }
        match_occurrences_to_activities(occurrences, acts, used_activity_ids=used)
    except Exception as e:  # noqa: BLE001
        print(f"[COACH-EXT] activity match failed user={user_id}: {repr(e)}")


def _in_date_range(ev: Dict[str, Any], current: date) -> bool:
    start_date_str = ev.get("start_date")
    end_date_str = ev.get("end_date")

    if start_date_str:
        try:
            if date.fromisoformat(start_date_str) > current:
                return False
        except Exception:  # noqa: BLE001
            pass

    if end_date_str:
        try:
            if date.fromisoformat(end_date_str) < current:
                return False
        except Exception:  # noqa: BLE001
            pass

    return True


def _expand_events_to_window(
    events: List[Dict[str, Any]],
    date_from: date,
    date_to: date,
) -> List[Dict[str, Any]]:
    """
    Occurrence expand v [date_from, date_to].
    Používa weekday_int (1..7).
    """
    out: List[Dict[str, Any]] = []
    current = date_from

    while current <= date_to:
        iso = current.isoformat()
        wd_int = PY_WEEKDAY_TO_INT.get(current.weekday(), 1)  # 1..7
        wd_abbr = WEEKDAY_TO_ABBR.get(wd_int, "Mon")

        for ev in events:
            rk = (ev.get("recurrence_kind") or "weekly").lower()

            if rk == "weekly":
                ev_wd = ev.get("weekday_int")
                if not isinstance(ev_wd, int) or not (1 <= ev_wd <= 7):
                    # fallback legacy
                    ev_wd = _normalize_weekday_int(ev.get("weekday"))
                if ev_wd != wd_int:
                    continue
                if not _in_date_range(ev, current):
                    continue

                occ = dict(ev)
                occ["occurrence_date"] = iso
                occ["occurrence_weekday_int"] = wd_int
                occ["occurrence_weekday"] = wd_abbr
                out.append(occ)

            elif rk == "single":
                sd = ev.get("single_date")
                if not sd or sd != iso:
                    continue
                if not _in_date_range(ev, current):
                    continue

                occ = dict(ev)
                occ["occurrence_date"] = iso
                occ["occurrence_weekday_int"] = wd_int
                occ["occurrence_weekday"] = wd_abbr
                out.append(occ)

        current += timedelta(days=1)

    # stabilné poradie: date, weekday_int, start_time_local
    def _sort_key(r: Dict[str, Any]):
        return (
            str(r.get("occurrence_date") or ""),
            int(r.get("occurrence_weekday_int") or 99),
            str(r.get("start_time_local") or ""),
        )

    out.sort(key=_sort_key)
    return out


def service_list_external_events_window(
    user_id: int,
    *,
    from_iso: str,
    to_iso: str,
    match_activities: bool = False,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    match_activities: spáruje výskyty s aktivitami zo Stravy (kalendár,
    denný plán). AI kontext to nepotrebuje - tam ostáva vypnuté.
    """
    try:
        d_from = date.fromisoformat(from_iso)
        d_to = date.fromisoformat(to_iso)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid from/to date format, expected YYYY-MM-DD") from exc

    if d_to < d_from:
        raise ValueError("to must be >= from")

    base_rows = db_list_external_events_for_user(
        user_id,
        ctx=ctx,
    )

    occurrences = _expand_events_to_window(base_rows, d_from, d_to)
    for occ in occurrences:
        occ["title"] = external_title(occ)
        occ["intensity"] = external_intensity(occ)
        occ["structure"] = external_event_structure(occ)
    if match_activities and occurrences:
        _match_window(user_id, occurrences, d_from, d_to, ctx=ctx)

    return {
        "success": True,
        "occurrences": occurrences,
    }


def service_list_external_events(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    rows = db_list_external_events_for_user(
        user_id,
        ctx=ctx,
    )
    return {"success": True, "events": rows}


def service_save_external_events(
    user_id: int,
    *,
    events: List[Dict[str, Any]],
    ctx: AuthCtx,
) -> Dict[str, Any]:

    norm_rows: List[Dict[str, Any]] = []
    for raw in events:
        if not isinstance(raw, dict):
            raise ValueError("events must contain objects")
        norm_rows.append(_normalize_event_input(user_id, raw))

    # PREČO NAJPRV INSERT A AŽ POTOM DELETE: Supabase REST nemá transakciu.
    # Pri opačnom poradí by zlyhaný insert nechal usera bez externých
    # aktivít. Takto zlyhaný insert nič nezmení a zlyhaný delete sa vráti
    # zmazaním práve vložených riadkov.
    inserted_rows = db_insert_external_events_returning(norm_rows, ctx=ctx)
    if inserted_rows is None or len(inserted_rows) != len(norm_rows):
        if inserted_rows:
            db_delete_external_events_by_ids(
                user_id,
                [int(r["id"]) for r in inserted_rows if r.get("id") is not None],
                ctx=ctx,
            )
        return {"success": False, "error_code": "external_save_failed"}

    new_ids = [int(r["id"]) for r in inserted_rows if r.get("id") is not None]
    if len(new_ids) != len(inserted_rows):
        # bez id nevieme, čo nechať - radšej nič nemazať (staré ostanú)
        db_delete_external_events_by_ids(user_id, new_ids, ctx=ctx)
        return {"success": False, "error_code": "external_save_failed"}

    deleted = db_delete_external_events_except(user_id, new_ids, ctx=ctx)
    if deleted is None:
        rolled_back = db_delete_external_events_by_ids(user_id, new_ids, ctx=ctx)
        if not rolled_back:
            print(f"[COACH-EXT] rollback failed user={user_id} ids={new_ids}")
        return {"success": False, "error_code": "external_save_failed"}

    return {
        "success": True,
        "deleted": deleted,
        "inserted": len(inserted_rows),
        "count": len(norm_rows),
    }


def service_build_external_events_block_for_analysis(
    user_id: int,
    *,
    days_past: int = 28,
    days_future: int = 42,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    today = date.today()
    d_from = today - timedelta(days=days_past)
    d_to = today + timedelta(days=days_future)

    try:
        window = service_list_external_events_window(
            user_id=user_id,
            from_iso=d_from.isoformat(),
            to_iso=d_to.isoformat(),
            ctx=ctx,
        )

        raw = window.get("occurrences") or []
        occurrences: List[Dict[str, Any]] = []
        for ev in raw:
            occurrences.append(
                {
                    "occurrence_date": ev.get("occurrence_date"),
                    "occurrence_weekday_int": ev.get("occurrence_weekday_int"),
                    "occurrence_weekday": ev.get("occurrence_weekday"),
                    "sport": ev.get("sport"),
                    "title": ev.get("title"),
                    "priority": ev.get("priority") or "fixed",
                    "duration_min": ev.get("duration_min"),
                    "start_time_local": ev.get("start_time_local"),
                }
            )

        return {
            "schema_version": 1,
            "occurrences": occurrences,
            "window": {"from": d_from.isoformat(), "to": d_to.isoformat()},
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "schema_version": 1,
            "occurrences": [],
            "window": {"from": d_from.isoformat(), "to": d_to.isoformat()},
            "error": f"external_events_load_failed: {exc}",
        }