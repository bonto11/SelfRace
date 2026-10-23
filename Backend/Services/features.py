# Services/features.py
"""
Prepínače nových funkcií: off → admin → beta → all (viď Configs/features.py).

Ochrana je tu na BE – FE funkciu len skryje. Každá route novej funkcie
overí `service_feature_enabled` (zvyčajne pre volajúceho z JWT).
"""

from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from Configs.features import (
    FEATURE_STAGES,
    FEATURES,
    FEATURES_CACHE_TTL_S,
    FEATURES_SETTING_KEY,
)
from DB.app_settings import db_get_app_setting, db_set_app_setting
from DB.users import db_get_user_by_email, db_get_user_role, db_get_users_basic
from Modules.Supabase.auth import AuthCtx, service_ctx

_lock = threading.Lock()
# PREČO cache: flag sa pýta pri každom requeste funkcie (aj pri notifikáciách
# trénera) – bez nej by každý request niesol 1–2 DB dotazy navyše.
_settings_cache: Optional[Tuple[float, Dict[str, Any]]] = None
_role_cache: Dict[int, Tuple[float, bool]] = {}
_ROLE_CACHE_MAX = 2048


def _ictx(caller: str) -> AuthCtx:
    return service_ctx(f"features.{caller}")


def _normalize(raw: Any) -> Dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    stages_raw = raw.get("stages") if isinstance(raw.get("stages"), dict) else {}
    stages = {
        str(k): str(v)
        for k, v in stages_raw.items()
        if str(k) in FEATURES and str(v) in FEATURE_STAGES
    }
    beta: List[int] = []
    for u in raw.get("beta_users") or []:
        try:
            uid = int(u)
        except (TypeError, ValueError):
            continue
        if uid > 0 and uid not in beta:
            beta.append(uid)
    return {"stages": stages, "beta_users": beta}


def _load_settings(*, force: bool = False) -> Dict[str, Any]:
    global _settings_cache
    now = time.time()
    with _lock:
        if not force and _settings_cache and now - _settings_cache[0] < FEATURES_CACHE_TTL_S:
            return _settings_cache[1]
    try:
        raw = db_get_app_setting(FEATURES_SETTING_KEY, ctx=_ictx("load"))
    except Exception as e:  # noqa: BLE001
        print(f"[FEATURES] load failed: {repr(e)}")
        # PREČO necachovať chybu: výpadok DB nesmie na minútu vypnúť funkcie
        # všetkým – vrátime posledné známe nastavenie, inak defaulty.
        with _lock:
            if _settings_cache:
                return _settings_cache[1]
        return _normalize(None)
    data = _normalize(raw)
    with _lock:
        _settings_cache = (now, data)
    return data


def _invalidate() -> None:
    global _settings_cache
    with _lock:
        _settings_cache = None
        _role_cache.clear()


def _is_admin(user_id: int) -> bool:
    now = time.time()
    with _lock:
        hit = _role_cache.get(user_id)
        if hit and now - hit[0] < FEATURES_CACHE_TTL_S:
            return hit[1]
    try:
        role = db_get_user_role(user_id, ctx=_ictx("role"))
    except Exception as e:  # noqa: BLE001
        print(f"[FEATURES] role failed user={user_id}: {repr(e)}")
        return False
    is_admin = (role or "").upper() == "ADMIN"
    with _lock:
        if len(_role_cache) >= _ROLE_CACHE_MAX:
            _role_cache.clear()
        _role_cache[user_id] = (now, is_admin)
    return is_admin


def service_feature_stage(key: str) -> str:
    if key not in FEATURES:
        return "off"
    return _load_settings()["stages"].get(key) or FEATURES[key]


def _enabled_for(user_id: int, stage: str, beta_users: List[int]) -> bool:
    if stage == "all":
        return True
    if stage == "off":
        return False
    if stage == "beta" and user_id in beta_users:
        return True
    return _is_admin(user_id)


def service_feature_enabled(user_id: Optional[int], key: str) -> bool:
    """Má user funkciu `key` zapnutú? Neznámy user / funkcia = False."""
    if not user_id or key not in FEATURES:
        return False
    settings = _load_settings()
    stage = settings["stages"].get(key) or FEATURES[key]
    return _enabled_for(int(user_id), stage, settings["beta_users"])


def service_user_features(user_id: Optional[int]) -> Dict[str, bool]:
    """Všetky funkcie pre usera ({kľúč: zapnutá}) – pre FE."""
    return {key: service_feature_enabled(user_id, key) for key in FEATURES}


# ---------------------------------------------------------------------------
# ADMIN PANEL
# ---------------------------------------------------------------------------


def service_features_admin_get() -> Dict[str, Any]:
    settings = _load_settings(force=True)
    features = [
        {
            "key": key,
            "stage": settings["stages"].get(key) or default,
            "default_stage": default,
        }
        for key, default in FEATURES.items()
    ]
    beta_ids = settings["beta_users"]
    users: List[Dict[str, Any]] = []
    try:
        rows = {int(r["id"]): r for r in db_get_users_basic(beta_ids, ctx=_ictx("admin_get"))}
    except Exception as e:  # noqa: BLE001
        print(f"[FEATURES] beta users lookup failed: {repr(e)}")
        rows = {}
    for uid in beta_ids:
        r = rows.get(uid) or {}
        users.append(
            {
                "id": uid,
                "email": r.get("mail_address"),
                "name": r.get("display_name"),
                "missing": not r,
            }
        )
    return {"ok": True, "stages": FEATURE_STAGES, "features": features, "beta_users": users}


def _save(settings: Dict[str, Any]) -> None:
    db_set_app_setting(FEATURES_SETTING_KEY, settings, ctx=_ictx("save"))
    _invalidate()


def service_features_admin_set_stage(key: str, stage: str) -> Dict[str, Any]:
    if key not in FEATURES:
        return {"ok": False, "code": "unknown_feature"}
    if stage not in FEATURE_STAGES:
        return {"ok": False, "code": "invalid_stage"}
    settings = dict(_load_settings(force=True))
    settings["stages"] = {**settings["stages"], key: stage}
    _save(settings)
    return service_features_admin_get()


def _resolve_user_id(user: str) -> Optional[int]:
    """Admin zadá ID alebo e-mail."""
    s = (user or "").strip()
    if s.lstrip("#").isdigit():
        uid = int(s.lstrip("#"))
        rows = db_get_users_basic([uid], ctx=_ictx("resolve"))
        return uid if rows else None
    if "@" in s:
        row = db_get_user_by_email(s.lower(), ctx=_ictx("resolve")) or db_get_user_by_email(
            s, ctx=_ictx("resolve")
        )
        return int(row["id"]) if row and row.get("id") is not None else None
    return None


def service_features_admin_add_beta(user: str) -> Dict[str, Any]:
    try:
        uid = _resolve_user_id(user)
    except Exception as e:  # noqa: BLE001
        print(f"[FEATURES] resolve failed: {repr(e)}")
        uid = None
    if not uid:
        return {"ok": False, "code": "user_not_found"}
    settings = dict(_load_settings(force=True))
    if uid not in settings["beta_users"]:
        settings["beta_users"] = [*settings["beta_users"], uid]
        _save(settings)
    return service_features_admin_get()


def service_features_admin_remove_beta(user_id: int) -> Dict[str, Any]:
    settings = dict(_load_settings(force=True))
    settings["beta_users"] = [u for u in settings["beta_users"] if u != int(user_id)]
    _save(settings)
    return service_features_admin_get()
