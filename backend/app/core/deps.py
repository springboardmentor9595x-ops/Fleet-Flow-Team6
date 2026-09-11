from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import SECRET_KEY, ALGORITHM
from app.crud.user import get_user_by_email
from app.models.user import RoleEnum


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    print("TOKEN:", token)

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        print("PAYLOAD:", payload)

        email = payload.get("sub")
        print("EMAIL:", email)

        if email is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid Token"
            )

        user = get_user_by_email(db, email)

        print("USER:", user.email if user else None)

        if user is None:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        return user

    except JWTError as e:
        print("JWT ERROR:", str(e))
        raise HTTPException(
            status_code=401,
            detail="Invalid Token"
        )



def require_role(*roles):

    def role_checker(
        current_user = Depends(get_current_user)
    ):

        user_role = (
            current_user.role.value
            if hasattr(current_user.role, "value")
            else current_user.role
        )

        allowed_roles = [
            role.value if hasattr(role, "value") else role
            for role in roles
        ]

        if user_role not in allowed_roles:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied"
            )

        return current_user

    return role_checker



def require_roles(*roles):

    return require_role(*roles)