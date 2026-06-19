import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from Modules.Strava import webhook_strava
from Modules.Stripe import webhook_stripe, billing_stripe
from Routes import (
    users,
    activities_summary,
    activities_enrichment,
    analytics,
    monthly_summary,
    synchronization,
    user_prefs,
    user_bests,
    user_zones,
    user_thresholds,
    user_recovery,
    user_health_log,
    user_metrics,
    user_pace_history,
    coach_plan_daily,
    coach_plan_weekly,
    coach_athlete_state,
    coach_plan_active,
    coach_external_events,
    coach_user_notes,
    profile_static,
    async_jobs,
    app_subscription,
    account,
    notifications,
    trigger,
)

app = FastAPI()

# -------- CORS z ENV --------
raw_origins = os.getenv("CORS_ORIGINS", "")
# Rozdelí podľa čiarky a odstráni nielen medzery, ale aj všetky zbytočné " a ' úvodzovky
origins = [o.strip().strip('"').strip("'") for o in raw_origins.split(",") if o.strip()]

# fallback pre lokálny dev, ak by ENV chýbalo
if not origins:
    origins = [
        "https://selfrace.com",
        "https://www.selfrace.com",
        "https://dev.selfrace.com",
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
app.include_router(user_metrics.router)
app.include_router(user_prefs.router)
app.include_router(user_bests.router)
app.include_router(user_zones.router)
app.include_router(user_thresholds.router)
app.include_router(user_pace_history.router)
app.include_router(user_health_log.router)

app.include_router(activities_summary.router)
app.include_router(activities_enrichment.router)
app.include_router(analytics.router)
app.include_router(synchronization.router)
app.include_router(monthly_summary.router)

app.include_router(coach_plan_daily.router)
app.include_router(coach_plan_weekly.router)
app.include_router(coach_athlete_state.router)
app.include_router(coach_plan_active.router)
app.include_router(coach_external_events.router)
app.include_router(coach_user_notes.router)
app.include_router(async_jobs.router)
app.include_router(app_subscription.router)
app.include_router(account.router)
app.include_router(notifications.router)
app.include_router(trigger.router)


app.include_router(webhook_strava.router)

app.include_router(webhook_stripe.router)
app.include_router(billing_stripe.router)
