
from app.database import SessionLocal
from app.crud.user import get_user_by_email
from app.core.security import hash_password

db = SessionLocal()

try:
    user = get_user_by_email(db, "dhar@gmail.com")

    if not user:
        print("USER NOT FOUND")
    else:
        user.password = hash_password("123")

        db.commit()
        db.refresh(user)

        print("PASSWORD UPDATED")
        print("EMAIL:", user.email)
        print("HASH:", user.password)

finally:
    db.close()

