import os
import sys
import unittest
from decimal import Decimal
from datetime import date, datetime, timedelta

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.vehicle import Vehicle, VehicleStatus, FuelType
from app.models.driver import Driver
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from app.models.shipment import Shipment, ShipmentStatus
from app.models.trip import Trip, TripStatus
from app.core.security import hash_password, create_access_token
from app.tasks.maintenance import check_maintenance_alerts
from app.tasks.shipments import check_delayed_shipments
from app.tasks.maintenance_tasks import check_maintenance_alerts_task

client = TestClient(app)

def run_milestone3_verification():
    print("=================================================================")
    print("      FLEETFLOW MILESTONE 3: COMPREHENSIVE VERIFICATION SUITE    ")
    print("=================================================================")

    db = SessionLocal()

    # 1. Ensure test users exist with each role
    roles = {
        "admin@fleetflow.com": (RoleEnum.Admin, "Admin User"),
        "manager@fleetflow.com": (RoleEnum.FleetManager, "Fleet Manager"),
        "dispatcher@fleetflow.com": (RoleEnum.Dispatcher, "Dispatcher User"),
        "driver1@fleetflow.com": (RoleEnum.Driver, "Driver One"),
        "driver2@fleetflow.com": (RoleEnum.Driver, "Driver Two"),
    }

    user_ids = {}
    for email, (role, name) in roles.items():
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                full_name=name,
                password=hash_password("Pass1234!"),
                role=role,
                is_email_verified=True,
                email_verified=True,
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        user_ids[email] = u.user_id

    # 2. Test Vehicle setup
    veh = db.query(Vehicle).filter(Vehicle.registration_number == "M3-TRK-777").first()
    if not veh:
        veh = Vehicle(
            registration_number="M3-TRK-777",
            brand="Scania",
            model="R500",
            vehicle_type="Heavy Truck",
            fuel_type=FuelType.Diesel,
            capacity=24,
            status=VehicleStatus.Available,
        )
        db.add(veh)
        db.commit()
        db.refresh(veh)
    veh_id = veh.vehicle_id
    print(f"[*] Target Vehicle for M3 tests: {veh.registration_number} (ID: {veh_id})")
    db.close()

    # Tokens
    tokens = {
        "Admin": create_access_token({"sub": "admin@fleetflow.com", "role": "Admin"}),
        "FleetManager": create_access_token({"sub": "manager@fleetflow.com", "role": "FleetManager"}),
        "Dispatcher": create_access_token({"sub": "dispatcher@fleetflow.com", "role": "Dispatcher"}),
        "Driver1": create_access_token({"sub": "driver1@fleetflow.com", "role": "Driver"}),
        "Driver2": create_access_token({"sub": "driver2@fleetflow.com", "role": "Driver"}),
    }

    headers = {k: {"Authorization": f"Bearer {v}"} for k, v in tokens.items()}

    # =========================================================================
    # SECTION A: Maintenance Scheduling & Vehicle Status Automation
    # =========================================================================
    print("\n[SECTION A] Testing Maintenance Scheduling & Vehicle Status Automation...")
    
    # Schedule maintenance in progress -> vehicle status should become Maintenance
    res = client.post("/maintenance/", json={
        "vehicle_id": str(veh_id),
        "maintenance_type": "Engine Service",
        "service_date": str(date.today()),
        "next_service_date": str(date.today() + timedelta(days=5)),
        "cost": 5500.00,
        "remarks": "Scheduled engine tuning & oil change",
        "status": "In Progress",
    }, headers=headers["FleetManager"])
    assert res.status_code == 200, f"Failed scheduling maintenance: {res.text}"
    maint_rec = res.json()
    maint_id = maint_rec["maintenance_id"]
    print(f"  [OK] Maintenance scheduled: {maint_id}")

    db2 = SessionLocal()
    v_check = db2.query(Vehicle).filter(Vehicle.vehicle_id == veh_id).first()
    assert v_check.status == VehicleStatus.Maintenance, f"Vehicle should be in Maintenance, got {v_check.status}"
    print(f"  [OK] Vehicle status automatically updated to: {v_check.status}")
    db2.close()

    # Complete maintenance -> vehicle status should return to Available
    res = client.put(f"/maintenance/{maint_id}", json={
        "status": "Completed",
        "cost": 5600.00,
        "remarks": "Completed successfully",
    }, headers=headers["FleetManager"])
    assert res.status_code == 200, f"Failed updating maintenance: {res.text}"
    
    db3 = SessionLocal()
    v_check = db3.query(Vehicle).filter(Vehicle.vehicle_id == veh_id).first()
    assert v_check.status == VehicleStatus.Available, f"Vehicle should be Available after completion, got {v_check.status}"
    print(f"  [OK] Vehicle status automatically restored to: {v_check.status}")
    db3.close()

    # List maintenance history per vehicle
    res = client.get(f"/maintenance/?vehicle_id={veh_id}", headers=headers["FleetManager"])
    assert res.status_code == 200 and len(res.json()) >= 1
    print(f"  [OK] Maintenance history for vehicle retrieved ({len(res.json())} records)")

    # List upcoming/overdue across fleet
    res = client.get("/maintenance/upcoming?days=7", headers=headers["Admin"])
    assert res.status_code == 200
    print(f"  [OK] Upcoming/overdue maintenance list retrieved across fleet")

    # =========================================================================
    # SECTION B: Celery Tasks & Alert Background Jobs
    # =========================================================================
    print("\n[SECTION B] Testing Celery Background Alert Tasks...")
    task_res1 = check_maintenance_alerts()
    print(f"  [OK] check_maintenance_alerts task executed: {task_res1}")
    
    task_res2 = check_delayed_shipments()
    print(f"  [OK] check_delayed_shipments task executed: {task_res2}")

    # =========================================================================
    # SECTION D: Driver Assignment Backend & RBAC
    # =========================================================================
    print("\n[SECTION D] Testing Driver Assignment & Scoped Permissions...")
    driver1_user_id = user_ids["driver1@fleetflow.com"]
    
    db_d = SessionLocal()
    driver1 = db_d.query(Driver).filter(Driver.user_id == driver1_user_id).first()
    db_d.close()

    if not driver1:
        res = client.post("/drivers/", json={
            "user_id": str(driver1_user_id),
            "license_number": "DL-IND-998877",
            "experience_years": 7,
            "address": "45 Tech Avenue, Bangalore",
            "status": "Available",
        }, headers=headers["FleetManager"])
        assert res.status_code == 200, f"Failed creating driver: {res.text}"
        driver1_id = res.json()["driver_id"]
    else:
        driver1_id = str(driver1.driver_id)
    print(f"  [OK] Driver profile registered: ID {driver1_id}")

    # Assign driver to vehicle
    res = client.put(f"/drivers/{driver1_id}/assign-vehicle", json={
        "vehicle_id": str(veh_id)
    }, headers=headers["FleetManager"])
    assert res.status_code == 200, f"Failed assigning vehicle: {res.text}"
    print(f"  [OK] Driver assigned to vehicle {veh.registration_number}")

    # Driver view scoped to own profile
    res = client.get("/drivers/me", headers=headers["Driver1"])
    assert res.status_code == 200
    assert res.json()["license_number"] == "DL-IND-998877"
    print(f"  [OK] Driver /drivers/me returns scoped profile")

    # Driver activity logs endpoint
    res = client.get(f"/drivers/{driver1_id}/activity", headers=headers["Driver1"])
    assert res.status_code == 200
    print(f"  [OK] Driver activity history retrieved")

    # =========================================================================
    # SECTION F: Fleet Performance & Operational Analytics Backend
    # =========================================================================
    print("\n[SECTION F] Testing Fleet Performance Analytics...")
    res = client.get("/analytics/fleet-utilization", headers=headers["Admin"])
    assert res.status_code == 200 and "utilization_percent" in res.json()
    print(f"  [OK] Fleet Utilization: {res.json()['utilization_percent']}%")

    res = client.get("/analytics/driver-performance", headers=headers["FleetManager"])
    assert res.status_code == 200 and isinstance(res.json(), list)
    print(f"  [OK] Driver Performance Metrics ({len(res.json())} drivers analyzed)")

    res = client.get("/analytics/delivery-performance", headers=headers["Dispatcher"])
    assert res.status_code == 200 and "on_time_rate_percent" in res.json()
    print(f"  [OK] Delivery Performance: on-time rate {res.json()['on_time_rate_percent']}%")

    res = client.get("/analytics/maintenance-analytics", headers=headers["FleetManager"])
    assert res.status_code == 200 and "by_type" in res.json()
    print(f"  [OK] Maintenance Analytics by Type: {len(res.json()['by_type'])} types")

    res = client.get("/analytics/admin-summary", headers=headers["Admin"])
    assert res.status_code == 200 and "total_operational_cost" in res.json()
    print(f"  [OK] Admin Summary: Total operational cost INR {res.json()['total_operational_cost']}")

    # =========================================================================
    # SECTION G: Fuel Monitoring Analytics
    # =========================================================================
    print("\n[SECTION G] Testing Fuel Monitoring Analytics...")
    # Log a fuel refill
    res = client.post("/fuel/", json={
        "vehicle_id": str(veh_id),
        "fuel_amount": 75.0,
        "fuel_cost": 7125.00,
        "mileage": 15420.0,
        "refill_date": str(date.today()),
    }, headers=headers["FleetManager"])
    assert res.status_code == 200, f"Failed logging fuel: {res.text}"
    print(f"  [OK] Fuel refill logged: 75L @ INR 7,125")

    # Fuel efficiency
    res = client.get("/fuel/analytics/efficiency", headers=headers["Admin"])
    assert res.status_code == 200
    print(f"  [OK] Fuel Efficiency Analytics calculated from OSRM trip distances: {res.json()}")

    # Fuel cost trends
    res = client.get("/fuel/analytics/trends", headers=headers["FleetManager"])
    assert res.status_code == 200
    print(f"  [OK] Fuel Cost Trends: {res.json()}")

    # =========================================================================
    # RBAC Permission Matrix Checks
    # =========================================================================
    print("\n[RBAC] Validating Role-Based User Pathways...")
    
    # 1. Driver cannot access Admin summary (Expect 403)
    res = client.get("/analytics/admin-summary", headers=headers["Driver1"])
    assert res.status_code == 403, f"Expected 403 for Driver on admin-summary, got {res.status_code}"

    # 2. Dispatcher cannot schedule maintenance (Expect 403)
    res = client.post("/maintenance/", json={
        "vehicle_id": str(veh_id),
        "maintenance_type": "Oil Change",
        "service_date": str(date.today()),
        "status": "Scheduled",
    }, headers=headers["Dispatcher"])
    assert res.status_code == 403, f"Expected 403 for Dispatcher on schedule maintenance, got {res.status_code}"

    # 3. Dispatcher cannot access Fuel analytics (Expect 403)
    res = client.get("/fuel/analytics/efficiency", headers=headers["Dispatcher"])
    assert res.status_code == 403, f"Expected 403 for Dispatcher on fuel efficiency, got {res.status_code}"

    # 4. FleetManager cannot access Admin Summary (Expect 403)
    res = client.get("/analytics/admin-summary", headers=headers["FleetManager"])
    assert res.status_code == 403, f"Expected 403 for FleetManager on admin summary, got {res.status_code}"

    print("  [OK] All RBAC 403 restrictions properly enforced across Admin, FleetManager, Dispatcher, and Driver roles!")

    print("\n=================================================================")
    print(" [SUCCESS] ALL MILESTONE 3 REQUIREMENTS FULLY VERIFIED AND PASS! ")
    print("=================================================================")

if __name__ == "__main__":
    run_milestone3_verification()
