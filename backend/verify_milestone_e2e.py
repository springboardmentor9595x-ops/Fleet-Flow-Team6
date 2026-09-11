import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.maintenance import VehicleMaintenance
from app.core.security import create_access_token

client = TestClient(app)

def test_full_milestone():
    db = SessionLocal()
    print("==================================================")
    print("[*] VERIFYING FULL MILESTONE END-TO-END")
    print("==================================================")

    # 1. Ensure Admin User
    admin = db.query(User).filter(User.role == RoleEnum.Admin).first()
    if not admin:
        admin = User(
            email="admin@fleetflow.io",
            full_name="Fleet Admin",
            role=RoleEnum.Admin,
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    admin_token = create_access_token({"sub": admin.email, "role": str(admin.role.value)})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Test Root
    res = client.get("/")
    assert res.status_code == 200
    print("[OK] API Root running:", res.json())

    # 3. Test Dashboard & Analytics
    res = client.get("/dashboard/summary", headers=headers)
    assert res.status_code == 200
    print("[OK] Dashboard Summary:", res.json())

    res = client.get("/analytics/fleet-utilization", headers=headers)
    assert res.status_code == 200
    print("[OK] Analytics Fleet Utilization:", res.json())

    res = client.get("/analytics/maintenance-analytics", headers=headers)
    assert res.status_code == 200
    print("[OK] Analytics Maintenance:", res.json())

    # 4. Test Maintenance APIs
    res = client.get("/maintenance/", headers=headers)
    assert res.status_code == 200
    print(f"[OK] Maintenance List: {len(res.json())} records retrieved")

    res = client.get("/maintenance/upcoming?days=14", headers=headers)
    assert res.status_code == 200
    print(f"[OK] Maintenance Upcoming (14d): {len(res.json())} records retrieved")

    # 5. Test Trigger Alert & Celery Status
    res = client.post("/maintenance/check-alerts?days=7", headers=headers)
    assert res.status_code == 200
    print("[OK] Check Alerts Endpoint:", res.json())

    res = client.get("/maintenance/worker-status", headers=headers)
    assert res.status_code == 200
    print("[OK] Worker Status Endpoint:", res.json())

    # 6. Test Notifications API
    res = client.get("/notifications/", headers=headers)
    assert res.status_code == 200
    print(f"[OK] Notifications List: {len(res.json())} notifications found")

    res = client.get("/notifications/unread-count", headers=headers)
    assert res.status_code == 200
    print("[OK] Notifications Unread Count:", res.json())

    # 7. Test Fuel Records & Efficiency
    res = client.get("/fuel/", headers=headers)
    assert res.status_code == 200
    print(f"[OK] Fuel Records List: {len(res.json())} records")

    res = client.get("/fuel/analytics/efficiency", headers=headers)
    assert res.status_code == 200
    print("[OK] Fuel Efficiency Analytics:", res.json())

    # 8. Test Drivers List
    res = client.get("/drivers/", headers=headers)
    assert res.status_code == 200
    print(f"[OK] Drivers List: {len(res.json())} drivers")

    print("\n==================================================")
    print("[SUCCESS] ALL MILESTONE REQUIREMENTS VERIFIED 100%!")
    print("==================================================")
    db.close()

if __name__ == "__main__":
    test_full_milestone()
