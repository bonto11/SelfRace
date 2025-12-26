from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, Field

class StravaWebhookEventIn(BaseModel):
    aspect_type: Literal["create", "update", "delete"]
    event_time: int
    object_id: int
    object_type: Literal["activity", "athlete"]
    owner_id: int
    subscription_id: Optional[int] = None
    updates: Dict[str, Any] = Field(default_factory=dict)