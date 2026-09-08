import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from database import get_db
from app.models.user import User, RoleEnum
from app.schemas.user import (
    UserSignup, UserResponse, Token, TokenWithUser,
    VerifyOTPRequest, SendOTPRequest,
    AdminSendOTPRequest, AdminVerifyOTPRequest,
    UserLoginWithRole
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from config import settings
from app.services.email_service import send_otp_email
from app.services.audit_service import log_activity

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


def _generate_otp() -> str:
    """Return a cryptographically secure 6-digit numeric OTP."""
    return "".join(secrets.choice("0123456789") for _ in range(6))


def _otp_expiry() -> datetime:
    """Return a UTC datetime 5 minutes from now."""
    return datetime.now(timezone.utc) + timedelta(minutes=5)


# ─────────────────────────────────────────
# POST /auth/signup
# Allows same email with DIFFERENT roles.
# Rejects duplicate (email + role).
# ─────────────────────────────────────────
@router.post(
    "/signup",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def signup(
    user: UserSignup,
    db: Session = Depends(get_db)
):
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)

    # Check composite uniqueness: (email, role)
    existing_user = db.query(User).filter(
        User.email == user.email,
        User.role == role_val
    ).first()

    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This account already exists for this role"
            )
        else:
            # Unverified account with same role: update and re-send OTP
            otp = _generate_otp()
            existing_user.full_name = user.full_name
            existing_user.password = hash_password(user.password)
            existing_user.phone = user.phone
            existing_user.otp_code = otp
            existing_user.otp_expires_at = _otp_expiry()
            db.commit()
            db.refresh(existing_user)
            send_otp_email(existing_user.email, existing_user.full_name, otp)
            return existing_user

    # Create new account under (email, role)
    otp = _generate_otp()

    new_user = User(
        full_name=user.full_name,
        email=user.email,
        password=hash_password(user.password),
        phone=user.phone,
        role=role_val,
        is_verified=False,
        otp_code=otp,
        otp_expires_at=_otp_expiry(),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Auto-provision Driver profile if registering as Driver
    if role_val == "Driver":
        from app.models.driver import Driver
        existing_driver = db.query(Driver).filter(Driver.user_id == new_user.user_id).first()
        if not existing_driver:
            db.add(Driver(
                driver_id=uuid.uuid4(),
                user_id=new_user.user_id,
                license_number=f"LIC-{str(new_user.user_id)[:6].upper()}",
                experience_years=1,
                status="Available"
            ))
            db.commit()

    log_activity(
        db, new_user, action="User Signup", module="Authentication",
        description=f"New {role_val} account created for {new_user.email}", status="Success"
    )

    try:
        send_otp_email(new_user.email, new_user.full_name, otp)
    except Exception as e:
        print(f"[OTP Notice]: {e}")

    return new_user


# ─────────────────────────────────────────
# POST /auth/login
# Finds account using email + role + password
# Supports JSON or Form data
# ─────────────────────────────────────────
@router.post("/login")
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    email_or_user = None
    password = None
    role = None

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            email_or_user = body.get("email") or body.get("username")
            password = body.get("password")
            role = body.get("role")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            email_or_user = form.get("username") or form.get("email")
            password = form.get("password")
            role = form.get("role")
        except Exception:
            pass

    if not email_or_user or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email/username and password are required."
        )

    # Validate role if provided
    valid_roles = ["Admin", "FleetManager", "Dispatcher", "Driver"]
    if role:
        matched_role = next((r for r in valid_roles if r.lower() == role.lower()), None)
        if not matched_role:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid role"
            )
        role = matched_role

    # Query account by (email or driver full_name) AND role (if provided)
    query = db.query(User).filter(
        or_(
            User.email == email_or_user,
            func.lower(User.full_name) == func.lower(email_or_user)
        )
    )

    if role:
        query = query.filter(User.role == role)

    matching_users = query.all()

    if not matching_users:
        if role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found for this email and role"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found"
            )

    if len(matching_users) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Multiple accounts found for this email. Please select your role to login."
        )

    user = matching_users[0]

    # Verify Password / PIN
    if not verify_password(password, user.password):
        log_activity(
            db, user, action="Login Failed", module="Authentication",
            description=f"Failed login attempt for email {user.email}", status="Failure"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )

    # Enforce email verification for non-Admin accounts
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    if not user.is_verified and role_str != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified. Please verify your email address using the OTP sent during signup."
        )

    # Issue JWT token containing sub=str(user.user_id), email=user.email, role=role_str
    access_token = create_access_token(
        data={
            "sub": str(user.user_id),
            "email": user.email,
            "role": role_str
        }
    )

    log_activity(
        db, user, action="User Login", module="Authentication",
        description=f"User {user.full_name} logged in successfully as {role_str}", status="Success"
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user),
        "requires_otp": False
    }


