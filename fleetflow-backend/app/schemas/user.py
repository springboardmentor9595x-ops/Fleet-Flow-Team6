from enum import Enum
from typing import Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict


class UserRole(str, Enum):
    Admin = "Admin"
    FleetManager = "FleetManager"
    Dispatcher = "Dispatcher"
    Driver = "Driver"


class UserSignup(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    role: UserRole


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    role: Optional[UserRole] = None


class UserLoginWithRole(BaseModel):
    email: EmailStr
    role: UserRole
    password: str


class UserResponse(BaseModel):
    user_id: UUID
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    role: UserRole
    worker_type: Optional[str] = None
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenWithUser(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str


class ResendCodeRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class SendOTPRequest(BaseModel):
    email: EmailStr


class AdminSendOTPRequest(BaseModel):
    email: EmailStr


class AdminVerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class WorkerLoginRequest(BaseModel):
    name: str
    worker_type: str


class WorkUpdateCreate(BaseModel):
    task_id: str
    task_title: Optional[str] = None
    work_status: str = "In Progress"
    description: Optional[str] = None


class WorkUpdateUpdate(BaseModel):
    work_status: Optional[str] = None
    description: Optional[str] = None


class WorkUpdateResponse(BaseModel):
    update_id: UUID
    user_id: UUID
    user_name: Optional[str] = None
    task_id: str
    task_title: Optional[str] = None
    work_status: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)