#Modules/
#└─ API/
#   └─ strava/
#      ├─ __init__.py          # re-exporty: zachováš public API, nič inde nemusíš meniť
#      ├─ config.py            # čítanie .env, globálne nastavenia (BASE URL, cache režim…)
#      ├─ auth.py              # tokeny + authorize + exchange endpoint (Flask handler)
#      ├─ cache.py             # _cache_read/_cache_write/_maybe_load_or_cache
#      ├─ client.py            # jednotný HTTP klient: _request_json, rate-limit, delay
#      ├─ activities.py        # get_activities, get_activity_full, get_activity_data
#      ├─ streams.py           # get_activity_streams_all, get_activity_detail (legacy)
#      ├─ laps.py              # get_activity_laps + heuristiky (_is_interval_workout)
#      └─ zones.py             # get_activity_zones

# re-exporty – nech sa ti inde v projekte nič nemusí meniť
from .auth import authorize_user, register_exchange_token_route, get_access_token, refresh_access_token