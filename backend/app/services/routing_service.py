import random
import math
import json
import logging
import urllib.request
import urllib.parse
from typing import Optional
from datetime import datetime, timedelta
from config import settings
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)

# Pre-defined coordinates for common operational cities
CITY_COORDINATES = {
    "chennai": (13.0827, 80.2707),
    "bangalore": (12.9716, 77.5946),
    "mumbai": (19.0760, 72.8777),
    "pune": (18.5204, 73.8567),
    "delhi": (28.6139, 77.2090),
    "jaipur": (26.9124, 75.7873),
    "hyderabad": (17.3850, 78.4867),
    "vijayawada": (16.5062, 80.6480),
    "kolkata": (22.5726, 88.3639),
    "bhubaneswar": (20.2961, 85.8245),
}


def get_city_coords(city_name: str) -> tuple[float, float]:
    """Get approximate latitude and longitude for a city name."""
    clean_name = city_name.strip().lower()
    if clean_name in CITY_COORDINATES:
        return CITY_COORDINATES[clean_name]
    
    # Check for substring matches (e.g. "Chennai City" -> "Chennai")
    for key, coords in CITY_COORDINATES.items():
        if key in clean_name or clean_name in key:
            return coords

    # Fallback to deterministic coordinates based on name hash
    hash_val = abs(hash(clean_name))
    lat = 10.0 + (hash_val % 15) + ((hash_val % 100) / 100.0)
    lng = 72.0 + (hash_val % 15) + ((hash_val % 200) / 200.0)
    return lat, lng


def calculate_haversine_distance(coord1: tuple[float, float], coord2: tuple[float, float]) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371.0  # Earth radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def generate_curved_path(start: tuple[float, float], end: tuple[float, float], num_points: int = 25, variance: float = 0.05) -> list[list[float]]:
    """Generate a list of intermediate lat/lng points with subtle curves between start and end."""
    lat1, lng1 = start
    lat2, lng2 = end
    path = []

    for i in range(num_points):
        t = i / (num_points - 1)
        interp_lat = lat1 + t * (lat2 - lat1)
        interp_lng = lng1 + t * (lng2 - lng1)
        
        if 0 < i < num_points - 1:
            sine_offset = math.sin(t * math.pi) * variance
            dx = lat2 - lat1
            dy = lng2 - lng1
            length = math.sqrt(dx*dx + dy*dy) or 1
            perpend_x = -dy / length
            perpend_y = dx / length
            
            interp_lat += perpend_x * sine_offset
            interp_lng += perpend_y * sine_offset
            
            interp_lat += random.uniform(-0.003, 0.003)
            interp_lng += random.uniform(-0.003, 0.003)

        path.append([round(interp_lat, 5), round(interp_lng, 5)])
    return path


