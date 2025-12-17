"""
Unit tests for coordinate validation utilities.
"""

import pytest
from app.utils.coordinates import (
    validate_coordinates,
    validate_bounding_box,
    calculate_bounding_box_area,
)
from app.models.traffic import Coordinates, BoundingBox


class TestValidateCoordinates:
    """Tests for coordinate validation."""
    
    def test_valid_coordinates(self):
        """Test valid coordinates pass validation."""
        coord = Coordinates(lat=40.7128, lng=-74.0060)
        is_valid, error = validate_coordinates(coord)
        assert is_valid is True
        assert error == ""
    
    def test_invalid_latitude_too_high(self):
        """Test latitude > 90 fails validation."""
        # Use model_construct to bypass Pydantic validation for testing
        coord = Coordinates.model_construct(lat=100, lng=-74.0060)
        is_valid, error = validate_coordinates(coord)
        assert is_valid is False
        assert "latitude" in error.lower()
    
    def test_invalid_latitude_too_low(self):
        """Test latitude < -90 fails validation."""
        coord = Coordinates.model_construct(lat=-100, lng=-74.0060)
        is_valid, error = validate_coordinates(coord)
        assert is_valid is False
        assert "latitude" in error.lower()
    
    def test_invalid_longitude_too_high(self):
        """Test longitude > 180 fails validation."""
        coord = Coordinates.model_construct(lat=40.7128, lng=200)
        is_valid, error = validate_coordinates(coord)
        assert is_valid is False
        assert "longitude" in error.lower()
    
    def test_invalid_longitude_too_low(self):
        """Test longitude < -180 fails validation."""
        coord = Coordinates.model_construct(lat=40.7128, lng=-200)
        is_valid, error = validate_coordinates(coord)
        assert is_valid is False
        assert "longitude" in error.lower()
    
    def test_nan_coordinates(self):
        """Test NaN coordinates fail validation."""
        import math
        coord = Coordinates.model_construct(lat=math.nan, lng=-74.0060)
        is_valid, error = validate_coordinates(coord)
        assert is_valid is False
        assert "nan" in error.lower() or "invalid" in error.lower()
    
    def test_none_coordinates(self):
        """Test None coordinates fail validation."""
        coord = Coordinates.model_construct(lat=None, lng=-74.0060)
        is_valid, error = validate_coordinates(coord)
        assert is_valid is False
        assert "missing" in error.lower()


class TestValidateBoundingBox:
    """Tests for bounding box validation."""
    
    def test_valid_bounding_box(self):
        """Test valid bounding box passes validation."""
        bbox = BoundingBox(north=40.8, south=40.7, east=-74.0, west=-74.1)
        is_valid, error = validate_bounding_box(bbox)
        assert is_valid is True
        assert error == ""
    
    def test_invalid_north_less_than_south(self):
        """Test north < south fails validation."""
        bbox = BoundingBox(north=40.7, south=40.8, east=-74.0, west=-74.1)
        is_valid, error = validate_bounding_box(bbox)
        assert is_valid is False
        assert "north" in error.lower() and "south" in error.lower()
    
    def test_invalid_east_less_than_west(self):
        """Test east < west fails validation."""
        bbox = BoundingBox(north=40.8, south=40.7, east=-74.1, west=-74.0)
        is_valid, error = validate_bounding_box(bbox)
        assert is_valid is False
        assert "east" in error.lower() and "west" in error.lower()
    
    def test_invalid_latitude_out_of_range(self):
        """Test latitude out of range fails validation."""
        bbox = BoundingBox(north=100, south=40.7, east=-74.0, west=-74.1)
        is_valid, error = validate_bounding_box(bbox)
        assert is_valid is False
        assert "latitude" in error.lower()
    
    def test_invalid_longitude_out_of_range(self):
        """Test longitude out of range fails validation."""
        bbox = BoundingBox(north=40.8, south=40.7, east=200, west=-74.1)
        is_valid, error = validate_bounding_box(bbox)
        assert is_valid is False
        assert "longitude" in error.lower()


class TestCalculateBoundingBoxArea:
    """Tests for bounding box area calculation."""
    
    def test_calculate_area(self):
        """Test area calculation."""
        bbox = BoundingBox(north=40.8, south=40.7, east=-74.0, west=-74.1)
        area = calculate_bounding_box_area(bbox)
        assert area == pytest.approx(0.01, rel=0.1)  # Approximately 0.01 square degrees
    
    def test_larger_area(self):
        """Test larger bounding box has larger area."""
        bbox_small = BoundingBox(north=40.8, south=40.7, east=-74.0, west=-74.1)
        bbox_large = BoundingBox(north=41.0, south=40.5, east=-73.5, west=-74.5)
        
        area_small = calculate_bounding_box_area(bbox_small)
        area_large = calculate_bounding_box_area(bbox_large)
        
        assert area_large > area_small

