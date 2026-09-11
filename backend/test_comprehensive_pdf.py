from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.core.security import create_access_token

client = TestClient(app)

def test_all():
    print("Testing comprehensive PDF endpoints...")

    admin_token = create_access_token({"sub": "admin@fleetflow.com", "role": "Admin"})
    driver_token = create_access_token({"sub": "dhar@gmail.com", "role": "Driver"})

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    # 1. Test Notifications
    res = client.get("/notifications/", headers=admin_headers)
    assert res.status_code == 200, f"Failed notifications: {res.text}"
    print(f"  [OK] Notifications list: {len(res.json())} items")

    res = client.get("/notifications/unread-count", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Unread count: {res.json()}")

    # 2. Test Attendance
    res = client.get("/attendance/", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Attendance list: {len(res.json())} items")

    # 3. Test Shipment History & Alerts
    res = client.get("/shipments/history", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Shipment history: {len(res.json())} items")

    res = client.get("/shipments/alerts", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Shipment alerts: {len(res.json())} items")

    # 4. Test Maintenance Alert Trigger
    res = client.post("/maintenance/check-alerts", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Maintenance alert check: {res.json()}")

    # 5. Test Admin User Management
    res = client.get("/users/", headers=admin_headers)
    assert res.status_code == 200
    print(f"  [OK] Admin list users: {len(res.json())} users")

    # 6. Test Driver blocked from Admin endpoints (403)
    res = client.get("/users/", headers=driver_headers)
    assert res.status_code == 403
    print("  [OK] RBAC 403 blocked driver from user list")

    print("\nALL PDF REQUIREMENTS VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    test_all()
