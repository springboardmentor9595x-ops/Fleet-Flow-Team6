from pydantic import BaseModel
from typing import Optional
from .task_status import TaskStatus

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None

class TaskOut(TaskBase):
    id: int
    user_id: str
    status: TaskStatus
    created_at: str
    updated_at: str

    class Config:
        orm_mode = True
