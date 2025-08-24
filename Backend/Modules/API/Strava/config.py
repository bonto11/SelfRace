import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

STRAVA_BASE = os.getenv("STRAVA_BASE")
CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
REDIRECT_URI = os.getenv("STRAVA_REDIRECT_URI")
TOKENS_FILE = os.getenv("TOKENS_FILE", "data/tokens.json")

USE_STRAVA_CACHE = os.getenv("STRAVA_USE_CACHE", "false").lower() in {"1", "true", "yes", "on"}
CACHE_DIR = Path(os.getenv("STRAVA_CACHE_DIR", "data/strava_cache"))

# dobrovoľný globálny delay medzi requestami (sekundy, napr. 0, 0.5, 1.0…)
REQUEST_DELAY_SECS = float(os.getenv("STRAVA_REQUEST_DELAY", "0"))
