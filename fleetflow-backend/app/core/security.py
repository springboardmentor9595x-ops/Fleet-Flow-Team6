import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )


def verify_access_token(token: str):
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload

    except JWTError:
        return None


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    payload = verify_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token."
        )

    sub = payload.get("sub")
    email = payload.get("email")
    role = payload.get("role")

    user = None

    # 1. Primary lookup by user_id from sub
    if sub:
        try:
            user_uuid = uuid.UUID(str(sub))
            user = db.query(User).filter(User.user_id == user_uuid).first()
        except (ValueError, TypeError, AttributeError):
            pass

    # 2. Fallback: if sub was not UUID, try (email, role)
    if user is None and email and role:
        user = db.query(User).filter(User.email == email, User.role == role).first()

    # 3. Fallback for legacy email-only tokens
    if user is None and sub and "@" in str(sub):
        user = db.query(User).filter(User.email == str(sub)).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found."
        )

    return user


def require_roles(allowed_roles: list[str]):
    """FastAPI dependency: restrict endpoint to users whose role is in allowed_roles."""
    def dependency(current_user: User = Depends(get_current_user)):
        role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        if role_str not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: Insufficient user privileges."
            )
        return current_user
    return dependency


require_admin = require_roles(["Admin"])
require_dispatcher = require_roles(["Dispatcher"])
require_fleet_manager = require_roles(["FleetManager"])
require_driver = require_roles(["Driver"])
require_dispatcher_or_manager_or_admin = require_roles(["Dispatcher", "FleetManager", "Admin"])
require_manager_or_admin = require_roles(["FleetManager", "Admin"])


def get_role_str(user: User) -> str:
    """Return the string value of a user's role, normalising Enum or plain string."""
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def get_driver_for_user(user: User, db):
    """
    Resolve the Driver profile for the given authenticated user.
    Returns None if the user has no Driver profile (non-Driver roles).
    Import: from app.models.driver import Driver
    """
    from app.models.driver import Driver as DriverModel
    return db.query(DriverModel).filter(DriverModel.user_id == user.user_id).first()