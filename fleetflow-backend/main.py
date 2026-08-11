import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers.dashboard import router as dashboard_router
from app.routers.fleet import router as fleet_router
from app.routers.shipments import router as shipments_router
from app.routers.gps import router as gps_router, gps_simulation_loop
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

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(fleet_router)
app.include_router(shipments_router)
app.include_router(gps_router)


@app.on_event("startup")
async def startup_event():
    # Launch background GPS simulation task
    asyncio.create_task(gps_simulation_loop())

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
            print(f"  [ERROR] {err}")
    else:
        print("\n[OK] SMTP Configuration is fully populated and parsed.")
    print("==================================================\n")


@app.get("/")
def home():
    return {
        "message": "FleetFlow Backend Running Successfully"
    }