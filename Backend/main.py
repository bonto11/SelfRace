from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from Routes import recovery, users, activities, profile, notes, analytics

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


