"""
Shared request/response models for API endpoints.
"""

from typing import Optional
from pydantic import BaseModel


class BBoxRequest(BaseModel):
    """Bounding box request for traffic data."""
    north: float
    south: float
    east: float
    west: float


class PointRequest(BaseModel):
    """Single point request."""
    lat: float
    lng: float
    zoom: int = 12


class TrafficLightTimingRequest(BaseModel):
    """Request to adjust traffic light timing."""
    light_id: str
    green_duration: Optional[int] = None
    yellow_duration: Optional[int] = None
    red_duration: Optional[int] = None


class IncidentRequest(BaseModel):
    """Request to add a traffic incident."""
    type: str
    lat: float
    lng: float
    description: Optional[str] = None
    severity: int = 3


class IntersectionRequest(BaseModel):
    """Request to add an intersection."""
    lat: float
    lng: float
    name: Optional[str] = None
    green_duration: int = 30
    yellow_duration: int = 5
    red_duration: int = 30

