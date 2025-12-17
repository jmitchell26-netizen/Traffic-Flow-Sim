"""
Coordinate validation utilities.
"""

import math
from typing import Tuple

from ..models.traffic import Coordinates, BoundingBox


def validate_coordinates(coord: Coordinates, name: str = "coordinates") -> Tuple[bool, str]:
    """
    Validate coordinate values.
    
    Args:
        coord: Coordinates to validate
        name: Name for error messages
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not coord:
        return False, f"{name}: Missing coordinates"
    
    if coord.lat is None or coord.lng is None:
        return False, f"{name}: Missing latitude or longitude"
    
    if math.isnan(coord.lat) or math.isnan(coord.lng):
        return False, f"{name}: Invalid coordinate values (NaN)"
    
    if abs(coord.lat) > 90:
        return False, f"{name}: Latitude out of range (-90 to 90)"
    
    if abs(coord.lng) > 180:
        return False, f"{name}: Longitude out of range (-180 to 180)"
    
    return True, ""


def validate_bounding_box(bbox: BoundingBox) -> Tuple[bool, str]:
    """
    Validate bounding box values.
    
    Args:
        bbox: Bounding box to validate
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not bbox:
        return False, "Missing bounding box"
    
    # Check individual coordinates
    for coord_name, coord_value in [
        ("north", bbox.north),
        ("south", bbox.south),
        ("east", bbox.east),
        ("west", bbox.west),
    ]:
        if coord_value is None:
            return False, f"Bounding box: Missing {coord_name}"
        
        if math.isnan(coord_value):
            return False, f"Bounding box: Invalid {coord_name} value (NaN)"
    
    # Validate ranges
    if abs(bbox.north) > 90 or abs(bbox.south) > 90:
        return False, "Bounding box: Latitude out of range (-90 to 90)"
    
    if abs(bbox.east) > 180 or abs(bbox.west) > 180:
        return False, "Bounding box: Longitude out of range (-180 to 180)"
    
    # Validate logical bounds
    if bbox.north <= bbox.south:
        return False, "Bounding box: North must be greater than south"
    
    if bbox.east <= bbox.west:
        return False, "Bounding box: East must be greater than west"
    
    return True, ""


def calculate_bounding_box_area(bbox: BoundingBox) -> float:
    """
    Calculate approximate area of bounding box in square degrees.
    
    Args:
        bbox: Bounding box
    
    Returns:
        Area in square degrees
    """
    return (bbox.north - bbox.south) * (bbox.east - bbox.west)

