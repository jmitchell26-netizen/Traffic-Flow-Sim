"""
Rate limiting middleware for API endpoints.

Prevents API abuse by limiting requests per IP address.
"""

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Simple in-memory rate limiter.
    
    For production, consider using Redis-based rate limiting
    (e.g., with redis-py or slowapi library).
    """
    
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        """
        Initialize rate limiter.
        
        Args:
            max_requests: Maximum requests allowed per window
            window_seconds: Time window in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[str, List[datetime]] = defaultdict(list)
    
    def is_allowed(self, client_ip: str) -> tuple[bool, int]:
        """
        Check if request is allowed.
        
        Args:
            client_ip: Client IP address
        
        Returns:
            Tuple of (is_allowed, remaining_requests)
        """
        now = datetime.now()
        window_start = now - timedelta(seconds=self.window_seconds)
        
        # Clean old entries
        self._requests[client_ip] = [
            req_time for req_time in self._requests[client_ip]
            if req_time > window_start
        ]
        
        # Check limit
        request_count = len(self._requests[client_ip])
        
        if request_count >= self.max_requests:
            remaining = 0
            return False, remaining
        
        # Add current request
        self._requests[client_ip].append(now)
        remaining = self.max_requests - request_count - 1
        
        return True, remaining
    
    def get_remaining(self, client_ip: str) -> int:
        """Get remaining requests for an IP."""
        now = datetime.now()
        window_start = now - timedelta(seconds=self.window_seconds)
        
        self._requests[client_ip] = [
            req_time for req_time in self._requests[client_ip]
            if req_time > window_start
        ]
        
        return max(0, self.max_requests - len(self._requests[client_ip]))


# Global rate limiter instance
_rate_limiter = RateLimiter(max_requests=100, window_seconds=60)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware for FastAPI.
    
    Limits requests per IP address to prevent API abuse.
    """
    
    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60):
        """
        Initialize middleware.
        
        Args:
            app: FastAPI application
            max_requests: Maximum requests per window
            window_seconds: Time window in seconds
        """
        super().__init__(app)
        self.rate_limiter = RateLimiter(max_requests, window_seconds)
    
    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting."""
        # Skip rate limiting for health checks and docs
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Check rate limit
        is_allowed, remaining = self.rate_limiter.is_allowed(client_ip)
        
        if not is_allowed:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {self.rate_limiter.max_requests} requests per {self.rate_limiter.window_seconds} seconds. Please try again later.",
                headers={
                    "X-RateLimit-Limit": str(self.rate_limiter.max_requests),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": str(self.rate_limiter.window_seconds),
                }
            )
        
        # Add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.rate_limiter.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        
        return response


def rate_limit_middleware(app, max_requests: int = 100, window_seconds: int = 60):
    """
    Create rate limiting middleware.
    
    Args:
        app: FastAPI application
        max_requests: Maximum requests per window
        window_seconds: Time window in seconds
    
    Returns:
        Middleware instance
    """
    return RateLimitMiddleware(app, max_requests, window_seconds)

