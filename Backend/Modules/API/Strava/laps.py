from typing import List, Dict, Any, Optional
import requests

from Modules.config import STRAVA_BASE, USE_STRAVA_CACHE, CACHE_DIR
from .auth import _auth_headers
from .client import _parse_rate_headers, _maybe_sleep_to_respect_limits, _request_json
from .cache import _cache_read, _cache_write
from math import isfinite


def _is_autolap_window(
    distances_m: List[float], *, window: int = 4, target_m: int = 1000, tol_m: int = 50
) -> bool:
    """
    True, ak existuje aspoň jedno okno `window` po sebe idúcich úsekov,
    kde všetky majú dĺžku v [target_m - tol_m, target_m + tol_m].
    """
    if len(distances_m) < window:
        return False
    lo, hi = target_m - tol_m, target_m + tol_m
    for i in range(0, len(distances_m) - window + 1):
        chunk = distances_m[i : i + window]
        if all(
            (d is not None) and isfinite(float(d)) and lo <= float(d) <= hi
            for d in chunk
        ):
            return True
    return False


def _extract_lap_distances(laps: List[Dict[str, Any]]) -> List[float]:
    dists = []
    for lap in laps or []:
        d = lap.get("distance")
        if d is None:
            d = lap.get("distance_m")
        dists.append(d)
    return dists


def _is_interval_workout(
    laps: List[Dict[str, Any]], *, km_target: int = 1000, tol_m: int = 50
) -> bool:
    """
    Heuristika:
      - ak sa nájde okno 4 po sebe idúcich ~1 km auto-lapov → NIE je intervalový tréning
      - inak, ak existuje aspoň 3+ lapy a rozsah dĺžok je >= 200 m → považuj za intervalový
      - inak NIE
    """
    dists = [float(d) for d in _extract_lap_distances(laps) if d is not None]
    if len(dists) < 2:
        return False
    if _is_autolap_window(dists, window=4, target_m=km_target, tol_m=tol_m):
        return False
    if len(dists) >= 3 and (max(dists) - min(dists)) >= 200.0:
        return True
    return False


def _fetch_laps_no_cache(
    activity_id: int, token: Optional[str] = None
) -> Optional[List[Dict[str, Any]]]:
    # pri rozhodovaní potrebujeme „raw“ (kvôli 402 aj rate-limit hlavičkám)
    headers = _auth_headers(token)
    resp = requests.get(
        f"{STRAVA_BASE}/activities/{activity_id}/laps", headers=headers, timeout=30
    )
    if resp.status_code == 402:
        return None
    resp.raise_for_status()
    _maybe_sleep_to_respect_limits(resp)
    return resp.json() or []


def get_activity_laps(
    activity_id: int, token: Optional[str] = None, *, filter_autolaps: bool = True
) -> Optional[List[Dict[str, Any]]]:
    """
    Lapy (zariadenie/manuálne/tréningové intervaly).

    Ak filter_autolaps=True a zistíme, že ide o "bežné" auto-lapy (>=4 po sebe ~1 km ± 50 m),
    lapy NEVRACIAME (None) a NEUKLADÁME do cache.
    """
    filename = f"laps_{activity_id}.json"
    cache_path = CACHE_DIR / filename

    # 1) Ak je cache povolená a súbor existuje, vráť ho (už raz sme rozhodli, že tieto lapy stoja za to)
    if USE_STRAVA_CACHE and cache_path.exists():
        cached = _cache_read(cache_path)
        return cached

    # 2) Inak fetchneme zo Stravy (ručne, kvôli 402)
    try:
        headers = _auth_headers(token)
        resp = requests.get(
            f"{STRAVA_BASE}/activities/{activity_id}/laps", headers=headers, timeout=30
        )
        if resp.status_code == 402:
            return None
        resp.raise_for_status()
        _maybe_sleep_to_respect_limits(resp)
        laps = resp.json() or []
    except requests.HTTPError as e:
        # štandardne preposlať chybu
        raise

    # 3) Aplikuj filter na auto-lapy (pred uložením cache!)
    if filter_autolaps and _is_autolap_window(
        _extract_lap_distances(laps), window=4, target_m=1000, tol_m=50
    ):
        # Bežné auto-lapy -> nechceme ich ani v JSON cache, ani v DB
        print(
            f"ℹ️  Laps pre activity_id={activity_id} vynechané (auto-lap 1 km ±50 m zistený)."
        )
        return None

    # 4) Ulož cache len ak lapy nechávame
    try:
        _cache_write(cache_path, laps)
    except Exception as e:
        print(f"⚠️ Cache write failed for {cache_path}: {e}")

    return laps


def decide_laps_or_splits(
    activity_id: int,
    token: Optional[str] = None,
    *,
    km_target: int = 1000,
    tol_m: int = 50,
):
    """
    Rozhodne, či uložiť LAPS (intervaly) alebo SPLITS (bežné 1 km auto-lapy).
    Vráti dict: {"mode": "laps"|"splits", "laps": list|None, "splits": list|None}

    Pravidlo:
      - ak _is_interval_workout(laps) == True → uložíme iba LAPS (a cache-laps súbor vznikne)
      - inak → uložíme iba SPLITS (a na LAPS kašleme)
    """
    from .activities import get_activity_full  # lokalny import, aby sme sa vyhli cyklom

    full = get_activity_full(activity_id, include_all_efforts=True, token=token)
    splits = full.get("splits_metric") or []

    # načítaj lapy bez cache (len na rozhodovanie)
    laps = _fetch_laps_no_cache(activity_id, token=token) or []

    is_interval = _is_interval_workout(laps, km_target=km_target, tol_m=tol_m)

    if is_interval and laps:
        # Uložíme LAPS do cache (aby ďalšie behy nehitovali API)
        try:
            _cache_write(CACHE_DIR / f"laps_{activity_id}.json", laps)
        except Exception as e:
            print(f"⚠️ Cache write failed for laps: {e}")
        return {"mode": "laps", "laps": laps, "splits": None}

    # else → preferuj splits, lapy ani necacheujeme
    return {"mode": "splits", "laps": None, "splits": splits}
