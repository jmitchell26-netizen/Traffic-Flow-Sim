"""
Error handling utilities.
"""

from typing import Optional
from fastapi import HTTPException


def handle_api_error(error: Exception, default_message: str = "API request failed") -> HTTPException:
    """
    Convert an exception to an HTTPException with appropriate status code.
    
    Args:
        error: Exception to handle
        default_message: Default error message if exception has no message
    
    Returns:
        HTTPException with appropriate status code
    """
    error_message = str(error) if error else default_message
    
    # Map common exceptions to HTTP status codes
    if isinstance(error, ValueError):
        return HTTPException(status_code=400, detail=error_message)
    elif isinstance(error, KeyError):
        return HTTPException(status_code=400, detail=f"Missing required field: {error_message}")
    elif isinstance(error, PermissionError):
        return HTTPException(status_code=403, detail=error_message)
    else:
        return HTTPException(status_code=500, detail=error_message)


def format_error_message(error: Exception, context: Optional[str] = None) -> str:
    """
    Format an error message with optional context.
    
    Args:
        error: Exception to format
        context: Optional context string
    
    Returns:
        Formatted error message
    """
    message = str(error) if error else "Unknown error"
    
    if context:
        return f"{context}: {message}"
    
    return message

