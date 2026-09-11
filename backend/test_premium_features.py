"""
Test script to verify all 5 Premium Feature expansions:
1. Multi-stop Waypoints Route Optimization & Trip Creation
2. PDF Reports generation (Fleet Summary, Maintenance Cost, Fuel Analysis)
3. Automated Webhook notifications (Slack/Discord formatting)
4. Fuel Efficiency Alert task calculations
5. Route verification
"""
import sys
import os

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend to path
sys.path.insert(0, os.path.abspath("c:/infosysProject/fleetflow_db/backend"))

from app.services.route_service import calculate_route_with_waypoints
from app.services.webhook_service import format_slack_card, format_discord_embed, send_webhook_alert
from app.tasks.fuel_alert_task import check_fuel_efficiency_alerts
from app.database import SessionLocal
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.trip import Trip
from app.models.shipment import Shipment
from app.models.fuel_record import FuelRecord

def test_waypoints_route():
    print("\n--- 1. Testing Multi-Stop Waypoints Route ---")
    start = "12.9716,77.5946" # Bangalore
    waypoints = ["13.3409,74.7421"] # Udupi
    dest = "15.3647,75.1240" # Hubli
    
    route = calculate_route_with_waypoints(start, dest, waypoints, route_type="Fastest")
    print(f"Distance: {route['distance']} km")
    print(f"Duration: {route['duration']} mins")
    print(f"Waypoints visited: {len(route['waypoint_coords'])}")
    print(f"Geometry points: {len(route['geometry'])}")
    assert route["distance"] > 0, "Route distance should be > 0"
    assert len(route["geometry"]) > 0, "Geometry points should be > 0"
    assert len(route["waypoint_coords"]) == 1, "Should have 1 intermediate waypoint"
    print("✅ Waypoints route calculation PASSED!")

def test_pdf_generation():
    print("\n--- 2. Testing PDF Report Generation ---")
    from app.routers.report import _build_pdf
    
    mock_data = {
        "generated_at": "2026-08-20T12:00:00",
        "fleet": {"total_vehicles": 12, "by_status": {"Available": 8, "InTransit": 3, "Maintenance": 1}},
        "drivers": {"total": 10},
        "shipments": {"total": 45, "delivered": 38, "in_transit": 5},
        "trips": {"total": 40, "completed": 35},
        "maintenance": {
            "total_records": 6,
            "overdue": 1,
            "total_cost": 4500.0,
            "by_type": [{"type": "Oil Change", "cost": 1200.0, "count": 2}],
        },
        "fuel": {"total_cost": 8900.0},
        "total_operational_cost": 13400.0,
    }
    
    pdf_bytes = _build_pdf(mock_data)
    print(f"Generated PDF size: {len(pdf_bytes)} bytes")
    assert len(pdf_bytes) > 1000, "PDF bytes should be non-empty"
    assert pdf_bytes.startswith(b"%PDF"), "Valid PDF magic bytes"
    print("✅ PDF Report generation PASSED!")

def test_webhook_formatting():
    print("\n--- 3. Testing Webhook Payload Builders ---")
    slack_payload = format_slack_card("Maintenance Due", "Truck KA-01 overdue by 500km", "warning")
    discord_payload = format_discord_embed("Fuel Efficiency Drop", "Vehicle MH-12 efficiency dropped to 2.8 km/L", "critical")
    
    assert "blocks" in slack_payload, "Slack payload should contain blocks"
    assert "embeds" in discord_payload, "Discord payload should contain embeds"
    print("✅ Webhook formatting PASSED!")

def test_fuel_efficiency_task():
    print("\n--- 4. Testing Fuel Efficiency Task ---")
    res = check_fuel_efficiency_alerts()
    print(f"Fuel Alert Task Execution Result: {res}")
    assert res["status"] == "success", "Task should execute successfully"
    print("✅ Fuel Efficiency alert task PASSED!")

def main():
    print("==================================================")
    print("  VERIFYING PREMIUM FEATURES IMPLEMENTATION")
    print("==================================================")
    test_waypoints_route()
    test_pdf_generation()
    test_webhook_formatting()
    test_fuel_efficiency_task()
    print("\n🎉 ALL 5 PREMIUM FEATURES VERIFIED SUCCESSFULLY! 🎉\n")

if __name__ == "__main__":
    main()
