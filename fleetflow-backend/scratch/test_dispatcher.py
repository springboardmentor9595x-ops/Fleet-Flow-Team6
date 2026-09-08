import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))

import traceback
from database import SessionLocal
from app.routers.dispatcher import get_dispatcher_dashboard
from app.models.user import User

db = SessionLocal()
user = db.query(User).filter(User.role == "Admin").first()
print("Testing get_dispatcher_dashboard...")
try:
    result = get_dispatcher_dashboard(current_user=user, db=db)
    print("SUCCESS!")
    print(result)
except Exception as e:
    print("CAUGHT EXCEPTION:")
    traceback.print_exc()
