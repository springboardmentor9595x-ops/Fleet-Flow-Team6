import sys
import os
from datetime import date, datetime, timedelta
from decimal import Decimal

# Ensure utf-8 stdout
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.maintenance import VehicleMaintenance
from app.models.notification import Notification
from app.crud.maintenance import create_maintenance, update_maintenance, get_upcoming_overdue
from app.schemas.maintenance import MaintenanceCreate, MaintenanceUpdate
from app.tasks.maintenance_tasks import check_maintenance_alerts_task, generate_maintenance_fleet_report_task


def run_tests():
    db = SessionLocal()
    print("==================================================")
    print("[*] RUNNING VEHICLE MAINTENANCE & CELERY TESTS")
    print("==================================================")

    # 1. Pick or create a test vehicle
    vehicle = db.query(Vehicle).first()
    if not vehicle:
        vehicle = Vehicle(
            registration_number="TEST-MAINT-999",
            brand="Volvo",
            model="FH16",
            vehicle_type="Truck",
            capacity=18.0,
            status=VehicleStatus.Available
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
    print(f"[OK] [1] Using vehicle: {vehicle.registration_number} (Current status: {vehicle.status})")

    # 2. Test Scheduling Maintenance with "In Progress" -> Vehicle status should switch to Maintenance
    today = date.today()
    maint_create = MaintenanceCreate(
        vehicle_id=vehicle.vehicle_id,
        maintenance_type="Engine Service",
        service_date=today,
        next_service_date=today + timedelta(days=3),  # Upcoming in 3 days
        cost=Decimal("4500.00"),
        remarks="Routine engine tuning and oil filter change",
        status="In Progress"
    )
    rec1 = create_maintenance(db, maint_create)
    db.refresh(vehicle)
    assert vehicle.status == VehicleStatus.Maintenance, f"Expected vehicle status 'Maintenance', got {vehicle.status}"
    print(f"[OK] [2] Scheduled Maintenance record created (ID: {rec1.maintenance_id}). Vehicle status correctly updated to: {vehicle.status}")

    # 3. Test Updating Maintenance to "Completed" -> Vehicle status should switch to Available
    maint_update = MaintenanceUpdate(
        status="Completed",
        cost=Decimal("4800.00"),
        remarks="Completed successfully with synthetic oil"
    )
    rec1_updated = update_maintenance(db, rec1.maintenance_id, maint_update)
    db.refresh(vehicle)
    assert vehicle.status == VehicleStatus.Available, f"Expected vehicle status 'Available', got {vehicle.status}"
    # Resolve any pre-existing unresolved records in DB first to isolate the test
    db.query(VehicleMaintenance).filter(VehicleMaintenance.is_resolved == False).update({VehicleMaintenance.is_resolved: True})
    db.commit()

    # 4. Create an Overdue maintenance record for testing Celery background alerts
    overdue_rec = VehicleMaintenance(
        vehicle_id=vehicle.vehicle_id,
        maintenance_type="Brake Service",
        service_date=today - timedelta(days=30),
        next_service_date=today - timedelta(days=5),  # 5 days overdue
        cost=Decimal("2500.00"),
        remarks="Brake pads replacement overdue",
        status="Scheduled"
    )
    db.add(overdue_rec)

    # Also create an Upcoming maintenance record (due in 5 days)
    upcoming_rec = VehicleMaintenance(
        vehicle_id=vehicle.vehicle_id,
        maintenance_type="Tire Replacement",
        service_date=today,
        next_service_date=today + timedelta(days=5),  # due in 5 days
        cost=Decimal("12000.00"),
        remarks="Front tires rotation and replacement",
        status="Scheduled"
    )
    db.add(upcoming_rec)
    db.commit()
    print("[OK] [4] Seeded Overdue and Upcoming maintenance records for Celery task check.")

    # 5. Run Celery Background Task: check_maintenance_alerts_task
    print("\n--- Running Celery Alert Check Task ---")
    task_res = check_maintenance_alerts_task(days_ahead=7)
    print(f"Task Result: {task_res}")
    assert task_res["status"] == "success"
    assert task_res["overdue_count"] >= 1
    assert task_res["upcoming_count"] >= 1
    print("[OK] [5] Celery check_maintenance_alerts_task succeeded!")

    # 6. Verify Notifications were created and Deduplication works on rerun
    recent_notifs = (
        db.query(Notification)
        .filter(Notification.created_at >= datetime.utcnow() - timedelta(minutes=5))
        .all()
    )
    print(f"[OK] [6] Created {len(recent_notifs)} recent notifications in DB.")
    for n in recent_notifs[-3:]:
        print(f"   * [{n.type.upper()}] {n.title}: {n.message}")

    # Rerun task to test keep-triggering and deduplication
    # First, verify that overdue keeps triggering:
    rerun_overdue = check_maintenance_alerts_task(days_ahead=7)
    assert rerun_overdue["alerts_created"] >= 1, f"Expected overdue alert to keep triggering, got {rerun_overdue['alerts_created']}"
    print("[OK] [7a] Verified overdue alert keeps triggering when unresolved.")

    # Now mark the overdue record as resolved:
    overdue_rec.is_resolved = True
    db.commit()

    # Rerun task to test deduplication (should create 0 new alerts because upcoming is deduplicated and overdue is resolved)
    rerun_res = check_maintenance_alerts_task(days_ahead=7)
    assert rerun_res["alerts_created"] == 0, f"Expected 0 duplicate alerts when resolved, got {rerun_res['alerts_created']}"
    print("[OK] [7b] Duplicate alert prevention verified (0 duplicates generated when resolved).")

    # 8. Run Daily Fleet Report Task
    report_res = generate_maintenance_fleet_report_task()
    assert report_res["status"] == "success"
    print(f"[OK] [8] Celery generate_maintenance_fleet_report_task executed: {report_res}")

    print("\n==================================================")
    print("[SUCCESS] ALL MAINTENANCE & CELERY TESTS PASSED!")
    print("==================================================")
    db.close()


if __name__ == "__main__":
    run_tests()
