"""
Request/response logging middleware.

Logs all API requests and responses for monitoring and debugging.
"""

import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all API requests and responses.
    
    Logs:
    - Request method and path
    - Response status code
    - Request duration
    - Client IP
    """
    
    async def dispatch(self, request: Request, call_next):
        """Process request with logging."""
        # Skip logging for static files and health checks (too noisy)
        if request.url.path.startswith("/static") or request.url.path == "/health":
            return await call_next(request)
        
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        
        # Log request
        logger.info(
            f"Request: {request.method} {request.url.path} "
            f"from {client_ip}"
        )
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log response
            log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
            logger.log(
                log_level,
                f"Response: {response.status_code} - {duration:.3f}s - "
                f"{request.method} {request.url.path}"
            )
            
            return response
            
        except Exception as e:
            # Log errors
            duration = time.time() - start_time
            logger.error(
                f"Error: {str(e)} - {duration:.3f}s - "
                f"{request.method} {request.url.path}",
                exc_info=True
            )
            raise


def log_requests(app):
    """
    Add logging middleware to FastAPI app.
    
    Args:
        app: FastAPI application
    
    Returns:
        Middleware instance
    """
    return LoggingMiddleware(app)

