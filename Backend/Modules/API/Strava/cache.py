import json
from pathlib import Path
from typing import Callable, Any

from backend.Modules.config import USE_STRAVA_CACHE, CACHE_DIR


def _cache_read(path: Path):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def _cache_write(path: Path, data: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _maybe_load_or_cache(filename: str, fetch_fn: Callable[[], Any]):
    """
    Ak je USE_STRAVA_CACHE=True a cache súbor existuje -> vráti cache.
    Inak zavolá fetch_fn(), výstup uloží do cache a vráti.
    """
    path = CACHE_DIR / filename
    if USE_STRAVA_CACHE:
        cached = _cache_read(path)
        if cached is not None:
            return cached
    data = fetch_fn()
    try:
        _cache_write(path, data)
    except Exception as e:
        print(f"⚠️ Cache write failed for {path}: {e}")
    return data
