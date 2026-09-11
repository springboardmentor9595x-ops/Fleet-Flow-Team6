from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.schemas.profile import ProfileUpdate


router = APIRouter(
    prefix="/profile",
    tags=["Profile"]
)


@router.get("/")
def get_profile(
    current_user=Depends(get_current_user)
):
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "role": current_user.role
    }


@router.put("/")
def update_profile(
    profile_in: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    update_data = profile_in.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully",
        "user_id": current_user.user_id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "role": current_user.role
    }