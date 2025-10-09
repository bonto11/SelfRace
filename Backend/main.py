import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from Routes import recovery, users, activities, profile, notes, analytics, account
from Routes.context import router as context_router
from Routes.user_bests import router as bests_router
from Routes.coach_prefs import router as prefs_router
from Routes.coach_analysis import router as analysis_router

app = FastAPI()

# -------- CORS z ENV --------
# CORS_ORIGINS="https://patrikmbontar.eu,https://www.patrikmbontar.eu,https://dev.patrikmbontar.eu,http://localhost:3000"
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
    allow_origins=origins,          # musí byť zoznam konkrétnych originov (nie *)
    allow_credentials=True,         # ak niekedy budeš posielať cookies/Authorization
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],            # alebo ["Content-Type", "Authorization", ...]
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

app.include_router(context_router)
app.include_router(bests_router)
app.include_router(prefs_router)
app.include_router(analysis_router)
