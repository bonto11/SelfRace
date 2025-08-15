# app.py – minimálny backend server s API pre frontend

import os
import logging
from typing import List, Optional
from fastapi import FastAPI, Query, Path, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
import math


logger = logging.getLogger("uvicorn.error")
load_dotenv()  # načíta .env z koreňa backendu

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE")
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE:
    raise RuntimeError("Chýba SUPABASE_URL alebo SUPABASE_SERVICE_ROLE v .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

ACTIVITIES_TABLE = "activities_summary"
DETAIL_TABLE = "activity_detail"

app = FastAPI(title="Trainalyze Backend API")

# CORS pre tvoj frontend dev server (Vite 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

# ============== Activities ==============

def _format_pace_min_per_km(sec_per_km: float | None) -> str | None:
    if sec_per_km is None or not math.isfinite(sec_per_km) or sec_per_km <= 0:
        return None
    m = int(sec_per_km // 60)
    s = int(round(sec_per_km % 60))
    if s == 60:  # zaokrúhlenie na ďalšiu minútu
        m += 1
        s = 0
    return f"{m}:{str(s).zfill(2)}"

@app.get("/api/activities")
def list_activities(
    user_id: int = Query(..., description="Identifier používateľa"),
    limit: int = Query(100, ge=1, le=500),
):
    """
    Vráti aktivity normalizované do SI:
    - distance_m (z distance_km * 1000)
    - moving_time_s (z moving_time_min * 60)
    - elapsed_time_s (z elapsed_time * 60)  # POZOR: ak máš elapsed_time už v sekundách, zmeň konverziu nižšie
    - average_speed_mps (primárne z distance_m / moving_time_s; ak chýba, a 'avg_speed' je dostupný a je to km/h, tak km/h -> m/s)
    - average_heartrate_bpm (z avg_hr)
    - max_heartrate_bpm (z max_hr)
    - elevation_gain_m (ponechané)
    Odvodené:
    - pace_seconds_per_km
    - pace_min_per_km (string "m:ss")
    """
    try:
        # berieme presne tvoje DB mená stĺpcov
        selection = (
            "id,"
            "user_id,"
            "name,"
            "date,"
            "distance_km,"
            "moving_time_min,"
            "elapsed_time,"
            "avg_hr,"
            "max_hr,"
            "avg_speed,"            # ak je to km/h, dopočítame m/s
            "elevation_gain_m"
        )

        resp = (
            supabase.table(ACTIVITIES_TABLE)
            .select(selection)
            .eq("user_id", user_id)
            .order("date", desc=True)
            .limit(limit)
            .execute()
        )

        out = []
        for row in resp.data or []:
            # Vstupy z DB
            distance_km        = row.get("distance_km")
            moving_time_min    = row.get("moving_time_min")
            elapsed_time_raw   = row.get("elapsed_time")
            avg_hr             = row.get("avg_hr")
            max_hr             = row.get("max_hr")
            avg_speed_raw      = row.get("avg_speed")  # nevieme jednotku, radšej sa nespoliehame
            elevation_gain_m   = row.get("elevation_gain_m")

            # Normalizácia do SI
            distance_m      = (distance_km or 0) * 1000
            moving_time_s   = (moving_time_min or 0) * 60

            # ⚠️ PREDPOKLAD: elapsed_time je v MINÚTACH. Ak ho máš už v SEKUNDÁCH, zmeň nasledujúci riadok na:
            # elapsed_time_s = int(elapsed_time_raw or 0)
            elapsed_time_s  = int((elapsed_time_raw or 0) * 60)

            # Rýchlosť (m/s) – preferujeme fyzikálnu definíciu z dĺžky a času
            average_speed_mps = None
            if distance_m > 0 and moving_time_s > 0:
                average_speed_mps = distance_m / moving_time_s
            elif avg_speed_raw:  # núdzovo – ak by bolo treba konvertovať km/h -> m/s
                # Ak veríš, že avg_speed je v km/h:
                average_speed_mps = (avg_speed_raw * 1000) / 3600

            # Pace (sek/km)
            pace_seconds_per_km = None
            if distance_m > 0 and moving_time_s > 0:
                pace_seconds_per_km = moving_time_s / (distance_m / 1000.0)
            pace_min_per_km = _format_pace_min_per_km(pace_seconds_per_km)

            # Vyrob normalizovaný objekt (ponecháme aj niektoré raw polia – môžeš ich vyhodiť)
            out.append({
                # identita
                "id": row.get("id"),
                "user_id": row.get("user_id"),
                "name": row.get("name"),
                "date": row.get("date"),

                # SI normalizované
                "distance_m": distance_m,
                "moving_time_s": moving_time_s,
                "elapsed_time_s": elapsed_time_s,
                "average_speed_mps": average_speed_mps,
                "average_heartrate_bpm": avg_hr,
                "max_heartrate_bpm": max_hr,
                "elevation_gain_m": elevation_gain_m,

                # odvodené
                "pace_seconds_per_km": pace_seconds_per_km,
                "pace_min_per_km": pace_min_per_km,

                # voliteľne: surové pre debug (ak nechceš, vyhoď tieto položky)
                "distance_km": distance_km,
                "moving_time_min": moving_time_min,
                "elapsed_time_raw": elapsed_time_raw,
                "avg_speed_raw": avg_speed_raw,
            })

        return out

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

# ============== Streams cache ==============

@app.post("/api/activities/{activity_id}/streams/cache")
def cache_streams(
    activity_id: int = Path(..., description="Strava activity id"),
    user_id: Optional[int] = Query(None, description="Identifier používateľa (ak potrebuješ v DB)"),
):
    """
    Pokúsi sa stiahnuť streamy zo Stravy a nahradiť ich v activity_detail.
    Ak nájde tvoje interné funkcie, použije ich.
    Inak vráti 501 Not Implemented (aby frontend vedel, že endpoint existuje).
    """
    # pokus o import tvojich existujúcich funkcií
    try:
        from Backend.Modules.API.api_strava import get_activity_detail  # tvoje API volanie
        from Backend.Modules.SQL.data_manager import replace_activity_detail  # tvoj wrapper delete->insert
    except Exception:
        # Ak tvoja štruktúra momentálne nie je trainalyze/… ale Modules/…, môžeš to zmeniť tu:
        try:
            from Backend.Modules.API.api_strava import get_activity_detail  # prípadne iná cesta
            from Modules.SQL.data_manager import replace_activity_detail
        except Exception:
            # fallback – endpoint existuje, ale nevie spraviť cache
            raise HTTPException(status_code=501, detail="Stream cache nie je na tomto build-e zapojená (importy zlyhali).")

    # stiahni streamy zo Stravy
    try:
        streams = get_activity_detail(activity_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Strava API error: {e}")

    # zisti activity_date z summary (ak chceš uložiť aj dátum)
    activity_date = None
    try:
        r = (
            supabase.table(ACTIVITIES_TABLE)
            .select("date")
            .eq("user_id", user_id) if user_id is not None else supabase.table(ACTIVITIES_TABLE).select("date")
        )
        r = r.eq("id", activity_id).limit(1).execute()
        if r.data:
            activity_date = r.data[0].get("date")
    except Exception:
        pass  # nie je kritické

    # nahradenie detailov v DB
    try:
        ok = replace_activity_detail(user_id=user_id or 0, activity_id=activity_id, streams=streams, activity_date=activity_date)
        if not ok:
            raise HTTPException(status_code=500, detail="Ukladanie streamov zlyhalo.")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error pri ukladaní: {e}")

# ============== Streams fetch ==============

@app.get("/api/activities/{activity_id}/streams")
def get_streams(
    activity_id: int = Path(..., description="Strava activity id"),
    user_id: int = Query(..., description="Identifier používateľa"),
    limit: int = Query(200000, ge=1),
):
    """
    Načíta riadky z activity_detail pre user_id + activity_id.
    Očakáva stĺpce: user_id, activity_id, activity_date, time, lat, lng, altitude_m, heartrate_bpm, cadence_rpm, speed_m_s.
    """
    try:
        res = (
            supabase.table(DETAIL_TABLE)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .order("time", desc=False)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
