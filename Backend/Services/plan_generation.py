import os
import json
import re
import time
from typing import Any, Dict, List, Tuple, Optional

from fastapi import HTTPException
from openai import OpenAI

from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S
from shared.training_types import get_session_type_catalog_for_prompt


# ---------- parsing utils ----------
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
    """
    Return (parsed_dict or None, cleaned_text, raw_text).
    Nikdy neháče – keď sa nedá parsovať, parsed je None, ale vrátime cleaned aj raw.
    """
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


# ---------- session_type helpers (fallback na Easy) ----------


# ---------- session_type helpers (fallback na Easy) ----------

def _canonical_sport(sport: Any) -> str:
    """
    Normalizuje názov športu:
    - bike / cycling -> ride
    - gym -> strength
    - run / ride / strength / swim / other -> ako sú
    - prázdny -> run (fallback)
    - čokoľvek iné -> other
    """
    s = (str(sport or "")).lower().strip()

    if not s:
        # keď AI nič neposlalo, fallback na run
        return "run"

    if s in ("bike", "cycling"):
        return "ride"
    if s in ("gym",):
        return "strength"

    if s in ("run", "ride", "strength", "swim", "other"):
        return s

    # exotické veci (yoga, walk, hike, ...) nech označíme ako "other"
    return "other"


def _default_session_type_for_sport(sport: str) -> str:
    """
    Default session_type keď AI nič nedá.
    """
    s = _canonical_sport(sport)

    if s == "ride":
        return "ride_easy_endurance"
    if s == "strength":
        return "strength_full_body"
    if s == "swim":
        return "swim_easy_technique"
    if s == "other":
        # napr. Rest Day alebo voľná aktivita – v katalógu nemusí byť
        return "rest_day"

    # default – beh
    return "run_easy"


def _ensure_session_types(next10: Any, default_sport: str) -> List[dict]:
    """
    Prejde next_10_days a:
    - normalizuje sport (run/ride/strength/swim),
    - doplní session_type, ak chýba (podľa športu),
    - nechá session_type na pokoji, ak už AI niečo rozumné poslala.
    """
    if not isinstance(next10, list):
        return []

    default_sport = _canonical_sport(default_sport)

    for d in next10:
        if not isinstance(d, dict):
            continue
        sessions = d.get("sessions")
        if not isinstance(sessions, list):
            continue
        for s in sessions:
            if not isinstance(s, dict):
                continue

            sport = s.get("sport")
            sport = _canonical_sport(sport or default_sport)
            s["sport"] = sport  # normalizovaný názov

            # session_type: vezmi existujúce (session_type/type/kind) alebo fallback
            st = s.get("session_type") or s.get("type") or s.get("kind")
            if not isinstance(st, str) or not st.strip():
                st = _default_session_type_for_sport(sport)
            s["session_type"] = st

    return next10


# ---------- normalize (aliasy, bez dopĺňania obsahu) ----------


def normalize_plan_json(
    obj: dict,
    plan_start_iso: Optional[str] = None,
    default_sport: str = "run",
) -> dict:
    """
    Normalizuje AI výstup:
    - názvy kľúčov,
    - doplní meta,
    - *post-process* next_10_days, aby tam vždy bol sport + session_type.
    """
    if not isinstance(obj, dict):
        # toto je interná chyba, nie AI validácia
        raise ValueError("AI output is not a JSON object")

    raw_next10 = obj.get("next_10_days") or []
    next10 = _ensure_session_types(raw_next10, default_sport=default_sport)

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


# ---------- coach voice helpers ----------


def _bucket_level(val: Any) -> str:
    """low / medium / high z 0–100 slidera."""
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
    """
    Preloží coach_voice + coach_tone (emoji/praise/explain/challenge)
    na krátky textový popis štýlu, ktorý dáme do promptu.
    """
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

    # emoji / ľudskosť
    if emoji_level == "low":
        extras.append("Avoid emojis and slang; keep language clean and professional.")
    elif emoji_level == "high":
        extras.append("Use a friendly, conversational tone with occasional emojis.")
    else:
        extras.append("Tone can be human and friendly, but do not overuse emojis.")

    # pochvala
    if praise_level == "low":
        extras.append(
            "Praise only when there is a really strong reason; be rather strict."
        )
    elif praise_level == "high":
        extras.append(
            "Regularly highlight wins and positive trends to keep motivation high."
        )
    else:
        extras.append("Use praise in a balanced way when it is deserved.")

    # vysvetľovanie
    if explain_level == "low":
        extras.append("Keep explanations short and only when necessary.")
    elif explain_level == "high":
        extras.append(
            "Briefly explain *why* important decisions are made (zones, structure, intensity)."
        )
    else:
        extras.append("Explain key points, but do not go into excessive detail.")

    # challenge
    if challenge_level == "low":
        extras.append(
            "Be cautious with pushing intensity; emphasize safety and recovery."
        )
    elif challenge_level == "high":
        extras.append(
            "Do not hesitate to challenge the athlete and suggest ambitious, but safe, workloads."
        )
    else:
        extras.append(
            "Balance between comfort and challenge; push gently, not aggressively."
        )

    return base + " " + " ".join(extras)


