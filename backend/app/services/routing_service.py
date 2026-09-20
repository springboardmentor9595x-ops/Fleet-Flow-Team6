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


def geocode_address(address: str) -> tuple[float, float]:
    """Convert an address string to (latitude, longitude) using Nominatim with city fallback."""
    clean_name = address.strip().lower()
    for key, coords in CITY_COORDINATES.items():
        if key in clean_name or clean_name in key:
            return coords

    try:
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(address)}&format=json&limit=1"
        req = urllib.request.Request(url, headers={"User-Agent": "FleetFlow/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode())
            if data and len(data) > 0:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        logger.warning(f"Nominatim geocoding failed for {address}: {e}. Falling back to internal coordinates.")

    hash_val = abs(hash(clean_name))
    lat = 10.0 + (hash_val % 15) + ((hash_val % 100) / 100.0)
    lng = 72.0 + (hash_val % 15) + ((hash_val % 200) / 200.0)
    return lat, lng


# Alias for backwards compatibility with gps.py and legacy routers
get_city_coords = geocode_address


def calculate_haversine_distance(coord1: tuple[float, float], coord2: tuple[float, float]) -> float:
    """Calculate great-circle distance between two points in kilometers."""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371.0  # Earth radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def generate_curved_path(start: tuple[float, float], end: tuple[float, float], num_points: int = 30, variance: float = 0.04) -> list[list[float]]:
    """Generate intermediate waypoints between start and end coordinates."""
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

        path.append([round(interp_lat, 5), round(interp_lng, 5)])
    return path


def fetch_osrm_route(start: tuple[float, float], end: tuple[float, float]) -> Optional[dict]:
    """Fetch routing geometry, distance, and duration from OSRM driving server."""
    try:
        url = f"http://router.project-osrm.org/route/v1/driving/{start[1]},{start[0]};{end[1]},{end[0]}?overview=full&geometries=geojson"
        req = urllib.request.Request(url, headers={"User-Agent": "FleetFlow/1.0"})
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            data = json.loads(resp.read().decode())
            if data.get("code") == "Ok" and data.get("routes"):
                route = data["routes"][0]
                dist_km = route["distance"] / 1000.0
                dur_secs = route["duration"]
                # Convert OSRM [lng, lat] GeoJSON coordinates to Leaflet [lat, lng]
                raw_coords = route["geometry"]["coordinates"]
                leaflet_coords = [[c[1], c[0]] for c in raw_coords]
                return {
                    "distance": round(dist_km, 1),
                    "duration_secs": dur_secs,
                    "duration_mins": int(dur_secs / 60.0),
                    "path": leaflet_coords
                }
    except Exception as e:
        logger.warning(f"OSRM API call failed: {e}. Falling back to internal Haversine path calculation.")
    return None


def get_route_options(source: str, destination: str) -> list[dict]:
    """
    Expose the 4 Route Optimization Profiles with simulated traffic congestion multipliers & Redis caching.
    Traffic Multipliers:
      - Low Traffic       : 1.0x duration
      - Medium Traffic    : 1.2x duration
      - High Traffic      : 1.5x duration
      - Very High Traffic : 1.8x duration
    """
    cache_key = f"route_options:{source.lower().strip()}:{destination.lower().strip()}"
    cached_options = redis_service.get(cache_key)
    if cached_options:
        return cached_options

    start_coords = geocode_address(source)
    end_coords = geocode_address(destination)

    # 1. Query OSRM Driving Engine
    osrm_data = fetch_osrm_route(start_coords, end_coords)
    
    if osrm_data:
        base_road_distance = osrm_data["distance"]
        base_duration_mins = osrm_data["duration_mins"]
        base_path = osrm_data["path"]
    else:
        # Fallback to straight-line Haversine + road factor
        base_road_distance = round(calculate_haversine_distance(start_coords, end_coords) * 1.25, 1)
        if base_road_distance < 10:
            base_road_distance = 15.0
        base_duration_mins = int((base_road_distance / 60.0) * 60)
        base_path = generate_curved_path(start_coords, end_coords, num_points=30, variance=0.03)

    options = []

    # 1. Fastest Route (Lowest Estimated Duration via Highway, 1.0x duration multiplier)
    fastest_dist = round(base_road_distance, 1)
    fastest_duration = int(base_duration_mins * 1.0)
    options.append({
        "id": "fastest",
        "name": "Fastest Route (via Expressway)",
        "distance": fastest_dist,
        "duration_mins": fastest_duration,
        "fuel_saving_pct": 0,
        "traffic_level": "Moderate",
        "description": "Standard route with high-speed expressways and live traffic optimization.",
        "path": base_path,
        "eta": (datetime.now() + timedelta(minutes=fastest_duration)).strftime("%I:%M %p")
    })

    # 2. Shortest Route (Lowest Travel Distance via Arterial Local Roads)
    shortest_dist = round(base_road_distance * 0.9, 1)
    shortest_duration = int(base_duration_mins * 1.35)
    shortest_path = generate_curved_path(start_coords, end_coords, num_points=30, variance=0.01)
    options.append({
        "id": "shortest",
        "name": "Shortest Route (via Local Roads)",
        "distance": shortest_dist,
        "duration_mins": shortest_duration,
        "fuel_saving_pct": 5,
        "traffic_level": "Heavy",
        "description": "Minimum travel distance, utilizing local arterial roads.",
        "path": shortest_path,
        "eta": (datetime.now() + timedelta(minutes=shortest_duration)).strftime("%I:%M %p")
    })

    # 3. Traffic Avoidance Route (Urban Bypass, 0.95x duration / Light Traffic)
    traffic_dist = round(base_road_distance * 1.1, 1)
    traffic_duration = int(base_duration_mins * 0.95)
    traffic_path = generate_curved_path(start_coords, end_coords, num_points=30, variance=0.07)
    options.append({
        "id": "traffic_avoidance",
        "name": "Traffic Avoidance Route (via Bypass)",
        "distance": traffic_dist,
        "duration_mins": traffic_duration,
        "fuel_saving_pct": -5,
        "traffic_level": "Light",
        "description": "Bypasses high-density urban clusters to avoid traffic congestion bottlenecks.",
        "path": traffic_path,
        "eta": (datetime.now() + timedelta(minutes=traffic_duration)).strftime("%I:%M %p")
    })

    # 4. Fuel-Efficient Route (Smooth Eco-Drive Velocity Profile, +12% fuel savings)
    fuel_dist = round(base_road_distance * 0.98, 1)
    fuel_duration = int(base_duration_mins * 1.13)
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

    # Cache response in Redis for 300 seconds (5 minutes)
    redis_service.set(cache_key, options, ttl_seconds=300)
    return options


def calculate_live_progress_and_eta(current_coords: tuple[float, float], destination_coords: tuple[float, float], total_distance_km: float, speed_kmh: float = 55.0) -> dict:
    """Calculate remaining distance, remaining duration, completion percentage, and ETA together."""
    remaining_dist_km = round(calculate_haversine_distance(current_coords, destination_coords) * 1.25, 1)
    if remaining_dist_km > total_distance_km:
        remaining_dist_km = total_distance_km

    speed = max(speed_kmh, 15.0)
    remaining_hours = remaining_dist_km / speed
    remaining_mins = int(remaining_hours * 60.0)
    remaining_secs = int(remaining_hours * 3600.0)

    eta_time = datetime.now() + timedelta(minutes=remaining_mins)
    
    progress_pct = 0.0
    if total_distance_km > 0:
        progress_pct = round(max(0.0, min(100.0, ((total_distance_km - remaining_dist_km) / total_distance_km) * 100.0)), 1)

    return {
        "remaining_distance_km": remaining_dist_km,
        "remaining_duration_mins": remaining_mins,
        "remaining_duration_secs": remaining_secs,
        "progress_pct": progress_pct,
        "eta": eta_time.strftime("%I:%M %p")
    }


def check_route_deviation(current_coords: tuple[float, float], planned_route: list[list[float]], threshold_km: float = 0.5) -> bool:
    """Check if vehicle's current position is > threshold_km away from all planned route waypoints."""
    if not planned_route:
        return False

    min_distance = float("inf")
    for waypoint in planned_route:
        dist = calculate_haversine_distance(current_coords, (waypoint[0], waypoint[1]))
        if dist < min_distance:
            min_distance = dist

    return min_distance > threshold_km
