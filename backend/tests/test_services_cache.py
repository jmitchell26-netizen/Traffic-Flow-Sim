"""
Unit tests for caching service.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from app.services.cache import ResponseCache, cache_response, clear_cache


class TestResponseCache:
    """Tests for ResponseCache class."""
    
    def test_get_set(self):
        """Test basic get/set operations."""
        cache = ResponseCache()
        cache.set("test_key", "test_value")
        assert cache.get("test_key") == "test_value"
    
    def test_get_nonexistent(self):
        """Test getting non-existent key returns None."""
        cache = ResponseCache()
        assert cache.get("nonexistent") is None
    
    def test_expiration(self):
        """Test cache entries expire after TTL."""
        cache = ResponseCache()
        cache.set("test_key", "test_value")
        
        # Should be available immediately
        assert cache.get("test_key", ttl_seconds=1) == "test_value"
        
        # Wait for expiration
        import time
        time.sleep(1.1)
        
        # Should be expired
        assert cache.get("test_key", ttl_seconds=1) is None
    
    def test_stats(self):
        """Test cache statistics."""
        cache = ResponseCache()
        cache.set("key1", "value1")
        cache.get("key1")  # Hit
        cache.get("key2")  # Miss
        
        stats = cache.get_stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["size"] == 1
    
    def test_clear(self):
        """Test clearing cache."""
        cache = ResponseCache()
        cache.set("key1", "value1")
        cache.clear()
        assert cache.get("key1") is None


class TestCacheResponseDecorator:
    """Tests for cache_response decorator."""
    
    @pytest.mark.asyncio
    async def test_caching_works(self):
        """Test decorator caches function results."""
        call_count = 0
        
        @cache_response(ttl_minutes=5)
        async def test_func(x: int):
            nonlocal call_count
            call_count += 1
            return x * 2
        
        # First call - should execute function
        result1 = await test_func(5)
        assert result1 == 10
        assert call_count == 1
        
        # Second call - should use cache
        result2 = await test_func(5)
        assert result2 == 10
        assert call_count == 1  # Should not increment
    
    @pytest.mark.asyncio
    async def test_different_args_not_cached(self):
        """Test different arguments create different cache entries."""
        # Clear cache to ensure clean state
        clear_cache()
        
        call_count = 0
        
        @cache_response(ttl_minutes=5)
        async def test_func(x: int):
            nonlocal call_count
            call_count += 1
            return x * 2
        
        # First call with arg 5
        result1 = await test_func(5)
        assert result1 == 10
        assert call_count == 1
        
        # Second call with different arg 10 - should execute again
        result2 = await test_func(10)
        assert result2 == 20
        assert call_count == 2  # Both should execute
        
        # Third call with same arg 5 - should use cache
        result3 = await test_func(5)
        assert result3 == 10
        assert call_count == 2  # Should not increment

