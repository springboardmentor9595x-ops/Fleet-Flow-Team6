import uuid
import datetime
from database import SessionLocal, engine
from sqlalchemy import text
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.trip import Trip
from app.models.notification import Notification
from app.models.shipment import Shipment
from app.models.maintenance import VehicleMaintenance
from app.core.security import hash_password

def seed_database():
    db = SessionLocal()
    try:
        print("Cleaning up old seed data...")
        # Clear existing trips, drivers, vehicles, notifications, maintenance, shipments
        db.execute(text("TRUNCATE TABLE vehicle_maintenance CASCADE"))
        db.execute(text("TRUNCATE TABLE trips CASCADE"))
        db.execute(text("TRUNCATE TABLE shipments CASCADE"))
        db.execute(text("TRUNCATE TABLE notifications CASCADE"))
        db.execute(text("TRUNCATE TABLE drivers CASCADE"))
        db.execute(text("TRUNCATE TABLE vehicles CASCADE"))
        
        # Delete old users
        db.execute(text("DELETE FROM users CASCADE"))
        db.commit()

        print("Seeding admin user...")
        admin = User(
            user_id=uuid.uuid4(),
            full_name="Admin User",
            email="admin@fleetflow.com",
            password=hash_password("password123"),
            phone="9876543210",
            role="Admin",
            is_verified=True
        )
        db.add(admin)
        db.commit()

        print("Seeding users (drivers)...")
        # 1. Create User accounts for drivers
        driver_users_data = [
            {"full_name": "Marcus Lee", "email": "marcus@fleetflow.com", "phone": "9876543210"},
            {"full_name": "Priya Nair", "email": "priya@fleetflow.com", "phone": "9876543211"},
            {"full_name": "James Okafor", "email": "james@fleetflow.com", "phone": "9876543212"},
            {"full_name": "Anika Sharma", "email": "anika@fleetflow.com", "phone": "9876543213"},
            {"full_name": "Ravi Kumar", "email": "ravi@fleetflow.com", "phone": "9876543214"}
        ]
        
        driver_users = []
        for d in driver_users_data:
            user = User(
                user_id=uuid.uuid4(),
                full_name=d["full_name"],
                email=d["email"],
                password=hash_password("password123"),
                phone=d["phone"],
                role="Driver",
                is_verified=True
            )
            db.add(user)
            driver_users.append(user)
        db.commit()

        print("Seeding drivers...")
        # 2. Create Driver profiles linked to the Users
        drivers = []
        licenses = ["DL-TN42A123", "DL-MH17B456", "DL-DL89C789", "DL-AP55D012", "DL-WB33E345"]
        for idx, user in enumerate(driver_users):
            driver = Driver(
                driver_id=uuid.uuid4(),
                user_id=user.user_id,
                license_number=licenses[idx],
                experience_years=5 + idx,
                address="Driver Address City " + str(idx),
                status="Active" if idx % 2 == 0 else "Inactive"
            )
            db.add(driver)
            drivers.append(driver)
        db.commit()

        print("Seeding vehicles...")
        # 3. Create Vehicles
        vehicles_data = [
            {"reg": "TRK-042", "type": "Cargo Van", "brand": "Force", "model": "Traveller", "year": 2022, "status": "Available"},
            {"reg": "TRK-017", "type": "Box Truck", "brand": "Tata", "model": "Ultra", "year": 2021, "status": "Maintenance"},
            {"reg": "TRK-089", "type": "Heavy Duty", "brand": "Leyland", "model": "U-Truck", "year": 2023, "status": "Available"},
            {"reg": "TRK-055", "type": "Cargo Van", "brand": "Mahindra", "model": "Bolero", "year": 2024, "status": "Available"},
            {"reg": "TRK-033", "type": "SUV", "brand": "Toyota", "model": "Innova", "year": 2023, "status": "Available"},
            {"reg": "TRK-001", "type": "Sedan", "brand": "Hyundai", "model": "Verna", "year": 2022, "status": "Available"},
        ]
        
        vehicles = []
        for idx, v in enumerate(vehicles_data):
            # assign a driver to some vehicles
            assigned_drv = drivers[idx % len(drivers)].driver_id if idx < len(drivers) else None
            vehicle = Vehicle(
                vehicle_id=uuid.uuid4(),
                registration_number=v["reg"],
                vehicle_type=v["type"],
                brand=v["brand"],
                model=v["model"],
                manufacture_year=v["year"],
                fuel_type="Diesel",
                capacity=1500 + idx * 500,
                assigned_driver=assigned_drv,
                status=v["status"]
            )
            db.add(vehicle)
            vehicles.append(vehicle)
        db.commit()

        print("Seeding shipments...")
        # 4. Create Shipments
        shipments_data = [
            {"id": uuid.uuid4(), "tracking": "SH-001", "customer": "Global Logistics", "status": "In Transit"},
            {"id": uuid.uuid4(), "tracking": "SH-002", "customer": "Acme Corp", "status": "Delivered"},
            {"id": uuid.uuid4(), "tracking": "SH-003", "customer": "Zenith Retail", "status": "In Transit"},
            {"id": uuid.uuid4(), "tracking": "SH-004", "customer": "Apex Manufacturing", "status": "Created"},
            {"id": uuid.uuid4(), "tracking": "SH-005", "customer": "Fast Delivery Services", "status": "Delivered"}
        ]
        
        for idx, s in enumerate(shipments_data):
            v_obj = vehicles[idx % len(vehicles)]
            d_obj = drivers[idx % len(drivers)]
            shipment = Shipment(
                shipment_id=s["id"],
                tracking_number=s["tracking"],
                source="Source City " + str(idx),
                destination="Dest City " + str(idx),
                customer_name=s["customer"],
                shipment_weight=250.5 * (idx + 1),
                vehicle_id=v_obj.vehicle_id,
                driver_id=d_obj.driver_id,
                status=s["status"],
                created_at=datetime.datetime.now()
            )
            db.add(shipment)
        db.commit()

        print("Seeding trips...")
        # 5. Create Trips
        trips_data = [
            {
                "route": "Chennai → Bangalore", "status": "active",
                "start": "Chennai", "dest": "Bangalore",
                "dist": 350.0, "start_time_offset": -4
            },
            {
                "route": "Mumbai → Pune", "status": "completed",
                "start": "Mumbai", "dest": "Pune",
                "dist": 150.0, "start_time_offset": -6
            },
            {
                "route": "Delhi → Jaipur", "status": "active",
                "start": "Delhi", "dest": "Jaipur",
                "dist": 270.0, "start_time_offset": -3
            },
            {
                "route": "Hyderabad → Vijayawada", "status": "pending",
                "start": "Hyderabad", "dest": "Vijayawada",
                "dist": 275.0, "start_time_offset": 1
            },
            {
                "route": "Kolkata → Bhubaneswar", "status": "completed",
                "start": "Kolkata", "dest": "Bhubaneswar",
                "dist": 440.0, "start_time_offset": -24
            }
        ]

        now = datetime.datetime.now()
        for idx, t in enumerate(trips_data):
            v_obj = vehicles[idx % len(vehicles)]
            d_obj = drivers[idx % len(drivers)]
            start_time = now + datetime.timedelta(hours=t["start_time_offset"])
            end_time = start_time + datetime.timedelta(hours=6) if t["status"] == "completed" else None
            
            trip = Trip(
                trip_id=uuid.uuid4(),
                vehicle_id=v_obj.vehicle_id,
                driver_id=d_obj.driver_id,
                shipment_id=shipments_data[idx]["id"],
                start_location=t["start"],
                destination=t["dest"],
                start_time=start_time,
                end_time=end_time,
                distance=t["dist"],
                status=t["status"]
            )
            db.add(trip)
        db.commit()

        print("Seeding notifications...")
        # 5. Create notifications/alerts
        admin_user = db.query(User).filter(User.role == "Admin").first()
        admin_id = admin_user.user_id if admin_user else None
        
        alerts_data = [
            {"type": "warning", "title": "Maintenance Overdue", "msg": "TRK-017 maintenance overdue by 3 days"},
            {"type": "info", "title": "Checkpoint Reached", "msg": "TRP-003 reached midpoint checkpoint"},
            {"type": "warning", "title": "Driver Hours Limit", "msg": "Driver James Okafor approaching hours limit"},
            {"type": "success", "title": "Trip Completed", "msg": "TRP-005 delivered successfully"},
        ]

        for a in alerts_data:
            notif = Notification(
                notification_id=uuid.uuid4(),
                user_id=admin_id,
                title=a["title"],
                message=a["msg"],
                type=a["type"],
                is_read=False
            )
            db.add(notif)
        db.commit()

        print("Seeding vehicle maintenance...")
        # 6. Seed vehicle maintenance record for TRK-017
        trk_017 = next(v for v in vehicles if v.registration_number == "TRK-017")
        maintenance = VehicleMaintenance(
            maintenance_id=uuid.uuid4(),
            vehicle_id=trk_017.vehicle_id,
            maintenance_type="Engine Service",
            service_date=(now - datetime.timedelta(days=3)).date(),
            next_service_date=(now + datetime.timedelta(days=27)).date(),
            cost=4500.00,
            remarks="Overdue service",
            status="pending"
        )
        db.add(maintenance)
        db.commit()

        print("Database seeded successfully!")

    except Exception as e:
        print("Error seeding database:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
