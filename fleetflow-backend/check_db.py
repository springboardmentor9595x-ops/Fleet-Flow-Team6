from database import SessionLocal
from app.models.fuel_record import FuelRecord
db = SessionLocal()
records = db.query(FuelRecord).all()
print(f'Found {len(records)} records')
