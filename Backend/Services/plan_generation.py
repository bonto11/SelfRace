# Services/plan_generation
import os
import json
import re
import time
from typing import Any, Dict, List, Tuple, Optional, Sequence, cast

from fastapi import HTTPException
from openai import OpenAI

from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S
from shared.training_types import get_session_type_catalog_for_prompt


# =========================
# Parsing utils
# =========================

CODEFENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _strip_codefence(s: str) -> str:
    m = CODEFENCE_RE.search(s)
    return m.group(1).strip() if m else s.strip()


def _find_outer_json_block(s: str) -> str:
    start = s.find("{")
    if start < 0:
        return s
    depth = 0
    for i in range(start, len(s)):
        ch = s[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
    end = s.rfind("}")
    return s[start : end + 1] if end > start else s


def _sanitize_json_guess(s: str) -> str:
    s = s.replace("“", '"').replace("”", '"').replace("’", "'")
    s = _strip_codefence(s)
    s = _find_outer_json_block(s)
    s = re.sub(r",\s*([}\]])", r"\1", s)  # trailing commas
    s = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", s)  # bad backslashes
    s = re.sub(r"\bNaN\b|\bInfinity\b|-Infinity", "null", s)
    return s.strip()


def _parse_ai_json(raw: str) -> Tuple[Optional[dict], str, str]:
    """Return (parsed_dict or None, cleaned_text, raw_text)."""
    if not raw:
        return None, "", ""
    try:
        return json.loads(raw.strip()), raw.strip(), raw.strip()
    except Exception:
        cleaned = _sanitize_json_guess(raw or "")
        try:
            return json.loads(cleaned), cleaned, raw
        except Exception:
            return None, cleaned, raw


# =========================
# Helpers: types & coercion
# =========================

Bounds2 = Tuple[int, int]


def _to_min(v: Any) -> Optional[int]:
    """Best-effort prevod na celé minúty (alebo None)."""
    if v is None:
        return None
    try:
        if isinstance(v, (int, float)):
            return int(round(float(v)))
        if isinstance(v, str) and v.strip() != "":
            return int(round(float(v)))
    except Exception:
        return None
    return None


# =========================
# Sport & session types
# =========================

def _canonical_sport(sport: Any) -> str:
    """
    Normalizuje názov športu:
      - bike/cycling -> ride
      - gym -> strength
      - allowed: run/ride/strength/swim/other
      - prázdny -> run
      - iné -> other
    """
    s = (str(sport or "")).lower().strip()
    if not s:
        return "run"
    if s in ("bike", "cycling"):
        return "ride"
    if s in ("gym",):
        return "strength"
    if s in ("run", "ride", "strength", "swim", "other"):
        return s
    return "other"


def _default_session_type_for_sport(sport: str) -> str:
    s = _canonical_sport(sport)
    if s == "ride":
        return "ride_easy_endurance"
    if s == "strength":
        return "strength_full_body"
    if s == "swim":
        return "swim_easy_technique"
    if s == "other":
        return "rest_day"
    return "run_easy"


# =========================
# Zones + enrichment (RUN)
# =========================

def _extract_zone_bounds_from_context(z_ctx: Any) -> Optional[Dict[str, int]]:
    """
    Podporuje:
      - priamo dict so z1_min..z5_max
      - dict per sport: {"running": {...}}
      - list dictov s kľúčom sport
    Vracia dict s int hodnotami alebo None keď chýbajú Z1/Z2.
    """
    if not z_ctx:
        return None

    src: Optional[dict] = None

    if isinstance(z_ctx, dict) and ("z1_min" in z_ctx or "z2_min" in z_ctx):
        src = z_ctx
    elif isinstance(z_ctx, dict):
        for key in ("running", "run"):
            v = z_ctx.get(key)
            if isinstance(v, dict):
                src = v
                break
        if src is None:
            for v in z_ctx.values():
                if isinstance(v, dict):
                    src = v
                    break
    elif isinstance(z_ctx, list):
        for r in z_ctx:
            if not isinstance(r, dict):
                continue
            sport = str(r.get("sport") or "").lower()
            if sport in ("run", "running"):
                src = r
                break
        if src is None:
            for r in z_ctx:
                if isinstance(r, dict):
                    src = r
                    break

    if not isinstance(src, dict):
        return None

    def n(key: str) -> int:
        v = src.get(key)
        if v is None:
            return 0
        try:
            return int(round(float(v)))
        except Exception:
            return 0

    z = {
        "hr_max": n("hr_max"),
        "z1_min": n("z1_min"),
        "z1_max": n("z1_max"),
        "z2_min": n("z2_min"),
        "z2_max": n("z2_max"),
        "z3_min": n("z3_min"),
        "z3_max": n("z3_max"),
        "z4_min": n("z4_min"),
        "z4_max": n("z4_max"),
        "z5_min": n("z5_min"),
        "z5_max": n("z5_max"),
    }

    if (z["z1_min"] <= 0 or z["z1_max"] <= 0 or
        z["z2_min"] <= 0 or z["z2_max"] <= 0):
        return None
    return z


def _infer_intensity_tag(session_type: str, sport: str, duration_min: Any = None) -> str:
    """Jednoduchá mapa -> 'off'/'low'/'moderate'/'moderate-high'/'high'."""
    st = (session_type or "").lower()
    sp = (sport or "").lower()
    dur_val = _to_min(duration_min)

    if "rest" in st or (dur_val is not None and dur_val <= 0):
        return "off"

    if sp == "strength":
        if "recovery" in st or "mobility" in st:
            return "low"
        if "hypertrophy" in st or "heavy" in st:
            return "high"
        return "moderate"

    if any(k in st for k in ["recovery", "easy", "aerobic", "base", "long"]):
        return "low"
    if any(k in st for k in ["tempo", "threshold"]):
        return "moderate-high"
    if any(k in st for k in ["vo2", "interval", "repeats", "hills", "speed"]):
        return "high"
    return "moderate"


# ---------- WU/CD defaults from catalog ----------

def _fetch_wu_cd_defaults(session_type: str, sport: str, catalog: Dict[str, Any]):
    s = _canonical_sport(sport)
    node = {}
    try:
        node = (catalog.get(s) or {}).get(session_type) or {}
    except Exception:
        node = {}
    w = node.get("wu_min", node.get("warmup_min"))
    c = node.get("cd_min", node.get("cooldown_min"))
    return _to_min(w), _to_min(c)


def _apply_wu_cd_defaults_generic(
    s: Dict[str, Any],
    wu_min: Optional[int],
    cd_min: Optional[int],
    *,
    hr_for_wu_cd: Optional[Sequence[int]] = None,
) -> None:
    """
    Ak sú minúty zadané, pridá warmup/cooldown bloky.
    Nezasahuje, ak už blok existuje.
    """
    if wu_min is None and cd_min is None:
        return

    struct = s.get("structure")
    if not isinstance(struct, dict):
        struct = {}
        s["structure"] = struct

    hr_pair: Optional[Bounds2] = None
    if isinstance(hr_for_wu_cd, Sequence) and len(hr_for_wu_cd) == 2:
        try:
            hr_pair = (int(hr_for_wu_cd[0]), int(hr_for_wu_cd[1]))
        except Exception:
            hr_pair = None

    if wu_min is not None and not isinstance(struct.get("warmup"), dict):
        blk: Dict[str, Any] = {"minutes": int(wu_min)}
        if hr_pair is not None:
            blk["target"] = {"hr": [hr_pair[0], hr_pair[1]]}
        struct["warmup"] = blk

    if cd_min is not None and not isinstance(struct.get("cooldown"), dict):
        blk: Dict[str, Any] = {"minutes": int(cd_min)}
        if hr_pair is not None:
            blk["target"] = {"hr": [hr_pair[0], hr_pair[1]]}
        struct["cooldown"] = blk


def _enrich_run_session_from_zones(
    s: Dict[str, Any],
    z: Dict[str, int],
    *,
    wu_min: Optional[int] = None,
    cd_min: Optional[int] = None,
) -> None:
    """
    RUN: doplní
      - target_hr_bpm_range (Z1 pre recovery, Z2 pre easy/long)
      - hr_zone_label ("Z1"/"Z2")
      - WU/CD bloky podľa katalógu (ak chýbajú) s HR hranami (Z1..Z2)
    """
    if (s.get("sport") or "").lower() != "run":
        return

    st = str(s.get("session_type") or "").lower()
    dur_min = _to_min(s.get("duration_min")) or 0

    z1_min, z1_max = int(z.get("z1_min", 0)), int(z.get("z1_max", 0))
    z2_min, z2_max = int(z.get("z2_min", 0)), int(z.get("z2_max", 0))
    if min(z1_min, z1_max, z2_min, z2_max) <= 0:
        return

    is_recovery = "recovery" in st
    # easy aj long idú do Z2
    if is_recovery:
        main_lo, main_hi = z1_min, z1_max
        s.setdefault("hr_zone_label", "Z1")
    else:
        main_lo, main_hi = z2_min, z2_max
        s.setdefault("hr_zone_label", "Z2")

    if not isinstance(s.get("target_hr_bpm_range"), list):
        s["target_hr_bpm_range"] = [int(main_lo), int(main_hi)]

    # WU/CD (iba ak máme definované minúty z katalógu)
    if (wu_min is not None) or (cd_min is not None):
        _apply_wu_cd_defaults_generic(
            s,
            wu_min,
            cd_min,
            hr_for_wu_cd=(z1_min, z2_min),
        )


# =========================
# Normalize AI output
# =========================

def _ensure_session_types(
    next10: Any,
    default_sport: str,
    zones: Optional[Dict[str, int]] = None,
    rules: Optional[dict] = None,  # nechávame pre budúcnosť (napr. constraints)
) -> List[dict]:
    """
    - Normalizuje sport a session_type
    - Pridá intensity tag
    - Pre RUN doplní HR + WU/CD zo session katalógu + zón
    """
    if not isinstance(next10, list):
        return []

    default_sport = _canonical_sport(default_sport)
    catalog = get_session_type_catalog_for_prompt()
    if not isinstance(catalog, dict):
        catalog = {}

    for d in next10:
        if not isinstance(d, dict):
            continue
        sessions = d.get("sessions")
        if not isinstance(sessions, list):
            continue

        for s in sessions:
            if not isinstance(s, dict):
                continue

            sport = _canonical_sport(s.get("sport") or default_sport)
            s["sport"] = sport

            st = s.get("session_type") or s.get("type") or s.get("kind")
            if not isinstance(st, str) or not st.strip():
                st = _default_session_type_for_sport(sport)
            st = st.strip()
            s["session_type"] = st

            # vždy nastav intenzitu
            s["intensity"] = _infer_intensity_tag(st, sport, s.get("duration_min"))

            # RUN enrichment: HR + (voliteľne) WU/CD z katalógu
            if sport == "run" and isinstance(zones, dict):
                wu_min, cd_min = _fetch_wu_cd_defaults(st, sport, catalog)
                _enrich_run_session_from_zones(s, zones, wu_min=wu_min, cd_min=cd_min)

    return cast(List[dict], next10)


def normalize_plan_json(
    obj: dict,
    plan_start_iso: Optional[str] = None,
    default_sport: str = "run",
    context: Optional[dict] = None,
) -> dict:
    """
    Normalizuje AI výstup:
      - summary/insights/red_flags/weeks_overview
      - next_10_days: doplní sport + session_type + intensity
      - RUN: doplní HR + WU/CD štruktúru podľa zón + katalógu
    """
    if not isinstance(obj, dict):
        raise ValueError("AI output is not a JSON object")

    ctx_dict = context or {}
    ctx_zones = ctx_dict.get("zones")

    zone_bounds = _extract_zone_bounds_from_context(ctx_zones)

    raw_next10 = obj.get("next_10_days") or []
    next10 = _ensure_session_types(
        raw_next10,
        default_sport=default_sport,
        zones=zone_bounds,
        rules=context.get("rules") if isinstance(context, dict) else None,
    )

    return {
        "summary": obj.get("summary") or "No summary.",
        "insights": obj.get("insights") or [],
        "red_flags": obj.get("red_flags") or [],
        "weeks_overview": obj.get("weeks_overview") or obj.get("outline_10w") or [],
        "next_10_days": next10,
        "next_week_plan": (
            obj.get("next_week_plan")
            if obj.get("next_week_plan") not in ([], {})
            else None
        ),
        "_meta": {
            "plan_source": "ai",
            "week_start": plan_start_iso or None,
            "next10_start": plan_start_iso or None,
        },
    }


# =========================
# Coach voice helpers
# =========================

def _bucket_level(val: Any) -> str:
    if val is None:
        return "medium"
    try:
        v = float(val)
    except Exception:
        return "medium"
    if v <= 30:
        return "low"
    if v >= 70:
        return "high"
    return "medium"


def _describe_coach_voice(voice_block: Optional[dict]) -> str:
    vb = voice_block or {}
    voice_name = (vb.get("coach_voice") or "neutral").lower()
    tone = vb.get("coach_tone") or {}

    emoji_level = _bucket_level(tone.get("emoji"))
    praise_level = _bucket_level(tone.get("praise"))
    explain_level = _bucket_level(tone.get("explain"))
    challenge_level = _bucket_level(tone.get("challenge"))

    voice_map = {
        "realist": "Be direct and fact-focused. Do not sugar-coat, but stay respectful and constructive.",
        "motivator": "Be energetic and encouraging. Highlight progress and help the athlete feel confident.",
        "supportive": "Be empathetic and reassuring. Focus on encouragement and long-term consistency.",
        "drill_sergeant": "Be very demanding and strict, but not insulting. Push the athlete strongly toward their limits.",
        "neutral": "Use a balanced, professional tone without extremes.",
    }
    base = voice_map.get(voice_name, voice_map["neutral"])

    extras: List[str] = []
    if emoji_level == "low":
        extras.append("Avoid emojis and slang; keep language clean and professional.")
    elif emoji_level == "high":
        extras.append("Use a friendly, conversational tone with occasional emojis.")
    else:
        extras.append("Tone can be human and friendly, but do not overuse emojis.")

    if praise_level == "low":
        extras.append("Praise only when there is a really strong reason; be rather strict.")
    elif praise_level == "high":
        extras.append("Regularly highlight wins and positive trends to keep motivation high.")
    else:
        extras.append("Use praise in a balanced way when it is deserved.")

    if explain_level == "low":
        extras.append("Keep explanations short and only when necessary.")
    elif explain_level == "high":
        extras.append("Briefly explain *why* important decisions are made (zones, structure, intensity).")
    else:
        extras.append("Explain key points, but do not go into excessive detail.")

    if challenge_level == "low":
        extras.append("Be cautious with pushing intensity; emphasize safety and recovery.")
    elif challenge_level == "high":
        extras.append("Do not hesitate to challenge the athlete and suggest ambitious, but safe, workloads.")
    else:
        extras.append("Balance between comfort and challenge; push gently, not aggressively.")

    return base + " " + " ".join(extras)


# =========================
# LLM call
# =========================

def _llm_models_priority(explicit_model: Optional[str]) -> List[str]:
    env_list = os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini")
    env_models = [m.strip() for m in env_list.split(",") if m.strip()]
    if explicit_model and explicit_model not in env_models:
        return [explicit_model] + env_models
    return env_models if not explicit_model else [explicit_model] + env_models


def _build_prompts(context_payload: dict, schema_text: str) -> Tuple[str, str]:
    weeks = int(context_payload.get("weeks") or 6)
    voice_desc = _describe_coach_voice(context_payload.get("voice") or {})

    primary_sports_raw = context_payload.get("primary_sports") or []
    primary_sports = [
        _canonical_sport(s)
        for s in primary_sports_raw
        if isinstance(s, str) and s.strip()
    ]
    if not primary_sports:
        main = context_payload.get("main_sport")
        if isinstance(main, str) and main.strip():
            primary_sports = [_canonical_sport(main)]
        else:
            primary_sports = ["run"]

    allowed_sports_set = {
        s for s in primary_sports if s in ("run", "ride", "strength", "swim", "other")
    } or {"run"}
    allowed_sports_str = ", ".join(sorted(allowed_sports_set))

    intensity_model = (context_payload.get("intensity_model") or "").lower().strip()

    # katalog do promptu (pre session_type výber)
    session_catalog = get_session_type_catalog_for_prompt()
    session_catalog_txt = json.dumps(session_catalog, ensure_ascii=False)

    hard: List[str] = [
        # DÁTOVÁ ŠTRUKTÚRA
        "Produce `next_10_days` for a continuous block of dates starting from `plan_start_date`.",
        "`next_10_days` MUST be an ARRAY with between 7 and 10 items (do NOT return a single object).",
        "Each day in `next_10_days` MUST include non-empty `sessions`.",
        'If a day is rest: include one session {"title":"Rest Day","sport":"other","duration_min":0}.',

        # ŠPORTY – STRICT podľa používateľa
        f"Allowed sports for planned sessions are STRICTLY limited to: {allowed_sports_str}.",
        "Do NOT propose sessions in any other sport, even if such sports appear in historical training data.",
        "Use historical weekly data ONLY to estimate fitness, fatigue and recent volume – NOT to change the sport mix away from the requested primary sports.",
        "For each session, set `sport` to one of the allowed sports only.",

        # INTENZITA, ZÓNY – len interné rozhodovanie
        "Use heart-rate zones and thresholds from the context ONLY to decide how hard sessions should be.",
        "Do NOT output any explicit HR ranges, zones, pace targets or power targets in the plan.",
        "The plan output should only contain high-level sessions (type and duration), not detailed physiological targets.",

        # next_week_plan
        "`next_week_plan` is optional and may be null.",
        "Output JSON only.",

        # STRENGTH
        "Strength sessions MUST include `exercises` array (3–8 items). Each exercise: {name, sets, reps OR seconds, rest_sec}. Use only equipment that the athlete has available (see context).",

        # weeks_overview
        f"Include `weeks_overview` as an array of up to {min(weeks, 12)} short strings.",
        "Each item in `weeks_overview` should summarize one upcoming training week (e.g. 'Week 1: 3 runs, 1 strength, focus on Z2 volume').",
        "Keep every `weeks_overview` item <= 120 characters and very concise.",

        # SESSION TYPE – via katalog
        "Each session MUST include `session_type` (string).",
        "For each session, `session_type` MUST be chosen from the provided session type catalog (per sport).",
        "Do NOT invent new `session_type` codes.",
        "If unsure, choose an easy/aerobic type for that sport.",
    ]

    # HARD CONSTRAINTS (days off a single-session limit) – čítame z context_payload.hard_constraints
    hc = context_payload.get("hard_constraints") or {}
    if isinstance(hc, dict):
        ban = hc.get("no_sessions_on") or []
        if isinstance(ban, list) and ban:
            hard += [
                "Do NOT schedule any training session on the following dates (these are off/occupied days):",
                ", ".join([str(x)[:10] for x in ban]),
                "On those dates, include only a 'Rest Day' stub if needed.",
            ]
        if hc.get("max_one_session_per_day"):
            hard += ["Plan at most ONE session per day."]

    # Intensity model
    if intensity_model == "polarized":
        hard += [
            "The intensity model is POLARIZED (80/20).",
            "At least ~80% of total planned training time must be in low-intensity zones (Z1–Z2).",
            "At most ~20% in Z3+.",
            "Separate hard days with at least one low or rest day whenever possible.",
        ]
    elif intensity_model == "pyramidal":
        hard += [
            "The intensity model is PYRAMIDAL.",
            "Most time remains Z1–Z2, a smaller part around tempo/threshold, and only a small part VO2+.",
            "Avoid clustering many high-intensity days back-to-back.",
        ]
    else:
        hard += [
            "Use a balanced intensity distribution and avoid making almost all sessions high-intensity.",
        ]

    system_txt = (
        "You are an endurance coaching assistant. "
        "Always follow the user's preferences and physiological data strictly. "
        "Return one valid JSON object only. No prose, no code fences."
    )

    user_txt = (
        "Context JSON (ground truth for zones, thresholds, preferences and history):\n"
        + json.dumps(context_payload, ensure_ascii=False)
        + "\n\nSession type catalog (per sport):\n"
        + session_catalog_txt
        + "\n\nCoaching style and tone:\n"
        + voice_desc
        + "\n\nSchema (instructional):\n"
        + schema_text
        + "\n\nHard requirements (all must be satisfied):\n- "
        + "\n- ".join(hard)
    )
    return system_txt, user_txt


def _call_openai(
    client: OpenAI, model: str, system_txt: str, user_txt: str, max_tokens: int
) -> str:
    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_txt},
            {"role": "user", "content": user_txt},
        ],
        "temperature": 0.2,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    cc = client.chat.completions.create(**kwargs)
    return getattr(cc.choices[0].message, "content", "").strip()


