import random
import math
from datetime import datetime, timedelta

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

    # Fallback to random but deterministic coordinates based on name hash
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
        # Linear interpolation
        interp_lat = lat1 + t * (lat2 - lat1)
        interp_lng = lng1 + t * (lng2 - lng1)
        
        # Add curve using a sine wave perpendicular to the route direction
        if 0 < i < num_points - 1:
            sine_offset = math.sin(t * math.pi) * variance
            # Shift slightly perpendicular to the primary heading
            dx = lat2 - lat1
            dy = lng2 - lng1
            length = math.sqrt(dx*dx + dy*dy) or 1
            perpend_x = -dy / length
            perpend_y = dx / length
            
            interp_lat += perpend_x * sine_offset
            interp_lng += perpend_y * sine_offset
            
            # Add small noise/wiggle for road roughness
            interp_lat += random.uniform(-0.003, 0.003)
            interp_lng += random.uniform(-0.003, 0.003)

        path.append([round(interp_lat, 5), round(interp_lng, 5)])
    return path


def get_route_options(source: str, destination: str) -> list[dict]:
    """Generate the 4 route options (Fastest, Shortest, Traffic-Avoidance, Fuel-Efficient)."""
    start_coords = get_city_coords(source)
    end_coords = get_city_coords(destination)
    
    # Calculate base straight-line distance, scaled by 1.25 for average winding road factor
    base_road_distance = calculate_haversine_distance(start_coords, end_coords) * 1.25
    if base_road_distance < 10:
        base_road_distance = 15.0

    options = []

    # 1. Fastest Route (Standard Highway, Moderate Speed)
    fastest_dist = round(base_road_distance, 1)
    fastest_speed = 60.0  # km/h
    fastest_duration = int((fastest_dist / fastest_speed) * 60)
    fastest_path = generate_curved_path(start_coords, end_coords, num_points=30, variance=0.03)

    options.append({
        "id": "fastest",
        "name": "Fastest Route (via Expressway)",
        "distance": fastest_dist,
        "duration_mins": fastest_duration,
        "fuel_saving_pct": 0,
        "traffic_level": "Moderate",
        "description": "Standard route with high-speed expressways.",
        "path": fastest_path,
        "eta": (datetime.now() + timedelta(minutes=fastest_duration)).strftime("%I:%M %p")
    })

    # 2. Shortest Route (Narrow roads, slow speeds, possible traffic)
    shortest_dist = round(base_road_distance * 0.9, 1)
    shortest_speed = 40.0  # km/h
    shortest_duration = int((shortest_dist / shortest_speed) * 60)
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

    # 3. Traffic Avoidance Route (Bypasses cities, longer distance, high speeds)
    traffic_dist = round(base_road_distance * 1.1, 1)
    traffic_speed = 70.0  # km/h
    traffic_duration = int((traffic_dist / traffic_speed) * 60)
    traffic_path = generate_curved_path(start_coords, end_coords, num_points=30, variance=0.07)

    options.append({
        "id": "traffic_avoidance",
        "name": "Traffic Avoidance Route (via Bypass)",
        "distance": traffic_dist,
        "duration_mins": traffic_duration,
        "fuel_saving_pct": -5,
        "traffic_level": "Light",
        "description": "Bypasses urban clusters to avoid traffic congestion.",
        "path": traffic_path,
        "eta": (datetime.now() + timedelta(minutes=traffic_duration)).strftime("%I:%M %p")
    })

    # 4. Fuel-Efficient Route (Smooth cruising, speed limits)
    fuel_dist = round(base_road_distance * 0.98, 1)
    fuel_speed = 52.0  # km/h
    fuel_duration = int((fuel_dist / fuel_speed) * 60)
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

    return options
