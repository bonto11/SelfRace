# Services/AI/utils/training_focus.py
"""
Zameranie usera pre AI – z úvodného výberu v appke (users_preferences
"ui.widgets", pole profile).

PREČO z výberu widgetov a nie z coach prefs: zameranie si vyberá každý user
(aj ten, kto nikdy nevyplnil cieľ ani plán), kým coach prefs má len ten, kto
si nastavil trénera. Bez výberu (starší user) sa odhadne z coach prefs.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx

# rovnaké hodnoty ako WidgetProfile na FE (shared/widgets/widgetCatalog.ts)
FOCUS_PROFILES = ("strength", "endurance", "hybrid", "ocr", "health", "all")


def load_widget_profile(user_id: int, *, ctx: AuthCtx) -> Optional[str]:
    """Profil z ui.widgets, None keď ho user nemá alebo čítanie zlyhá."""
    try:
        from Services.user_prefs import service_get_user_pref

        val = service_get_user_pref(user_id=user_id, key="ui.widgets", ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[FOCUS] ui.widgets user={user_id} failed: {repr(e)}")
        return None
    profile = val.get("profile") if isinstance(val, dict) else None
    return profile if profile in FOCUS_PROFILES else None


def resolve_training_focus(
    user_id: int, prefs: Optional[Dict[str, Any]], *, ctx: AuthCtx
) -> str:
    """
    Zameranie pre AI: výber usera, inak odhad z coach prefs.

    Bez výberu: kto nemá vytrvalostný šport a silu nevypol, posilňuje
    (resolve_main_sport vráti "strength"); ostatní dostanú "all" = správanie
    ako pred zameraniami.
    """
    profile = load_widget_profile(user_id, ctx=ctx)
    if profile:
        return profile
    try:
        from Services.AI.prefs_defaults import resolve_main_sport

        if isinstance(prefs, dict) and prefs and resolve_main_sport(prefs) == "strength":
            return "strength"
    except Exception as e:  # noqa: BLE001
        print(f"[FOCUS] main sport user={user_id} failed: {repr(e)}")
    return "all"
