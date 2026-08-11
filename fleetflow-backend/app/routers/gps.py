import asyncio
import random
import uuid
import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, sessionmaker
from database import engine
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.shipment import Shipment
from app.models.gps_tracking import GPSTracking
from app.services.routing_service import get_city_coords, generate_curved_path

router = APIRouter(
    prefix="/gps",
    tags=["GPS Tracking"]
)

# Global connection manager for WebSockets
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Handle disconnected or stale sockets gracefully
                pass

manager = ConnectionManager()

# Global state for simulation index tracking (trip_id -> current_index)
SIMULATION_STATES = {}

# Session factory for background database tasks
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


async def gps_simulation_loop():
    """Background loop simulating GPS movement for active trips."""
    print("Starting background GPS simulation loop...")
    while True:
        try:
            await asyncio.sleep(4.0)  # Ping interval
            db = SessionLocal()
            try:
                # Fetch active trips
                active_trips = db.query(Trip).filter(Trip.status == "active").all()
                
                for trip in active_trips:
                    start_coords = get_city_coords(trip.start_location or "Chennai")
                    end_coords = get_city_coords(trip.destination or "Bangalore")
                    
                    # Generate the standard curved path for this route (25 coordinates)
                    path = generate_curved_path(start_coords, end_coords, num_points=20, variance=0.03)
                    
                    trip_str = str(trip.trip_id)
                    current_idx = SIMULATION_STATES.get(trip_str, 0)
                    
                    if current_idx >= len(path):
                        # End of the trip reached: update statuses
                        trip.status = "completed"
                        trip.end_time = datetime.datetime.now()
                        
                        # Free vehicle
                        if trip.vehicle_id:
                            v = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
                            if v:
                                v.status = "Available"
                                
                        # Update shipment to Delivered
                        if trip.shipment_id:
                            s = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
                            if s:
                                s.status = "Delivered"
                                
                        db.commit()
                        
                        # Remove simulation tracking state
                        if trip_str in SIMULATION_STATES:
                            del SIMULATION_STATES[trip_str]
                            
                        # Broadcast trip completed notification
                        await manager.broadcast({
                            "type": "trip_completed",
                            "trip_id": trip_str,
                            "vehicle_id": str(trip.vehicle_id) if trip.vehicle_id else None,
                            "message": f"Trip from {trip.start_location} to {trip.destination} completed."
                        })
                    else:
                        # Advance position along the path
                        lat, lng = path[current_idx]
                        speed = round(50.0 + random.uniform(-8, 12), 1)
                        
                        # Save tracking ping to DB
                        ping = GPSTracking(
                            tracking_id=uuid.uuid4(),
                            vehicle_id=trip.vehicle_id,
                            latitude=lat,
                            longitude=lng,
                            speed=speed,
                            recorded_time=datetime.datetime.now()
                        )
                        db.add(ping)
                        db.commit()
                        
                        # Fetch vehicle registration number
                        reg = "TRK"
                        if trip.vehicle_id:
                            v = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
                            if v:
                                reg = v.registration_number
                        
                        # Broadcast live coordinates
                        await manager.broadcast({
                            "type": "gps_update",
                            "trip_id": trip_str,
                            "vehicle_id": str(trip.vehicle_id),
                            "vehicle_reg": reg,
                            "latitude": lat,
                            "longitude": lng,
                            "speed": speed,
                            "progress": round((current_idx / (len(path) - 1)) * 100, 1)
                        })
                        
                        # Update state
                        SIMULATION_STATES[trip_str] = current_idx + 1
            except Exception as inner_err:
                print(f"Error in simulation step: {inner_err}")
                db.rollback()
            finally:
                db.close()
        except Exception as loop_err:
            print(f"GPS simulation loop error: {loop_err}")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Keep connection open and listen for any client messages
        while True:
            data = await websocket.receive_text()
            # Echo or process messages if needed
            await websocket.send_json({"echo": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
