from pydantic import BaseModel, EmailStr
from uuid import UUID
from app.models.user import RoleEnum


from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    role: RoleEnum = RoleEnum.Driver


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    role: RoleEnum = RoleEnum.Driver
    email_verified: bool = True


class AdminUserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    role: RoleEnum | None = None


class UserOut(BaseModel):
    user_id: UUID
    email: EmailStr
    full_name: str
    phone: str | None = None
    role: RoleEnum
    email_verified: bool = False
    created_at: datetime | None = None

    class Config:
        from_attributes = True



class SignupResponse(BaseModel):
    message: str
    email: str
    debug_otp: str | None = None  # Only returned when SMTP is not configured (dev mode)


class Token(BaseModel):
    access_token: str
    token_type: str


class UserUpdate(BaseModel):
    full_name: str
    phone: str | None = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str


class ResendOtpRequest(BaseModel):
    email: EmailStr


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str
    debug_otp: str | None = None  # Only returned when SMTP is not configured (dev mode)
