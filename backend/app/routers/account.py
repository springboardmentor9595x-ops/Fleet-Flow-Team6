from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.crud.user import get_user_by_email
from app.schemas.account import EmailUpdate, PasswordUpdate


router = APIRouter(
    prefix="/account",
    tags=["Account Settings"]
)


@router.put("/email")
def update_email(
    data: EmailUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    existing_user = get_user_by_email(db, data.email)

    if existing_user and existing_user.user_id != current_user.user_id:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    current_user.email = data.email

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Email updated successfully",
        "email": current_user.email
    }


@router.put("/password")
def update_password(
    data: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if not verify_password(
        data.current_password,
        current_user.password
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password"
        )

    current_user.password = hash_password(data.new_password)

    db.commit()

    return {
        "message": "Password updated successfully"
    }