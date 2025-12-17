# Routes_AI/analyze_athlete_state.py
from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from openai import OpenAI

from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S


# ---------- parsing utils (zjednodušené) ----------

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


def _llm_models_priority(explicit_model: Optional[str]) -> List[str]:
    env_list = os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini")
    env_models = [m.strip() for m in env_list.split(",") if m.strip()]
    if explicit_model and explicit_model not in env_models:
        return [explicit_model] + env_models
    return env_models if not explicit_model else [explicit_model] + env_models


# ---------- prompt builder ----------


def _build_prompts_for_analyze(context_payload: dict) -> Tuple[str, str]:
    """
    context_payload = CoachAnalyzeInput (to, čo skladáš v build_input_from_db)

    OČAKÁVANÉ BLOKY (dôležité pre LLM):
    - user            – profil, vek, tréningová história...
    - zones           – Z1–Z5 podľa LTHR/HRmax
    - thresholds      – laktát / FTP, hlavne running LT2
    - bests           – osobáky, najlepšie výkony
    - recent_load     – objem a intenzita posledných týždňov
    - recovery        – HRV, RHR, subjektívna únava...
    - prefs           – ciele, športy, days_off, atď. (vrátane prefs.volume)
    - external_events – futbal, skupinové tréningy, krúžky, atď. ktoré treba brať ako fix / vysokú prioritu
    - active_plan     – ak už existuje plán, dá sa z neho odhadnúť záťaž
    """
    prefs = context_payload.get("prefs") or {}
    weeks = int(prefs.get("weeks") or 4)
    main_sport = prefs.get("main_sport") or "run"

    system_txt = (
        "You are an endurance coaching assistant for runners and multisport athletes. "
        "You receive a structured JSON context about an athlete (profile, zones, thresholds, PBs, "
        "recent load, recovery, preferences including training volume preferences, and external events). "
        "External events are non-editable sessions like football matches, group runs or other fixed trainings "
        "that already create load and need to be considered when judging fatigue and safe volume. "
        "Your task is to analyze the current training state and return a SINGLE valid JSON object "
        "describing the athlete's current fitness, fatigue, risks and recommended block focus. "
        "Do NOT output any prose or code fences, only JSON."
    )

    # UPDATED – volume + external_events vysvetlené v inštrukciách
    schema_text = """
{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp in UTC",
  "model": "string (your model name or 'Trainalyze Coach')",
  "user_summary": {
    "headline": "short Slovak summary (1 sentence)",
    "bullets": string[],          // 2–5 krátkych bodov v slovenčine
    "risks": string[],            // potenciálne riziká (únava, zranenie, objem)
    "suggestions_short": string[] // 2–5 konkrétnych odporúčaní na najbližšie týždne
  },
  "ai_state": {
    "fitness_level": {
      "run":      { "level_1_to_10": number, "comment": string | null },
      "ride":     { "level_1_to_10": number, "comment": string | null } | null,
      "strength": { "level_1_to_10": number, "comment": string | null } | null
    },
    "fatigue_level": "low" | "moderate" | "high",
    "injury_risk": "low" | "moderate" | "high",
    "volume_tolerance": {
      "weekly_minutes_min": number | null,
      "weekly_minutes_max": number | null,
      "note": string | null
    },
    "intensity_tolerance": {
      "hard_sessions_per_week_max": number | null,
      "comment": string | null
    },
    "suggested_block_kind": "base_aerobic" | "base_long" | "threshold_speed" | "regeneration" | "race_specific" | string,
    "key_limitations": string[],
    "key_strengths": string[],
    "metrics": {
      "estimated_vo2max": number | null,
      "estimated_5k_time_min": number | null,
      "chronic_load_score": number | null,
      "acute_load_score": number | null
    }
  }
}
""".strip()

    user_txt = (
        "Analyze the following athlete context JSON and fill the schema below.\n"
        f"The main sport is: {main_sport}.\n"
        f"The upcoming planning horizon is about {weeks} weeks.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_payload, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema (you may set some numeric fields to null if unknown).\n"
        "- Keep all text in Slovak language.\n"
        "- Headline and bullet points should be short and practical, focused on training.\n"
        "- Use recent_load and recovery data to assess fatigue and injury risk.\n"
        "- Use bests and thresholds to set fitness_level (run/strength/etc.).\n"
        "- Ak je v prefs.volume zadaný požadovaný objem (mode = 'weekly_hours' alebo 'daily_minutes' a value != null),\n"
        "  nastav volume_tolerance.weekly_minutes_min a weekly_minutes_max tak, aby reálne odrážali bezpečný rozsah okolo tohto cieľa.\n"
        "  Napr. približne 70–120 % z implikovanej týždennej záťaže, upravené podľa recent_load a recovery.\n"
        "- Ak prefs.volume.value je null, odhadni volume_tolerance len z recent_load, recovery a doterajších plánov – buď radšej konzervatívny.\n"
        "- Použi external_events blok ako existujúce tréningy/aktivity, ktoré už pridávajú záťaž (napr. futbal, krúžky, klubové behy).\n"
        "  Zohľadni ich pri fatigue_level, injury_risk a pri návrhu suggestions_short (napr. odporuč menej tvrdých behov okolo ťažkých external_events).\n"
        "- Ak už existuje active_plan, porovnaj jeho týždennú záťaž s volume_tolerance; ak je výrazne nad ňou, upozorni na riziko.\n"
        "- Do suggestions_short nedávaj odporúčania, ktoré dlhodobo prekračujú volume_tolerance.weekly_minutes_max.\n"
        "- Do note v volume_tolerance stručne vysvetli, z čoho si objem odvodil (prefs.volume, recent_load, external_events...).\n"
        "- Do NOT invent impossible numbers (keep everything plausible).\n"
    )
    return system_txt, user_txt


