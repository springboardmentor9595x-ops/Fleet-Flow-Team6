from pydantic import BaseModel, validator




class ProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None

    @validator("phone")
    def phone_must_be_10_digits(cls, v):
        if v is not None and len(v) != 10:
            raise ValueError("Phone number must be exactly 10 digits")
        return v