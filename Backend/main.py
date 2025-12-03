import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from Routes_FE import (
    users,
    activities,
    analytics,
    account,
    streams,
    activity_zones,
    analytics_pareto8020,
    activities_streams,
    user_prefs,
    user_bests,
    user_zones,
    user_thresholds,
    user_recovery,
    coach_plan_daily,
    coach_plan_weekly,
    coach_athlete_state,
    profile_static,
    profile_metrics,
)

app = FastAPI()

# -------- CORS z ENV --------
raw_origins = os.getenv("CORS_ORIGINS", "")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

# fallback pre lokálny dev, ak by ENV chýbalo
if not origins:
    origins = [
        "https://patrikmbontar.eu",
        "https://www.patrikmbontar.eu",
        "https://dev.patrikmbontar.eu",
        "http://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # musí byť zoznam konkrétnych originov (nie *)
    allow_credentials=True,  # ak niekedy budeš posielať cookies/Authorization
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],  # alebo ["Content-Type", "Authorization", ...]
)

# -------- Routers --------
app.include_router(user_recovery.router)
app.include_router(users.router)
app.include_router(profile_static.router)
app.include_router(profile_metrics.router)
app.include_router(user_prefs.router)
app.include_router(user_bests.router)
app.include_router(user_zones.router)
app.include_router(user_thresholds.router)

app.include_router(account.router)
app.include_router(activities.router)
app.include_router(streams.router)
app.include_router(analytics.router)
app.include_router(activity_zones.router)
app.include_router(analytics_pareto8020.router)
app.include_router(activities_streams.router)

app.include_router(coach_plan_daily.router)
app.include_router(coach_plan_weekly.router)
app.include_router(coach_athlete_state.router)