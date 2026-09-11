from pydantic import BaseModel, EmailStr


class EmailUpdate(BaseModel):
    email: EmailStr


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str