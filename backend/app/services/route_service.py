import urllib.request
import urllib.parse
import json
import math
import os
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Optional Redis cache for route responses
# Falls back gracefully if Redis is not running / not installed
# ---------------------------------------------------------------------------
try:
    import redis as _redis_lib

    _REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    _REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    _redis_client = _redis_lib.Redis(
        host=_REDIS_HOST,
        port=_REDIS_PORT,
        db=0,
        socket_connect_timeout=1,
        socket_timeout=1,
        decode_responses=True,
    )
    # Test connection eagerly so we know immediately if Redis is available
    _redis_client.ping()
    _REDIS_AVAILABLE = True
    print("[CACHE] Redis connected — route caching enabled")
except Exception:
    _redis_client = None
    _REDIS_AVAILABLE = False
    print("[CACHE] Redis not available — route caching disabled (using in-memory fallback)")

# In-memory fallback cache: {key: (value, expires_at)}
_MEM_CACHE: dict = {}
_CACHE_TTL = 300  # 5 minutes


def _cache_get(key: str):
    """Read from Redis (or in-memory fallback)."""
    if _REDIS_AVAILABLE:
        try:
            val = _redis_client.get(key)
            return json.loads(val) if val else None
        except Exception:
            pass
    # In-memory fallback
    entry = _MEM_CACHE.get(key)
    if entry:
        value, expires_at = entry
        if datetime.utcnow() < expires_at:
            return value
        del _MEM_CACHE[key]
    return None


def _cache_set(key: str, value: dict, ttl: int = _CACHE_TTL):
    """Write to Redis (or in-memory fallback)."""
    if _REDIS_AVAILABLE:
        try:
            _redis_client.setex(key, ttl, json.dumps(value, default=str))
            return
        except Exception:
            pass
    # In-memory fallback
    _MEM_CACHE[key] = (value, datetime.utcnow() + timedelta(seconds=ttl))


# ---------------------------------------------------------------------------
# Geocoding via Nominatim
# ---------------------------------------------------------------------------

def geocode_address(address: str):
    """
    Geocode an address to (lat, lon) using OpenStreetMap Nominatim.
    Falls back to approximate coordinates for known cities if offline/unavailable.
    """
    try:
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(address)}"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "FleetFlowApp/1.0"}
        )
        with urllib.request.urlopen(req, timeout=3) as response:
            data = json.loads(response.read().decode())
            if data and len(data) > 0:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print("Geocoding notice:", e)

    # Fallback coordinate map for common cities
    city_coords = {
        "new york": (40.7128, -74.0060),
        "los angeles": (34.0522, -118.2437),
        "chicago": (41.8781, -87.6298),
        "houston": (29.7604, -95.3698),
        "london": (51.5074, -0.1278),
        "paris": (48.8566, 2.3522),
        "mumbai": (19.0760, 72.8777),
        "delhi": (28.6139, 77.2090),
        "bangalore": (12.9716, 77.5946),
        "chennai": (13.0827, 80.2707),
        "hyderabad": (17.3850, 78.4867),
        "kolkata": (22.5726, 88.3639),
        "pune": (18.5204, 73.8567),
        "ahmedabad": (23.0225, 72.5714),
        "jaipur": (26.9124, 75.7873),
        "surat": (21.1702, 72.8311),
    }

    clean_addr = address.lower().strip()
    for city, coords in city_coords.items():
        if city in clean_addr:
            return coords

    # Hash-based deterministic fallback around Bengaluru
    hash_val = sum(ord(c) for c in address)
    return (12.9716 + (hash_val % 50) * 0.01, 77.5946 + (hash_val % 50) * 0.01)


