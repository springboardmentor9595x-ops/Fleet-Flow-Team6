import sys
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.core.security import create_access_token, hash_password

client = TestClient(app)

def get_token_for_user(email: str) -> str:
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    db.close()
    if not user:
        raise ValueError(f"User {email} not found in database")
    return create_access_token(data={"sub": user.email, "role": user.role.value})

def auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


class TestFleetFlowTestSuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.admin_token = get_token_for_user("admin@fleetflow.com")
        cls.manager_token = get_token_for_user("manager@fleetflow.com")
        cls.dispatcher_token = get_token_for_user("dispatcher@fleetflow.com")
        cls.driver_token = get_token_for_user("driver1@fleetflow.com")

    # =========================================================================
    # 1. USER MANAGEMENT & ROLE ELEVATION ACCESS MATRIX
    # Admin: ALLOW | FleetManager: DENIED (403) | Dispatcher: DENIED (403) | Driver: DENIED (403)
    # =========================================================================
    def test_user_management_rbac(self):
        # Admin access
        res_admin = client.get("/users/", headers=auth_header(self.admin_token))
        self.assertEqual(res_admin.status_code, 200, "Admin should be allowed to view user accounts")

        # Fleet Manager access
        res_fm = client.get("/users/", headers=auth_header(self.manager_token))
        self.assertEqual(res_fm.status_code, 403, "Fleet Manager must be denied access to user list")

        # Dispatcher access
        res_disp = client.get("/users/", headers=auth_header(self.dispatcher_token))
        self.assertEqual(res_disp.status_code, 403, "Dispatcher must be denied access to user list")

        # Driver access
        res_drv = client.get("/users/", headers=auth_header(self.driver_token))
        self.assertEqual(res_drv.status_code, 403, "Driver must be denied access to user list")

    # =========================================================================
    # 2. ADMIN DASHBOARD ACCESS MATRIX
    # Admin: ALLOW | FleetManager: DENIED (403) | Dispatcher: DENIED (403) | Driver: DENIED (403)
    # =========================================================================
    def test_admin_dashboard_rbac(self):
        res_admin = client.get("/dashboard/admin", headers=auth_header(self.admin_token))
        self.assertEqual(res_admin.status_code, 200, "Admin should access Admin Dashboard")

        res_fm = client.get("/dashboard/admin", headers=auth_header(self.manager_token))
        self.assertEqual(res_fm.status_code, 403, "Fleet Manager must be denied Admin Dashboard")

        res_disp = client.get("/dashboard/admin", headers=auth_header(self.dispatcher_token))
        self.assertEqual(res_disp.status_code, 403, "Dispatcher must be denied Admin Dashboard")

        res_drv = client.get("/dashboard/admin", headers=auth_header(self.driver_token))
        self.assertEqual(res_drv.status_code, 403, "Driver must be denied Admin Dashboard")

    # =========================================================================
    # 3. FLEET DASHBOARD ACCESS MATRIX
    # Admin: ALLOW | FleetManager: ALLOW | Dispatcher: DENIED (403) | Driver: DENIED (403)
    # =========================================================================
    def test_fleet_dashboard_rbac(self):
        res_admin = client.get("/dashboard/fleet", headers=auth_header(self.admin_token))
        self.assertEqual(res_admin.status_code, 200, "Admin should access Fleet Dashboard")

        res_fm = client.get("/dashboard/fleet", headers=auth_header(self.manager_token))
        self.assertEqual(res_fm.status_code, 200, "Fleet Manager should access Fleet Dashboard")

        res_disp = client.get("/dashboard/fleet", headers=auth_header(self.dispatcher_token))
        self.assertEqual(res_disp.status_code, 403, "Dispatcher must be denied Fleet Dashboard")

        res_drv = client.get("/dashboard/fleet", headers=auth_header(self.driver_token))
        self.assertEqual(res_drv.status_code, 403, "Driver must be denied Fleet Dashboard")

    # =========================================================================
    # 4. LOGISTICS DASHBOARD ACCESS MATRIX
    # Admin: ALLOW | FleetManager: ALLOW | Dispatcher: ALLOW | Driver: DENIED (403)
    # =========================================================================
    def test_logistics_dashboard_rbac(self):
        res_admin = client.get("/dashboard/logistics", headers=auth_header(self.admin_token))
        self.assertEqual(res_admin.status_code, 200, "Admin should access Logistics Dashboard")

        res_fm = client.get("/dashboard/logistics", headers=auth_header(self.manager_token))
        self.assertEqual(res_fm.status_code, 200, "Fleet Manager should access Logistics Dashboard")

        res_disp = client.get("/dashboard/logistics", headers=auth_header(self.dispatcher_token))
        self.assertEqual(res_disp.status_code, 200, "Dispatcher should access Logistics Dashboard")

        res_drv = client.get("/dashboard/logistics", headers=auth_header(self.driver_token))
        self.assertEqual(res_drv.status_code, 403, "Driver must be denied Logistics Dashboard")

    # =========================================================================
    # 5. ADMIN ANALYTICS SUMMARY MATRIX
    # Admin: ALLOW | FleetManager: DENIED (403) | Dispatcher: DENIED (403) | Driver: DENIED (403)
    # =========================================================================
    def test_admin_analytics_rbac(self):
        res_admin = client.get("/analytics/admin-summary", headers=auth_header(self.admin_token))
        self.assertEqual(res_admin.status_code, 200, "Admin should access Admin Summary Analytics")

        res_fm = client.get("/analytics/admin-summary", headers=auth_header(self.manager_token))
        self.assertEqual(res_fm.status_code, 403, "Fleet Manager must be denied Admin Summary Analytics")

        res_disp = client.get("/analytics/admin-summary", headers=auth_header(self.dispatcher_token))
        self.assertEqual(res_disp.status_code, 403, "Dispatcher must be denied Admin Summary Analytics")

        res_drv = client.get("/analytics/admin-summary", headers=auth_header(self.driver_token))
        self.assertEqual(res_drv.status_code, 403, "Driver must be denied Admin Summary Analytics")

    # =========================================================================
    # 6. ROUTE RECALCULATE & STRATEGY CHANGE ACCESS MATRIX
    # Admin: ALLOW | FleetManager: ALLOW | Dispatcher: ALLOW | Driver: DENIED (403)
    # =========================================================================
    def test_route_recalculate_rbac(self):
        db = SessionLocal()
        from app.models.trip import Trip
        trip = db.query(Trip).first()
        db.close()
        self.assertIsNotNone(trip, "At least one trip must exist in database for testing")
        trip_id = str(trip.trip_id)

        # Driver access to recalculate route
        res_drv = client.post(f"/trips/{trip_id}/route?route_type=Fastest", headers=auth_header(self.driver_token))
        self.assertEqual(res_drv.status_code, 403, "Driver must be denied route optimization")

        # Dispatcher access to recalculate route
        res_disp = client.post(f"/trips/{trip_id}/route?route_type=Fastest", headers=auth_header(self.dispatcher_token))
        self.assertIn(res_disp.status_code, [200, 400], "Dispatcher is authorized to optimize route")

        # Fleet Manager access
        res_fm = client.post(f"/trips/{trip_id}/route?route_type=Fastest", headers=auth_header(self.manager_token))
        self.assertIn(res_fm.status_code, [200, 400], "Fleet Manager should be authorized to optimize route")

    # =========================================================================
    # 7. SHIPMENT CREATION ACCESS MATRIX
    # Admin: ALLOW | FleetManager: ALLOW | Dispatcher: ALLOW | Driver: DENIED (403)
    # =========================================================================
    def test_shipment_creation_rbac(self):
        import uuid
        payload = {
            "tracking_number": f"TEST-TRK-{uuid.uuid4().hex[:6].upper()}",
            "source": "Mumbai Port",
            "destination": "Delhi Hub",
            "customer_name": "Acme Corp",
            "shipment_weight": 750.5
        }

        # Driver attempt
        res_drv = client.post("/shipments/", json=payload, headers=auth_header(self.driver_token))
        self.assertEqual(res_drv.status_code, 403, "Driver must be denied shipment creation")

        # Dispatcher attempt
        res_disp = client.post("/shipments/", json=payload, headers=auth_header(self.dispatcher_token))
        self.assertIn(res_disp.status_code, [200, 201], "Dispatcher should be allowed to create shipment")

    # =========================================================================
    # 8. VEHICLE FLEET DELETION ACCESS MATRIX
    # Admin: ALLOW | FleetManager: ALLOW | Dispatcher: DENIED (403) | Driver: DENIED (403)
    # =========================================================================
    def test_vehicle_deletion_rbac(self):
        db = SessionLocal()
        from app.models.vehicle import Vehicle
        veh = db.query(Vehicle).first()
        db.close()
        veh_id = str(veh.vehicle_id) if veh else "00000000-0000-0000-0000-000000000000"

        # Driver attempt to delete vehicle asset
        res_drv = client.delete(f"/vehicles/{veh_id}", headers=auth_header(self.driver_token))
        self.assertEqual(res_drv.status_code, 403, "Driver must be denied vehicle deletion")

        # Dispatcher attempt to delete vehicle asset
        res_disp = client.delete(f"/vehicles/{veh_id}", headers=auth_header(self.dispatcher_token))
        self.assertEqual(res_disp.status_code, 403, "Dispatcher must be denied vehicle deletion")

    # =========================================================================
    # 9. AUTHENTICATION & LOGIN VALIDATION MATRIX
    # =========================================================================
    def test_auth_validations(self):
        # L2: Wrong Password
        res_wrong_pw = client.post("/auth/login", data={"username": "admin@fleetflow.com", "password": "wrongpassword"})
        self.assertIn(res_wrong_pw.status_code, [400, 401], "Wrong password must return 401 Unauthorized / 400 Bad Request")

        # L3: Unregistered Email
        res_unreg = client.post("/auth/login", data={"username": "nonexistent_user_99@fleetflow.com", "password": "password123"})
        self.assertIn(res_unreg.status_code, [400, 401], "Unregistered email must return 401 Unauthorized / 400 Bad Request")

        # L1: Successful Login
        res_success = client.post("/auth/login", data={"username": "admin@fleetflow.com", "password": "password123"})
        self.assertEqual(res_success.status_code, 200, "Valid credentials must log in successfully")
        self.assertIn("access_token", res_success.json(), "Response must contain access_token")


if __name__ == "__main__":
    unittest.main()
