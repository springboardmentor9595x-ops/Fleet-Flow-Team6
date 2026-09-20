import json
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

# Try importing redis
try:
    import redis
    _redis_available = True
except ImportError:
    _redis_available = False
    redis = None

class RedisService:
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        self.host = host
        self.port = port
        self.db = db
        self.client = None
        self.pubsub = None
        self._memory_cache = {}
        self._is_connected = False
        self._connect()

    def _connect(self):
        if not _redis_available:
            logger.info("redis-py package not installed. Using in-memory fallback cache.")
            self._is_connected = False
            return

        try:
            self.client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                decode_responses=True,
                socket_timeout=2.0
            )
            self.client.ping()
            self._is_connected = True
            logger.info(f"Connected to Redis at {self.host}:{self.port}")
        except Exception as e:
            logger.warning(f"Could not connect to Redis server: {e}. Falling back to in-memory cache.")
            self._is_connected = False
            self.client = None

    def get(self, key: str) -> Optional[Any]:
        """Get cached item by key."""
        if self._is_connected and self.client:
            try:
                val = self.client.get(key)
                if val:
                    return json.loads(val)
            except Exception as e:
                logger.error(f"Redis get error for key '{key}': {e}")
        
        # In-memory fallback
        return self._memory_cache.get(key)

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> bool:
        """Set cached item with time-to-live (TTL)."""
        val_str = json.dumps(value)
        if self._is_connected and self.client:
            try:
                self.client.setex(key, ttl_seconds, val_str)
                return True
            except Exception as e:
                logger.error(f"Redis set error for key '{key}': {e}")
        
        # In-memory fallback
        self._memory_cache[key] = value
        return True

    def publish(self, channel: str, message: dict) -> bool:
        """Publish a message over Redis channel."""
        if self._is_connected and self.client:
            try:
                self.client.publish(channel, json.dumps(message))
                return True
            except Exception as e:
                logger.error(f"Redis publish error on channel '{channel}': {e}")
        return False

# Global instance
redis_service = RedisService()