def haversine_distance(lat1, lon1, lat2, lon2):
    """Straight-line distance between two (lat, lon) points in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# ---------------------------------------------------------------------------
# Core OSRM routing helper (shared by both calculate_route and recalculate_route_from_position)
# ---------------------------------------------------------------------------

def _osrm_route(start_lat, start_lon, end_lat, end_lon):
    """
    Call OSRM to get raw distance (km), duration (min), and route geometry.
    Returns (distance_km, duration_min, route_geometry) or (0, 0, []) on failure.
    """
    try:
        osrm_url = (
            f"http://router.project-osrm.org/route/v1/driving/"
            f"{start_lon},{start_lat};{end_lon},{end_lat}"
            f"?overview=full&geometries=geojson"
        )
        req = urllib.request.Request(osrm_url, headers={"User-Agent": "FleetFlowApp/1.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            if data and data.get("routes") and len(data["routes"]) > 0:
                route = data["routes"][0]
                distance_km = round(route["distance"] / 1000.0, 2)
                duration_min = round(route["duration"] / 60.0, 1)
                coords = route["geometry"]["coordinates"]
                route_geometry = [[c[1], c[0]] for c in coords]
                return distance_km, duration_min, route_geometry
    except Exception as e:
        print("OSRM routing notice:", e)
    return 0, 0, []


def _haversine_fallback(start_lat, start_lon, end_lat, end_lon):
    """Return straight-line based distance/duration/geometry when OSRM is unavailable."""
    dist = haversine_distance(start_lat, start_lon, end_lat, end_lon)
    distance_km = max(round(dist * 1.3, 2), 5.0)  # road winding factor ~1.3
    duration_min = round((distance_km / 50.0) * 60, 1)  # avg speed 50 km/h

    num_steps = 10
    route_geometry = []
    for i in range(num_steps + 1):
        t = i / float(num_steps)
        lat = start_lat + t * (end_lat - start_lat)
        lon = start_lon + t * (end_lon - start_lon)
        route_geometry.append([round(lat, 5), round(lon, 5)])

    return distance_km, duration_min, route_geometry


def _apply_route_type(distance_km, duration_min, route_type):
    """Apply simulated adjustments based on the chosen route optimisation strategy."""
    if route_type == "Shortest":
        # Slightly shorter distance but slower (more stops)
        distance_km = round(distance_km * 0.95, 2)
        duration_min = round(duration_min * 1.10, 1)
    elif route_type == "Traffic Avoidance":
        # Avoids congestion — longer road, but faster
        distance_km = round(distance_km * 1.08, 2)
        duration_min = round(duration_min * 0.90, 1)
    elif route_type == "Fuel-Efficient":
        # Slight distance saving, minimal time penalty (fewer turns/stops)
        distance_km = round(distance_km * 0.98, 2)
        duration_min = round(duration_min * 1.02, 1)
    # "Fastest" — no adjustment (OSRM already returns optimal time-based route)
    return distance_km, duration_min


# ---------------------------------------------------------------------------
# Public API: calculate_route
# ---------------------------------------------------------------------------

def calculate_route(start_location: str, destination: str, route_type: str = "Fastest"):
    """
    Calculate distance, duration, ETA, and polyline route coordinates.
    Uses Redis (or in-memory) cache to avoid repeated OSRM calls for the same route.

    Returns a dict with keys:
        distance, duration, eta, route_type,
        start_coords, destination_coords, geometry
    """
    cache_key = f"route:{start_location}:{destination}:{route_type}"
    cached = _cache_get(cache_key)
    if cached:
        # Refresh ETA based on current time
        duration_min = cached["duration"]
        cached["eta"] = (datetime.utcnow() + timedelta(minutes=duration_min)).isoformat()
        return cached

    start_lat, start_lon = geocode_address(start_location)
    end_lat, end_lon = geocode_address(destination)

    distance_km, duration_min, route_geometry = _osrm_route(start_lat, start_lon, end_lat, end_lon)

    if distance_km <= 0:
        distance_km, duration_min, route_geometry = _haversine_fallback(
            start_lat, start_lon, end_lat, end_lon
        )

    distance_km, duration_min = _apply_route_type(distance_km, duration_min, route_type)

    eta = datetime.utcnow() + timedelta(minutes=duration_min)

    base_dist, base_dur = distance_km, duration_min

    route_options = {
        "Fastest": {
            "distance": round(base_dist, 2),
            "duration": round(base_dur, 1),
            "delay": "+2m delay"
        },
        "Shortest": {
            "distance": round(base_dist * 0.95, 2),
            "duration": round(base_dur * 1.10, 1),
            "delay": "+5m delay"
        },
        "Traffic Avoidance": {
            "distance": round(base_dist * 1.08, 2),
            "duration": round(base_dur * 0.90, 1),
            "delay": "Clear"
        },
        "Fuel-Efficient": {
            "distance": round(base_dist * 0.98, 2),
            "duration": round(base_dur * 1.02, 1),
            "delay": "+1m delay"
        }
    }

    result = {
        "distance": distance_km,
        "duration": duration_min,
        "eta": eta.isoformat(),
        "route_type": route_type,
        "start_coords": [start_lat, start_lon],
        "destination_coords": [end_lat, end_lon],
        "geometry": route_geometry,
        "route_options": route_options,
    }

    _cache_set(cache_key, result)
    return result


# ---------------------------------------------------------------------------
# Public API: recalculate_route_from_position
# ---------------------------------------------------------------------------

def recalculate_route_from_position(
    current_lat: float,
    current_lon: float,
    destination: str,
    route_type: str = "Fastest",
):
    """
    Recalculate the route from the vehicle's current GPS coordinates to the
    destination. Used mid-trip when the vehicle deviates or a stop changes.

    Falls back to Haversine estimate if OSRM is unavailable.
    """
    end_lat, end_lon = geocode_address(destination)

    distance_km, duration_min, route_geometry = _osrm_route(
        current_lat, current_lon, end_lat, end_lon
    )

    if distance_km <= 0:
        distance_km, duration_min, route_geometry = _haversine_fallback(
            current_lat, current_lon, end_lat, end_lon
        )

    distance_km, duration_min = _apply_route_type(distance_km, duration_min, route_type)

    eta = datetime.utcnow() + timedelta(minutes=duration_min)

    return {
        "distance": distance_km,
        "duration": duration_min,
        "eta": eta.isoformat(),
        "route_type": route_type,
        "start_coords": [current_lat, current_lon],
        "destination_coords": [end_lat, end_lon],
        "geometry": route_geometry,
    }


# ---------------------------------------------------------------------------
# Public API: calculate_route_with_waypoints
# ---------------------------------------------------------------------------

def calculate_route_with_waypoints(
    start_location: str,
    destination: str,
    waypoints: list[str],
    route_type: str = "Fastest",
):
    """
    Calculate a multi-stop route: start → waypoint1 → waypoint2 → … → destination.
    Chains OSRM calls between consecutive stops and merges geometry.

    Returns the same dict shape as calculate_route, plus a 'waypoint_coords' list.
    """
    stops = [start_location] + list(waypoints) + [destination]
    all_coords = [geocode_address(s) for s in stops]

    total_distance = 0.0
    total_duration = 0.0
    merged_geometry = []
    waypoint_coords = [[lat, lon] for lat, lon in all_coords[1:-1]]

    for i in range(len(all_coords) - 1):
        slat, slon = all_coords[i]
        elat, elon = all_coords[i + 1]

        seg_dist, seg_dur, seg_geom = _osrm_route(slat, slon, elat, elon)
        if seg_dist <= 0:
            seg_dist, seg_dur, seg_geom = _haversine_fallback(slat, slon, elat, elon)

        seg_dist, seg_dur = _apply_route_type(seg_dist, seg_dur, route_type)
        total_distance += seg_dist
        total_duration += seg_dur

        # Avoid duplicating the shared coordinate between consecutive segments
        if merged_geometry and seg_geom:
            merged_geometry.extend(seg_geom[1:])
        else:
            merged_geometry.extend(seg_geom)

    total_distance = round(total_distance, 2)
    total_duration = round(total_duration, 1)
    eta = datetime.utcnow() + timedelta(minutes=total_duration)

    return {
        "distance": total_distance,
        "duration": total_duration,
        "eta": eta.isoformat(),
        "route_type": route_type,
        "start_coords": list(all_coords[0]),
        "destination_coords": list(all_coords[-1]),
        "waypoint_coords": waypoint_coords,
        "geometry": merged_geometry,
    }