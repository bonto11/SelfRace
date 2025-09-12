# routers/coach.py
from fastapi import APIRouter, HTTPException, Body
from datetime import date, datetime, timedelta
from collections import defaultdict
import math, statistics, os, json

from Modules.SQL.db_handler import get_client
import Modules.config as CFG

# Konštanty z configu + bezpečné defaulty
TABLE_ACTIVITIES_SUMMARY = getattr(CFG, "TABLE_ACTIVITIES_SUMMARY", "activities_summary")
TABLE_USERS_STATIC       = getattr(CFG, "TABLE_USERS_STATIC",       "users_static")
TABLE_USERS_METRICS      = getattr(CFG, "TABLE_USERS_METRICS",      "users_metrics")
TABLE_USERS_RECOVERY     = getattr(CFG, "TABLE_USERS_RECOVERY",     "users_recovery")
TABLE_USERS_NOTES        = getattr(CFG, "TABLE_USERS_NOTES",        "users_notes")

router = APIRouter(prefix="/coach", tags=["coach"])
supabase = get_client()

# ========== helpers ==========

def sport_bucket(s: str) -> str:
    s = (s or "").lower()
    if "run" in s: return "run"
    if "ride" in s or "bike" in s or "cycle" in s: return "bike"
    if any(k in s for k in ["strength","weight","gym"]): return "strength"
    return "other"

