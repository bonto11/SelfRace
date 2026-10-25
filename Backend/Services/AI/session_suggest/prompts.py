# Services/AI/session_suggest/prompts.py
"""
Prompt pre AI návrh jedného tréningu. Výstup = stav formulára ManualSessionForm
(šport, názov, štruktúra), BE ho skontroluje v main.py a FE ním predvyplní
formulár – uloží ho až user.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Tuple

from Services.AI.session_preview.prompts import (
    _lang_notes,
    _name_usage_rule,
    _terminology_rule,
    _time_format_rule,
)


def _remove_empty(d: Any) -> Any:
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    if isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d


def _schema(lang_label: str) -> str:
    return f"""
{{
  "reply_text": "2-4 sentences in {lang_label}: why this session for this day, naming the concrete recent days by weekday",
  "warning": "one sentence in {lang_label} or null - ONLY when resting would be the better choice or the request is risky",
  "session": {{
    "sport": "run | ride | swim | strength | other",
    "title": "short title in {lang_label}",
    "notes": "1-2 short practical tips in {lang_label} (intensity, zone, how it should feel) or null",
    "session_type": "easy | recovery | long | tempo | interval   (run/ride/swim only)",
    "structure_mode": "simple | intervals   (run/ride/swim only)",
    "warmup_min": "int or null",
    "cooldown_min": "int or null",
    "main_minutes": "int - main part for structure_mode=simple",
    "main_notes": "short text or null",
    "blocks": [
      {{
        "rounds": "int",
        "work_unit": "time | distance", "work_s": "int seconds (time)", "work_m": "int meters (distance)", "work_notes": "e.g. 'Z4, steady'",
        "rest_unit": "time | distance", "rest_s": "int seconds", "rest_m": "int meters", "rest_notes": "e.g. 'easy jog'"
      }}
    ],
    "exercises": [{{"exercise_id": "id from strength_catalog", "sets": "int", "reps": "string, e.g. '8-10'; seconds for time exercises ('30-45'); meters for distance exercises"}}],
    "event_kind": "sport   (sport=other only: walk, hike, yoga, mobility)",
    "event_load": "easy | moderate | hard   (sport=other only)",
    "duration_min": "int - total minutes for sport=other; null otherwise"
  }}
}}
""".strip()


def _rules() -> str:
    return (
        "- TASK: suggest exactly ONE training session for 'target_day'. The athlete builds their own plan "
        "(advisor mode) and adds the session themselves - never say you added or changed anything in the plan.\n"
        "- REQUEST: follow 'athlete_request' when it is safe. If it is empty, pick the most sensible session "
        "for that day from the context (their sports, the days around, recovery).\n"
        "- LOOK AROUND THE DAY: 'done_activities' and 'strength_logs' = the last 2-3 days, 'plan_around' = "
        "what is planned 2 days before and 1 day after (status done / planned), 'races_nearby' = races.\n"
        "  - A race, long run or other hard effort in the last 1-2 days, or a hard session/race the next day "
        "-> keep the session easy and short.\n"
        "  - Do not load the same muscle groups the athlete trained hard in the last 2 days ('strength_logs' "
        "targets) or that they say hurt - choose other groups or mobility.\n"
        "  - Something already planned on 'target_day' counts - the new session must fit next to it.\n"
        "- THE ATHLETE'S WORD COUNTS: if they say the race or the last days were easy (e.g. went slowly with a "
        "friend), trust it and adjust. Still mention poor sleep or low HRV from 'recovery' as a light caution.\n"
        "- WHEN REST IS BETTER (e.g. heavy legs asked the day after a marathon, active illness, very poor "
        "recovery): do NOT give the risky session. Fill 'warning' saying that ideally they rest today, and still "
        "give the lightest sensible option in 'session' (easy walk, easy spin, mobility, or upper body/core if "
        "they insist on strength). Acute illness or injury in 'health_records' = only very light movement.\n"
        "- SPORTS: use the athlete's sports ('main_sport', 'add_on_sports', 'training_focus') unless the request "
        "asks for another one. Walk, hike, yoga and mobility are sport='other' with event_kind='sport'.\n"
        "- STRENGTH: 5-8 exercises, ONLY exercise_id values from 'strength_catalog' (format "
        "'id|target|pattern|measure'; the list already fits the athlete's equipment and injuries). Never "
        "invent an id. measure=time -> 'reps' are seconds, measure=distance -> meters. Balance patterns (push "
        "and pull, legs and core), sets/reps fitting 'strength_level'.\n"
        "- RUN/RIDE/SWIM: structure_mode 'simple' = warm-up + main_minutes + cool-down; 'intervals' = 1-5 "
        "'blocks' (each block its own rounds/work/rest - pyramids and mixed series are allowed). Times in "
        "seconds, distances in meters. Put the zone or effort in 'notes'/'work_notes' (use 'hr_zones' if "
        "present). Duration must fit the athlete's level ('athlete_state').\n"
        "- CONVERSATION: if 'conversation' is not empty, the last 'athlete_request' is feedback on your last "
        "suggestion in it. Change what they asked, keep the rest, and say briefly what you changed.\n"
        "- TEXT: no raw field names, ids or enum values in 'reply_text', 'warning', 'title' or notes - "
        "exercise names in words, days by weekday ('včera', 'v sobotu'). Use only numbers from the context. "
        "No English words in Slovak/Czech text (not 'shin splints', write 'bolesti predkolenia').\n"
    )


def build_prompts_for_session_suggest(payload: Dict[str, Any]) -> Tuple[str, str]:
    settings = payload.get("settings") or {}
    user = payload.get("user") or {}
    lang = payload.get("lang") or "sk"
    lang_label, second_person = _lang_notes(settings, user_data=user)

    context_for_llm = _remove_empty(json.loads(json.dumps(payload.get("context") or {}, default=str)))
    if user.get("gender"):
        context_for_llm["athlete_gender"] = user["gender"]

    system_txt = (
        "You are an expert endurance and strength coach. You suggest ONE training session for a given day "
        "that fits what the athlete did and will do around it. Return ONE valid JSON object only. "
        "No markdown. No extra text."
    )
    user_txt = (
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label)
        + "\n\nRULES:\n"
        + f"- Language: {lang_label}. {second_person}\n"
        + _name_usage_rule(user.get("first_name"), lang)
        + _time_format_rule()
        + _terminology_rule(lang_label)
        + _rules()
        + "- Return ONLY raw JSON."
    )
    return system_txt, user_txt
