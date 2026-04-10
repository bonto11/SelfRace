# Schemas/profile_static.py
from __future__ import annotations

from pydantic import BaseModel
from typing import Optional, Literal, Union
from datetime import datetime, date

class StaticPayload(BaseModel):
    sex: Optional[Literal["M", "F"]] = None
    birth_date: Optional[Union[str, date, datetime]] = None
    height_cm: Optional[float] = None


