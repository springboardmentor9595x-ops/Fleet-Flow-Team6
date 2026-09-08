from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from app.models.user import User, RoleEnum
from app.models.work_update import WorkUpdate
from app.schemas.user import (
    WorkUpdateCreate,
    WorkUpdateUpdate,
    WorkUpdateResponse,
)
from app.core.security import get_current_user
from app.models.notification import Notification
import uuid

router = APIRouter(
    prefix="/work-updates",
    tags=["Work Updates"]
)

# Standard tasks catalog for operations/warehouse workers
DEFAULT_WORKER_TASKS = [
    {"task_id": "TSK-W01", "title": "Dock Bay 3 Cargo Inspection & Staging", "category": "Warehouse", "priority": "High"},
    {"task_id": "TSK-W02", "title": "Cold-Chain Pallet Temperature Logging", "category": "Quality Control", "priority": "Urgent"},
    {"task_id": "TSK-W03", "title": "Outbound Manifest Cross-Dock Verification", "category": "Loading", "priority": "Normal"},
    {"task_id": "TSK-W04", "title": "Forklift Safety Inspection & Battery Check", "category": "Maintenance", "priority": "Normal"},
    {"task_id": "TSK-W05", "title": "Zone B Inventory Reconciliation", "category": "Warehouse", "priority": "Low"},
    {"task_id": "TSK-W06", "title": "Heavy Cargo Securing & Tie-Down", "category": "Loading", "priority": "High"},
]


@router.get("/tasks")
def get_available_tasks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Return active/available tasks for the logged in worker or driver.
    """
    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    tasks = list(DEFAULT_WORKER_TASKS)
    if role_val == "Driver":
        tasks.insert(0, {"task_id": "TSK-D01", "title": "Pre-Trip Vehicle Safety Inspection", "category": "Transit", "priority": "Urgent"})
        tasks.insert(1, {"task_id": "TSK-D02", "title": "Fuel & Mileage Logging at Depot", "category": "Transit", "priority": "Normal"})
        tasks.insert(2, {"task_id": "TSK-D03", "title": "Proof of Delivery Document Sign-off", "category": "Delivery", "priority": "High"})

    return tasks


@router.get("", response_model=List[WorkUpdateResponse])
def list_work_updates(
    task_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve work updates.
    - Admin & FleetManager: Can view all updates.
    - Driver & OtherWorker: Only see their OWN updates.
    """
    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    query = (
        db.query(
            WorkUpdate.update_id,
            WorkUpdate.user_id,
            User.full_name.label("user_name"),
            WorkUpdate.task_id,
            WorkUpdate.task_title,
            WorkUpdate.work_status,
            WorkUpdate.description,
            WorkUpdate.created_at,
            WorkUpdate.updated_at,
        )
        .join(User, WorkUpdate.user_id == User.user_id)
    )

    if role_val not in ["Admin", "FleetManager"]:
        query = query.filter(WorkUpdate.user_id == current_user.user_id)

    if task_id:
        query = query.filter(WorkUpdate.task_id == task_id)

    records = query.order_by(desc(WorkUpdate.created_at)).all()

    return [
        WorkUpdateResponse(
            update_id=r.update_id,
            user_id=r.user_id,
            user_name=r.user_name,
            task_id=r.task_id,
            task_title=r.task_title,
            work_status=r.work_status,
            description=r.description,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in records
    ]


@router.post("", response_model=WorkUpdateResponse, status_code=status.HTTP_201_CREATED)
def create_work_update(
    payload: WorkUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new work update attached strictly to the authenticated user.
    """
    new_update = WorkUpdate(
        user_id=current_user.user_id,
        task_id=payload.task_id,
        task_title=payload.task_title or payload.task_id,
        work_status=payload.work_status,
        description=payload.description,
    )
    db.add(new_update)
    
    # Create notification for dashboard
    db.add(Notification(
        notification_id=uuid.uuid4(),
        type="success",
        message=f"New work update for {new_update.task_id} by {current_user.full_name}.",
        title="Work Update"
    ))
    
    db.commit()
    db.refresh(new_update)

    return WorkUpdateResponse(
        update_id=new_update.update_id,
        user_id=new_update.user_id,
        user_name=current_user.full_name,
        task_id=new_update.task_id,
        task_title=new_update.task_title,
        work_status=new_update.work_status,
        description=new_update.description,
        created_at=new_update.created_at,
        updated_at=new_update.updated_at,
    )


@router.put("/{update_id}", response_model=WorkUpdateResponse)
def update_work_update(
    update_id: UUID,
    payload: WorkUpdateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an existing work status update.
    SERVER ENFORCEMENT:
    - Admin can edit any update.
    - Other users CANNOT edit another user's update (returns HTTP 403).
    """
    update = db.query(WorkUpdate).filter(WorkUpdate.update_id == update_id).first()
    if not update:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work update record not found.",
        )

    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    # Strict server-side ownership enforcement
    if role_val != "Admin" and update.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot edit another worker's update.",
        )

    if payload.work_status is not None:
        update.work_status = payload.work_status
    if payload.description is not None:
        update.description = payload.description

    db.commit()
    db.refresh(update)

    author = db.query(User).filter(User.user_id == update.user_id).first()
    user_name = author.full_name if author else current_user.full_name

    return WorkUpdateResponse(
        update_id=update.update_id,
        user_id=update.user_id,
        user_name=user_name,
        task_id=update.task_id,
        task_title=update.task_title,
        work_status=update.work_status,
        description=update.description,
        created_at=update.created_at,
        updated_at=update.updated_at,
    )


@router.delete("/{update_id}", status_code=status.HTTP_200_OK)
def delete_work_update(
    update_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a work update.
    SERVER ENFORCEMENT:
    - Admin or original author only.
    """
    update = db.query(WorkUpdate).filter(WorkUpdate.update_id == update_id).first()
    if not update:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work update record not found.",
        )

    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    if role_val != "Admin" and update.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot delete another worker's update.",
        )

    db.delete(update)
    db.commit()
    return {"message": "Work update deleted successfully."}