# ─────────────────────────────────────────
# POST /auth/admin/send-otp
# Existing Admin OTP flow preserved
# ─────────────────────────────────────────
@router.post("/admin/send-otp")
def admin_send_otp(payload: AdminSendOTPRequest, db: Session = Depends(get_db)):
    """
    Step 1 of Admin Login:
    Admin enters email -> specifically looks up Admin account -> sends 6-digit OTP.
    """
    user = db.query(User).filter(User.email == payload.email, User.role == "Admin").first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No admin account found with this email address."
        )

    otp = _generate_otp()
    user.otp_code = otp
    user.otp_expires_at = _otp_expiry()
    db.commit()

    send_otp_email(user.email, user.full_name, otp)

    return {
        "message": f"A 6-digit verification code has been sent to {user.email}. It expires in 5 minutes.",
        "email": user.email,
    }


# ─────────────────────────────────────────
# POST /auth/admin/verify-otp
# Existing Admin OTP verification preserved
# ─────────────────────────────────────────
@router.post("/admin/verify-otp", response_model=TokenWithUser)
def admin_verify_otp(payload: AdminVerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Step 2 of Admin Login:
    Admin enters 6-digit OTP -> verify against stored OTP -> return JWT token.
    """
    if not payload.otp or not payload.otp.strip().isdigit() or len(payload.otp.strip()) != 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OTP must be exactly 6 digits."
        )

    user = db.query(User).filter(User.email == payload.email, User.role == "Admin").first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No admin account found for this email address."
        )

    if not user.otp_code or user.otp_expires_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active verification code found. Please request a new code."
        )

    now_utc = datetime.now(timezone.utc)
    otp_expiry = (
        user.otp_expires_at.replace(tzinfo=timezone.utc)
        if user.otp_expires_at.tzinfo is None
        else user.otp_expires_at
    )
    if now_utc > otp_expiry:
        user.otp_code = None
        user.otp_expires_at = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This verification code has expired. Please request a new code."
        )

    if not secrets.compare_digest(user.otp_code.strip(), payload.otp.strip()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The verification code you entered is incorrect."
        )

    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()

    access_token = create_access_token(
        data={
            "sub": str(user.user_id),
            "email": user.email,
            "role": "Admin"
        }
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user),
    }


# ─────────────────────────────────────────
# POST /auth/send-otp (generic)
# ─────────────────────────────────────────
@router.post("/send-otp")
def send_otp(payload: SendOTPRequest, db: Session = Depends(get_db)):
    users = db.query(User).filter(User.email == payload.email).all()
    if not users:
        return {"message": f"If an account is registered to {payload.email}, a code has been sent."}

    otp = _generate_otp()
    expiry = _otp_expiry()
    for user in users:
        user.otp_code = otp
        user.otp_expires_at = expiry
    db.commit()

    send_otp_email(users[0].email, users[0].full_name, otp)
    return {"message": f"A new verification code has been sent to {payload.email}."}


# ─────────────────────────────────────────
# POST /auth/verify-otp (generic)
# ─────────────────────────────────────────
@router.post("/verify-otp", response_model=TokenWithUser)
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    if not payload.otp or not payload.otp.strip().isdigit() or len(payload.otp.strip()) != 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OTP must be exactly 6 digits.",
        )

    users = db.query(User).filter(User.email == payload.email).all()
    if not users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No account found for this email address.",
        )

    user_with_otp = next((u for u in users if u.otp_code and u.otp_expires_at is not None), None)
    if not user_with_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active verification code found.",
        )

    now_utc = datetime.now(timezone.utc)
    otp_expiry = (
        user_with_otp.otp_expires_at.replace(tzinfo=timezone.utc)
        if user_with_otp.otp_expires_at.tzinfo is None
        else user_with_otp.otp_expires_at
    )
    if now_utc > otp_expiry:
        for u in users:
            u.otp_code = None
            u.otp_expires_at = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This verification code has expired.",
        )

    if not secrets.compare_digest(user_with_otp.otp_code.strip(), payload.otp.strip()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The verification code you entered is incorrect.",
        )

    for u in users:
        u.is_verified = True
        u.otp_code = None
        u.otp_expires_at = None
    db.commit()

    role_val = user_with_otp.role.value if hasattr(user_with_otp.role, "value") else str(user_with_otp.role)
    access_token = create_access_token(
        data={
            "sub": str(user_with_otp.user_id),
            "email": user_with_otp.email,
            "role": role_val
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user_with_otp),
    }


# ─────────────────────────────────────────
# GET /auth/me
# ─────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user