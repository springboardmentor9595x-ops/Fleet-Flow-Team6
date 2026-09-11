import sys
import os

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.user import User

def delete_user_by_email(email: str):
    email = email.strip().lower()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"[-] User with email '{email}' was not found in the database.")
            return False
        
        db.delete(user)
        db.commit()
        print(f"[+] Successfully deleted user '{email}' from the database.")
        return True
    except Exception as e:
        db.rollback()
        print(f"[!] Error deleting user '{email}': {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    target_email = sys.argv[1] if len(sys.argv) > 1 else "mounesh@gmail.com"
    delete_user_by_email(target_email)
