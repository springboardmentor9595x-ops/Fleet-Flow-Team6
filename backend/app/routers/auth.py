from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from database import get_db
from app.models.user import User
from app.schemas.user import (
    UserSignup, UserResponse, Token, TokenWithUser,
    VerifyOTPRequest, SendOTPRequest
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from config import settings
from app.services.email_service import send_otp_email

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# -----------------------------
# User Signup
# -----------------------------
@router.post(
    "/signup",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def signup(
    user: UserSignup,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:
        if not existing_user.is_verified:
            import secrets
            otp = "".join(secrets.choice("0123456789") for _ in range(6))
            existing_user.full_name = user.full_name
            existing_user.password = hash_password(user.password)
            existing_user.phone = user.phone
            existing_user.role = user.role.value
            existing_user.otp_code = otp
            existing_user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
            db.commit()
            db.refresh(existing_user)
            
            background_tasks.add_task(send_otp_email, existing_user.email, existing_user.full_name, otp)
            return existing_user
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered."
            )

    import secrets
    otp = "".join(secrets.choice("0123456789") for _ in range(6))

    new_user = User(
        full_name=user.full_name,
        email=user.email,
        password=hash_password(user.password),
        phone=user.phone,
        role=user.role.value,
        is_verified=False,
        otp_code=otp,
        otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    background_tasks.add_task(send_otp_email, new_user.email, new_user.full_name, otp)

    return new_user


# -----------------------------
# User Login
# -----------------------------
@router.post(
    "/login"
)
def login(
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not verify_password(
        form_data.password,
        user.password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # If user account is not verified yet, send OTP for initial verification
    if not user.is_verified:
        import secrets
        otp = "".join(secrets.choice("0123456789") for _ in range(6))
        
        user.otp_code = otp
        user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        db.commit()

        background_tasks.add_task(send_otp_email, user.email, user.full_name, otp)

        return {
            "requires_otp": True,
            "email": user.email,
            "message": "Account not verified. OTP has been sent to your email."
        }

    # Already existing verified account: issue token directly without OTP
    access_token = create_access_token(data={"sub": user.email})
    return {
        "requires_otp": False,
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


# -----------------------------
# Send / Resend OTP
# -----------------------------
@router.post(
    "/send-otp"
)
def send_otp(
    payload: SendOTPRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found."
        )

    import secrets
    otp = "".join(secrets.choice("0123456789") for _ in range(6))
    
    user.otp_code = otp
    user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    db.commit()

    background_tasks.add_task(send_otp_email, user.email, user.full_name, otp)

    return {"message": "OTP sent successfully."}


# -----------------------------
# Verify OTP & Log In
# -----------------------------
@router.post(
    "/verify-otp",
    response_model=TokenWithUser
)
def verify_otp(
    payload: VerifyOTPRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found."
        )

    if not user.otp_code or user.otp_expires_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP requested or OTP has already been verified."
        )

    otp_expires_at = user.otp_expires_at
    if otp_expires_at.tzinfo is None:
        otp_expires_at = otp_expires_at.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new code."
        )

    if user.otp_code != payload.otp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP code. Please check your email and try again."
        )

    if not user.is_verified:
        user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()

    access_token = create_access_token(
        data={
            "sub": user.email
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


# -----------------------------
# Current Logged-in User
# -----------------------------
@router.get(
    "/me",
    response_model=UserResponse
)
def get_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user


# -----------------------------
# Test SMTP Email
# -----------------------------
@router.post(
    "/test-email"
)
def test_email(
    email: str,
    db: Session = Depends(get_db)
):
    import logging
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    logger = logging.getLogger(__name__)

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "FleetFlow SMTP Connection Test"
        msg["From"] = f"FleetFlow <{settings.EMAIL_FROM}>"
        msg["To"] = email

        html = """
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h2>SMTP Test Successful</h2>
            <p>Your FleetFlow SMTP settings are correctly configured and working!</p>
          </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, email, msg.as_string())

        logger.info(f"Test email successfully sent to {email}")
        return {"message": f"SMTP Test email successfully sent to {email}"}
    except smtplib.SMTPAuthenticationError as e:
        error_msg = (
            "SMTP Authentication Failed (535). "
            f"Please verify your EMAIL_USER ({settings.EMAIL_USER}) and check that "
            "EMAIL_PASSWORD matches your Google App Password exactly without spaces or quotes."
        )
        logger.error(f"{error_msg}. Details: {e}", exc_info=True)
        print(f"\n[CRITICAL SMTP AUTH ERROR] {error_msg}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
    except Exception as e:
        error_msg = (
            f"SMTP Connection Failed: {str(e)}. "
            f"Please check EMAIL_HOST ({settings.EMAIL_HOST}) and EMAIL_PORT ({settings.EMAIL_PORT})."
        )
        logger.error(error_msg, exc_info=True)
        print(f"\n[SMTP CONNECTION ERROR] {error_msg}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )