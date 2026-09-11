from sqlalchemy import Column, Integer, String, ForeignKey, Enum as SqlEnum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from .task_status import TaskStatus

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(String, nullable=True)
    status = Column(SqlEnum(TaskStatus), default=TaskStatus.OPEN, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="tasks")
