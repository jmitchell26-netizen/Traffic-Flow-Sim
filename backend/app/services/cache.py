"""
Response caching service for API calls.

Reduces external API calls by caching responses with TTL.
"""

from functools import wraps
from datetime import datetime, timedelta
from typing import Any, Callable, Optional
import hashlib
import json
import logging

logger = logging.getLogger(__name__)


class ResponseCache:
    """
    In-memory cache for API responses.
    
    Stores responses with timestamps and automatically expires
    entries based on TTL (time-to-live).
    
    For production, consider using Redis instead of in-memory cache.
    """
    
    def __init__(self):
        """Initialize empty cache."""
        self._cache: dict[str, tuple[Any, datetime]] = {}
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str, ttl_seconds: int = 300) -> Optional[Any]:
        """
        Get cached value if it exists and hasn't expired.
        
        Args:
            key: Cache key
            ttl_seconds: Time-to-live in seconds
        
        Returns:
            Cached value or None if not found/expired
        """
        if key not in self._cache:
            self._misses += 1
            return None
        
        value, cached_time = self._cache[key]
        
        # Check if expired
        if datetime.now() - cached_time > timedelta(seconds=ttl_seconds):
            del self._cache[key]
            self._misses += 1
            logger.debug(f"Cache expired for key: {key}")
            return None
        
        self._hits += 1
        logger.debug(f"Cache hit for key: {key}")
        return value
    
    def set(self, key: str, value: Any) -> None:
        """
        Store value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
        """
        self._cache[key] = (value, datetime.now())
        logger.debug(f"Cached value for key: {key}")
    
    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()
        logger.info("Cache cleared")
    
    def get_stats(self) -> dict:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with hit/miss counts and hit rate
        """
        total = self._hits + self._misses
        hit_rate = (self._hits / total * 100) if total > 0 else 0
        
        return {
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": f"{hit_rate:.1f}%",
            "size": len(self._cache),
        }


# Global cache instance
_cache = ResponseCache()


def cache_response(ttl_minutes: int = 5, key_prefix: Optional[str] = None):
    """
    Decorator to cache async function responses.
    
    Args:
        ttl_minutes: Cache TTL in minutes (default 5)
        key_prefix: Optional prefix for cache keys
    
    Returns:
        Decorated function with caching
    
    Example:
        @cache_response(ttl_minutes=5)
        async def get_traffic_data(bbox: BoundingBox):
            # Function implementation
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            # Convert args/kwargs to JSON-serializable format
            cache_data = {
                "func": func.__name__,
                "args": str(args),
                "kwargs": json.dumps(kwargs, sort_keys=True, default=str)
            }
            
            cache_key_str = json.dumps(cache_data, sort_keys=True)
            cache_key = hashlib.md5(cache_key_str.encode()).hexdigest()
            
            if key_prefix:
                cache_key = f"{key_prefix}:{cache_key}"
            
            # Check cache
            cached_result = _cache.get(cache_key, ttl_seconds=ttl_minutes * 60)
            if cached_result is not None:
                logger.debug(f"Cache hit for {func.__name__}")
                return cached_result
            
            # Call function and cache result
            logger.debug(f"Cache miss for {func.__name__}, calling function")
            result = await func(*args, **kwargs)
            
            # Cache the result
            _cache.set(cache_key, result)
            
            return result
        
        return wrapper
    return decorator


def get_cache_stats() -> dict:
    """Get cache statistics."""
    return _cache.get_stats()


def clear_cache() -> None:
    """Clear all cached entries."""
    _cache.clear()

