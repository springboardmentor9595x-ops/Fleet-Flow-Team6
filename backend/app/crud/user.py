import secrets
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.email_verification import EmailVerification
from app.core.security import hash_password, SECRET_KEY


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    print("[OTP] Generating verification OTP")
    return f"{secrets.randbelow(1000000):06d}"


def hash_otp(email: str, otp: str) -> str:
    """Generate SHA-256 hash of OTP salted with email and SECRET_KEY."""
    clean_email = email.strip().lower()
    clean_otp = otp.strip()
    return hashlib.sha256(f"{clean_email}:{clean_otp}:{SECRET_KEY}".encode()).hexdigest()


def get_user_by_email(db: Session, email: str) -> User | None:
    if not email:
        return None
    return db.query(User).filter(User.email == email.strip().lower()).first()


def get_user_by_verification_token(db: Session, token: str) -> User | None:
    return db.query(User).filter(User.verification_token == token).first()


def create_user(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    phone: str | None,
    role,
    otp: str | None = None,
) -> User:
    clean_email = email.strip().lower()
    token = secrets.token_urlsafe(32)
    token_expires = datetime.utcnow() + timedelta(hours=24)
    otp_expires = datetime.utcnow() + timedelta(minutes=10)

    user = User(
        email=clean_email,
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


def create_or_update_unverified_user(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    phone: str | None,
    role,
    otp: str | None = None,
) -> User:
    """
    Create a new user, or if an unverified user with this email already exists,
    update their details and refresh credentials.
    """
    clean_email = email.strip().lower()
    existing_user = get_user_by_email(db, clean_email)

    if existing_user and not (existing_user.email_verified or existing_user.is_email_verified):
        existing_user.password = hash_password(password)
        existing_user.full_name = full_name.strip()
        existing_user.phone = phone.strip() if phone else None
        existing_user.role = role
        existing_user.verification_otp = otp
        existing_user.verification_otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
        db.commit()
        db.refresh(existing_user)
        return existing_user

    return create_user(db, clean_email, password, full_name, phone, role, otp=otp)


def create_email_verification(db: Session, email: str, otp: str) -> EmailVerification:
    """
    Invalidate any active OTP records for this email, hash the new OTP,
    and persist in email_verifications table.
    """
    clean_email = email.strip().lower()
    print(f"[OTP] Saving verification record for {clean_email}")

    # Invalidate previous unverified records
    db.query(EmailVerification).filter(
        EmailVerification.email == clean_email,
        EmailVerification.verified == False,
    ).delete()

    record = EmailVerification(
        email=clean_email,
        otp_hash=hash_otp(clean_email, otp),
        expires_at=datetime.utcnow() + timedelta(minutes=10),
        attempts=0,
        verified=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_latest_email_verification(db: Session, email: str) -> EmailVerification | None:
    """Retrieve the latest email verification record for an email."""
    clean_email = email.strip().lower()
    return (
        db.query(EmailVerification)
        .filter(EmailVerification.email == clean_email)
        .order_by(EmailVerification.created_at.desc())
        .first()
    )


def verify_email_otp(db: Session, email: str, otp: str) -> tuple[bool, str]:
    """
    Verify the provided OTP against the email_verifications table.
    Returns (success: bool, message_or_error: str).
    """
    clean_email = email.strip().lower()
    clean_otp = otp.strip()

    user = get_user_by_email(db, clean_email)
    if not user:
        return False, "User not found."

    if user.email_verified or user.is_email_verified:
        return True, "Email is already verified. You can log in."

    record = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.email == clean_email,
            EmailVerification.verified == False,
        )
        .order_by(EmailVerification.created_at.desc())
        .first()
    )

    if not record:
        # Fallback to user model verification_otp if legacy record
        if user.verification_otp and user.verification_otp == clean_otp:
            if user.verification_otp_expires_at and datetime.utcnow() > user.verification_otp_expires_at:
                return False, "OTP expired. Please request a new OTP."
            user.email_verified = True
            user.is_email_verified = True
            user.verification_otp = None
            user.verification_otp_expires_at = None
            db.commit()
            return True, "Email verified successfully"
        return False, "Invalid OTP"

    # Check maximum failed attempts
    if record.attempts >= 5:
        return False, "Too many failed attempts. Please request a new OTP."

    # Check expiration
    if datetime.utcnow() > record.expires_at:
        return False, "OTP expired. Please request a new OTP."

    # Validate OTP hash
    expected_hash = hash_otp(clean_email, clean_otp)
    if record.otp_hash != expected_hash:
        record.attempts += 1
        db.commit()
        return False, "Invalid OTP"

    # Success
    record.verified = True
    user.email_verified = True
    user.is_email_verified = True
    user.verification_otp = None
    user.verification_otp_expires_at = None
    db.commit()
    return True, "Email verified successfully"


def set_user_otp(db: Session, user: User, otp: str | None = None) -> str:
    """Generate and assign a new 10-minute OTP to the user, invalidating any previous OTP."""
    if not otp:
        otp = generate_otp()

    user.verification_otp = otp
    user.verification_otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()
    db.refresh(user)

    # Also store in email_verifications table
    create_email_verification(db, user.email, otp)
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