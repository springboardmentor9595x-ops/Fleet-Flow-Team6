import json
from sqlalchemy import inspect
from app.database import engine, SessionLocal
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.trip import Trip
from app.models.shipment import Shipment
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from app.models.notification import Notification
from app.models.attendance import Attendance

insp = inspect(engine)
print("=== TABLES IN DB ===")
for t in insp.get_table_names():
    cols = [c["name"] for c in insp.get_columns(t)]
    print(f"{t}: {cols}")
    try:
        checks = insp.get_check_constraints(t)
        if checks:
            print(f"  Check constraints: {checks}")
    except Exception as e:
        pass

print("\n=== RECORD COUNTS ===")
db = SessionLocal()
try:
    print("Users:", db.query(User).count())
    print("Vehicles:", db.query(Vehicle).count())
    print("Drivers:", db.query(Driver).count())
    print("Trips:", db.query(Trip).count())
    print("Shipments:", db.query(Shipment).count())
    print("Maintenance:", db.query(VehicleMaintenance).count())
    print("Fuel:", db.query(FuelRecord).count())
    print("Notifications:", db.query(Notification).count())
    print("Attendance:", db.query(Attendance).count())
except Exception as e:
    print("Error querying counts:", e)
finally:
    db.close()
