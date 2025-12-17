# Routes_AI/coach_plan_weekly.py
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


# ---------- parsing utils (rovnaké ako pri analyze) ----------

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


def _build_prompts_for_weekly(context_payload: dict) -> Tuple[str, str]:
    """
    context_payload typicky vyzerá cca takto:

    {
      "schema_version": 1,
      "user_id": 123,
      "weeks": 6,
      "overwrite": true,
      "analyze_input": {
        "user": {...},
        "zones": {...},
        "thresholds": {...},
        "prefs": {... alebo { "value": {...skutočné prefs...} }},
        "bests": {...},
        "recent_load": {...},
        "recovery": {...},
        "active_plan": {...},
        "external_events": {...}   // blok s definíciami + výskytmi externých eventov
      },
      "athlete_state": {...},       // výstup z analyze_athlete_state (ai_state + user_summary)
      "athlete_state_meta": {...}
    }
    """
    analyze_input = context_payload.get("analyze_input") or {}
    # prefs môžu byť priamo alebo pod .value (rovnako ako pri daily)
    raw_prefs = analyze_input.get("prefs") or context_payload.get("prefs") or {}
    if isinstance(raw_prefs, dict) and "value" in raw_prefs and isinstance(
        raw_prefs["value"], dict
    ):
        prefs = raw_prefs["value"]
    else:
        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}

    weeks = int(prefs.get("weeks") or context_payload.get("weeks") or 6)
    start_date = (
        prefs.get("start_date")
        or prefs.get("plan_start_date")
        or (context_payload.get("plan_meta") or {}).get("start_date")
        or ""
    )
    main_sport = prefs.get("main_sport") or "run"
    goal_kind = prefs.get("goal_kind") or "improve_overall"

    volume_prefs = prefs.get("volume") or {}
    external_events = analyze_input.get("external_events") or {}

    system_txt = (
        "You are an endurance coaching assistant. "
        "You receive structured JSON with athlete preferences (including volume preferences), "
        "AI analysis state, recent load, thresholds, zones and external events. "
        "External events are fixed activities like football matches, club runs or other regular trainings, "
        "which already create load and must be counted into total weekly volume. "
        "Your task is to design a WEEK-BY-WEEK meta training plan (no daily sessions yet). "
        "You must return ONE valid JSON object only. No prose, no code fences."
    )

    schema_text = """
{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp in UTC",
  "model": "string (your model name or 'Trainalyze Coach')",
  "plan_meta": {
    "start_date": "YYYY-MM-DD" | null,
    "weeks": number,
    "main_sport": string,
    "goal_kind": string | null
  },
  "weeks": [
    {
      "week_index": number,          // 1-based index v rámci plánu
      "week_start": "YYYY-MM-DD",    // pondelok alebo iný konzistentný začiatok
      "week_end": "YYYY-MM-DD",      // posledný deň týždňa
      "goal": string | null,         // krátky slovný cieľ týždňa
      "focus": string | null,        // napr. 'Z2 objem', 'threshold', 'VO2', 'race', 'regenerácia'
      "load_phase": string | null,   // napr. 'base', 'build', 'peak', 'taper', 'recovery'
      "planned_km": number | null,   // približný plánovaný objem v km (pre hlavný šport, ak relevantné)
      "planned_minutes": number | null, // približný plánovaný čas tréningu všetkých športov (vrátane externých eventov)
      "notes": string | null         // krátke poznámky (slovensky)
    }
  ]
}
""".strip()

    # iba popisne vysvetlíme LLM, kde čo je a ako rátať objem
    volume_hint_lines: List[str] = []

    volume_mode = volume_prefs.get("mode")
    volume_value = volume_prefs.get("value")

    if volume_mode == "weekly_hours" and isinstance(volume_value, (int, float)):
        volume_hint_lines.append(
            "- V prefs.volume má športovec nastavený cieľový objem ako weekly_hours. "
            "Prepoočítaj si to na minúty (hodiny * 60) a ber to ako cieľový týždenný objem."
        )
    elif volume_mode == "daily_minutes" and isinstance(volume_value, (int, float)):
        volume_hint_lines.append(
            "- V prefs.volume má športovec nastavený cieľový objem ako daily_minutes. "
            "Počet tréningových dní si vieš približne odvodiť z preferences.days_off, "
            "teda tréningové dni ≈ 7 - počet days_off. "
            "Cieľový týždenný objem ≈ daily_minutes * počet tréningových dní."
        )
    else:
        volume_hint_lines.append(
            "- prefs.volume.value je null alebo chýba, takže cieľový objem odhadni z recent_load, "
            "recovery a z ai_state.volume_tolerance, buď radšej konzervatívny."
        )

    volume_hint_lines.append(
        "- V athlete_state.ai_state.volume_tolerance máš weekly_minutes_min a weekly_minutes_max. "
        "Pri návrhu plánovaných týždňov sa snaž, aby planned_minutes každého týždňa boli "
        "spravidla v tomto rozumnom pásme. Krátkodobé odchýlky môžu byť, ale nie extrémne."
    )

    volume_hint_lines.append(
        "- Blok analyze_input.external_events obsahuje externé eventy (definície a ich výskyty v kalendári). "
        "Tieto eventy ber ako súčasť tréningového objemu – teda planned_minutes pre daný týždeň "
        "by mali zahŕňať aj odhadovaný čas z týchto externých eventov."
    )

    volume_hint_lines.append(
        "- Použi recent_load a recovery na rozhodnutie o priebehu záťaže: "
        "skús cyklus 2–3 vyššie záťažové týždne -> 1 ľahší (regeneračný) týždeň, "
        "pričom nikdy dlhodobo neprekračuj volume_tolerance.weekly_minutes_max."
    )

    volume_hint = "\n".join(volume_hint_lines)

    user_txt = (
        "You will design a WEEKLY meta training plan for the athlete.\n"
        f"Main sport: {main_sport}\n"
        f"Goal kind: {goal_kind}\n"
        f"Planning horizon (weeks): {weeks}\n"
        f"Preferred plan start date (if any): {start_date or 'none'}\n\n"
        "The CONTEXT_JSON you receive contains:\n"
        "- analyze_input.user: základný profil (vek, tréningová história,...)\n"
        "- analyze_input.zones: tréningové zóny\n"
        "- analyze_input.thresholds: prahy (najmä running LT2)\n"
        "- analyze_input.bests: osobné rekordy\n"
        "- analyze_input.recent_load: objem a intenzita posledných týždňov\n"
        "- analyze_input.recovery: HRV, RHR, subjektívna únava...\n"
        "- analyze_input.prefs alebo analyze_input.prefs.value: coach prefs (ciele, days_off, main_sport, volume,...)\n"
        "- analyze_input.active_plan: ak už existuje starší plán\n"
        "- analyze_input.external_events: externé eventy, ktoré už samé o sebe vytvárajú tréningovú záťaž\n"
        "- athlete_state: AI analýza (ai_state + user_summary) z predchádzajúceho kroku\n\n"
        "CONTEXT_JSON (ground truth – use it as the only source of information):\n"
        + json.dumps(context_payload, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema (you may set some numeric fields to null if unknown).\n"
        "- All free text (goal, focus, notes) MUST be in Slovak language.\n"
        "- Make sure week_index starts at 1 and grows consecutively (1, 2, 3, ...).\n"
        "- week_start and week_end must be valid dates and form continuous, non-overlapping weeks.\n"
        "- Use athlete_state.ai_state (fitness, fatigue, injury risk, volume_tolerance, intensity_tolerance) to decide load_phase and load progression per week.\n"
        "- Respect the number of weeks requested (context_payload.weeks alebo prefs.weeks) as much as possible.\n"
        "- Do NOT generate daily sessions here – only weekly summary/meta.\n"
        "- planned_minutes musia reprezentovať celkový približný tréningový čas za týždeň vrátane externých eventov.\n"
        "- Pri návrhu objemu a progresie sa riaď nasledujúcimi pokynmi:\n"
        + volume_hint
        + "\n"
        "- Ak má athlete_state.ai_state.fatigue_level = 'high' alebo injury_risk = 'high', "
        "zaraď na začiatok plánu aspoň 1 regeneračný týždeň s planned_minutes blízko weekly_minutes_min.\n"
        "- Pri peak/race týždňoch neprekračuj volume_tolerance.weekly_minutes_max a radšej zvýš intenzitu než objem.\n"
        "- Neodporúčaj dlhodobý trend, kde by väčšina týždňov bola výrazne nad weekly_minutes_max.\n"
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


def generate_weekly_plan_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    AI klient pre WEEKLY PLÁN.

    Vždy vráti (weekly_dict, debug_trace_or_None).
    Keď AI zlyhá, weekly_dict bude jednoduchý fallback s informáciou o chybe.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [1800, 1500, 1200]

    system_txt, user_txt = _build_prompts_for_weekly(context_payload)

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

                # sanity defaults
                if "schema_version" not in parsed:
                    parsed["schema_version"] = 1
                if "generated_at" not in parsed:
                    parsed["generated_at"] = datetime.now(timezone.utc).isoformat()
                if "model" not in parsed:
                    parsed["model"] = m

                # doplnenie plan_meta.weeks z kontextu, ak chýba
                plan_meta = parsed.get("plan_meta") or {}
                if "weeks" not in plan_meta or plan_meta.get("weeks") is None:
                    analyze_input = context_payload.get("analyze_input") or {}
                    raw_prefs = analyze_input.get("prefs") or context_payload.get("prefs") or {}
                    if isinstance(raw_prefs, dict) and "value" in raw_prefs and isinstance(
                        raw_prefs["value"], dict
                    ):
                        prefs = raw_prefs["value"]
                    else:
                        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}
                    plan_meta["weeks"] = int(
                        prefs.get("weeks") or context_payload.get("weeks") or 6
                    )
                parsed["plan_meta"] = plan_meta

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
    analyze_input_fb = context_payload.get("analyze_input") or {}
    raw_prefs_fb = analyze_input_fb.get("prefs") or context_payload.get("prefs") or {}
    if isinstance(raw_prefs_fb, dict) and "value" in raw_prefs_fb and isinstance(
        raw_prefs_fb["value"], dict
    ):
        prefs_fb = raw_prefs_fb["value"]
    else:
        prefs_fb = raw_prefs_fb if isinstance(raw_prefs_fb, dict) else {}

    now_iso = datetime.now(timezone.utc).isoformat()
    fallback = {
        "schema_version": 1,
        "generated_at": now_iso,
        "model": "weekly-fallback",
        "plan_meta": {
            "start_date": prefs_fb.get("start_date") or None,
            "weeks": int(prefs_fb.get("weeks") or context_payload.get("weeks") or 6),
            "main_sport": prefs_fb.get("main_sport") or "run",
            "goal_kind": prefs_fb.get("goal_kind") or "improve_overall",
        },
        "weeks": [],
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None