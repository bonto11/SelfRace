# Services/AI/types.py
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Generic, Optional, TypeVar

T = TypeVar("T")

@dataclass(frozen=True)
class AiError:
    code: str
    message: str

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


def ai_err(code: str, message: str) -> AiResult[Any]:
    return AiResult(ok=False, error=AiError(code=code, message=message))