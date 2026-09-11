from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, RoleEnum
from app.schemas.user import UserOut, UserUpdate, ChangePassword
from app.core.security import verify_password, hash_password

router = APIRouter()


class RoleUpdateRequest(BaseModel):
    role: RoleEnum


# ==========================================================
# CURRENT USER
# ==========================================================

@router.get("/me", response_model=UserOut)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.full_name = user_data.full_name
    current_user.phone = user_data.phone

    db.commit()
    db.refresh(current_user)

    return current_user


@router.put("/change-password")
def change_password(
    passwords: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(
        passwords.current_password,
        current_user.password,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.password = hash_password(
        passwords.new_password
    )

    db.commit()

    return {
        "message": "Password updated successfully"
    }


from app.schemas.user import UserOut, UserUpdate, ChangePassword, AdminUserCreate, AdminUserUpdate


@router.get("/eligible-drivers", response_model=list[UserOut])
def list_eligible_driver_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    """Admin and Fleet Manager: List user accounts with role=Driver for profile linking."""
    return db.query(User).filter(User.role == RoleEnum.Driver).order_by(User.full_name).all()


@router.get("/", response_model=list[UserOut])
def list_all_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(RoleEnum.Admin)),
):
    """Admin only: List all users in the system."""
    return db.query(User).order_by(User.created_at.desc()).all()



@router.post("/", response_model=UserOut)
def create_user_by_admin(
    body: AdminUserCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(RoleEnum.Admin)),
):
    """Admin only: Register/create a new user with verified status."""
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")

    new_user = User(
        email=body.email,
        full_name=body.full_name,
        password=hash_password(body.password),
        phone=body.phone,
        role=body.role,
        email_verified=body.email_verified,
        is_email_verified=body.email_verified,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.put("/{user_id}", response_model=UserOut)
def update_user_by_admin(
    user_id: UUID,
    body: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(RoleEnum.Admin)),
):
    """Admin only: Update user details or role."""
    target_user = db.query(User).filter(User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.full_name is not None:
        target_user.full_name = body.full_name
    if body.phone is not None:
        target_user.phone = body.phone
    if body.role is not None:
        target_user.role = body.role

    db.commit()
    db.refresh(target_user)
    return target_user


@router.put("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: UUID,
    body: RoleUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(RoleEnum.Admin)),
):
    """Admin only: Change another user's role."""
    target_user = db.query(User).filter(User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_user.role = body.role
    db.commit()
    db.refresh(target_user)
    return target_user


@router.delete("/{user_id}")
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(RoleEnum.Admin)),
):
    """Admin only: Delete a user record."""
    target_user = db.query(User).filter(User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.user_id == admin_user.user_id:
        raise HTTPException(status_code=400, detail="Admin cannot delete their own account")

    db.delete(target_user)
    db.commit()
    return {"message": "User deleted successfully"}