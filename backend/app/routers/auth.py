import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import (
    UserCreate,
    UserOut,
    Token,
    SignupResponse,
    VerifyOtpRequest,
    ResendOtpRequest,
    ResendVerificationRequest,
    MessageResponse,
)
from app.crud.user import (
    get_user_by_email,
    get_user_by_verification_token,
    create_or_update_unverified_user,
    create_email_verification,
    get_latest_email_verification,
    verify_email_otp,
    set_user_otp,
    verify_user_otp,
    verify_user_email,
    regenerate_verification_token,
    generate_otp,
)
from app.core.security import verify_password, create_access_token
from app.core.deps import get_current_user, require_role
from app.models.user import User, RoleEnum
from app.services.email_service import (
    send_otp_email,
    send_verification_email,
    EmailConfigurationError,
    EmailDeliveryError,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# SIGNUP  – creates user, generates 6-digit OTP, sends email, does NOT auto-login
# ---------------------------------------------------------------------------
@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    clean_email = user_in.email.strip().lower()

    existing_user = get_user_by_email(db, clean_email)
    if existing_user and (existing_user.email_verified or existing_user.is_email_verified):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please log in.",
        )

    otp = generate_otp()

    # Step 1: Send verification email first.
    # Do NOT report success if email sending fails.
    try:
        send_otp_email(
            to_email=clean_email,
            full_name=user_in.full_name,
            otp=otp,
        )
    except EmailConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except EmailDeliveryError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to send verification email. {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deliver verification email: {str(e)}",
        )

    # Step 2: Persist user and OTP record only after email sending succeeded
    user = create_or_update_unverified_user(
        db=db,
        email=clean_email,
        password=user_in.password,
        full_name=user_in.full_name,
        phone=user_in.phone,
        role=user_in.role,
        otp=otp,
    )
    create_email_verification(db, clean_email, otp)

    print(f"[SIGNUP] User successfully registered: {user.email}")

    return SignupResponse(
        message="Verification OTP sent to your email.",
        email=user.email,
        debug_otp=None,
    )


# ---------------------------------------------------------------------------
# VERIFY OTP  POST /auth/verify-email
# ---------------------------------------------------------------------------
@router.post("/verify-email", response_model=MessageResponse)
def verify_otp_endpoint(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    clean_email = body.email.strip().lower()
    clean_otp = body.otp.strip()

    if not clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is required.",
        )

    if len(clean_otp) != 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter the complete 6-digit OTP.",
        )

    success, message = verify_email_otp(db, clean_email, clean_otp)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    return MessageResponse(message=message)


# ---------------------------------------------------------------------------
# RESEND OTP  POST /auth/resend-otp
# ---------------------------------------------------------------------------
@router.post("/resend-otp", response_model=MessageResponse)
def resend_otp_endpoint(body: ResendOtpRequest, db: Session = Depends(get_db)):
    clean_email = body.email.strip().lower()

    user = get_user_by_email(db, clean_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if user.is_email_verified or user.email_verified:
        return MessageResponse(message="Email is already verified. You can log in.")

    # Rate limiting: 60-second cooldown
    latest_rec = get_latest_email_verification(db, clean_email)
    if latest_rec:
        elapsed_seconds = (datetime.utcnow() - latest_rec.created_at).total_seconds()
        if elapsed_seconds < 60:
            wait_seconds = int(60 - elapsed_seconds)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Resend OTP available after {wait_seconds} seconds.",
            )

    new_otp = generate_otp()

    try:
        send_otp_email(
            to_email=user.email,
            full_name=user.full_name,
            otp=new_otp,
        )
    except EmailConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except EmailDeliveryError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to send verification email. {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deliver verification email: {str(e)}",
        )

    set_user_otp(db, user, new_otp)

    return MessageResponse(
        message="A new verification OTP has been sent to your email.",
        debug_otp=None,
    )


# ---------------------------------------------------------------------------
# LOGIN – blocks unverified users with 403
# ---------------------------------------------------------------------------
@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    clean_email = form_data.username.strip().lower()
    user = get_user_by_email(db, clean_email)

    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Email verification check
    if not (user.is_email_verified or user.email_verified):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )

    token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role.value if hasattr(user.role, "value") else user.role,
        }
    )

    return {"access_token": token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# LEGACY GET /auth/verify-email (for link compatibility)
# ---------------------------------------------------------------------------
@router.get("/verify-email")
def legacy_verify_email(token: str, db: Session = Depends(get_db)):
    user = get_user_by_verification_token(db, token)

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")

    if user.is_email_verified or user.email_verified:
        return {"message": "Email already verified. You can log in."}

    if user.verification_token_expires and datetime.utcnow() > user.verification_token_expires:
        raise HTTPException(
            status_code=400,
            detail="Verification link has expired. Please request a new one.",
        )

    verify_user_otp(db, user)

    return {"message": "Email verified successfully! You can now log in."}


# ---------------------------------------------------------------------------
# LEGACY RESEND VERIFICATION  POST /auth/resend-verification
# ---------------------------------------------------------------------------
@router.post("/resend-verification")
def resend_verification(
    body: ResendVerificationRequest,
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, body.email.strip().lower())

    if not user or (user.is_email_verified or user.email_verified):
        return {
            "message": "If that email is registered and unverified, a new link has been sent."
        }

    user = regenerate_verification_token(db, user)
    otp = set_user_otp(db, user)

    send_otp_email(
        to_email=user.email,
        full_name=user.full_name,
        otp=otp,
    )

    return {"message": "If that email is registered and unverified, a new verification code has been sent."}


# ---------------------------------------------------------------------------
# ME & ADMIN TEST
# ---------------------------------------------------------------------------
@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/admin-test")
def admin_test(current_user: User = Depends(require_role(RoleEnum.Admin))):
    return {
        "message": "Admin access granted",
        "user": current_user.email,
        "role": current_user.role.value if hasattr(current_user.role, "value") else current_user.role,
    }
