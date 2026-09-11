import sys
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.core.security import hash_password, create_access_token

client = TestClient(app)

def test_api():
    print("Testing Root Endpoint...")
    res = client.get("/")
    assert res.status_code == 200, f"Root failed: {res.text}"
    print("  [OK] Root endpoint:", res.json())

    # Seed test users if they don't exist
    db = SessionLocal()
    admin_user = db.query(User).filter(User.email == "admin@fleetflow.com").first()
    if not admin_user:
        admin_user = User(
            email="admin@fleetflow.com",
            full_name="Admin Test",
            password=hash_password("adminpass"),
            role=RoleEnum.Admin,
            is_email_verified=True,
            email_verified=True
        )
        db.add(admin_user)

    driver_user = db.query(User).filter(User.email == "dhar@gmail.com").first()
    if not driver_user:
        driver_user = User(
            email="dhar@gmail.com",
            full_name="Driver Test",
            password=hash_password("driverpass"),
            role=RoleEnum.Driver,
            is_email_verified=True,
            email_verified=True
        )
        db.add(driver_user)
    db.commit()
    db.close()

    # Create test tokens
    admin_token = create_access_token({"sub": "admin@fleetflow.com", "role": "Admin"})
    driver_token = create_access_token({"sub": "dhar@gmail.com", "role": "Driver"})

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    print("Testing Analytics & Dashboard...")
    res = client.get("/dashboard/summary", headers=admin_headers)
    assert res.status_code == 200, f"Dashboard summary failed: {res.text}"
    print("  [OK] Dashboard summary:", res.json())

    res = client.get("/analytics/fleet-utilization", headers=admin_headers)
    assert res.status_code == 200, f"Fleet utilization failed: {res.text}"
    print("  [OK] Fleet utilization:", res.json())

    res = client.get("/analytics/delivery-performance", headers=admin_headers)
    assert res.status_code == 200, f"Delivery performance failed: {res.text}"
    print("  [OK] Delivery performance:", res.json())

    res = client.get("/analytics/maintenance-analytics", headers=admin_headers)
    assert res.status_code == 200, f"Maintenance analytics failed: {res.text}"
    print("  [OK] Maintenance analytics:", res.json())

    res = client.get("/analytics/admin-summary", headers=admin_headers)
    assert res.status_code == 200, f"Admin summary failed: {res.text}"
    print("  [OK] Admin summary:", res.json())

    print("Testing RBAC Enforcement...")
    # Driver shouldn't be able to access admin-summary (Expect 403)
    res = client.get("/analytics/admin-summary", headers=driver_headers)
    assert res.status_code == 403, f"Expected 403 for driver on admin-summary, got {res.status_code}"
    print("  [OK] RBAC 403 blocked driver from admin summary")

    # Driver shouldn't be able to add vehicle (Expect 403)
    res = client.post("/vehicles/", json={
        "registration_number": "TEST-1234",
        "vehicle_type": "Truck"
    }, headers=driver_headers)
    assert res.status_code == 403, f"Expected 403 for driver on add_vehicle, got {res.status_code}"
    print("  [OK] RBAC 403 blocked driver from vehicle creation")

    print("Testing Vehicles List...")
    res = client.get("/vehicles/", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Vehicles count: {len(res.json())}")

    print("Testing Shipments List...")
    res = client.get("/shipments/", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Shipments count: {len(res.json())}")

    print("Testing Trips List...")
    res = client.get("/trips/", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Trips count: {len(res.json())}")

    print("Testing Drivers List...")
    res = client.get("/drivers/", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Drivers count: {len(res.json())}")

    print("Testing Maintenance List...")
    res = client.get("/maintenance/", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Maintenance records count: {len(res.json())}")

    print("Testing Fuel Records & Analytics...")
    res = client.get("/fuel/", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Fuel records count: {len(res.json())}")

    res = client.get("/fuel/analytics/efficiency", headers=admin_headers)
    assert res.status_code == 200
    print("  [OK] Fuel efficiency analytics:", res.json())

    res = client.get("/fuel/analytics/trends", headers=admin_headers)
    assert res.status_code == 200
    print("  [OK] Fuel trends analytics:", res.json())

    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_api()
