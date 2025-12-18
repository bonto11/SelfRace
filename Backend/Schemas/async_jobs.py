# backend/Schemas/async_jobs.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field


class EnqueueJobPayload(BaseModel):
    # FE-friendly
    job_type: str = Field(..., min_length=1, description="maps to DB.kind")

    # FE payload -> DB.input
    payload: Dict[str, Any] = Field(default_factory=dict)

    # tvoje DB vyžaduje user_uid (NOT NULL)
    user_uid: str = Field(..., min_length=10, description="UUID string")

    # scheduling / retry
    run_after: Optional[str] = None  # ISO timestamptz
    max_attempts: int = 3

    # soft-dedupe: uložíme to do input.dedupe_key (bez DB indexu)
    dedupe_key: Optional[str] = None


class EnqueueJobResponse(BaseModel):
    success: bool
    job: Optional[Dict[str, Any]] = None
    note: Optional[str] = None


class WorkerClaimRequest(BaseModel):
    worker_id: str = Field(..., min_length=2)
    kinds: Optional[List[str]] = None  # napr ["ai_analyze"]
    limit_scan: int = 25


class WorkerClaimResponse(BaseModel):
    success: bool
    job: Optional[Dict[str, Any]] = None


class WorkerProgressRequest(BaseModel):
    worker_id: str = Field(..., min_length=2)
    job_id: str = Field(..., min_length=10)
    progress: int = Field(..., ge=0, le=100)


class WorkerFinishRequest(BaseModel):
    worker_id: str = Field(..., min_length=2)
    job_id: str = Field(..., min_length=10)

    ok: bool = True
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None