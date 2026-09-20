from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from database import get_db

from app.routers.fleet import schedule_trip, start_trip, end_trip, recalculate_trip_route, get_trips, delete_trip
from app.models.user import User
from app.core.security import get_current_user, require_roles

router = APIRouter(
    prefix="/trips",
    tags=["Trip Management & Scheduling"]
)

@router.get("")
@router.get("/")
def list_trips(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_trips(db=db)

@router.post("/schedule", status_code=status.HTTP_201_CREATED)
def schedule_trip_route(data: dict = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return schedule_trip(data=data, current_user=current_user, db=db)

@router.post("/{trip_id}/start")
@router.put("/{trip_id}/start")
def start_trip_route(trip_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return start_trip(trip_id=trip_id, current_user=current_user, db=db)

@router.post("/{trip_id}/end")
@router.put("/{trip_id}/end")
def end_trip_route(trip_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return end_trip(trip_id=trip_id, current_user=current_user, db=db)

@router.post("/{trip_id}/recalculate-route")
@router.post("/{trip_id}/recalculate")
def recalculate_route_endpoint(trip_id: str, current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])), db: Session = Depends(get_db)):
    return recalculate_trip_route(trip_id=trip_id, db=db)

@router.delete("/{trip_id}")
def delete_trip_endpoint(trip_id: str, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    return delete_trip(trip_id=trip_id, current_user=current_user, db=db)
