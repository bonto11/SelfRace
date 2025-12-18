# backend/Schemas/async_jobs.py
from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EnqueueJobPayload(BaseModel):
    kind: str = Field(..., min_length=1)
    input: Dict[str, Any] = Field(default_factory=dict)
    user_uid: UUID

    run_after: Optional[str] = Field(
        default=None,
        description="ISO timestamp (timestamptz), napr. '2025-12-18T12:00:00Z'",
    )
    max_attempts: int = Field(default=3, ge=1, le=10)


class EnqueueJobResponse(BaseModel):
    success: bool
    job: Optional[Dict[str, Any]] = None
    note: Optional[str] = None


class RunJobResponse(BaseModel):
    """
    Response pre manuálne spustenie jedného jobu (run endpoint).
    """
    success: bool
    job: Optional[Dict[str, Any]] = None
    error: Optional[str] = None