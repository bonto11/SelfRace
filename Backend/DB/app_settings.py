# DB/app_settings.py
# Globálne nastavenia appky (tabuľka app_settings: key → value JSON).
from __future__ import annotations

from typing import Any, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_APP_SETTINGS


def db_get_app_setting(key: str, *, ctx: AuthCtx) -> Optional[Any]:
    sb = get_sb(ctx, caller="app_settings.db_get_app_setting")
    res = sb.table(TABLE_APP_SETTINGS).select("value").eq("key", key).limit(1).execute()
    rows = res.data or []
    return rows[0].get("value") if rows else None


def db_set_app_setting(key: str, value: Any, *, ctx: AuthCtx) -> None:
    # PREČO nie upsert: nevieme, či má `key` unique index – update existujúceho, inak insert
    sb = get_sb(ctx, caller="app_settings.db_set_app_setting")
    exists = sb.table(TABLE_APP_SETTINGS).select("key").eq("key", key).limit(1).execute().data
    if exists:
        sb.table(TABLE_APP_SETTINGS).update({"value": value}).eq("key", key).execute()
    else:
        sb.table(TABLE_APP_SETTINGS).insert({"key": key, "value": value}).execute()
