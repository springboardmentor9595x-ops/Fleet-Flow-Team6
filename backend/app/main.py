import asyncio
import os
import sys
import re
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.routers.auth import router as auth_router
from app.routers.dashboard import router as dashboard_router
from app.routers.fleet import router as fleet_router
from app.routers.trips import router as trips_router
from app.routers.shipments import router as shipments_router
from app.routers.gps import router as gps_router, gps_simulation_loop
from app.routers.maintenance import router as maintenance_router
from app.routers.drivers import router as drivers_router
from app.routers.fuel import router as fuel_router
from app.routers.analytics import router as analytics_router
from app.routers.notifications import router as notifications_router
from app.routers.reports import router as reports_router
from app.routers.attendance import router as attendance_router
from app.celery_worker import run_maintenance_alert_check
from config import settings

app = FastAPI(
    title="FleetFlow API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg_list = []
    for err in errors:
        loc_str = " -> ".join([str(l) for l in err.get("loc", []) if str(l) != "body"])
        msg = err.get("msg", "Invalid input value")
        if "value is not a valid email address" in msg.lower():
            msg = "Please enter a valid email address with a valid domain (e.g. user@example.com)."
        elif "value error," in msg.lower():
            msg = re.sub(r"^value error,\s*", "", msg, flags=re.IGNORECASE)
        msg_list.append(f"{loc_str}: {msg}" if loc_str else msg)
    
    formatted_detail = "; ".join(msg_list)
    return JSONResponse(
        status_code=422,
        content={"detail": formatted_detail}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"GLOBAL SERVER EXCEPTION on {request.url}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": traceback.format_exc()}
    )

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(fleet_router)
app.include_router(trips_router)
app.include_router(shipments_router)
app.include_router(gps_router)
app.include_router(maintenance_router)
app.include_router(drivers_router)
app.include_router(fuel_router)
app.include_router(analytics_router)
app.include_router(notifications_router)
app.include_router(reports_router)
app.include_router(attendance_router)


@app.on_event("startup")
async def startup_event():
    # Database migration check for profile_picture column and leave_requests table
    try:
        from database import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;"))
        db.execute(text("ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;"))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS leave_requests (
                leave_id UUID PRIMARY KEY,
                driver_id UUID NOT NULL REFERENCES drivers(driver_id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                reason TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'Pending',
                reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
                reviewed_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))
        db.commit()
        db.close()
    except Exception as ex:
        print(f"Database schema migration check: {ex}")

    # Launch background GPS simulation task
    asyncio.create_task(gps_simulation_loop())
    # Run initial maintenance alert check
    try:
        run_maintenance_alert_check()
    except Exception as e:
        print(f"Initial maintenance alert check error: {e}")

    # Email configuration debugging and validation
    errors = []
    if not settings.EMAIL_HOST:
        errors.append("EMAIL_HOST is missing or empty")
    if not settings.EMAIL_PORT:
        errors.append("EMAIL_PORT is missing or empty")
    if not settings.EMAIL_USER:
        errors.append("EMAIL_USER is missing or empty")
    if not settings.EMAIL_PASSWORD or settings.EMAIL_PASSWORD == "YOUR_NEW_APP_PASSWORD":
        errors.append("EMAIL_PASSWORD is not configured or uses placeholder value")
    if not settings.EMAIL_FROM:
        errors.append("EMAIL_FROM is missing or empty")

    print("\n==================================================")
    print("EMAIL CONFIGURATION DEBUG:")
    print(f"EMAIL_HOST: '{settings.EMAIL_HOST}'")
    print(f"EMAIL_PORT: {settings.EMAIL_PORT}")
    print(f"EMAIL_USER: '{settings.EMAIL_USER}'")
    print(f"EMAIL_FROM: '{settings.EMAIL_FROM}'")
    
    # Mask password for secure debug printing
    masked_pwd = "None"
    if settings.EMAIL_PASSWORD:
        pwd = settings.EMAIL_PASSWORD
        if pwd == "YOUR_NEW_APP_PASSWORD":
            masked_pwd = "[PLACEHOLDER_VALUE]"
        elif len(pwd) > 4:
            masked_pwd = pwd[:2] + "*" * (len(pwd) - 4) + pwd[-2:]
        else:
            masked_pwd = "*" * len(pwd)
    print(f"EMAIL_PASSWORD: {masked_pwd}")

    if errors:
        print("\n[CRITICAL ERROR] SMTP CONFIGURATION IS INVALID:")
        for err in errors:
            print(f" [ERROR] {err}")
    else:
        print("\n[OK] SMTP Configuration is fully populated and parsed.")
    print("==================================================\n")

@app.get("/")
def home():
    return {
        "message": "FleetFlow Backend Running Successfully"
    }
