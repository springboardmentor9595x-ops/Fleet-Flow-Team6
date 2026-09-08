"""
Profile management endpoints — update own name/phone, change password.
Every authenticated user can manage their own profile.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from app.core.security import get_current_user, hash_password, verify_password
from app.models.user import User

router = APIRouter(
    prefix="/profile",
    tags=["Profile"],
)


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# ----------------------------------------------------------------
# GET /profile/me
# ----------------------------------------------------------------
@router.get("/me")
def get_my_profile(current_user: User = Depends(get_current_user)):
    return {
        "user_id": str(current_user.user_id),
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
    }


# ----------------------------------------------------------------
# PUT /profile/me  — update name and/or phone
# ----------------------------------------------------------------
@router.put("/me")
def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.phone is not None:
        current_user.phone = payload.phone

    db.commit()
    db.refresh(current_user)
    return {
        "user_id": str(current_user.user_id),
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        "message": "Profile updated successfully",
    }


# ----------------------------------------------------------------
# PUT /profile/change-password
# ----------------------------------------------------------------
@router.put("/change-password")
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must be at least 6 characters.",
        )

    current_user.password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully."}
