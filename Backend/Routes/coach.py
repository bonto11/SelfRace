# routers/coach.py
from fastapi import APIRouter, HTTPException, Body
from datetime import date, datetime, timedelta
from collections import defaultdict
from typing import Any, cast, Dict, List, Tuple
import uuid, sys, traceback
import math, statistics, os, json

from Modules.SQL.db_handler import get_client
import Modules.config as CFG

# ================== Konštanty / tabulky ==================
TABLE_ACTIVITIES_SUMMARY = getattr(
    CFG, "TABLE_ACTIVITIES_SUMMARY", "activities_summary"
)
TABLE_USERS_STATIC = getattr(CFG, "TABLE_USERS_STATIC", "users_static")
TABLE_USERS_METRICS = getattr(CFG, "TABLE_USERS_METRICS", "users_metrics")
TABLE_USERS_RECOVERY = getattr(CFG, "TABLE_USERS_RECOVERY", "users_recovery")
TABLE_USERS_NOTES = getattr(CFG, "TABLE_USERS_NOTES", "users_notes")
TABLE_USERS_BESTS = getattr(CFG, "TABLE_USERS_BESTS", "users_bests")
TABLE_USERS_THRESHOLDS = getattr(CFG, "TABLE_USERS_THRESHOLDS", "users_thresholds")
TABLE_USERS_ZONES = getattr(CFG, "TABLE_USERS_ZONES", "users_zones")
TABLE_COACH_FEEDBACK = getattr(CFG, "TABLE_COACH_FEEDBACK", "coach_feedback")
TABLE_COACH_PREFERENCES = getattr(CFG, "TABLE_COACH_PREFERENCES", "coach_preferences")


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv(
        "OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini"
    ).split(",")
    if m.strip()
]
LLM_TIMEOUT_S = int(os.getenv("OPENAI_TIMEOUT_S", "25"))
LLM_RETRIES = int(os.getenv("OPENAI_RETRIES", "2"))

router = APIRouter(prefix="/coach", tags=["coach"])
supabase = get_client()


def _trace() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z/" + uuid.uuid4().hex[:8]


def _dbg(tag: str, **kwargs):
    """Lacný debug do STDOUT; uvidíš ho v uvicorn konzole."""
    msg = f"[COACH_PREFS] {tag} " + " ".join(
        f"{k}={repr(v)}" for k, v in kwargs.items()
    )
    print(msg, file=sys.stdout, flush=True)


def _exc_detail(e: Exception) -> str:
    return f"{type(e).__name__}: {e}"

def _hhmmss_to_seconds(s: str | None) -> int | None:
    if not s: return None
    parts = [int(x) for x in s.split(":")]
    if len(parts) == 3:
        h, m, sec = parts
    elif len(parts) == 2:
        h, m, sec = 0, parts[0], parts[1]
    else:
        return None
    return h*3600 + m*60 + sec

def _seconds_to_hhmmss(sec: int | None) -> str | None:
    if sec is None: return None
    h = sec // 3600
    m = (sec % 3600) // 60
    s = sec % 60
    return f"{h:02d}:{m:02d}:{s:02d}"
 
# ================== Heuristická slovná sumarizácia ==================


