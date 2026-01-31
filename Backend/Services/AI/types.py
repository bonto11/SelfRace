# Services/AI/types.py
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Generic, Optional, TypeVar

T = TypeVar("T")

@dataclass(frozen=True)
class AiError:
    code: str
    message: str
    trace: Optional[Dict[str, Any]] = None

@dataclass(frozen=True)
class AiUsage:
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None

@dataclass(frozen=True)
class AiResult(Generic[T]):
    ok: bool
    data: Optional[T] = None
    error: Optional[AiError] = None
    usage: Optional[AiUsage] = None
    provider: str = "unknown"
    model: str = "unknown"