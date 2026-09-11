"""
Comprehensive Seed Script for FleetFlow Management System
Populates rich, realistic, and meaningful data across all entities:
- Users & Roles (Admin, FleetManager, Dispatcher, Drivers)
- Drivers (Profiles, licenses, experience)
- Vehicles (Trucks, Vans, EV, Reefer, Flatbed with realistic specs)
- Shipments (Corridors, cargo, tracking numbers, weights, statuses)
- Trips (Routes, waypoints, distance, durations, ETAs)
- GPS Tracking (Realistic breadcrumb coordinates & live locations)
- Vehicle Maintenance (Scheduled, Completed, In-Progress, Overdue)
- Fuel Records (Realistic consumption, costs, mileages over past 60 days)
- Driver Attendance (Daily logs over past 14 days)
- System Notifications (Operational alerts, geofence triggers, trip milestones)
"""

import uuid
from datetime import datetime, timedelta, date
from decimal import Decimal

from app.database import SessionLocal, engine
from app.core.security import hash_password
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.vehicle import Vehicle, VehicleStatus, FuelType
from app.models.shipment import Shipment, ShipmentStatus
from app.models.trip import Trip, TripStatus
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from app.models.attendance import Attendance
from app.models.notification import Notification
from app.models.gps_tracking import GPSTracking