def week_key(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"

def week_bounds(iso_key: str) -> tuple[date, date]:
    y = int(iso_key.split("-W")[0])
    w = int(iso_key.split("-W")[1])
    start = date.fromisocalendar(y, w, 1)
    end = start + timedelta(days=6)
    return start, end

def compute_trimp(avg_hr: float | None, dur_min: float, hr_max: float | None, rhr: float | None, sex: str | None) -> float:
    try:
        if not avg_hr or not hr_max or not rhr: return 0.0
        denom = (hr_max - rhr)
        if denom <= 0: return 0.0
        hrr = (avg_hr - rhr) / denom
        if hrr <= 0: return 0.0
        if (sex or "").upper() == "F": k, c = 0.86, 1.67
        else:                           k, c = 0.64, 1.92
        return float(dur_min * hrr * k * math.exp(c * hrr))
    except Exception:
        return 0.0

def monotony_and_strain(day_dict: dict[str, float], week_start: date, week_total: float) -> tuple[float, float]:
    vals = []
    for i in range(7):
        d = (week_start + timedelta(days=i)).isoformat()
        vals.append(float(day_dict.get(d, 0.0)))
    mean = statistics.fmean(vals) if vals else 0.0
    sd   = statistics.pstdev(vals) if len(vals) > 1 else 0.0
    mono = (mean / sd) if sd > 0 else 0.0
    return mono, week_total * mono

def fetch_weekly(user_id: int, weeks: int = 12):
    # Profilové parametre
    sex, hr_max, rhr = None, None, None
    st = supabase.table(TABLE_USERS_STATIC).select("sex").eq("user_id", user_id).limit(1).execute()
    if st.data: sex = st.data[0].get("sex")
    mt = supabase.table(TABLE_USERS_METRICS).select("HR_max,RHR,updated_at").eq("user_id", user_id).order("updated_at", desc=True).limit(1).execute()
    if mt.data:
        hr_max = mt.data[0].get("HR_max")
        rhr    = mt.data[0].get("RHR")

    since = (datetime.utcnow() - timedelta(weeks=weeks+1)).date().isoformat()
    res = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
        .select("date,sport_type,distance_m,moving_time_s,average_heartrate_bpm,name,activity_id")
        .eq("user_id", user_id)
        .gte("date", since)
        .execute()
    )
    rows = res.data or []

    week_agg: dict[str, dict] = defaultdict(lambda: {
        "trimp": 0.0, "trimp_run": 0.0, "trimp_bike": 0.0, "trimp_strength": 0.0, "trimp_other": 0.0,
        "time_min": 0.0, "time_run_min": 0.0, "time_bike_min": 0.0, "time_strength_min": 0.0, "time_other_min": 0.0,
        "km_total": 0.0, "km_run": 0.0, "km_bike": 0.0,
        "day_trimp": defaultdict(float), "day_time": defaultdict(float), "day_km": defaultdict(float),
        "examples": [],  # pár záznamov na kontext (názvy tréningov)
    })

    for r in rows:
        d_str = (r.get("date") or "")[:10]
        try: d = date.fromisoformat(d_str)
        except Exception: continue

        wk     = week_key(d)
        bucket = sport_bucket(r.get("sport_type") or "")
        dist_km  = float(r.get("distance_m") or 0.0) / 1000.0
        time_min = float(r.get("moving_time_s") or 0.0) / 60.0
        avg_hr   = r.get("average_heartrate_bpm")
        tr       = compute_trimp(avg_hr, time_min, hr_max, rhr, sex)

        wa = week_agg[wk]
        wa["trimp"]     += tr
        wa["time_min"]  += time_min
        wa["km_total"]  += dist_km
        wa["day_trimp"][d.isoformat()] += tr
        wa["day_time"][d.isoformat()]  += time_min
        wa["day_km"][d.isoformat()]    += dist_km

        if bucket == "run":
            wa["trimp_run"]      += tr
            wa["time_run_min"]   += time_min
            wa["km_run"]         += dist_km
        elif bucket == "bike":
            wa["trimp_bike"]     += tr
            wa["time_bike_min"]  += time_min
            wa["km_bike"]        += dist_km
        elif bucket == "strength":
            wa["trimp_strength"] += tr
            wa["time_strength_min"] += time_min
        else:
            wa["trimp_other"]    += tr
            wa["time_other_min"] += time_min

        # vezmeme pár názvov tréningov do kontextu
        if len(wa["examples"]) < 6:
            wa["examples"].append({
                "date": d_str, "sport": r.get("sport_type"),
                "name": r.get("name"), "id": r.get("activity_id")
            })

    out_weeks = []
    for wk in sorted(week_agg.keys()):
        start, end = week_bounds(wk)
        wa = week_agg[wk]
        mono_km,  strain_km  = monotony_and_strain(wa["day_km"],   start, wa["km_total"])
        mono_tm,  strain_tm  = monotony_and_strain(wa["day_time"], start, wa["time_min"])
        mono_tr,  strain_tr  = monotony_and_strain(wa["day_trimp"],start, wa["trimp"])

        out_weeks.append({
            "week": wk, "start": start.isoformat(), "end": end.isoformat(),
            "km_total": wa["km_total"], "km_run": wa["km_run"], "km_bike": wa["km_bike"],
            "time_min": wa["time_min"], "time_run_min": wa["time_run_min"], "time_bike_min": wa["time_bike_min"],
            "time_strength_min": wa["time_strength_min"], "time_other_min": wa["time_other_min"],
            "trimp": wa["trimp"], "trimp_run": wa["trimp_run"], "trimp_bike": wa["trimp_bike"],
            "trimp_strength": wa["trimp_strength"], "trimp_other": wa["trimp_other"],
            "monotony": {"km": mono_km, "time": mono_tm, "trimp": mono_tr},
            "strain":   {"km": strain_km, "time": strain_tm, "trimp": strain_tr},
            "examples": wa["examples"],
        })

    return {
        "weeks": out_weeks,
        "hr_used": {"sex": sex, "hr_max": hr_max, "rhr": rhr},
    }

def fetch_recent_recovery(user_id: int, days: int = 21):
    try:
        since = (datetime.utcnow().date() - timedelta(days=days)).isoformat()
        res = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select("date,RHR_bpm,HRV_avg_ms,sleep_duration_min,food_2h_before,caffeine_8h,alcohol_volume_ml")
            .eq("user_id", user_id).gte("date", since).order("date", desc=False)
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

# ========== PUBLIC ENDPOINTS ==========

