import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.maintenance import VehicleMaintenance
from app.models.notification import Notification
from app.routers.dashboard import get_dashboard_summary
from app.routers.analytics import fleet_utilization, maintenance_analytics, driver_performance, delivery_performance, admin_summary
from app.routers.maintenance import list_maintenance, list_upcoming, check_maintenance_alerts, get_worker_status
from app.routers.fuel_record import list_fuel, fuel_efficiency, fuel_trends
from app.routers.notification import list_notifications, get_unread_count
from app.routers.driver import get_drivers
from app.tasks.maintenance_tasks import check_maintenance_alerts_task, generate_maintenance_fleet_report_task

def run_checks():
    db = SessionLocal()
    print("==================================================")
    print("[*] DIRECT BACKEND ENDPOINT & INTEGRATION VERIFICATION")
    print("==================================================")

    # 1. Admin User
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
    print(f"[OK] [1] Admin User: {admin.email} (Role: {admin.role})")

    # 2. Dashboard Summary Endpoint
    dash_res = get_dashboard_summary(db=db, current_user=admin)
    print(f"[OK] [2] Dashboard Summary: {dash_res}")

    # 3. Analytics Endpoints
    util_res = fleet_utilization(db=db, current_user=admin)
    print(f"[OK] [3a] Fleet Utilization: {util_res}")

    maint_an_res = maintenance_analytics(db=db, current_user=admin)
    print(f"[OK] [3b] Maintenance Analytics: {maint_an_res}")

    driver_perf_res = driver_performance(db=db, current_user=admin)
    print(f"[OK] [3c] Driver Performance: {len(driver_perf_res)} drivers analyzed")

    deliv_perf_res = delivery_performance(db=db, current_user=admin)
    print(f"[OK] [3d] Delivery Performance: {deliv_perf_res}")

    admin_sum_res = admin_summary(db=db, current_user=admin)
    print(f"[OK] [3e] Admin Summary: {admin_sum_res}")

    # 4. Maintenance List & Upcoming Endpoints
    maint_list = list_maintenance(db=db, current_user=admin)
    print(f"[OK] [4a] Maintenance Records count: {len(maint_list)}")

    maint_up = list_upcoming(days=14, db=db, current_user=admin)
    print(f"[OK] [4b] Maintenance Upcoming/Overdue count: {len(maint_up)}")

    # 5. Check Maintenance Alerts & Celery Worker Status
    alert_res = check_maintenance_alerts(days=7, db=db, current_user=admin)
    print(f"[OK] [5a] Alert Dispatch Endpoint: {alert_res}")

    worker_res = get_worker_status(current_user=admin)
    print(f"[OK] [5b] Worker Status Endpoint: {worker_res}")

    # 6. Notifications List & Unread Count Endpoints
    notifs = list_notifications(db=db, current_user=admin)
    print(f"[OK] [6a] Notifications list count: {len(notifs)}")

    unread = get_unread_count(db=db, current_user=admin)
    print(f"[OK] [6b] Unread count: {unread}")

    # 7. Fuel Records & Trends Endpoints
    fuels = list_fuel(db=db, current_user=admin)
    print(f"[OK] [7a] Fuel records count: {len(fuels)}")

    eff = fuel_efficiency(db=db, current_user=admin)
    print(f"[OK] [7b] Fuel efficiency analytics: {len(eff)} vehicles")

    trends = fuel_trends(db=db, current_user=admin)
    print(f"[OK] [7c] Fuel cost trends: {len(trends)} monthly buckets")

    # 8. Drivers Endpoint
    drivers = get_drivers(db=db, current_user=admin)
    print(f"[OK] [8] Drivers count: {len(drivers)}")

    print("\n==================================================")
    print("[SUCCESS] ALL ROUTER ENDPOINTS TESTED & PASSED 100%!")
    print("==================================================")
    db.close()

if __name__ == "__main__":
    run_checks()
