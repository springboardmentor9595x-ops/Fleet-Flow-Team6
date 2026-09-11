import secrets
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import hash_password


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    return f"{secrets.randbelow(900000) + 100000}"


def get_user_by_email(db: Session, email: str):
    if not email:
        return None
    return db.query(User).filter(User.email == email.strip().lower()).first()


def get_user_by_verification_token(db: Session, token: str):
    return db.query(User).filter(User.verification_token == token).first()


def create_user(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    phone: str,
    role,
    otp: str | None = None,
):
    if not otp:
        otp = generate_otp()

    token = secrets.token_urlsafe(32)
    token_expires = datetime.utcnow() + timedelta(hours=24)
    otp_expires = datetime.utcnow() + timedelta(minutes=10)

    user = User(
        email=email.strip().lower(),
        password=hash_password(password),
        full_name=full_name.strip(),
        phone=phone.strip() if phone else None,
        role=role,
        is_email_verified=False,
        email_verified=False,
        verification_otp=otp,
        verification_otp_expires_at=otp_expires,
        verification_token=token,
        verification_token_expires=token_expires,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def set_user_otp(db: Session, user: User, otp: str | None = None) -> str:
    """Generate and assign a new 10-minute OTP to the user, invalidating any previous OTP."""
    if not otp:
        otp = generate_otp()

    user.verification_otp = otp
    user.verification_otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()
    db.refresh(user)
    return otp


def verify_user_otp(db: Session, user: User):
    """Mark user as verified and clear OTP credentials."""
    user.is_email_verified = True
    user.email_verified = True
    user.verification_otp = None
    user.verification_otp_expires_at = None
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    db.refresh(user)
    return user


def verify_user_email(db: Session, user: User):
    return verify_user_otp(db, user)


def regenerate_verification_token(db: Session, user: User):
    user.verification_token = secrets.token_urlsafe(32)
    user.verification_token_expires = datetime.utcnow() + timedelta(hours=24)
    db.commit()
    db.refresh(user)
    return user