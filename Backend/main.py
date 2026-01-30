import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from Modules.Strava import webhook_strava
from Routes_FE import (
    users,
    activities_summary,
    analytics,
    synchronization,
    user_prefs,
    user_bests,
    user_zones,
    user_thresholds,
    user_recovery,
    coach_plan_daily,
    coach_plan_weekly,
    coach_athlete_state,
    coach_plan_active,
    coach_external_events,
    profile_static,
    profile_metrics,
    async_jobs,
    maintenance,
    app_subscription,
    account,
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
        "https://hoppscotch.io",
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

app.include_router(activities_summary.router)
app.include_router(analytics.router)
app.include_router(synchronization.router)


app.include_router(coach_plan_daily.router)
app.include_router(coach_plan_weekly.router)
app.include_router(coach_athlete_state.router)
app.include_router(coach_plan_active.router)
app.include_router(coach_external_events.router)
app.include_router(async_jobs.router)
app.include_router(maintenance.router)
app.include_router(app_subscription.router)
app.include_router(account.router)

app.include_router(webhook_strava.router)