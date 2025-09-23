from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from Routes import recovery, users, activities, profile, notes, analytics

from Routes.context import router as context_router
from Routes.user_bests import router as bests_router
from Routes.coach_prefs import router as prefs_router
from Routes.coach_analysis import router as analysis_router

app = FastAPI()

# ---- CORS ----
origins = [
    "http://localhost:3000",  # FE dev server
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # kto môže volať BE
    allow_credentials=True,
    allow_methods=["*"],         # GET, POST, PUT...
    allow_headers=["*"],
)

# ---- Routers ----
app.include_router(recovery.router)
app.include_router(users.router)
app.include_router(activities.router)
app.include_router(profile.router)
app.include_router(notes.router)
app.include_router(analytics.router)

app.include_router(context_router)
app.include_router(bests_router)
app.include_router(prefs_router)
app.include_router(analysis_router)