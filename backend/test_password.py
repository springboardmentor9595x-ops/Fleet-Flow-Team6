
from app.database import SessionLocal
from app.crud.user import get_user_by_email
from app.core.security import verify_password, hash_password


EMAIL = "dhar@gmail.com"
PASSWORD = "123"

db = SessionLocal()

try:
    user = get_user_by_email(db, EMAIL)

    if not user:
        print("USER NOT FOUND")
    else:
        print("USER:", user.email)
        print("STORED HASH:", user.password)
        print("HASH LENGTH:", len(user.password))

        print(
            "CURRENT PASSWORD VALID:",
            verify_password(PASSWORD, user.password)
        )

        # Create a completely new bcrypt hash
        new_hash = hash_password(PASSWORD)

        print("NEW HASH:", new_hash)
        print("NEW HASH LENGTH:", len(new_hash))

        print(
            "NEW HASH TEST:",
            verify_password(PASSWORD, new_hash)
        )

finally:
    db.close()

