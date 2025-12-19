# backend/Schemas/async_jobs.py
from __future__ import annotations

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class EnqueueJobPayload(BaseModel):
    # čo posiela FE
    job_type: str = Field(..., min_length=1)
    user_uid: str
    payload: Dict[str, Any] = Field(default_factory=dict)

    priority: int = 100
    run_after: Optional[str] = Field(
        default=None,
        description="ISO timestamp (timestamptz), napr. '2025-12-18T12:00:00Z'",
    )
    max_attempts: int = Field(default=3, ge=1, le=10)
    dedupe_key: Optional[str] = None 


class EnqueueJobResponse(BaseModel):
    success: bool
    job: Optional[Dict[str, Any]] = None
    note: Optional[str] = None


class RunJobResponse(BaseModel):
    """Response pre manuálne spustenie jedného jobu (run endpoint)."""

    success: bool
    job: Optional[Dict[str, Any]] = None
    error: Optional[str] = None