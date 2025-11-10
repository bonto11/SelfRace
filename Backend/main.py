import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from Routes import (
    recovery,
    users,
    activities,
    profile,
    notes,
    analytics,
    account,
    streams,
    activity_zones,
    analytics_pareto8020,
    activities_streams,
    user_prefs,
    user_bests
)
from backend.Routes import coach_context, coach_planning

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


# (voliteľné) healthcheck
@app.get("/healthz")
def healthz():
    return {"ok": True}


# -------- Routers --------
app.include_router(recovery.router)
app.include_router(users.router)
app.include_router(activities.router)
app.include_router(profile.router)
app.include_router(notes.router)
app.include_router(analytics.router)
app.include_router(account.router)
app.include_router(streams.router)
app.include_router(activity_zones.router)
app.include_router(analytics_pareto8020.router)
app.include_router(activities_streams.router)
app.include_router(user_prefs.router)
app.include_router(user_bests.router)
app.include_router(coach_context.router)
app.include_router(coach_planning.router)
