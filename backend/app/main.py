from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.routers import (
    auth,
    profile,
    account,
    dashboard,
    vehicle,
    shipment,
    driver,
    user,
    trip,
    gps_tracking,
    websocket,
    maintenance,
    fuel_record,
    analytics,
    notification,
    attendance,
    report,
    task,
)


app = FastAPI(
    title="FleetFlow Management API",
    version="1.0.0"
)


# ==========================================================
# CORS CONFIGURATION
# ==========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)



@app.exception_handler(SQLAlchemyError)
async def db_exception_handler(request: Request, exc: SQLAlchemyError):
    err_msg = str(exc)
    if "recovery mode" in err_msg:
        detail = "PostgreSQL is currently in recovery mode or restarting. Please restart the PostgreSQL service."
    else:
        detail = "Database connection error. Please ensure PostgreSQL is running."
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": detail},
        headers={"Access-Control-Allow-Origin": "*"},
    )


# ==========================================================
# ROOT ENDPOINT
# ==========================================================

@app.get("/")
def root():
    return {
        "message": "Fleet Management API is running"
    }


# ==========================================================
# AUTHENTICATION
# ==========================================================

app.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"]
)


# ==========================================================
# GPS TRACKING
# ==========================================================

app.include_router(
    gps_tracking.router,
    prefix="/gps",
    tags=["GPS Tracking"]
)


# ==========================================================
# TRIPS
# ==========================================================

app.include_router(
    trip.router,
    prefix="/trips",
    tags=["Trips"]
)


# ==========================================================
# VEHICLES
# ==========================================================

app.include_router(
    vehicle.router,
    prefix="/vehicles",
    tags=["Vehicles"]
)


# ==========================================================
# USERS
# ==========================================================

app.include_router(
    user.router,
    prefix="/users",
    tags=["Users"]
)


# ==========================================================
# SHIPMENTS
# ==========================================================

app.include_router(
    shipment.router,
    prefix="/shipments",
    tags=["Shipments"]
)


# ==========================================================
# DRIVERS
# ==========================================================

app.include_router(
    driver.router
)


# ==========================================================
# PROFILE
# ==========================================================

app.include_router(
    profile.router
)


# ==========================================================
# ACCOUNT
# ==========================================================

app.include_router(
    account.router
)


# ==========================================================
# DASHBOARD
# ==========================================================

app.include_router(
    dashboard.router
)


# ==========================================================
# WEBSOCKET
# ==========================================================

app.include_router(
    websocket.router,
    tags=["WebSocket"]
)


# ==========================================================
# MAINTENANCE (Milestone 3)
# ==========================================================

app.include_router(maintenance.router)


# ==========================================================
# FUEL RECORDS (Milestone 3)
# ==========================================================

app.include_router(fuel_record.router)


# ==========================================================
# ANALYTICS (Milestone 3)
# ==========================================================

app.include_router(analytics.router)


# ==========================================================
# NOTIFICATIONS (Milestone 3)
# ==========================================================

app.include_router(notification.router)


# ==========================================================
# ATTENDANCE (Milestone 3)
# ==========================================================

app.include_router(attendance.router)


# ==========================================================
# REPORTS / PDF EXPORT (Premium Features)
# ==========================================================
app.include_router(task.router)
app.include_router(report.router)