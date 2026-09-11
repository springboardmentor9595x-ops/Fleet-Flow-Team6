# FleetFlow Celery Tasks Package
from app.tasks.maintenance import check_maintenance_alerts
from app.tasks.shipments import check_delayed_shipments
from app.tasks.maintenance_tasks import check_maintenance_alerts_task, generate_maintenance_fleet_report_task
from app.tasks.fuel_alert_task import check_fuel_efficiency_alerts

__all__ = [
    "check_maintenance_alerts",
    "check_delayed_shipments",
    "check_maintenance_alerts_task",
    "generate_maintenance_fleet_report_task",
    "check_fuel_efficiency_alerts",
]
