from uuid import UUID
from datetime import datetime, date
from pydantic import BaseModel


class NotificationCreate(BaseModel):
    user_id: UUID | None = None
    title: str
    message: str
    type: str | None = "info"


class NotificationOut(BaseModel):
    notification_id: UUID
    user_id: UUID | None = None
    title: str
    message: str
    type: str | None = "info"
    is_read: bool | None = False
    created_at: datetime | None = None

    class Config:
        from_attributes = True
