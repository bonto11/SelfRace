# Services/AI/types.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Generic, Optional, TypeVar

T = TypeVar("T")


@dataclass
class AiError:
    code: str
    message: str
    trace: Optional[Dict[str, Any]] = None


@dataclass
class AiResult(Generic[T]):
    ok: bool
    data: Optional[T] = None
    error: Optional[AiError] = None
    provider: str = "unknown"
    model: str = "unknown"
    trace: Optional[Dict[str, Any]] = None