@router.get("/context/{user_id}")
def coach_context(user_id: int, weeks: int = 6, rec_days: int = 21):
    try:
        weekly = fetch_weekly(user_id, weeks=weeks)
        recovery = fetch_recent_recovery(user_id, days=rec_days)
        notes = fetch_recent_notes(user_id, days=weeks*7)
        return {"success": True, "weekly": weekly, "recovery": recovery, "notes": notes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/{user_id}")
def coach_analyze(
    user_id: int,
    payload: dict = Body(..., example={
        "weeks": 6,
        "goal": "Zlepšiť 10 km čas o 2-3% v najbližších 6-8 týždňoch",
        "primary_sports": ["run","bike","strength"]
    }),
):
    """
    Vráti AI analýzu posledných týždňov + návrh ďalšieho týždňa.
    Ak OPENAI_API_KEY chýba, vráti dummy ukážku (aby FE fungoval).
    """
    try:
        weeks = int(payload.get("weeks", 6))
        goal  = payload.get("goal", "")
        primary_sports = payload.get("primary_sports", ["run","bike","strength"])

        ctx = coach_context(user_id, weeks=weeks)  # reuse
        if not ctx.get("success"):
            raise HTTPException(status_code=500, detail="Context build failed")

        # priprav JSON context pre LLM (orež trochu, nech je to ľahšie)
        weekly = ctx["weekly"]["weeks"][-weeks:]
        hr_used = ctx["weekly"]["hr_used"]
        recovery = ctx.get("recovery", [])[-21:]
        notes = ctx.get("notes", [])[-50:]

        llm_input = {
            "goal": goal,
            "primary_sports": primary_sports,
            "hr_used": hr_used,
            "weekly": weekly,
            "recovery": recovery,
            "notes": notes
        }

        # ============ LLM call (OpenAI) ============
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            # Fallback – dummy output, nech FE žije aj bez kľúča
            return {
                "success": True,
                "model": "dummy",
                "analysis": {
                    "summary": "Posledné týždne vyzerajú konzistentne, mierny nárast TRIMP, nízke monotóny špičky.",
                    "insights": [
                        "Beh: progres v objeme bez prudkých skokov",
                        "Bike: skôr doplnok, drží základnú kapacitu",
                        "Strength: 1-2x týždenne je akurát",
                    ],
                    "red_flags": [],
                    "next_week_plan": {
                        "focus": "build",
                        "run": {
                            "weekly_km_target": 42,
                            "sessions": [
                                {"title":"Intervals 6×800m @ 5k pace", "duration_min": 60, "intensity":"high", "notes":"RPE 8; pauzy 2-3 min easy jog"},
                                {"title":"Tempo 20-25 min @ LT", "duration_min": 55, "intensity":"med-high", "notes":"RPE 7; drž kadenciu"},
                                {"title":"Long run easy", "duration_min": 80, "intensity":"easy", "notes":"RPE 4; kadencia, technika"},
                            ]
                        },
                        "bike": {"weekly_time_target_min": 120, "sessions":[{"title":"Endurance Z2","duration_min":60},{"title":"Endurance Z2","duration_min":60}]},
                        "strength": {"sessions":[{"title":"Full-body","duration_min":45},{"title":"Core+Mobility","duration_min":30}]},
                        "rest_days": ["Fri"]
                    }
                },
                "context_used": llm_input
            }

        # skutočný LLM call
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        system_msg = {
            "role":"system",
            "content":(
                "You are an endurance coaching assistant. "
                "Use the provided training/recovery context to generate a short analysis and a concrete next-week plan. "
                "Prioritize safety, progressive overload, and good recovery. Return STRICT JSON matching the schema."
            )
        }
        user_msg = {
            "role":"user",
            "content":(
                "Context JSON:\n"
                + json.dumps(llm_input, ensure_ascii=False)
                + "\n\nRespond ONLY with a JSON object of shape:\n"
                + json.dumps({
                    "summary":"string",
                    "insights":["string", "..."],
                    "red_flags":[{"type":"string","details":"string","evidence":"string"}],
                    "next_week_plan":{
                        "focus":"base|build|recovery",
                        "run":{"weekly_km_target":"number?","sessions":[{"title":"string","intent?":"string","structure?":"string","duration_min":"number","intensity?":"string","notes?":"string"}]},
                        "bike":{"weekly_time_target_min?":"number","sessions":"array?"},
                        "strength":{"sessions":"array?"},
                        "rest_days":["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
                    }
                }, ensure_ascii=False)
            )
        }

        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type":"json_object"},
            messages=[system_msg, user_msg],
            temperature=0.4,
        )

        content = resp.choices[0].message.content
        parsed = json.loads(content)

        return {"success": True, "model": "gpt-4o-mini", "analysis": parsed, "context_used": llm_input}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))