def fetch_google_maps_directions(source: str, destination: str) -> Optional[dict]:
    """Fetch real-time routing data from Google Maps Directions API if API key is provided."""
    api_key = getattr(settings, "GOOGLE_MAPS_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        url = f"https://maps.googleapis.com/maps/api/directions/json?origin={urllib.parse.quote(source)}&destination={urllib.parse.quote(destination)}&key={api_key}"
        req = urllib.request.Request(url, headers={"User-Agent": "FleetFlow/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode())
            if data.get("status") == "OK" and data.get("routes"):
                route = data["routes"][0]
                leg = route["legs"][0]
                dist_km = leg["distance"]["value"] / 1000.0
                duration_mins = int(leg["duration"]["value"] / 60.0)
                path = []
                for step in leg.get("steps", []):
                    path.append([step["end_location"]["lat"], step["end_location"]["lng"]])
                return {
                    "distance": round(dist_km, 1),
                    "duration_mins": duration_mins,
                    "path": path
                }
    except Exception as e:
        logger.warning(f"Google Maps API call failed: {e}. Falling back to internal engine.")
    return None


def get_route_options(source: str, destination: str) -> list[dict]:
    """Generate the 4 route options (Fastest, Shortest, Traffic-Avoidance, Fuel-Efficient) with Redis caching."""
    cache_key = f"route_options:{source.lower().strip()}:{destination.lower().strip()}"
    cached_options = redis_service.get(cache_key)
    if cached_options:
        return cached_options

    start_coords = get_city_coords(source)
    end_coords = get_city_coords(destination)
    
    # Try Google Maps API first
    gmaps_data = fetch_google_maps_directions(source, destination)
    
    if gmaps_data:
        base_road_distance = gmaps_data["distance"]
        base_duration = gmaps_data["duration_mins"]
    else:
        base_road_distance = calculate_haversine_distance(start_coords, end_coords) * 1.25
        if base_road_distance < 10:
            base_road_distance = 15.0
        base_duration = None

    options = []

    # 1. Fastest Route (Standard Highway, High Speed)
    fastest_dist = round(base_road_distance, 1)
    fastest_duration = base_duration if base_duration else int((fastest_dist / 60.0) * 60)
    fastest_path = generate_curved_path(start_coords, end_coords, num_points=30, variance=0.03)

    options.append({
        "id": "fastest",
        "name": "Fastest Route (via Expressway)",
        "distance": fastest_dist,
        "duration_mins": fastest_duration,
        "fuel_saving_pct": 0,
        "traffic_level": "Moderate",
        "description": "Standard route with high-speed expressways and live traffic optimization.",
        "path": fastest_path,
        "eta": (datetime.now() + timedelta(minutes=fastest_duration)).strftime("%I:%M %p")
    })

    # 2. Shortest Route (Local Roads, Slow Speeds)
    shortest_dist = round(base_road_distance * 0.9, 1)
    shortest_duration = int((shortest_dist / 40.0) * 60)
    shortest_path = generate_curved_path(start_coords, end_coords, num_points=30, variance=0.01)

    options.append({
        "id": "shortest",
        "name": "Shortest Route (via Local Roads)",
        "distance": shortest_dist,
        "duration_mins": shortest_duration,
        "fuel_saving_pct": 5,
        "traffic_level": "Heavy",
        "description": "Minimum distance, but utilizes local roads with lower speeds.",
        "path": shortest_path,
        "eta": (datetime.now() + timedelta(minutes=shortest_duration)).strftime("%I:%M %p")
    })

    # 3. Traffic Avoidance Route (Bypasses Cities)
    traffic_dist = round(base_road_distance * 1.1, 1)
    traffic_duration = int((traffic_dist / 70.0) * 60)
    traffic_path = generate_curved_path(start_coords, end_coords, num_points=30, variance=0.07)

    options.append({
        "id": "traffic_avoidance",
        "name": "Traffic Avoidance Route (via Bypass)",
        "distance": traffic_dist,
        "duration_mins": traffic_duration,
        "fuel_saving_pct": -5,
        "traffic_level": "Light",
        "description": "Bypasses urban clusters to avoid traffic congestion and bottlenecks.",
        "path": traffic_path,
        "eta": (datetime.now() + timedelta(minutes=traffic_duration)).strftime("%I:%M %p")
    })

    # 4. Fuel-Efficient Route (Smooth Eco-Drive)
    fuel_dist = round(base_road_distance * 0.98, 1)
    fuel_duration = int((fuel_dist / 52.0) * 60)
    fuel_path = generate_curved_path(start_coords, end_coords, num_points=30, variance=0.02)

    options.append({
        "id": "fuel_efficient",
        "name": "Fuel-Efficient Route (Optimal Eco-Drive)",
        "distance": fuel_dist,
        "duration_mins": fuel_duration,
        "fuel_saving_pct": 12,
        "traffic_level": "Light",
        "description": "Optimized speed profile to reduce fuel consumption by up to 12%.",
        "path": fuel_path,
        "eta": (datetime.now() + timedelta(minutes=fuel_duration)).strftime("%I:%M %p")
    })

    # Cache in Redis for 300 seconds
    redis_service.set(cache_key, options, ttl_seconds=300)
    return options


def calculate_live_progress_and_eta(current_coords: tuple[float, float], destination_coords: tuple[float, float], total_distance_km: float, speed_kmh: float = 55.0) -> dict:
    """Calculate remaining distance, ETA, and completion percentage for live tracking."""
    remaining_dist_km = round(calculate_haversine_distance(current_coords, destination_coords) * 1.25, 1)
    if remaining_dist_km > total_distance_km:
        remaining_dist_km = total_distance_km

    speed = max(speed_kmh, 15.0)  # Avoid division by zero
    remaining_hours = remaining_dist_km / speed
    remaining_mins = int(remaining_hours * 60.0)

    eta_time = datetime.now() + timedelta(minutes=remaining_mins)
    
    progress_pct = 0.0
    if total_distance_km > 0:
        progress_pct = round(max(0.0, min(100.0, ((total_distance_km - remaining_dist_km) / total_distance_km) * 100.0)), 1)

    return {
        "remaining_distance_km": remaining_dist_km,
        "remaining_duration_mins": remaining_mins,
        "progress_pct": progress_pct,
        "eta": eta_time.strftime("%I:%M %p")
    }
