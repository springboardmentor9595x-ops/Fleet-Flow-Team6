from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from app.websocket_manager import manager
from app.database import SessionLocal
from app.models.gps_tracking import GPSTracking
import uuid


router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await manager.connect(websocket)

    try:
        while True:

            data = await websocket.receive_json()

            print("GPS DATA RECEIVED:", data)

            # --------------------------------------------------------
            # Persist to database
            # --------------------------------------------------------
            db: Session = SessionLocal()
            try:
                tracking = GPSTracking(
                    vehicle_id=uuid.UUID(str(data.get("vehicle_id"))) if data.get("vehicle_id") else None,
                    latitude=data.get("latitude"),
                    longitude=data.get("longitude"),
                    speed=data.get("speed"),
                )
                if tracking.vehicle_id and tracking.latitude is not None:
                    db.add(tracking)
                    db.commit()
            except Exception as db_error:
                print("GPS DB save error:", db_error)
                db.rollback()
            finally:
                db.close()

            # --------------------------------------------------------
            # Broadcast to all connected clients
            # --------------------------------------------------------
            await manager.broadcast(data)

    except WebSocketDisconnect:

        manager.disconnect(websocket)
        print("WebSocket client disconnected")

    except Exception as error:

        print("WebSocket error:", error)
        manager.disconnect(websocket)