def _sanitize_prefs_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Povolené polia: goal_kind, goal_distance_km, current_pace, target_pace, weeks, sports, notes, other(json)
    Všetko ostatné zahodíme (aby sme nemali neporiadok v tabuľke).
    """
    allowed_keys = {
        "goal_kind",  # napr. "improve_10k" | "maintain" | "build_base"
        "goal_distance_km",  # int
        "current_pace",  # "4:30/km" alebo "05:00/km"
        "target_pace",  # "4:15/km"
        "weeks",  # int (horizont)
        "sports",  # list[str], napr. ["run","bike","strength"]
        "notes",  # voľný text
        "other",  # dict (čokoľvek navyše)
    }

    clean: Dict[str, Any] = {}
    for k, v in (payload or {}).items():
        if k in allowed_keys:
            clean[k] = v

    # základná normalizácia
    if "sports" in clean and not isinstance(clean["sports"], list):
        clean["sports"] = [str(clean["sports"])]
    if "goal_distance_km" in clean:
        try:
            clean["goal_distance_km"] = int(clean["goal_distance_km"])
        except Exception:
            clean["goal_distance_km"] = None
    if "weeks" in clean:
        try:
            clean["weeks"] = int(clean["weeks"])
        except Exception:
            clean["weeks"] = None
    if "other" in clean and not isinstance(clean["other"], dict):
        clean["other"] = {"raw": clean["other"]}

    return clean

def _avg(nums: list[float]) -> float:
    return sum(nums) / len(nums) if nums else 0.0


def _safe(v, d=0.0):
    try:
        return float(v)
    except:
        return d

def _build_narrative(ctx: dict, weeks: int) -> dict:
    weekly = (ctx.get("weekly") or {}).get("weeks") or []
    recovery = ctx.get("recovery") or []
    notes = ctx.get("notes") or []

    last = weekly[-1] if weekly else None
    prev = weekly[-weeks:-1] if len(weekly) > 1 else []
    km_last = _safe(last.get("km_run")) if last else 0.0
    tr_last = _safe(last.get("trimp")) if last else 0.0
    km_prev = _avg([_safe(w.get("km_run")) for w in prev])
    tr_prev = _avg([_safe(w.get("trimp")) for w in prev])
    diff_km, diff_tr = km_last - km_prev, tr_last - tr_prev

    rec_sorted = list(reversed(recovery))
    last7, prev14 = rec_sorted[:7], rec_sorted[7:21]
    hrv7 = _avg([_safe(r.get("HRV_avg_ms")) for r in last7])
    rhr7 = _avg([_safe(r.get("RHR_bpm")) for r in last7])
    hrv14 = _avg([_safe(r.get("HRV_avg_ms")) for r in prev14])
    rhr14 = _avg([_safe(r.get("RHR_bpm")) for r in prev14])
    hrv_delta, rhr_delta = hrv7 - hrv14, rhr7 - rhr14

    raw_notes = (notes or [])[-20:]
    t = " ".join([str(n.get("feeling") or "") for n in raw_notes]).lower()
    flags = []
    if any(k in t for k in ["dovolen", "holiday", "vacation"]):
        flags.append("dovolenka")
    if any(k in t for k in ["sick", "ill", "chor", "virus", "flu", "covid"]):
        flags.append("choroba")
    if any(k in t for k in ["race", "prete", "marat", "10k", "half"]):
        flags.append("preteky")

    sign = lambda x: "↑" if x > 1e-6 else ("↓" if x < -1e-6 else "≈")

    period = []
    if prev:
        period.append(
            f"Za posledných {min(len(prev)+1, weeks)} týždňov držíš beh ~{km_prev:.1f} km/týž. a TRIMP ~{tr_prev:.0f}."
        )
    if hrv14 or rhr14:
        period.append(
            f"Recovery trend: HRV ~{hrv14:.0f} ms, RHR ~{rhr14:.0f} bpm (predposledné 2 týždne)."
        )

    last_week = [
        f"Minulý týždeň: beh {km_last:.1f} km ({sign(diff_km)} {diff_km:+.1f} vs. priemer), TRIMP {tr_last:.0f} ({sign(diff_tr)} {diff_tr:+.0f})."
    ]
    if hrv7 or rhr7:
        last_week.append(
            f"HRV {hrv7:.0f} ms ({hrv_delta:+.0f} vs. predchádzajúce 2 týždne), RHR {rhr7:.1f} bpm ({rhr_delta:+.1f})."
        )
    if flags:
        last_week.append("Poznámky naznačujú: " + ", ".join(flags) + ".")

    return {
        "period_summary": " ".join(period) or None,
        "last_week_summary": " ".join(last_week) or None,
    }


# ================== LLM helpery (schema, koercia, call) ==================
def _extract_json_block(text: str) -> dict:
    import re, json as _j

    t = (text or "").strip()
    try:
        return _j.loads(t)
    except Exception:
        pass
    start, end = t.find("{"), t.rfind("}")
    candidate = t[start : end + 1] if start != -1 and end != -1 and end > start else t
    safe = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", candidate)
    return _j.loads(safe)


def _coerce_to_schema(obj: dict) -> dict:
    """Znormalizuje výstup na: summary, insights[list[str]], red_flags[list], next_week_plan[dict], _meta."""
    if not isinstance(obj, dict):
        raise ValueError("LLM output is not a JSON object")
    out: Dict[str, Any] = {
        "summary": obj.get("summary") or "No summary.",
        "insights": [],
        "red_flags": (
            obj.get("red_flags") if isinstance(obj.get("red_flags"), list) else []
        ),
        "next_week_plan": obj.get("next_week_plan"),
        "_meta": {"coerced": False, "plan_source": "llm"},
    }
    ins = obj.get("insights")
    if isinstance(ins, list):
        out["insights"] = [str(x) for x in ins]
    elif isinstance(ins, dict):
        bullets: List[str] = []

        def flat(pref: str, v: Any):
            if isinstance(v, dict):
                for k, vv in v.items():
                    flat(f"{pref}{k}:", vv)
            elif isinstance(v, list):
                for it in v:
                    flat(pref, it)
            else:
                s = f"{pref} {v}".strip()
                if s:
                    bullets.append(s)

        flat("", ins)
        out["insights"] = [b.replace("  ", " ").strip(" :") for b in bullets if b]

    nwp = obj.get("next_week_plan")
    if isinstance(nwp, list) and all(isinstance(x, str) for x in nwp):
        out["_meta"]["coerced"] = True
        out["_meta"]["plan_source"] = "coerced_from_guidelines"
        out["next_week_plan"] = None
        out["_guidelines"] = nwp
    elif isinstance(nwp, dict):
        out["next_week_plan"] = nwp
    else:
        out["_meta"]["coerced"] = True
        out["_meta"]["plan_source"] = "coerced_empty"
        out["next_week_plan"] = None
    return out


def _recent_run_km_avg(weekly: list[dict]) -> float:
    vals = [float(w.get("km_run") or 0.0) for w in (weekly[-3:] if weekly else [])]
    return (sum(vals) / len(vals)) if vals else 30.0


def _build_min_plan_from_context(ctx_in: Dict[str, Any]) -> Dict[str, Any]:
    weekly: List[Dict[str, Any]] = cast(
        List[Dict[str, Any]], ctx_in.get("weekly") or []
    )
    sports: List[str] = cast(
        List[str], ctx_in.get("primary_sports") or ["run", "strength"]
    )
    base_km = max(28.0, min(60.0, _recent_run_km_avg(weekly)))
    run_s = [
        {
            "title": "Intervals 6×800m @ 5k pace",
            "duration_min": 60,
            "intensity": "high",
            "notes": "RPE 8; pauzy 2–3 min",
        },
        {
            "title": "Tempo 20–25 min @ LT",
            "duration_min": 55,
            "intensity": "med-high",
            "notes": "RPE 7",
        },
        {
            "title": "Long run easy",
            "duration_min": 80,
            "intensity": "easy",
            "notes": "RPE 4",
        },
    ]
    bike_s = [
        {"title": "Endurance Z2", "duration_min": 45},
        {"title": "Endurance Z2", "duration_min": 45},
    ]
    str_s = [
        {"title": "Full-body", "duration_min": 45},
        {"title": "Core+Mobility", "duration_min": 25},
    ]
    plan: Dict[str, Any] = {
        "focus": "build",
        "monday": {"title": "Rest", "duration_min": 0, "notes": "Hydration, sleep"},
        "tuesday": (
            run_s[0]
            if "run" in sports
            else (bike_s[0] if "bike" in sports else str_s[0])
        ),
        "wednesday": (
            str_s[0]
            if "strength" in sports
            else {"title": "Easy cross", "duration_min": 30}
        ),
        "thursday": (
            run_s[1]
            if "run" in sports
            else (bike_s[1] if "bike" in sports else str_s[-1])
        ),
        "friday": {"title": "Rest", "duration_min": 0, "notes": "Light mobility"},
        "saturday": (
            run_s[2]
            if "run" in sports
            else (
                bike_s[0] if "bike" in sports else {"title": "Hike", "duration_min": 60}
            )
        ),
        "sunday": (
            (bike_s[1] if "bike" in sports else str_s[-1])
            if "run" not in sports
            else {"title": "Easy jog", "duration_min": 40}
        ),
        "rest_days": ["Mon", "Fri"],
    }
    if "run" in sports:
        plan["run"] = {"weekly_km_target": round(base_km), "sessions": run_s}
    if "bike" in sports:
        plan["bike"] = {"weekly_time_target_min": 90, "sessions": bike_s}
    if "strength" in sports:
        plan["strength"] = {"sessions": str_s}
    return plan


def _enforce_minimum_plan(parsed: dict, llm_input: dict) -> dict:
    if not isinstance(parsed, dict):
        raise ValueError("LLM output not a dict")
    plan = parsed.get("next_week_plan")
    has_any = False
    if isinstance(plan, dict):
        for k in ("run", "bike", "strength"):
            s = plan.get(k)
            if (
                s
                and isinstance(s, dict)
                and isinstance(s.get("sessions"), list)
                and s["sessions"]
            ):
                has_any = True
                break
        if not has_any and any(
            day in plan
            for day in (
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
            )
        ):
            has_any = True
    if not plan or not has_any:
        parsed.setdefault(
            "summary",
            "Auto-filled plan based on your recent context (guidelines detected).",
        )
        parsed["next_week_plan"] = _build_min_plan_from_context(llm_input)
        meta = parsed.setdefault("_meta", {})
        meta["plan_source"] = (
            "coerced_from_guidelines"
            if meta.get("plan_source") == "coerced_from_guidelines"
            else "fallback_min"
        )
    else:
        parsed.setdefault("_meta", {})["plan_source"] = parsed.get("_meta", {}).get(
            "plan_source", "llm"
        )
    return parsed


def _try_llm_call(payload_json: dict, model: str) -> dict:
    """
    Chat Completions + response_format=json_object.
    Schému dávame v texte (instructional). Potom normalizujeme a v callerovi vynútime minimálny plán.
    """
    from typing import Any, cast
    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=LLM_TIMEOUT_S)

    # Instructional schema – obsahuje aj 'structure' a 'exercises'
    json_schema_text = """
    JSON object with keys:
      summary: string
      insights: string[]
      red_flags: {type:string, details?:string, evidence?:string}[]
      next_week_plan: {
        focus: "base" | "build" | "recovery",
        monday?:    Session|Session[],
        tuesday?:   Session|Session[],
        wednesday?: Session|Session[],
        thursday?:  Session|Session[],
        friday?:    Session|Session[],
        saturday?:  Session|Session[],
        sunday?:    Session|Session[],
        rest_days?: string[],
        run?:      { weekly_km_target?: number|null, sessions?: Session[] },
        bike?:     { weekly_time_target_min?: number|null, sessions?: Session[] },
        strength?: { sessions?: Session[] }
      }
    where Session = {
      title: string,
      duration_min: number,
      intensity?: string|null,
      notes?: string|null,
      target_pace_min_per_km?: string|null,         # e.g. "4:35–4:45"
      target_hr_bpm_range?: [number, number]|null,  # e.g. [150,165]
      target_power_watts?: number|null,             # bike power
      zone?: string|null,                           # "Z2", "Z3 (LT)"...
      structure?: {
        warmup?:  { minutes: number, notes?: string, target?: { pace?: string|null, hr?: [number,number]|null, zone?: string|null } },
        main?:    { reps: number, work_min: number, recover_min: number, recovery_mode?: "walk"|"jog"|"stop"|null, target?: { pace?: string|null, hr?: [number,number]|null, power?: number|null, zone?: string|null } }[],
        cooldown?:{ minutes: number, notes?: string }
      },
      exercises?: { name: string, sets: number, reps: number, rest_sec?: number, tempo?: string|null, focus?: string|null }[]
    }
    Constraints:
    - Return ONLY valid JSON (no markdown).
    - Build a full 7-day plan whenever possible (monday..sunday).
    - Use user's thresholds and zones if present (pace HR power targets).
    - Prefer to include both pace AND HR/zone targets for runs; power/HR for bike.
    - Keep progression ≤ 10% vs recent loads; place rest days sensibly.
    """

    system_txt = (
        "You are an endurance coaching assistant. "
        "Use the provided weekly loads, recovery, thresholds, zones and goal_structured to produce a concrete 7-day plan. "
        "Include warmup / interval blocks / cooldown when relevant. Return ONLY JSON."
    )

    user_txt = (
        "Context JSON:\n"
        + json.dumps(payload_json, ensure_ascii=False)
        + "\n\nSchema (instructional; follow strictly):\n"
        + json_schema_text
    )

    cc = client.chat.completions.create(
        model=model,
        messages=cast(
            Any,
            [
                {"role": "system", "content": system_txt},
                {"role": "user", "content": user_txt},
            ],
        ),
        response_format={"type": "json_object"},
        temperature=0.35,
        max_tokens=1200,
    )

    raw = (
        getattr(getattr(cc.choices[0], "message", {}), "content", None)
        or getattr(cc.choices[0], "text", None)
        or ""
    ).strip()
    if not raw:
        raise RuntimeError("empty_response_chat_json_object")
    print(
        f"[LLM] model={model} json_len={len(raw)} head={raw[:100].replace(chr(10),' ')}"
    )

    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = _extract_json_block(raw)

    return _coerce_to_schema(parsed)


# ================== Fetch doplnkov (thresholds/zones) ==================


# ================== Agregácia dát ==================
def sport_bucket(s: str) -> str:
    s = (s or "").lower()
    if "run" in s:
        return "run"
    if "ride" in s or "bike" in s or "cycle" in s:
        return "bike"
    if any(k in s for k in ["strength", "weight", "gym"]):
        return "strength"
    return "other"


def week_key(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def week_bounds(iso_key: str) -> Tuple[date, date]:
    y = int(iso_key.split("-W")[0])
    w = int(iso_key.split("-W")[1])
    start = date.fromisocalendar(y, w, 1)
    end = start + timedelta(days=6)
    return start, end


def compute_trimp(
    avg_hr: float | None,
    dur_min: float,
    hr_max: float | None,
    rhr: float | None,
    sex: str | None,
) -> float:
    try:
        if not avg_hr or not hr_max or not rhr:
            return 0.0
        denom = hr_max - rhr
        if denom <= 0:
            return 0.0
        hrr = (avg_hr - rhr) / denom
        if hrr <= 0:
            return 0.0
        k, c = (0.86, 1.67) if (sex or "").upper() == "F" else (0.64, 1.92)
        return float(dur_min * hrr * k * math.exp(c * hrr))
    except Exception:
        return 0.0


def monotony_and_strain(
    day_dict: Dict[str, float], week_start: date, week_total: float
) -> Tuple[float, float]:
    vals = [
        float(day_dict.get((week_start + timedelta(days=i)).isoformat(), 0.0))
        for i in range(7)
    ]
    mean = statistics.fmean(vals) if vals else 0.0
    sd = statistics.pstdev(vals) if len(vals) > 1 else 0.0
    mono = (mean / sd) if sd > 0 else 0.0
    return mono, week_total * mono


def fetch_weekly(user_id: int, weeks: int = 12):
    sex = hr_max = rhr = None
    try:
        st = (
            supabase.table(TABLE_USERS_STATIC)
            .select("sex")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if st.data:
            sex = st.data[0].get("sex")
    except Exception:
        pass
    try:
        mt = (
            supabase.table(TABLE_USERS_METRICS)
            .select("HR_max,RHR,updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if mt.data:
            hr_max, rhr = mt.data[0].get("HR_max"), mt.data[0].get("RHR")
    except Exception:
        pass

    since = (datetime.utcnow() - timedelta(weeks=weeks + 1)).date().isoformat()
    try:
        res = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select(
                "date,sport_type,distance_m,moving_time_s,average_heartrate_bpm,average_hr,name,activity_id"
            )
            .eq("user_id", user_id)
            .gte("date", since)
            .execute()
        )
        rows = res.data or []
    except Exception:
        rows = []

    week_agg: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {
            "trimp": 0.0,
            "trimp_run": 0.0,
            "trimp_bike": 0.0,
            "trimp_strength": 0.0,
            "trimp_other": 0.0,
            "time_min": 0.0,
            "time_run_min": 0.0,
            "time_bike_min": 0.0,
            "time_strength_min": 0.0,
            "time_other_min": 0.0,
            "km_total": 0.0,
            "km_run": 0.0,
            "km_bike": 0.0,
            "day_trimp": defaultdict(float),
            "day_time": defaultdict(float),
            "day_km": defaultdict(float),
            "examples": [],
        }
    )

    for r in rows:
        d_str = (r.get("date") or "")[:10]
        try:
            d = date.fromisoformat(d_str)
        except Exception:
            continue
        wk = week_key(d)
        bucket = sport_bucket(r.get("sport_type") or r.get("name") or "")
        dist_km = float(r.get("distance_m") or 0.0) / 1000.0
        time_min = float(r.get("moving_time_s") or 0.0) / 60.0
        avg_hr = r.get("average_heartrate_bpm") or r.get("average_hr")
        tr = compute_trimp(avg_hr, time_min, hr_max, rhr, sex)

        wa = week_agg[wk]
        wa["trimp"] += tr
        wa["time_min"] += time_min
        wa["km_total"] += dist_km
        wa["day_trimp"][d.isoformat()] += tr
        wa["day_time"][d.isoformat()] += time_min
        wa["day_km"][d.isoformat()] += dist_km

        if bucket == "run":
            wa["trimp_run"] += tr
            wa["time_run_min"] += time_min
            wa["km_run"] += dist_km
        elif bucket == "bike":
            wa["trimp_bike"] += tr
            wa["time_bike_min"] += time_min
            wa["km_bike"] += dist_km
        elif bucket == "strength":
            wa["trimp_strength"] += tr
            wa["time_strength_min"] += time_min
        else:
            wa["trimp_other"] += tr
            wa["time_other_min"] += time_min

        if len(wa["examples"]) < 6:
            wa["examples"].append(
                {
                    "date": d_str,
                    "sport": r.get("sport_type"),
                    "name": r.get("name"),
                    "id": r.get("activity_id"),
                }
            )

    out_weeks: List[Dict[str, Any]] = []
    for wk in sorted(week_agg.keys()):
        start, end = week_bounds(wk)
        wa = week_agg[wk]
        mono_km, strain_km = monotony_and_strain(wa["day_km"], start, wa["km_total"])
        mono_tm, strain_tm = monotony_and_strain(wa["day_time"], start, wa["time_min"])
        mono_tr, strain_tr = monotony_and_strain(wa["day_trimp"], start, wa["trimp"])
        out_weeks.append(
            {
                "week": wk,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "km_total": wa["km_total"],
                "km_run": wa["km_run"],
                "km_bike": wa["km_bike"],
                "time_min": wa["time_min"],
                "time_run_min": wa["time_run_min"],
                "time_bike_min": wa["time_bike_min"],
                "time_strength_min": wa["time_strength_min"],
                "time_other_min": wa["time_other_min"],
                "trimp": wa["trimp"],
                "trimp_run": wa["trimp_run"],
                "trimp_bike": wa["trimp_bike"],
                "trimp_strength": wa["trimp_strength"],
                "trimp_other": wa["trimp_other"],
                "monotony": {"km": mono_km, "time": mono_tm, "trimp": mono_tr},
                "strain": {"km": strain_km, "time": strain_tm, "trimp": strain_tr},
                "examples": wa["examples"],
            }
        )
    return {"weeks": out_weeks, "hr_used": {"sex": sex, "hr_max": hr_max, "rhr": rhr}}


def fetch_recent_recovery(user_id: int, days: int = 21):
    try:
        since = (datetime.utcnow().date() - timedelta(days=days)).isoformat()
        res = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select(
                "date,RHR_bpm,HRV_avg_ms,sleep_duration_min,food_2h_before,caffeine_8h,alcohol_volume_ml"
            )
            .eq("user_id", user_id)
            .gte("date", since)
            .order("date", desc=False)
            .execute()
        )
        return res.data or []
    except Exception:
        return []


def fetch_recent_notes(user_id: int, days: int = 28):
    try:
        since_dt = datetime.utcnow() - timedelta(days=days)
        res = (
            supabase.table(TABLE_USERS_NOTES)
            .select("activity_id,feeling,created_at")
            .eq("user_id", user_id)
            .gte("created_at", since_dt.isoformat())
            .order("created_at", desc=False)
            .execute()
        )
        return res.data or []
    except Exception:
        return []

def fetch_user_thresholds(user_id: int) -> list[dict]:
    try:
        res = (
            supabase.table(TABLE_USERS_THRESHOLDS)
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        return []


def fetch_user_zones(user_id: int) -> list[dict]:
    try:
        res = (
            supabase.table(TABLE_USERS_ZONES)
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        return []

def fetch_user_bests(user_id: int) -> list[dict]:
    """Vráti zoznam PR (distance_km, time_sec, time_str, event_name?, date?)."""
    try:
        res = (supabase.table(TABLE_USERS_BESTS)
               .select("distance_km,time_sec,event_name,date")
               .eq("user_id", user_id)
               .order("distance_km", desc=False)
               .execute())
        out = []
        for r in (res.data or []):
            out.append({
                "distance_km": r.get("distance_km"),
                "time_sec": r.get("time_sec"),
                "time_str": _seconds_to_hhmmss(r.get("time_sec")),
                "event_name": r.get("event_name"),
                "date": r.get("date"),
            })
        return out
    except Exception:
        return []

def fetch_user_prefs(user_id: int) -> dict | None:
    try:
        res = (
            supabase.table(TABLE_COACH_PREFERENCES)
            .select("prefs")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0].get("prefs") or None
    except Exception:
        pass
    return None

def fetch_user_preferences(user_id: int) -> Dict[str, Any] | None:
    """Načíta 1 row z coach_preferences podľa user_id (alebo None)."""
    try:
        res = (
            supabase.table(TABLE_COACH_PREFERENCES)
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print(f"[coach] fetch_user_preferences error: {e}")
        return None

# ================== PUBLIC ENDPOINTS ==================
@router.get("/bests/{user_id}")
def coach_bests_get(user_id: int):
    try:
        return {"success": True, "bests": fetch_user_bests(user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/bests/{user_id}")
def coach_bests_put(user_id: int, payload: dict = Body(...)):
    """
    Upsert jedného osobného rekordu:
    body: { distance_km: number, time_str?: "hh:mm:ss", time_sec?: number, event_name?: string, date?: "YYYY-MM-DD" }
    """
    try:
        distance_val = payload.get("distance_km")
        if distance_val is None:
            raise HTTPException(status_code=400, detail="Missing distance_km")
        try:
            distance = float(distance_val)
        except Exception:
            raise HTTPException(status_code=400, detail="distance_km must be a number")

        time_sec = payload.get("time_sec")
        if time_sec is None:
            time_sec = _hhmmss_to_seconds(payload.get("time_str"))
        if not time_sec:
            raise HTTPException(status_code=400, detail="Missing time (time_str or time_sec).")

        rec = {
            "user_id": user_id,
            "distance_km": distance,
            "time_sec": int(time_sec),
            "event_name": payload.get("event_name"),
            "date": payload.get("date"),
            "updated_at": datetime.utcnow().isoformat(),
        }

        (supabase.table(TABLE_USERS_BESTS)
         .upsert(rec, on_conflict="user_id,distance_km")
         .execute())

        return {"success": True, "saved": rec}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))  
@router.get("/context/{user_id}")
def coach_context(user_id: int, weeks: int = 6, rec_days: int = 21):
    try:
        weekly = fetch_weekly(user_id, weeks=weeks)
        recovery = fetch_recent_recovery(user_id, days=rec_days)
        notes = fetch_recent_notes(user_id, days=weeks * 7)
        thresholds = fetch_user_thresholds(user_id)
        zones = fetch_user_zones(user_id)
        preferencies = fetch_user_preferences(user_id)
        bests = fetch_user_bests(user_id)

        return {
            "success": True,
            "weekly": weekly,
            "recovery": recovery,
            "notes": notes,
            "thresholds": thresholds,
            "zones": zones,
            "preferencies": preferencies,
            "bests": bests,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/llm_status")
def coach_llm_status():
    if not OPENAI_API_KEY:
        return {"ok": False, "reason": "no_api_key"}
    payload = {"goal": "ping", "weekly": []}
    models = [DEFAULT_MODEL] + [m for m in FALLBACK_MODELS if m != DEFAULT_MODEL]
    last_err = None
    for m in models:
        for i in range(LLM_RETRIES + 1):
            try:
                _ = _try_llm_call(payload, m)
                return {"ok": True, "model": m, "retries_used": i}
            except Exception as e:
                last_err = str(e)
                continue
    return {
        "ok": False,
        "reason": "call_failed",
        "last_error": last_err,
        "tried": models,
    }


@router.post("/feedback/{user_id}")
def coach_feedback(user_id: int, payload: dict = Body(...)):
    txt = (payload.get("text") or "").strip()
    if not txt:
        raise HTTPException(status_code=400, detail="Missing text")
    record = {
        "user_id": user_id,
        "text": txt,
        "weeks": payload.get("weeks"),
        "goal": payload.get("goal"),
        "model": payload.get("model"),
        "context": payload.get("context"),
    }
    try:
        supabase.table(TABLE_COACH_FEEDBACK).insert(record).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Preferences / Goals ----------
@router.get("/prefs/{user_id}")
def get_prefs(user_id: int):
    """
    Načíta preferencie: vracia {"prefs": {...}} alebo prázdny objekt.
    Debug loguje všetky kroky + trace_id na spárovanie v FE.
    """
    tid = _trace()
    _dbg("GET.start", tid=tid, user_id=user_id, table=TABLE_COACH_PREFERENCES)
    try:
        res = (
            supabase.table(TABLE_COACH_PREFERENCES)
            .select("prefs, updated_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        _dbg("GET.query_ok", tid=tid, rows=len(res.data or []))
        row = (res.data or [{}])[0]
        prefs = row.get("prefs") or {}
        _dbg("GET.done", tid=tid, has_prefs=bool(prefs))
        return {
            "success": True,
            "trace_id": tid,
            "prefs": prefs,
            "updated_at": row.get("updated_at"),
        }
    except Exception as e:
        _dbg("GET.error", tid=tid, error=_exc_detail(e))
        # pribalíme aj traceback do detailu, nech to vidíš priamo v logu
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"prefs_load_failed[{tid}]: {_exc_detail(e)}"
        )


@router.put("/prefs/{user_id}")
@router.post("/prefs/{user_id}")  # voliteľne
def upsert_prefs(user_id: int, payload: dict = Body(...)):
    """
    Uloží preferencie. Ukladáme *celý* payload do JSONB 'prefs'.
    Debug: logujeme veľkosť payloadu, obsah kľúčov, výsledok upsertu.
    """
    tid = _trace()
    _dbg("PUT.start", tid=tid, user_id=user_id)

    # kontrola typu
    if not isinstance(payload, dict):
        _dbg("PUT.bad_payload_type", tid=tid, type=str(type(payload)))
        raise HTTPException(
            status_code=400, detail=f"invalid_payload[{tid}]: must be JSON object"
        )

    # pár užitočných meta-šípok (aby si nemusel rozbaľovať celý objekt v logu)
    _dbg(
        "PUT.payload_meta",
        tid=tid,
        keys=list(payload.keys())[:12],
        size_bytes=len(json.dumps(payload, ensure_ascii=False)),
    )

    record = {
        "user_id": user_id,
        "prefs": payload,
        "updated_at": datetime.utcnow().isoformat(),
    }

    try:
        res = (
            supabase.table(TABLE_COACH_PREFERENCES)
            .upsert(record, on_conflict="user_id")
            .execute()
        )
        saved = (res.data or [{}])[0]
        _dbg(
            "PUT.upsert_ok",
            tid=tid,
            rows=len(res.data or []),
            updated_at=saved.get("updated_at"),
        )
        return {
            "success": True,
            "trace_id": tid,
            "saved": saved.get("prefs", payload),
            "updated_at": saved.get("updated_at", record["updated_at"]),
        }
    except Exception as e:
        _dbg("PUT.error", tid=tid, error=_exc_detail(e))
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"prefs_save_failed[{tid}]: {_exc_detail(e)}"
        )


@router.get("/goals/catalog")
def goals_catalog():
    """Jednoduchý katalóg cieľov pre FE výberník."""
    return {
        "success": True,
        "goals": [
            {
                "id": "race_time",
                "label": "Zlepšiť čas na pretekoch",
                "distances": ["5k", "10k", "21k", "42k"],
            },
            {"id": "improve_speed", "label": "Zlepšiť rýchlosť"},
            {"id": "improve_endurance", "label": "Zlepšiť vytrvalosť"},
            {"id": "improve_overall", "label": "Zlepšiť vseobecne"},
            {"id": "maintain", "label": "Udržať kondíciu"},
        ],
    }


@router.post("/goals/estimate/{user_id}")
def goals_estimate(user_id: int, payload: dict = Body(...)):
    """
    Hrubý sanity-check: vyhodnotí, či skok cieľového tempa nie je príliš agresívny.
    Vstup: {distance:"10k", current_pace:"4:45", target_pace:"4:30"}
    """
    try:
        distance = (payload.get("distance") or "").lower()
        cur = (payload.get("current_pace") or "").strip()
        tgt = (payload.get("target_pace") or "").strip()
        weeks = int(payload.get("weeks", 6))

        def pace_to_sec(p: str) -> float:
            if not p or ":" not in p:
                return 0.0
            m, s = p.split(":")
            return int(m) * 60 + int(s)

        cur_s, tgt_s = pace_to_sec(cur), pace_to_sec(tgt)
        if not cur_s or not tgt_s:
            return {"success": True, "ok": False, "reason": "missing_pace"}

        delta = cur_s - tgt_s  # pozitívne = zrýchlenie
        rel = delta / cur_s if cur_s else 0.0

        # jednoduché pravidlo: >6% za 6 týždňov = rizikové
        risky = rel > 0.06 and weeks <= 6
        note = (
            "ambiciózne ale možné"
            if rel <= 0.06
            else "príliš agresívne — zváž dlhší horizont alebo miernejší cieľ"
        )
        return {
            "success": True,
            "ok": not risky,
            "improvement_pct": round(rel * 100, 1),
            "comment": note,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Hlavná AI analýza ----------
@router.post("/analyze/{user_id}")
def coach_analyze(
    user_id: int,
    payload: dict = Body(
        ...,
        example={
            "weeks": 6,
            "goal": "Zlepšiť 10 km čas o 2-3% v najbližších 6-8 týždňoch",
            "primary_sports": ["run", "bike", "strength"],
            "goal_structured": {
                "goal_kind": "race_time",
                "distance": "10k",
                "current_pace": "4:45",
                "target_pace": "4:30",
            },
        },
    ),
):
    """AI analýza + návrh ďalšieho týždňa (denný plán). Bez dummy; ak LLM zlyhá, vráti 500."""
    try:
        weeks = int(payload.get("weeks", 6))
        goal = payload.get("goal", "")
        primary_sports = payload.get("primary_sports", ["run", "bike", "strength"])
        goal_structured = payload.get("goal_structured")  # môžeš poslať z FE

        ctx = coach_context(user_id, weeks=weeks)
        if not ctx.get("success"):
            raise HTTPException(status_code=500, detail="Context build failed")

        weekly = ctx["weekly"]["weeks"][-weeks:]
        hr_used = ctx["weekly"]["hr_used"]
        recovery = ctx.get("recovery", [])[-21:]
        notes = ctx.get("notes", [])[-50:]
        thresholds = ctx.get("thresholds", [])
        zones = ctx.get("zones", [])
        prefs = ctx.get("prefs")
        bests = ctx.get("bests", [])

        llm_input = {
            "goal": goal,
            "goal_structured": goal_structured,
            "primary_sports": primary_sports,
            "hr_used": hr_used,
            "weekly": weekly,
            "recovery": recovery,
            "notes": notes,
            "thresholds": thresholds,
            "zones": zones,
            "prefs": prefs,
            "bests": bests,
        }
        narr = _build_narrative(ctx, weeks)

        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

        models = [DEFAULT_MODEL] + [m for m in FALLBACK_MODELS if m != DEFAULT_MODEL]
        parsed = None
        last_err = None
        used_model = DEFAULT_MODEL

        for m in models:
            for _ in range(LLM_RETRIES + 1):
                try:
                    parsed = _try_llm_call(llm_input, m)
                    parsed = _enforce_minimum_plan(parsed, llm_input)
                    used_model = m
                    break
                except Exception as e:
                    last_err = str(e)
                    continue
            if parsed is not None:
                break

        if parsed is None:
            raise HTTPException(status_code=500, detail=f"LLM failed: {last_err}")

        return {
            "success": True,
            "model": used_model,
            "analysis": parsed,
            "context_used": llm_input,
            "narrative": narr,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Pomocný endpoint – stručný sumár mesiac
@router.get("/analyze_recent/{user_id}")
def analyze_recent_activities(user_id: int, days: int = 30, limit: int = 30):
    try:
        month_ago = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
        res = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select(
                "name, sport_type, distance_m, moving_time_s, average_heartrate_bpm, start_date"
            )
            .eq("user_id", user_id)
            .gte("date", month_ago)
            .order("date", desc=True)
            .limit(limit)
            .execute()
        )
        activities = res.data or []
        if not activities:
            return {"success": False, "error": "Žiadne aktivity za zadané obdobie."}
        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=LLM_TIMEOUT_S)
        prompt = f"Tu sú aktivity za posledných {days} dní:\n{activities}\nZhrň trendy a odporúčania (stručne)."
        resp = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=cast(
                Any,
                [
                    {"role": "system", "content": "You are a concise data analyst."},
                    {"role": "user", "content": prompt},
                ],
            ),
            temperature=0.3,
            max_tokens=500,
        )
        raw = (
            getattr(getattr(resp.choices[0], "message", {}), "content", None)
            or getattr(resp.choices[0], "text", None)
            or ""
        )
        return {"success": True, "analysis": raw, "activities_count": len(activities)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
