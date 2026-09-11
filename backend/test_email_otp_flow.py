import sys
import uuid
from unittest.mock import patch
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.email_verification import EmailVerification
from app.crud.user import hash_otp

client = TestClient(app)


def run_tests():
    print("=" * 60)
    print("STARTING EMAIL OTP VERIFICATION COMPREHENSIVE TESTS")
    print("=" * 60)

    db = SessionLocal()
    try:
        test_email_1 = f"test_otp_user_{uuid.uuid4().hex[:6]}@example.com"
        test_unverified = f"test_unverified_{uuid.uuid4().hex[:6]}@example.com"

        # -------------------------------------------------------------
        # TEST 0: NO FAKE SUCCESS — UNCONFIGURED SMTP RETURNS 500
        # -------------------------------------------------------------
        print("\n[TEST 0] Testing Signup when SMTP credentials are placeholder / unconfigured...")
        with patch("app.services.email_service.get_smtp_config", return_value=("smtp.gmail.com", 587, "", "", "", "FleetFlow")):
            res_fail = client.post(
                "/auth/signup",
                json={
                    "email": test_email_1,
                    "password": "Password123!",
                    "full_name": "Test User",
                    "phone": "+1234567890",
                    "role": "Driver",
                },
            )
            assert res_fail.status_code == 500, f"Expected 500 when SMTP unconfigured, got {res_fail.status_code}: {res_fail.text}"
            assert "SMTP" in res_fail.json()["detail"] or "email" in res_fail.json()["detail"].lower()
            print("  -> Correctly blocked fake success and returned 500:", res_fail.json()["detail"][:80] + "...")

        # -------------------------------------------------------------
        # TEST 1: SIGNUP WITH MOCKED SUCCESSFUL SMTP DELIVERY
        # -------------------------------------------------------------
        print("\n[TEST 1] Testing Signup with Active SMTP Delivery...")
        with patch("app.routers.auth.send_otp_email", return_value=True):
            res = client.post(
                "/auth/signup",
                json={
                    "email": test_email_1,
                    "password": "Password123!",
                    "full_name": "Test OTP User",
                    "phone": "+1234567890",
                    "role": "Driver",
                },
            )
            assert res.status_code == 201, f"Signup failed: {res.text}"
            signup_data = res.json()
            assert signup_data["email"] == test_email_1.lower()
            assert signup_data.get("debug_otp") is None, "debug_otp should never be exposed in response!"
            print("  -> User signed up successfully:", signup_data)

        # Inspect database for user and email_verifications record
        user_in_db = db.query(User).filter(User.email == test_email_1.lower()).first()
        assert user_in_db is not None, "User not found in database!"
        assert user_in_db.email_verified is False, "User should be unverified after signup"

        verif_rec = (
            db.query(EmailVerification)
            .filter(EmailVerification.email == test_email_1.lower(), EmailVerification.verified == False)
            .first()
        )
        assert verif_rec is not None, "EmailVerification record not found in database!"
        assert len(verif_rec.otp_hash) == 64, "OTP should be stored as SHA-256 hash (64 hex characters)"
        print(f"  -> Found EmailVerification record. Salted SHA-256 hash: {verif_rec.otp_hash[:16]}...")

        # -------------------------------------------------------------
        # TEST 2: UNVERIFIED USER CANNOT LOGIN (EXPECT 403)
        # -------------------------------------------------------------
        print("\n[TEST 2] Attempting Login with Unverified Email (Expect 403)...")
        login_res = client.post(
            "/auth/login",
            data={"username": test_email_1, "password": "Password123!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert login_res.status_code == 403, f"Expected 403 for unverified user, got {login_res.status_code}: {login_res.text}"
        assert "verify your email" in login_res.json()["detail"].lower()
        print("  -> Correctly blocked unverified login with 403:", login_res.json()["detail"])

        # -------------------------------------------------------------
        # TEST 3: WRONG OTP (EXPECT 400)
        # -------------------------------------------------------------
        print("\n[TEST 3] Testing Invalid OTP Submission (Expect 400)...")
        wrong_res = client.post("/auth/verify-email", json={"email": test_email_1, "otp": "000000"})
        assert wrong_res.status_code == 400, f"Expected 400 for wrong OTP, got {wrong_res.status_code}: {wrong_res.text}"
        assert "Invalid OTP" in wrong_res.json()["detail"]
        db.refresh(verif_rec)
        assert verif_rec.attempts == 1, f"Expected attempts = 1, got {verif_rec.attempts}"
        print("  -> Correctly rejected invalid OTP and incremented attempts count to 1:", wrong_res.json())

        # -------------------------------------------------------------
        # TEST 4: EXPIRED OTP (EXPECT 400)
        # -------------------------------------------------------------
        print("\n[TEST 4] Testing Expired OTP Submission (Expect 400)...")
        verif_rec.expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.commit()

        expired_res = client.post("/auth/verify-email", json={"email": test_email_1, "otp": "123456"})
        assert expired_res.status_code == 400, f"Expected 400 for expired OTP, got {expired_res.status_code}: {expired_res.text}"
        assert "expired" in expired_res.json()["detail"].lower()
        print("  -> Correctly rejected expired OTP:", expired_res.json())

        # -------------------------------------------------------------
        # TEST 5: RESEND OTP & COOLDOWN
        # -------------------------------------------------------------
        print("\n[TEST 5] Testing Resend OTP & Cooldown...")
        with patch("app.routers.auth.send_otp_email", return_value=True):
            # Attempt to resend immediately (should hit cooldown 429)
            cooldown_res = client.post("/auth/resend-otp", json={"email": test_email_1})
            assert cooldown_res.status_code == 429, f"Expected 429 for rapid resend, got {cooldown_res.status_code}: {cooldown_res.text}"
            print("  -> Rapid resend correctly blocked by 60s cooldown (429):", cooldown_res.json())

            # Now artificially expire cooldown by moving created_at back by 65s
            verif_rec.created_at = datetime.utcnow() - timedelta(seconds=65)
            db.commit()

            # Resend after cooldown
            resend_res = client.post("/auth/resend-otp", json={"email": test_email_1})
            assert resend_res.status_code == 200, f"Resend OTP failed after cooldown: {resend_res.text}"
            print("  -> Resend OTP after cooldown successful (200):", resend_res.json())

            # Immediate resend again should hit 429
            cooldown_res2 = client.post("/auth/resend-otp", json={"email": test_email_1})
            assert cooldown_res2.status_code == 429, f"Expected 429 after resend, got {cooldown_res2.status_code}: {cooldown_res2.text}"
            print("  -> Rate-limit cooldown enforced again (429):", cooldown_res2.json())

        # -------------------------------------------------------------
        # TEST 6: SUBMIT VALID OTP
        # -------------------------------------------------------------
        print("\n[TEST 6] Submitting Valid OTP...")
        # For testing, generate known OTP and set in active verification record
        known_otp = "852963"
        new_rec = (
            db.query(EmailVerification)
            .filter(EmailVerification.email == test_email_1.lower(), EmailVerification.verified == False)
            .order_by(EmailVerification.created_at.desc())
            .first()
        )
        assert new_rec is not None
        new_rec.otp_hash = hash_otp(test_email_1.lower(), known_otp)
        db.commit()

        verify_res = client.post("/auth/verify-email", json={"email": test_email_1, "otp": known_otp})
        assert verify_res.status_code == 200, f"Valid OTP verification failed: {verify_res.text}"
        print("  -> Email verified successfully:", verify_res.json())

        db.refresh(user_in_db)
        db.refresh(new_rec)
        assert user_in_db.email_verified is True
        assert user_in_db.is_email_verified is True
        assert new_rec.verified is True
        print("  -> DB user confirmed verified: email_verified=True, record.verified=True.")

        # -------------------------------------------------------------
        # TEST 7: LOGIN VERIFIED USER
        # -------------------------------------------------------------
        print("\n[TEST 7] Logging in Verified User...")
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

        print("\n" + "=" * 60)
        print("ALL OTP EMAIL VERIFICATION TESTS PASSED PERFECTLY!")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    run_tests()
