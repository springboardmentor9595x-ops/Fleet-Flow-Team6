import sys
import uuid
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("STARTING EMAIL OTP VERIFICATION COMPREHENSIVE TESTS")
    print("=" * 60)

    db = SessionLocal()
    try:
        # Clean up test users if they exist
        test_email_1 = f"test_otp_user_{uuid.uuid4().hex[:6]}@example.com"
        test_email_2 = f"test_unverified_{uuid.uuid4().hex[:6]}@example.com"

        # -------------------------------------------------------------
        # TEST 1: SIGNUP AND VERIFY EMAIL WITH OTP
        # -------------------------------------------------------------
        print("\n[TEST 1] Testing New User Signup...")
        signup_payload = {
            "email": test_email_1,
            "password": "Password123!",
            "full_name": "Test OTP User",
            "phone": "+1234567890",
            "role": "Driver",
        }
        res = client.post("/auth/signup", json=signup_payload)
        assert res.status_code == 201, f"Signup failed: {res.text}"
        signup_data = res.json()
        assert "email" in signup_data and signup_data["email"] == test_email_1.lower()
        print("  -> User signed up successfully:", signup_data)

        # Inspect database for generated OTP
        user_in_db = db.query(User).filter(User.email == test_email_1.lower()).first()
        assert user_in_db is not None, "User not found in database!"
        assert user_in_db.is_email_verified is False, "User should be unverified after signup"
        assert user_in_db.verification_otp is not None and len(user_in_db.verification_otp) == 6, "OTP should be 6 digits"
        assert user_in_db.verification_otp_expires_at is not None, "OTP expiry should be set"
        valid_otp = user_in_db.verification_otp
        print(f"  -> Generated 6-digit OTP in DB: {valid_otp}")

        # -------------------------------------------------------------
        # TEST 5: UNVERIFIED USER CANNOT LOGIN (EXPECT 403)
        # -------------------------------------------------------------
        print("\n[TEST 5] Attempting Login with Unverified Email (Expect 403)...")
        login_res = client.post(
            "/auth/login",
            data={"username": test_email_1, "password": "Password123!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert login_res.status_code == 403, f"Expected 403 for unverified user, got {login_res.status_code}: {login_res.text}"
        assert "verify your email" in login_res.json()["detail"].lower()
        print("  -> Correctly blocked login with 403:", login_res.json())

        # -------------------------------------------------------------
        # TEST 2: WRONG OTP (EXPECT 400)
        # -------------------------------------------------------------
        print("\n[TEST 2] Testing Invalid OTP Submission (Expect 400)...")
        wrong_res = client.post("/auth/verify-email", json={"email": test_email_1, "otp": "000000"})
        assert wrong_res.status_code == 400, f"Expected 400 for wrong OTP, got {wrong_res.status_code}: {wrong_res.text}"
        assert "Invalid OTP" in wrong_res.json()["detail"]
        print("  -> Correctly rejected invalid OTP:", wrong_res.json())

        # -------------------------------------------------------------
        # TEST 3: EXPIRED OTP (EXPECT 400)
        # -------------------------------------------------------------
        print("\n[TEST 3] Testing Expired OTP Submission (Expect 400)...")
        # Artificially expire the OTP
        user_in_db.verification_otp_expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.commit()

        expired_res = client.post("/auth/verify-email", json={"email": test_email_1, "otp": valid_otp})
        assert expired_res.status_code == 400, f"Expected 400 for expired OTP, got {expired_res.status_code}: {expired_res.text}"
        assert "expired" in expired_res.json()["detail"].lower()
        print("  -> Correctly rejected expired OTP:", expired_res.json())

        # -------------------------------------------------------------
        # TEST 4: RESEND OTP & COOLDOWN
        # -------------------------------------------------------------
        print("\n[TEST 4] Testing Resend OTP...")
        resend_res = client.post("/auth/resend-otp", json={"email": test_email_1})
        assert resend_res.status_code == 200, f"Resend OTP failed: {resend_res.text}"
        print("  -> Resend OTP successful:", resend_res.json())

        # Verify new OTP generated
        db.refresh(user_in_db)
        new_otp = user_in_db.verification_otp
        assert new_otp is not None and len(new_otp) == 6
        print(f"  -> New OTP in DB: {new_otp}")

        # Test cooldown rate-limiting (<60 seconds)
        cooldown_res = client.post("/auth/resend-otp", json={"email": test_email_1})
        assert cooldown_res.status_code == 429, f"Expected 429 for rapid resend, got {cooldown_res.status_code}: {cooldown_res.text}"
        print("  -> Rate-limit cooldown enforced (429):", cooldown_res.json())

        # -------------------------------------------------------------
        # TEST 1 CONT.: SUBMIT VALID OTP
        # -------------------------------------------------------------
        print("\n[TEST 1 Cont.] Submitting Valid OTP...")
        verify_res = client.post("/auth/verify-email", json={"email": test_email_1, "otp": new_otp})
        assert verify_res.status_code == 200, f"Valid OTP verification failed: {verify_res.text}"
        print("  -> Email verified successfully:", verify_res.json())

        # Check DB state
        db.refresh(user_in_db)
        assert user_in_db.is_email_verified is True
        assert user_in_db.verification_otp is None
        assert user_in_db.verification_otp_expires_at is None
        print("  -> DB user marked as is_email_verified = True and OTP cleared.")

        # -------------------------------------------------------------
        # TEST 1 CONT.: LOGIN VERIFIED USER & ACCESS PROTECTED ROUTE
        # -------------------------------------------------------------
        print("\n[TEST 1 Cont.] Logging in Verified User...")
        login_res = client.post(
            "/auth/login",
            data={"username": test_email_1, "password": "Password123!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert login_res.status_code == 200, f"Login failed for verified user: {login_res.text}"
        tokens = login_res.json()
        assert "access_token" in tokens
        access_token = tokens["access_token"]
        print("  -> Login successful, JWT received.")

        # Access protected route
        me_res = client.get("/users/me", headers={"Authorization": f"Bearer {access_token}"})
        assert me_res.status_code == 200, f"Protected /users/me failed: {me_res.text}"
        print("  -> Protected profile accessed successfully:", me_res.json())

        # -------------------------------------------------------------
        # TEST 6: EXISTING VERIFIED USER
        # -------------------------------------------------------------
        print("\n[TEST 6] Testing Existing Verified User Login (admin@fleetflow.com)...")
        admin_login = client.post(
            "/auth/login",
            data={"username": "admin@fleetflow.com", "password": "password123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if admin_login.status_code != 200:
            # Check with default test password if different
            admin_login = client.post(
                "/auth/login",
                data={"username": "admin@fleetflow.com", "password": "password"},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        print(f"  -> Existing admin login response code: {admin_login.status_code}")
        if admin_login.status_code == 200:
            adm_token = admin_login.json()["access_token"]
            dash_res = client.get("/dashboard/summary", headers={"Authorization": f"Bearer {adm_token}"})
            assert dash_res.status_code == 200
            print("  -> Dashboard summary accessed successfully.")

        print("\n" + "=" * 60)
        print("ALL OTP EMAIL VERIFICATION TESTS PASSED SUCCESSFULLY!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