def _extract_start_date(ctx: dict) -> Optional[str]:
    sd = ctx.get("plan_start_date") or ctx.get("start_date")
    if isinstance(sd, str) and sd:
        return sd
    g = ctx.get("goal")
    if isinstance(g, dict):
        sd2 = g.get("start_date")
        if isinstance(sd2, str) and sd2:
            return sd2
    return None


def _default_sport_from_context(ctx: dict) -> str:
    main = ctx.get("main_sport")
    if isinstance(main, str) and main:
        return _canonical_sport(main)
    prim = ctx.get("primary_sports")
    if isinstance(prim, list) and prim:
        return _canonical_sport(prim[0])
    return "run"


def generate_plan_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
    loose: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    Vždy vráti (parsed_or_fallback, debug_trace). Nikdy neháče HTTPException (okrem chýbajúceho API key).
    Keď AI zlyhá, parsed bude minimálny fallback + debug obsahuje raw/cleaned/trace.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [3000, 2500, 2000]

    schema_text = """
{
  "summary": string,
  "insights": string[],
  "red_flags": { "type": string, "details"?: string, "evidence"?: string }[],
  "weeks_overview"?: string[],
  "next_week_plan"?: { ... } | null,
  "next_10_days": { "day": "YYYY-MM-DD", "sessions": Session[] }[]
}
Where Session = {
  "title": string,
  "sport": "run" | "ride" | "strength" | "other" | "swim",
  "duration_min": number,
  "intensity"?: string | null,
  "session_type"?: string,
  "notes"?: string | null,
  "structure"?: {
    "main_part"?: {
      "reps"?: number,
      "work_min"?: number,
      "recover_min"?: number,
      "notes"?: string
    }[]
  },
  "exercises"?: {
    "name": string,
    "sets": number,
    "reps"?: number,
    "seconds"?: number,
    "rest_sec"?: number
  }[]
}
""".strip()

    system_txt, user_txt = _build_prompts(context_payload, schema_text)

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    default_sport = _default_sport_from_context(context_payload)

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]
            try:
                raw = _call_openai(client, m, system_txt, user_txt, budget)
                dur_ms = int((time.time() - started) * 1000)
                parsed_dict, cleaned, raw_keep = _parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": parsed_dict is not None,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:800]
                        + ("…[truncated]" if len(raw) > 800 else ""),
                    }
                )

                if not parsed_dict:
                    last_err = "AI returned invalid JSON"
                    continue

                start_date = _extract_start_date(context_payload)
                parsed = normalize_plan_json(
                    parsed_dict,
                    plan_start_iso=start_date,
                    default_sport=default_sport,
                    context=context_payload,
                )

                if debug_raw:
                    trace["raw"] = raw_keep
                    trace["cleaned"] = cleaned
                    trace["ok_model"] = m

                return parsed, trace

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": False,
                        "duration_ms": dur_ms,
                        "error": last_err,
                    }
                )
                time.sleep(0.5 * attempt)
                continue

    # fallback – AI sa nepodarilo
    fallback = {
        "summary": "AI generation failed.",
        "insights": [],
        "red_flags": [{"type": "error", "details": last_err or "unknown"}],
        "weeks_overview": [],
        "next_10_days": [],
        "next_week_plan": None,
        "_meta": {"plan_source": "ai", "ok": False},
    }
    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
    return fallback, trace