# ---------- LLM call ----------


def _llm_models_priority(explicit_model: Optional[str]) -> List[str]:
    env_list = os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini")
    env_models = [m.strip() for m in env_list.split(",") if m.strip()]
    if explicit_model and explicit_model not in env_models:
        return [explicit_model] + env_models
    return env_models if not explicit_model else [explicit_model] + env_models


def _build_prompts(context_payload: dict, schema_text: str) -> Tuple[str, str]:
    # koľko týždňov rieši plán – len na počet riadkov v weeks_overview
    weeks = int(context_payload.get("weeks") or 6)

    # textový popis coach voice
    voice_desc = _describe_coach_voice(context_payload.get("voice") or {})

    # ===== športy & prefs =====
    primary_sports_raw = context_payload.get("primary_sports") or []
    primary_sports = [
        _canonical_sport(s) for s in primary_sports_raw
        if isinstance(s, str) and s.strip()
    ]

    # ak nie sú zadané, fallback – ale nech je to explicitné
    if not primary_sports:
        main = context_payload.get("main_sport")
        if isinstance(main, str) and main.strip():
            primary_sports = [_canonical_sport(main)]
        else:
            primary_sports = ["run"]

    allowed_sports_set = {s for s in primary_sports if s in ("run", "ride", "strength", "swim", "other")}
    if not allowed_sports_set:
        allowed_sports_set = {"run"}

    allowed_sports_str = ", ".join(sorted(allowed_sports_set))

    intensity_model = (context_payload.get("intensity_model") or "").lower().strip()
    prefs_block = context_payload.get("prefs") or {}

    # session_type katalóg zo shared/training_types.json
    session_catalog = get_session_type_catalog_for_prompt()
    session_catalog_txt = json.dumps(session_catalog, ensure_ascii=False)

    wu_cd_required = bool(context_payload.get("rules", {}).get("wu_cd_detail", False))

    hard: List[str] = [
        # DÁTOVÁ ŠTRUKTÚRA
        "Produce `next_10_days` for a continuous block of dates starting from `plan_start_date`.",
        "`next_10_days` MUST be an ARRAY with between 7 and 10 items (do NOT return a single object).",
        "Do NOT include any `first_10_days` key in the output.",
        "Each day in `next_10_days` MUST include non-empty `sessions`.",
        'If a day is rest: include one session {"title":"Rest Day","sport":"other","duration_min":0}.',

        # ŠPORTY – STRICT podľa používateľa
        f"Allowed sports for planned sessions are STRICTLY limited to: {allowed_sports_str}.",
        "Do NOT propose sessions in any other sport, even if such sports appear in historical training data.",
        "Use historical weekly data ONLY to estimate fitness, fatigue and recent volume – NOT to change the sport mix away from the requested primary sports.",
        "For each session, set `sport` to one of the allowed sports only.",

        # HR / ZÓNY
        "For RUN sessions provide `target_hr_bpm_range:[low,high]` (bpm).",
        "HR ranges MUST be consistent with the zones. If zones are not provided, use thresholds provided in the `zones` and `thresholds` fields of the context JSON.",
        "Easy and recovery sessions MUST stay entirely in low-intensity zones (Z1–Z2 according to the context zones).",
        "Do NOT mark a session as easy or recovery if its HR range is around threshold or in high zones.",
        "Pace must be a string in `min/km`; power in watts.",

        # next_week_plan
        "`next_week_plan` is optional and may be null.",
        "Output JSON only.",

        # STRENGTH
        "Strength sessions MUST include `exercises` array (3–8 items). Each exercise: {name, sets, reps OR seconds, rest_sec}. Use only equipment that the athlete has available (see context).",

        # weeks_overview kompaktný
        f"Include `weeks_overview` as an array of up to {min(weeks, 12)} short strings.",
        "Each item in `weeks_overview` should summarize one upcoming training week (e.g. 'Week 1: 3 runs, 1 strength, focus on Z2 volume').",
        "Keep every `weeks_overview` item <= 120 characters and very concise.",

        # SESSION TYPE – naviazané na shared katalóg
        "Each session MUST include `session_type` (string).",
        "For each session, `session_type` MUST be chosen from the session type catalog provided (per sport).",
        "Do NOT invent new `session_type` codes. Only use keys from that catalog.",
        "If you are unsure which `session_type` to use, choose an easy/aerobic one for that sport "
        "('run_easy' for running, 'ride_easy_endurance' for cycling, "
        "'strength_full_body' for strength, 'swim_easy_technique' for swimming).",

        # PREFS
        "Respect the user's preferences in the `prefs` block (days, number of sessions, which sports, which day off and for long run/ride) as the PRIMARY source of the weekly structure.",
        "Historical training is secondary: adjust volume and intensity based on history, but do not override the requested sports or days from `prefs`.",

        # štýl trénera
        "Apply the specified coaching style and tone to all textual fields (`summary`, `insights`, `notes`).",
    ]

    # INTENSITY MODEL – špecifické pravidlá
    if intensity_model == "polarized":
        hard += [
            "The intensity model is POLARIZED (80/20).",
            "At least ~80% of total planned training time must be in low-intensity zones (Z1–Z2).",
            "At most ~20% of total planned training time may be in higher-intensity zones (Z3 and above).",
            "Do NOT create a week where most sessions are threshold/VO2 or all near maximal HR.",
            "Separate hard/high-intensity days with at least one low-intensity or rest day whenever possible.",
        ]
    elif intensity_model == "pyramidal":
        hard += [
            "The intensity model is PYRAMIDAL.",
            "Most of the total planned training time must still be in low-intensity zones (Z1–Z2).",
            "A smaller, but noticeable portion of time can be in moderate intensity (around tempo/threshold), and only a small part in very high intensity (VO2 or above).",
            "Avoid planning many high-intensity days back-to-back; distribute intensity across the week.",
        ]
    else:
        hard += [
            "Use a balanced intensity distribution that respects the zones from the context.",
            "Avoid making almost all sessions high-intensity or near maximal HR.",
        ]

    if wu_cd_required:
        hard += [
            "For RUN sessions include `structure` with warmup (5–15 min), at least one `main` block, and cooldown (5–10 min).",
            "HR targets can be top-level or inside structure.*.target.hr.",
        ]

    system_txt = (
        "You are an endurance coaching assistant. "
        "Always follow the user's preferences and physiological data strictly. "
        "Return one valid JSON object only. No prose, no code fences."
    )

    user_txt = (
        "Context JSON (this contains the ground truth for zones, thresholds, preferences and history):\n"
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
    """
    Z kontextu vyberie “hlavný” šport na fallback (ak AI nedá sport).
    """
    main = ctx.get("main_sport")
    if isinstance(main, str) and main:
        return _canonical_sport(main)

    prim = ctx.get("primary_sports")
    if isinstance(prim, list) and prim:
        return _canonical_sport(prim[0])

    # fallback
    return "run"


def generate_plan_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
    loose: bool = False,  # kvôli spätnej kompatibilite – aktuálne ignorované
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
  "target_pace_min_per_km"?: string | null,
  "target_hr_bpm_range"?: [number, number] | null,
  "target_power_watts"?: number | null,
  "zone"?: string | null,
  "structure"?: {
    "warmup"?: { "minutes"?: number, "notes"?: string, "target"?: { "hr"?: [number,number], "pace"?: string, "power"?: number } },
    "main"?:   ({ "reps"?: number, "work_min"?: number, "recover_min"?: number, "target"?: { "hr"?: [number,number], "pace"?: string, "power"?: number } }[]),
    "cooldown"?: { "minutes"?: number, "notes"?: string, "target"?: { "hr"?: [number,number], "pace"?: string, "power"?: number } }
  },
  "exercises"?: { "name": string, "sets": number, "reps"?: number, "seconds"?: number, "rest_sec"?: number }[]
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