def _call_openai_raw(
    client: OpenAI, model: str, system_txt: str, user_txt: str, max_tokens: int
) -> str:
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_txt},
            {"role": "user", "content": user_txt},
        ],
        temperature=0.2,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    return (resp.choices[0].message.content or "").strip()


def generate_athlete_state_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    Hlavný AI klient pre ANALYZE ATHLETE STATE.

    Vždy vráti (state_dict, debug_trace_or_None).
    Keď AI zlyhá, state_dict bude jednoduchý fallback s informáciou o chybe.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [1800, 1500, 1200]

    system_txt, user_txt = _build_prompts_for_analyze(context_payload)

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]
            try:
                raw = _call_openai_raw(client, m, system_txt, user_txt, budget)
                dur_ms = int((time.time() - started) * 1000)
                parsed, cleaned, raw_keep = _parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": parsed is not None,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:600]
                        + ("…[truncated]" if len(raw) > 600 else ""),
                    }
                )

                if not parsed:
                    last_err = "AI returned invalid JSON"
                    continue

                # základná sanity – doplň timestamp/model ak chýbajú
                if "schema_version" not in parsed:
                    parsed["schema_version"] = 1
                if "generated_at" not in parsed:
                    parsed["generated_at"] = datetime.now(timezone.utc).isoformat()
                if "model" not in parsed:
                    parsed["model"] = m

                if debug_raw:
                    trace["raw"] = raw_keep
                    trace["cleaned"] = cleaned
                    trace["ok_model"] = m

                return parsed, trace

            except Exception as e:  # noqa: BLE001
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

    # Fallback – AI sa nepodarilo
    fallback = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": "analyze-fallback",
        "user_summary": {
            "headline": "Nepodarilo sa získať AI analýzu.",
            "bullets": ["Skús to znova neskôr."],
            "risks": [],
            "suggestions_short": [],
        },
        "ai_state": {
            "fitness_level": {
                "run": {"level_1_to_10": 5, "comment": None},
                "ride": None,
                "strength": None,
            },
            "fatigue_level": "moderate",
            "injury_risk": "moderate",
            "volume_tolerance": {
                "weekly_minutes_min": None,
                "weekly_minutes_max": None,
                "note": last_err,
            },
            "intensity_tolerance": {
                "hard_sessions_per_week_max": None,
                "comment": None,
            },
            "suggested_block_kind": "regeneration",
            "key_limitations": [],
            "key_strengths": [],
            "metrics": {
                "estimated_vo2max": None,
                "estimated_5k_time_min": None,
                "chronic_load_score": None,
                "acute_load_score": None,
            },
        },
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None