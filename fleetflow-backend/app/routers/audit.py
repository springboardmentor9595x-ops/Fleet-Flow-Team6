from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.core.security import require_admin

router = APIRouter(
    prefix="/api/audit-logs",
    tags=["Audit Logs"]
)


@router.get("")
def get_audit_logs(
    role: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)

    if role:
        query = query.filter(AuditLog.role == role)
    if module:
        query = query.filter(AuditLog.module == module)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if status_filter:
        query = query.filter(AuditLog.status == status_filter)
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(AuditLog.timestamp >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            query = query.filter(AuditLog.timestamp <= end_dt)
        except ValueError:
            pass

    total = query.count()
    logs = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [
            {
                "id": str(log.id),
                "user_id": str(log.user_id) if log.user_id else None,
                "user": log.user_name or "System",
                "user_name": log.user_name or "System",
                "role": log.role or "System",
                "action": log.action,
                "module": log.module,
                "description": log.description,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "status": log.status,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "date": log.timestamp.strftime("%d-%m-%Y") if log.timestamp else None,
                "time": log.timestamp.strftime("%I:%M %p") if log.timestamp else None,
            }
            for log in logs
        ]
    }