import sys
import io
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def seed_database():
    db = SessionLocal()
    try:
        print("[*] Starting FleetFlow Meaningful Data Seeding...")
        hashed_pwd = hash_password("Password123!")

        # -----------------------------------------------------------------
        # 1. USERS & ROLES
        # -----------------------------------------------------------------
        users_data = [
            {
                "email": "admin@fleetflow.com",
                "full_name": "Marcus Sterling (Admin)",
                "phone": "+1-555-0100",
                "role": RoleEnum.Admin,
            },
            {
                "email": "manager@fleetflow.com",
                "full_name": "David Miller (Fleet Manager)",
                "phone": "+1-555-0101",
                "role": RoleEnum.FleetManager,
            },
            {
                "email": "dispatcher@fleetflow.com",
                "full_name": "Samantha Chen (Chief Dispatcher)",
                "phone": "+1-555-0102",
                "role": RoleEnum.Dispatcher,
            },
            {
                "email": "driver1@fleetflow.com",
                "full_name": "Alex Morgan",
                "phone": "+1-555-0201",
                "role": RoleEnum.Driver,
            },
            {
                "email": "driver2@fleetflow.com",
                "full_name": "Sarah Jenkins",
                "phone": "+1-555-0202",
                "role": RoleEnum.Driver,
            },
            {
                "email": "driver.rajesh@fleetflow.com",
                "full_name": "Rajesh Kumar",
                "phone": "+91-98201-44512",
                "role": RoleEnum.Driver,
            },
            {
                "email": "driver.elena@fleetflow.com",
                "full_name": "Elena Rostova",
                "phone": "+1-555-0204",
                "role": RoleEnum.Driver,
            },
            {
                "email": "driver.marcus@fleetflow.com",
                "full_name": "Marcus Vance",
                "phone": "+1-555-0205",
                "role": RoleEnum.Driver,
            },
            {
                "email": "driver.priya@fleetflow.com",
                "full_name": "Priya Sharma",
                "phone": "+91-98450-88123",
                "role": RoleEnum.Driver,
            },
        ]

        user_map = {}
        for u in users_data:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if existing:
                existing.full_name = u["full_name"]
                existing.phone = u["phone"]
                existing.role = u["role"]
                existing.password = hashed_pwd
                existing.email_verified = True
                existing.is_email_verified = True
                user_map[u["email"]] = existing
            else:
                new_user = User(
                    email=u["email"],
                    full_name=u["full_name"],
                    password=hashed_pwd,
                    phone=u["phone"],
                    role=u["role"],
                    email_verified=True,
                    is_email_verified=True,
                    created_at=datetime.utcnow() - timedelta(days=60),
                )
                db.add(new_user)
                db.flush()
                user_map[u["email"]] = new_user

        # Ensure all existing users in DB are marked email verified
        db.query(User).update({User.email_verified: True, User.is_email_verified: True})
        db.commit()
        print("✅ Users seeded/updated successfully.")

        # -----------------------------------------------------------------
        # 2. DRIVERS
        # -----------------------------------------------------------------
        drivers_data = [
            {
                "email": "driver1@fleetflow.com",
                "license": "DL-NY-2018-9941",
                "experience": 9,
                "address": "452 Industrial Parkway, Newark, NJ",
                "status": "Active",
            },
            {
                "email": "driver2@fleetflow.com",
                "license": "DL-CA-2020-5512",
                "experience": 5,
                "address": "128 Harbor View Dr, San Francisco, CA",
                "status": "Active",
            },
            {
                "email": "driver.rajesh@fleetflow.com",
                "license": "MH-02-2015-00892",
                "experience": 12,
                "address": "Plot 88, Vashi Logistics Zone, Navi Mumbai, MH",
                "status": "Active",
            },
            {
                "email": "driver.elena@fleetflow.com",
                "license": "DL-IL-2017-7721",
                "experience": 8,
                "address": "742 Evergreen Blvd, Chicago, IL",
                "status": "Active",
            },
            {
                "email": "driver.marcus@fleetflow.com",
                "license": "DL-TX-2014-3310",
                "experience": 11,
                "address": "901 Lonestar Way, Dallas, TX",
                "status": "Active",
            },
            {
                "email": "driver.priya@fleetflow.com",
                "license": "KA-01-2019-00431",
                "experience": 6,
                "address": "24 Outer Ring Road, Bellandur, Bengaluru, KA",
                "status": "Active",
            },
        ]

        driver_map = {}
        for d in drivers_data:
            u = user_map.get(d["email"])
            if not u:
                continue
            existing_d = db.query(Driver).filter(Driver.user_id == u.user_id).first()
            if existing_d:
                existing_d.license_number = d["license"]
                existing_d.experience_years = d["experience"]
                existing_d.address = d["address"]
                existing_d.status = d["status"]
                driver_map[d["email"]] = existing_d
            else:
                new_d = Driver(
                    user_id=u.user_id,
                    license_number=d["license"],
                    experience_years=d["experience"],
                    address=d["address"],
                    status=d["status"],
                    created_at=datetime.utcnow() - timedelta(days=60),
                )
                db.add(new_d)
                db.flush()
                driver_map[d["email"]] = new_d

        db.commit()
        print("✅ Drivers seeded successfully.")

        # -----------------------------------------------------------------
        # 3. VEHICLES
        # -----------------------------------------------------------------
        # Clean existing vehicle data to ensure rich, pristine records
        # Keep references clean
        vehicles_data = [
            {
                "key": "v1",
                "reg": "MH-12-FL-4021",
                "type": "Heavy Semi-Truck",
                "brand": "Volvo",
                "model": "FH16 750 Globetrotter",
                "year": 2023,
                "fuel": FuelType.Diesel,
                "capacity": 25000,
                "driver_email": "driver.rajesh@fleetflow.com",
                "status": VehicleStatus.InTransit,
            },
            {
                "key": "v2",
                "reg": "KA-01-EQ-9104",
                "type": "Delivery Van",
                "brand": "Mercedes-Benz",
                "model": "Sprinter 314 CDI Cargo",
                "year": 2024,
                "fuel": FuelType.Diesel,
                "capacity": 3500,
                "driver_email": "driver2@fleetflow.com",
                "status": VehicleStatus.InTransit,
            },
            {
                "key": "v3",
                "reg": "DL-01-AX-3819",
                "type": "Heavy Commercial Hauler",
                "brand": "Scania",
                "model": "R500 V8 Streamline",
                "year": 2022,
                "fuel": FuelType.Diesel,
                "capacity": 28000,
                "driver_email": "driver1@fleetflow.com",
                "status": VehicleStatus.InTransit,
            },
            {
                "key": "v4",
                "reg": "TS-09-EV-1002",
                "type": "Electric Cargo Van",
                "brand": "Rivian",
                "model": "EDV 700 Delivery",
                "year": 2024,
                "fuel": FuelType.Electric,
                "capacity": 4200,
                "driver_email": "driver.priya@fleetflow.com",
                "status": VehicleStatus.Assigned,
            },
            {
                "key": "v5",
                "reg": "TN-02-RF-7734",
                "type": "Reefer Cold Chain Truck",
                "brand": "Thermo King / Isuzu",
                "model": "FVR 34P Refrigerated",
                "year": 2023,
                "fuel": FuelType.Diesel,
                "capacity": 18000,
                "driver_email": "driver.marcus@fleetflow.com",
                "status": VehicleStatus.InTransit,
            },
            {
                "key": "v6",
                "reg": "GJ-06-HD-5582",
                "type": "Heavy Duty Multi-Axle",
                "brand": "BharatBenz",
                "model": "2823R Custom Cargo",
                "year": 2023,
                "fuel": FuelType.Diesel,
                "capacity": 28000,
                "driver_email": "driver.elena@fleetflow.com",
                "status": VehicleStatus.InTransit,
            },
            {
                "key": "v7",
                "reg": "MH-04-CN-2041",
                "type": "Light Commercial Van",
                "brand": "Tata",
                "model": "Intra V30 Smart High-Deck",
                "year": 2022,
                "fuel": FuelType.CNG,
                "capacity": 2200,
                "driver_email": None,
                "status": VehicleStatus.Available,
            },
            {
                "key": "v8",
                "reg": "KA-03-TR-8812",
                "type": "Flatbed Freight Carrier",
                "brand": "Eicher",
                "model": "Pro 3019 Flatbed Express",
                "year": 2023,
                "fuel": FuelType.Diesel,
                "capacity": 19000,
                "driver_email": None,
                "status": VehicleStatus.Available,
            },
            {
                "key": "v9",
                "reg": "DL-05-EV-9901",
                "type": "Electric Urban Van",
                "brand": "Tata",
                "model": "Ace EV Eco-Courier",
                "year": 2023,
                "fuel": FuelType.Electric,
                "capacity": 1200,
                "driver_email": None,
                "status": VehicleStatus.Maintenance,
            },
            {
                "key": "v10",
                "reg": "HR-26-PK-6210",
                "type": "Long Haul Prime Mover",
                "brand": "MAN",
                "model": "TGX 26.540 Individual Lion",
                "year": 2024,
                "fuel": FuelType.Diesel,
                "capacity": 26000,
                "driver_email": None,
                "status": VehicleStatus.Available,
            },
        ]

        veh_map = {}
        for v in vehicles_data:
            driver_obj = driver_map.get(v["driver_email"]) if v["driver_email"] else None
            existing_v = db.query(Vehicle).filter(Vehicle.registration_number == v["reg"]).first()
            if existing_v:
                existing_v.vehicle_type = v["type"]
                existing_v.brand = v["brand"]
                existing_v.model = v["model"]
                existing_v.manufacture_year = v["year"]
                existing_v.fuel_type = v["fuel"]
                existing_v.capacity = v["capacity"]
                existing_v.assigned_driver = driver_obj.driver_id if driver_obj else None
                existing_v.status = v["status"]
                veh_map[v["key"]] = existing_v
            else:
                new_v = Vehicle(
                    registration_number=v["reg"],
                    vehicle_type=v["type"],
                    brand=v["brand"],
                    model=v["model"],
                    manufacture_year=v["year"],
                    fuel_type=v["fuel"],
                    capacity=v["capacity"],
                    assigned_driver=driver_obj.driver_id if driver_obj else None,
                    status=v["status"],
                    created_at=datetime.utcnow() - timedelta(days=50),
                )
                db.add(new_v)
                db.flush()
                veh_map[v["key"]] = new_v

        db.commit()
        print("✅ Vehicles seeded successfully.")

        # -----------------------------------------------------------------
        # 4. SHIPMENTS
        # -----------------------------------------------------------------
        shipments_data = [
            {
                "key": "s1",
                "trk": "TRK-2026-9011",
                "source": "JNPT Port Freight Terminal, Navi Mumbai, MH",
                "destination": "Tata Motors Auto Hub, Pune, MH",
                "customer": "Tata Motors Logistics",
                "weight": 14200.0,
                "veh": "v1",
                "driver_email": "driver.rajesh@fleetflow.com",
                "status": ShipmentStatus.InTransit,
                "created_days_ago": 1,
            },
            {
                "key": "s2",
                "trk": "TRK-2026-9012",
                "source": "Electronics City Warehouse, Bengaluru, KA",
                "destination": "Chennai Maritime Port Complex, Chennai, TN",
                "customer": "Samsung Electronics India",
                "weight": 3200.0,
                "veh": "v2",
                "driver_email": "driver2@fleetflow.com",
                "status": ShipmentStatus.InTransit,
                "created_days_ago": 1,
            },
            {
                "key": "s3",
                "trk": "TRK-2026-9013",
                "source": "Delhi Inland Container Depot, Tughlakabad, DL",
                "destination": "Jaipur Express Logistics Park, Jaipur, RJ",
                "customer": "Amazon Fulfillment Services",
                "weight": 18500.0,
                "veh": "v3",
                "driver_email": "driver1@fleetflow.com",
                "status": ShipmentStatus.InTransit,
                "created_days_ago": 2,
            },
            {
                "key": "s4",
                "trk": "TRK-2026-9014",
                "source": "Genome Valley Bio-Park, Hyderabad, TS",
                "destination": "Whitefield Biotech Distribution, Bengaluru, KA",
                "customer": "PharmaCare Global Vaccine Logistics",
                "weight": 8400.0,
                "veh": "v5",
                "driver_email": "driver.marcus@fleetflow.com",
                "status": ShipmentStatus.InTransit,
                "created_days_ago": 1,
            },
            {
                "key": "s5",
                "trk": "TRK-2026-9015",
                "source": "Sanand Heavy Industrial Zone, Ahmedabad, GJ",
                "destination": "JNPT Maritime Gate 4, Navi Mumbai, MH",
                "customer": "Bosch Industrial Systems",
                "weight": 22000.0,
                "veh": "v6",
                "driver_email": "driver.elena@fleetflow.com",
                "status": ShipmentStatus.InTransit,
                "created_days_ago": 2,
            },
            {
                "key": "s6",
                "trk": "TRK-2026-9016",
                "source": "Chakan MIDC Industrial Park, Pune, MH",
                "destination": "Mormugao Port Authority, Vasco da Gama, GA",
                "customer": "FreshFoods International Exporters",
                "weight": 6500.0,
                "veh": "v1",
                "driver_email": "driver.rajesh@fleetflow.com",
                "status": ShipmentStatus.Delivered,
                "created_days_ago": 7,
            },
            {
                "key": "s7",
                "trk": "TRK-2026-9017",
                "source": "Sriperumbudur Auto Industrial Corridor, Chennai, TN",
                "destination": "Gachibowli Tech Distribution, Hyderabad, TS",
                "customer": "Hyundai Mobis Logistics",
                "weight": 11800.0,
                "veh": "v3",
                "driver_email": "driver1@fleetflow.com",
                "status": ShipmentStatus.Delivered,
                "created_days_ago": 12,
            },
            {
                "key": "s8",
                "trk": "TRK-2026-9018",
                "source": "Kolkata Port Trust Dock 2, Kolkata, WB",
                "destination": "Kalinga Industrial Estate, Bhubaneswar, OD",
                "customer": "Tata Steel Heavy Freight",
                "weight": 19500.0,
                "veh": "v6",
                "driver_email": "driver.elena@fleetflow.com",
                "status": ShipmentStatus.Delivered,
                "created_days_ago": 18,
            },
            {
                "key": "s9",
                "trk": "TRK-2026-9019",
                "source": "Gurgaon E-Commerce Hub, Gurugram, HR",
                "destination": "Industrial Area Phase 1, Chandigarh, CH",
                "customer": "IKEA Retail Logistics",
                "weight": 4100.0,
                "veh": None,
                "driver_email": None,
                "status": ShipmentStatus.Created,
                "created_days_ago": 1,
            },
            {
                "key": "s10",
                "trk": "TRK-2026-9020",
                "source": "MIHAN Multi-Modal Cargo Hub, Nagpur, MH",
                "destination": "Pithampur Industrial Corridor, Indore, MP",
                "customer": "Flipkart Supply Chain Solutions",
                "weight": 5500.0,
                "veh": "v4",
                "driver_email": "driver.priya@fleetflow.com",
                "status": ShipmentStatus.Assigned,
                "created_days_ago": 1,
            },
        ]

        shipment_map = {}
        for s in shipments_data:
            veh_obj = veh_map.get(s["veh"]) if s["veh"] else None
            driver_obj = driver_map.get(s["driver_email"]) if s["driver_email"] else None
            existing_s = db.query(Shipment).filter(Shipment.tracking_number == s["trk"]).first()
            if existing_s:
                existing_s.source = s["source"]
                existing_s.destination = s["destination"]
                existing_s.customer_name = s["customer"]
                existing_s.shipment_weight = s["weight"]
                existing_s.vehicle_id = veh_obj.vehicle_id if veh_obj else None
                existing_s.driver_id = driver_obj.driver_id if driver_obj else None
                existing_s.status = s["status"]
                shipment_map[s["key"]] = existing_s
            else:
                new_s = Shipment(
                    tracking_number=s["trk"],
                    source=s["source"],
                    destination=s["destination"],
                    customer_name=s["customer"],
                    shipment_weight=s["weight"],
                    vehicle_id=veh_obj.vehicle_id if veh_obj else None,
                    driver_id=driver_obj.driver_id if driver_obj else None,
                    status=s["status"],
                    created_at=datetime.utcnow() - timedelta(days=s["created_days_ago"]),
                )
                db.add(new_s)
                db.flush()
                shipment_map[s["key"]] = new_s

        db.commit()
        print("✅ Shipments seeded successfully.")

        # -----------------------------------------------------------------
        # 5. TRIPS
        # -----------------------------------------------------------------
        trips_data = [
            {
                "shipment_key": "s1",
                "veh_key": "v1",
                "driver_email": "driver.rajesh@fleetflow.com",
                "start": "Navi Mumbai, MH",
                "dest": "Pune, MH",
                "waypoints": ["Khopoli Toll Plaza", "Lonavala Bypass", "Tathawade Interchange"],
                "start_time": datetime.utcnow() - timedelta(hours=3),
                "end_time": None,
                "eta": datetime.utcnow() + timedelta(hours=1, minutes=30),
                "distance": 148.5,
                "duration": 3.2,
                "route_type": "Fastest",
                "status": TripStatus.InTransit,
            },
            {
                "shipment_key": "s2",
                "veh_key": "v2",
                "driver_email": "driver2@fleetflow.com",
                "start": "Bengaluru, KA",
                "dest": "Chennai, TN",
                "waypoints": ["Hosur Industrial Gateway", "Krishnagiri Toll Plaza", "Vellore Bypass", "Sriperumbudur Hub"],
                "start_time": datetime.utcnow() - timedelta(hours=4),
                "end_time": None,
                "eta": datetime.utcnow() + timedelta(hours=2, minutes=15),
                "distance": 346.0,
                "duration": 6.5,
                "route_type": "Fastest",
                "status": TripStatus.InTransit,
            },
            {
                "shipment_key": "s3",
                "veh_key": "v3",
                "driver_email": "driver1@fleetflow.com",
                "start": "New Delhi, DL",
                "dest": "Jaipur, RJ",
                "waypoints": ["Gurugram Kherki Daula", "Manesar Industrial Zone", "Neemrana Industrial Center", "Shahpura Toll"],
                "start_time": datetime.utcnow() - timedelta(hours=2, minutes=45),
                "end_time": None,
                "eta": datetime.utcnow() + timedelta(hours=2),
                "distance": 280.0,
                "duration": 5.0,
                "route_type": "Fastest",
                "status": TripStatus.InTransit,
            },
            {
                "shipment_key": "s4",
                "veh_key": "v5",
                "driver_email": "driver.marcus@fleetflow.com",
                "start": "Hyderabad, TS",
                "dest": "Bengaluru, KA",
                "waypoints": ["Jadcherla Expressway", "Kurnool Highway", "Anantapur Toll", "Chikkaballapur Gateway"],
                "start_time": datetime.utcnow() - timedelta(hours=6),
                "end_time": None,
                "eta": datetime.utcnow() + timedelta(hours=2, minutes=45),
                "distance": 570.0,
                "duration": 8.8,
                "route_type": "Eco-Friendly",
                "status": TripStatus.InTransit,
            },
            {
                "shipment_key": "s5",
                "veh_key": "v6",
                "driver_email": "driver.elena@fleetflow.com",
                "start": "Ahmedabad, GJ",
                "dest": "Navi Mumbai, MH",
                "waypoints": ["Vadodara Expressway", "Surat Ring Road", "Vapi Industrial Belt", "Manor Toll Plaza"],
                "start_time": datetime.utcnow() - timedelta(hours=7),
                "end_time": None,
                "eta": datetime.utcnow() + timedelta(hours=2, minutes=30),
                "distance": 525.0,
                "duration": 9.5,
                "route_type": "Fastest",
                "status": TripStatus.InTransit,
            },
            {
                "shipment_key": "s6",
                "veh_key": "v1",
                "driver_email": "driver.rajesh@fleetflow.com",
                "start": "Pune, MH",
                "dest": "Goa, GA",
                "waypoints": ["Satara Toll", "Kolhapur Bypass", "Belagavi Hub", "Chorla Ghat Road"],
                "start_time": datetime.utcnow() - timedelta(days=7, hours=10),
                "end_time": datetime.utcnow() - timedelta(days=7, hours=1),
                "eta": datetime.utcnow() - timedelta(days=7, hours=1),
                "distance": 448.0,
                "duration": 9.0,
                "route_type": "Fastest",
                "status": TripStatus.Completed,
            },
            {
                "shipment_key": "s7",
                "veh_key": "v3",
                "driver_email": "driver1@fleetflow.com",
                "start": "Chennai, TN",
                "dest": "Hyderabad, TS",
                "waypoints": ["Nellore Gateway", "Ongole Bypass", "Guntur Highway", "Nalgonda Interchange"],
                "start_time": datetime.utcnow() - timedelta(days=12, hours=12),
                "end_time": datetime.utcnow() - timedelta(days=12, hours=1, minutes=30),
                "eta": datetime.utcnow() - timedelta(days=12, hours=1),
                "distance": 625.0,
                "duration": 10.5,
                "route_type": "Fastest",
                "status": TripStatus.Completed,
            },
            {
                "shipment_key": "s8",
                "veh_key": "v6",
                "driver_email": "driver.elena@fleetflow.com",
                "start": "Kolkata, WB",
                "dest": "Bhubaneswar, OD",
                "waypoints": ["Kharagpur Freight Junction", "Balasore Toll", "Bhadrak Highway", "Cuttack Bridge Gateway"],
                "start_time": datetime.utcnow() - timedelta(days=18, hours=9),
                "end_time": datetime.utcnow() - timedelta(days=18, hours=1),
                "eta": datetime.utcnow() - timedelta(days=18, hours=1),
                "distance": 440.0,
                "duration": 8.0,
                "route_type": "Shortest",
                "status": TripStatus.Completed,
            },
        ]

        # Clean existing trips to avoid orphan duplicates
        db.query(Trip).delete()
        db.commit()

        created_trips = []
        for t in trips_data:
            shipment_obj = shipment_map.get(t["shipment_key"])
            veh_obj = veh_map.get(t["veh_key"])
            driver_obj = driver_map.get(t["driver_email"])

            if not (shipment_obj and veh_obj and driver_obj):
                continue

            new_trip = Trip(
                shipment_id=shipment_obj.shipment_id,
                vehicle_id=veh_obj.vehicle_id,
                driver_id=driver_obj.driver_id,
                start_location=t["start"],
                destination=t["dest"],
                waypoints=t["waypoints"],
                start_time=t["start_time"],
                end_time=t["end_time"],
                eta=t["eta"],
                distance=t["distance"],
                duration=t["duration"],
                route_type=t["route_type"],
                status=t["status"],
                created_at=t["start_time"],
            )
            db.add(new_trip)
            created_trips.append(new_trip)

        db.commit()
        print("✅ Trips seeded successfully.")

        # -----------------------------------------------------------------
        # 6. GPS TRACKING BREADCRUMBS & LIVE POSITIONS
        # -----------------------------------------------------------------
        # Real-world corridor routes with accurate latitude/longitude steps
        routes_coords = {
            "v1": [  # Mumbai -> Pune Expressway
                (18.9894, 73.0232, 62.5), # Navi Mumbai
                (18.8950, 73.1700, 78.0), # Panvel
                (18.7900, 73.3400, 84.5), # Khopoli Toll
                (18.7500, 73.4100, 65.0), # Khandala Ghats
                (18.7540, 73.4450, 72.0), # Lonavala
                (18.6800, 73.6800, 88.0), # Talegaon
                (18.6200, 73.7800, 58.0), # Tathawade / Pune outskirts
            ],
            "v2": [  # Bengaluru -> Chennai NH48
                (12.8450, 77.6600, 54.0), # Electronic City
                (12.7300, 77.8300, 75.0), # Hosur
                (12.5200, 78.2100, 82.0), # Krishnagiri
                (12.6500, 78.6800, 80.0), # Ambur
                (12.9200, 79.1300, 76.5), # Vellore
                (12.9800, 79.7000, 70.0), # Ranipet
                (13.0000, 79.9700, 60.0), # Sriperumbudur
            ],
            "v3": [  # Delhi -> Jaipur NH48
                (28.5300, 77.0700, 48.0), # Gurugram border
                (28.3500, 76.9300, 76.0), # Manesar
                (28.1600, 76.7800, 84.0), # Dharuhera
                (27.9800, 76.3800, 80.0), # Neemrana
                (27.7000, 76.0500, 78.0), # Kotputli
                (27.4200, 75.9600, 82.0), # Shahpura
            ],
            "v5": [  # Hyderabad -> Bengaluru NH44
                (17.2400, 78.4300, 65.0), # Shamshabad Airport
                (16.8200, 78.1800, 86.0), # Shadnagar
                (16.5800, 77.9800, 88.0), # Jadcherla
                (15.8200, 78.0300, 82.0), # Kurnool
                (15.1500, 77.6200, 84.0), # Gooty
                (14.6800, 77.6000, 80.0), # Anantapur
            ],
            "v6": [  # Ahmedabad -> Mumbai NH48
                (22.9500, 72.6000, 75.0), # Ahmedabad ring
                (22.5600, 72.9500, 88.0), # Anand
                (22.3000, 73.1800, 84.0), # Vadodara
                (21.7000, 72.9900, 80.0), # Bharuch / Narmada Bridge
                (21.1700, 72.8300, 68.0), # Surat
                (20.3700, 72.9000, 74.0), # Vapi
            ],
        }

        # Clear existing gps breadcrumbs
        db.query(GPSTracking).delete()
        db.commit()

        for vkey, coords in routes_coords.items():
            veh_obj = veh_map.get(vkey)
            if not veh_obj:
                continue

            # Add sequence of historical points up to current
            t_base = datetime.utcnow() - timedelta(minutes=len(coords) * 20)
            for idx, (lat, lon, spd) in enumerate(coords):
                t_point = t_base + timedelta(minutes=idx * 20)
                gps_entry = GPSTracking(
                    vehicle_id=veh_obj.vehicle_id,
                    latitude=lat,
                    longitude=lon,
                    speed=spd,
                    recorded_time=t_point,
                )
                db.add(gps_entry)

        db.commit()
        print("✅ GPS Tracking data seeded successfully.")

        # -----------------------------------------------------------------
        # 7. VEHICLE MAINTENANCE
        # -----------------------------------------------------------------
        today = date.today()
        # Allowed maintenance_type values: 'Oil Change','Tire Replacement','Engine Service','Brake Service','General Inspection'
        maintenance_data = [
            {
                "veh_key": "v1",
                "type": "Oil Change",
                "service_date": today - timedelta(days=45),
                "next_service_date": today + timedelta(days=25),
                "cost": Decimal("480.00"),
                "remarks": "Replaced synthetic 15W-40 oil, OEM fuel filters, and air filtration cartridges. Volvo FH16 750.",
                "status": "Completed",
                "is_resolved": True,
            },
            {
                "veh_key": "v2",
                "type": "Brake Service",
                "service_date": today - timedelta(days=20),
                "next_service_date": today + timedelta(days=70),
                "cost": Decimal("320.00"),
                "remarks": "Front ceramic brake pads installed on Sprinter 314 CDI. Brake fluid flushed and pressure tested.",
                "status": "Completed",
                "is_resolved": True,
            },
            {
                "veh_key": "v3",
                "type": "Engine Service",
                "service_date": today - timedelta(days=10),
                "next_service_date": today + timedelta(days=80),
                "cost": Decimal("650.00"),
                "remarks": "Scania R500 V8: automated gearbox calibration, fresh synthetic transmission fluid, injector test.",
                "status": "Completed",
                "is_resolved": True,
            },
            {
                "veh_key": "v4",
                "type": "General Inspection",
                "service_date": today - timedelta(days=15),
                "next_service_date": today + timedelta(days=4),
                "cost": Decimal("220.00"),
                "remarks": "Rivian EDV 700: HV battery SoH at 98.4%. Inverter coolant inspected. Charging port verified.",
                "status": "Scheduled",
                "is_resolved": False,
            },
            {
                "veh_key": "v5",
                "type": "General Inspection",
                "service_date": today - timedelta(days=35),
                "next_service_date": today + timedelta(days=6),
                "cost": Decimal("540.00"),
                "remarks": "Isuzu FVR Reefer: refrigeration compressor service, thermostat calibrated at -20 C, TK unit inspected.",
                "status": "Scheduled",
                "is_resolved": False,
            },
            {
                "veh_key": "v6",
                "type": "Tire Replacement",
                "service_date": today - timedelta(days=90),
                "next_service_date": today - timedelta(days=3),
                "cost": Decimal("380.00"),
                "remarks": "BharatBenz 2823R multi-axle alignment OVERDUE. Tread depth at 3.8mm on rear axle. Immediate action required.",
                "status": "Pending",
                "is_resolved": False,
            },
            {
                "veh_key": "v9",
                "type": "Engine Service",
                "service_date": today - timedelta(days=2),
                "next_service_date": today + timedelta(days=2),
                "cost": Decimal("750.00"),
                "remarks": "Tata Ace EV: regenerative braking inverter fault code DTC-P0A80. Powertrain module under repair.",
                "status": "In Progress",
                "is_resolved": False,
            },
            {
                "veh_key": "v8",
                "type": "General Inspection",
                "service_date": today - timedelta(days=60),
                "next_service_date": today + timedelta(days=30),
                "cost": Decimal("290.00"),
                "remarks": "Eicher Pro 3019 flatbed: hydraulic seals replaced, pressure valve tested to 2.5 ton payload capacity.",
                "status": "Completed",
                "is_resolved": True,
            },
            {
                "veh_key": "v1",
                "type": "Tire Replacement",
                "service_date": today - timedelta(days=80),
                "next_service_date": today + timedelta(days=50),
                "cost": Decimal("920.00"),
                "remarks": "Volvo FH16: all 10 drive tires replaced with Michelin X Multi Energy D. Wheel torque: 650 Nm.",
                "status": "Completed",
                "is_resolved": True,
            },
            {
                "veh_key": "v10",
                "type": "Oil Change",
                "service_date": today - timedelta(days=30),
                "next_service_date": today + timedelta(days=40),
                "cost": Decimal("520.00"),
                "remarks": "MAN TGX 26.540: engine oil change with Shell Rimula R4L 15W-40, fuel separator replaced.",
                "status": "Completed",
                "is_resolved": True,
            },
            {
                "veh_key": "v3",
                "type": "Brake Service",
                "service_date": today - timedelta(days=50),
                "next_service_date": today - timedelta(days=2),
                "cost": Decimal("410.00"),
                "remarks": "Scania R500: brake chamber inspection, lining thickness 5mm (min 4mm). Overdue re-inspection.",
                "status": "Pending",
                "is_resolved": False,
            },
        ]

        db.query(VehicleMaintenance).delete()
        db.commit()

        for m in maintenance_data:
            veh_obj = veh_map.get(m["veh_key"])
            if not veh_obj:
                continue
            maint_entry = VehicleMaintenance(
                vehicle_id=veh_obj.vehicle_id,
                maintenance_type=m["type"],
                service_date=m["service_date"],
                next_service_date=m["next_service_date"],
                cost=m["cost"],
                remarks=m["remarks"],
                status=m["status"],
                is_resolved=m["is_resolved"],
            )
            db.add(maint_entry)

        db.commit()
        print("✅ Vehicle Maintenance data seeded successfully.")

        # -----------------------------------------------------------------
        # 8. FUEL RECORDS
        # -----------------------------------------------------------------
        db.query(FuelRecord).delete()
        db.commit()

        fuel_configs = [
            ("v1", 280.0, 95.50, 4.2),  # Volvo FH16 - 280 Litres
            ("v2", 65.0, 95.50, 11.5),  # Sprinter Van - 65 Litres
            ("v3", 310.0, 95.50, 3.8),  # Scania R500 - 310 Litres
            ("v5", 190.0, 95.50, 5.4),  # Reefer Truck - 190 Litres
            ("v6", 320.0, 95.50, 3.6),  # BharatBenz 2823R - 320 Litres
            ("v7", 40.0, 78.00, 14.8),  # CNG Intra - 40 kg
            ("v8", 160.0, 95.50, 6.2),  # Eicher Flatbed - 160 Litres
            ("v10", 290.0, 95.50, 4.0), # MAN TGX - 290 Litres
        ]

        # Generate fuel logs spanning the last 60 days
        for days_ago in [55, 45, 35, 25, 18, 10, 3]:
            log_date = today - timedelta(days=days_ago)
            for vkey, litres, price_per_unit, kmpl in fuel_configs:
                veh_obj = veh_map.get(vkey)
                if not veh_obj:
                    continue

                # Slight realistic variation per fill
                actual_litres = round(litres * (0.85 + (days_ago % 5) * 0.05), 1)
                cost = round(Decimal(str(actual_litres * price_per_unit)), 2)
                mileage = round(Decimal(str(kmpl + ((days_ago % 3) * 0.2))), 2)

                fuel_log = FuelRecord(
                    vehicle_id=veh_obj.vehicle_id,
                    fuel_amount=Decimal(str(actual_litres)),
                    fuel_cost=cost,
                    mileage=mileage,
                    refill_date=log_date,
                )
                db.add(fuel_log)

        db.commit()
        print("✅ Fuel records seeded successfully.")

        # -----------------------------------------------------------------
        # 9. DRIVER ATTENDANCE
        # -----------------------------------------------------------------
        db.query(Attendance).delete()
        db.commit()

        # Seed past 14 days of attendance for each driver
        for days_ago in range(14, -1, -1):
            att_date = today - timedelta(days=days_ago)
            # Skip Sundays
            if att_date.weekday() == 6:
                continue

            for demail, driver_obj in driver_map.items():
                # Realistic distribution: mostly Present, occasional Leave or Absent
                if days_ago == 8 and demail == "driver1@fleetflow.com":
                    status = "Leave"
                elif days_ago == 4 and demail == "driver.priya@fleetflow.com":
                    status = "Absent"
                elif days_ago == 12 and demail == "driver.elena@fleetflow.com":
                    status = "Leave"
                elif days_ago == 6 and demail == "driver.marcus@fleetflow.com":
                    status = "Absent"
                else:
                    status = "Present"

                att_entry = Attendance(
                    driver_id=driver_obj.driver_id,
                    attendance_date=att_date,
                    status=status,
                )
                db.add(att_entry)

        db.commit()
        print("✅ Driver Attendance seeded successfully.")

        # -----------------------------------------------------------------
        # 10. SYSTEM NOTIFICATIONS
        # -----------------------------------------------------------------
        db.query(Notification).delete()
        db.commit()

        admin_user = user_map.get("admin@fleetflow.com")
        manager_user = user_map.get("manager@fleetflow.com")
        target_uid = admin_user.user_id if admin_user else None

        notifications_data = [
            {
                "title": "Geofence Alert: Vehicle Entered Hub",
                "message": "Vehicle MH-12-FL-4021 (Volvo FH16) has entered the Pune Logistics Hub geofence perimeter.",
                "type": "info",
                "is_read": False,
                "minutes_ago": 15,
            },
            {
                "title": "Shipment Out for Final Delivery",
                "message": "Shipment TRK-2026-9012 (Samsung Electronics) is 35 km away from Chennai Maritime Terminal.",
                "type": "info",
                "is_read": False,
                "minutes_ago": 45,
            },
            {
                "title": "Overdue Maintenance Notice",
                "message": "Vehicle GJ-06-HD-5582 (BharatBenz 2823R) has exceeded scheduled service date for Multi-Axle Alignment.",
                "type": "warning",
                "is_read": False,
                "minutes_ago": 120,
            },
            {
                "title": "Shipment Delivered Successfully",
                "message": "Shipment TRK-2026-9016 has been delivered on time to Mormugao Port Authority, Goa.",
                "type": "success",
                "is_read": True,
                "minutes_ago": 360,
            },
            {
                "title": "Optimal Route Recalculation",
                "message": "Trip from Delhi to Jaipur redirected via NH48 Express Bypass due to traffic congestion near Manesar.",
                "type": "info",
                "is_read": True,
                "minutes_ago": 480,
            },
            {
                "title": "EV Charging Cycle Completed",
                "message": "Electric Cargo Van TS-09-EV-1002 has completed fast DC charging to 100% capacity.",
                "type": "success",
                "is_read": True,
                "minutes_ago": 720,
            },
        ]

        for n in notifications_data:
            notif = Notification(
                user_id=target_uid,
                title=n["title"],
                message=n["message"],
                type=n["type"],
                is_read=n["is_read"],
                created_at=datetime.utcnow() - timedelta(minutes=n["minutes_ago"]),
            )
            db.add(notif)

        db.commit()
        print("✅ Notifications seeded successfully.")

        print("\n🎉 ALL MEANINGFUL FLEETFLOW DATA HAS BEEN SEEDED SUCCESSFULLY!")

    except Exception as exc:
        print("❌ Error during database seeding:", exc)
        db.rollback()
        raise exc
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
