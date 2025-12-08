"""
TomTom Traffic API integration service.
Handles all communication with TomTom's Traffic Flow and Incidents APIs.
"""

import hashlib
from datetime import datetime
from typing import Optional
import httpx

from ..core.config import get_settings
from ..models.traffic import (
    BoundingBox,
    Coordinates,
    CongestionLevel,
    RoadSegment,
    TrafficFlowData,
    TrafficIncident,
)


class TomTomService:
    """
    Service for fetching real-time traffic data from TomTom API.
    
    This service handles all communication with TomTom's Traffic Flow and Incidents APIs.
    It provides methods to fetch traffic data for specific points or bounding boxes.
    
    API Documentation: https://developer.tomtom.com/traffic-api/documentation/traffic-flow
    
    Attributes:
        api_key: TomTom API key loaded from environment variables
        _client: Lazy-loaded async HTTP client for making API requests
    """
    
    BASE_URL = "https://api.tomtom.com"
    
    def __init__(self):
        """Initialize TomTom service with API key from settings."""
        settings = get_settings()
        self.api_key = settings.tomtom_api_key
        self._client: Optional[httpx.AsyncClient] = None
    
    async def get_client(self) -> httpx.AsyncClient:
        """
        Get or create async HTTP client.
        
        Uses lazy initialization - client is only created when first needed.
        Reuses existing client if it's still open.
        
        Returns:
            httpx.AsyncClient: Configured async HTTP client with 30s timeout
        """
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client
    
    async def close(self):
        """
        Close the HTTP client.
        
        Should be called during application shutdown to properly clean up resources.
        """
        if self._client:
            await self._client.aclose()
    
    # ============================================================
    # TRAFFIC FLOW API
    # ============================================================
    
    async def get_flow_segment_data(
        self,
        point: Coordinates,
        zoom: int = 10
    ) -> Optional[RoadSegment]:
        """
        Get traffic flow data for a specific road segment near a point.
        
        This method queries TomTom's Flow Segment Data API to get real-time
        traffic information for the road segment closest to the given point.
        
        Args:
            point: Geographic coordinates (latitude, longitude)
            zoom: Zoom level (1-22). Higher zoom = more detailed segments.
                  Default is 10 for city-level detail.
        
        Returns:
            RoadSegment object with current traffic data, or None if:
            - API request fails
            - No segment found at the point
            - Invalid response data
        
        Example:
            >>> point = Coordinates(lat=40.7128, lng=-74.0060)
            >>> segment = await service.get_flow_segment_data(point, zoom=12)
            >>> print(segment.current_speed)  # Current speed in km/h
        """
        client = await self.get_client()
        
        # Construct API URL - uses relative0 style for congestion visualization
        url = f"{self.BASE_URL}/traffic/services/4/flowSegmentData/relative0/{zoom}/json"
        params = {
            "key": self.api_key,
            "point": f"{point.lat},{point.lng}",  # Format: "lat,lng"
            "unit": "KMPH",  # Speed units: kilometers per hour
            "thickness": 1,   # Line thickness (1-5)
        }
        
        try:
            # Make async HTTP request
            response = await client.get(url, params=params)
            response.raise_for_status()  # Raise exception for HTTP errors
            data = response.json()
            
            # Extract flow segment data from response
            flow_data = data.get("flowSegmentData", {})
            
            # Parse coordinate array from response
            # TomTom returns coordinates as array of {latitude, longitude} objects
            coords_data = flow_data.get("coordinates", {}).get("coordinate", [])
            coordinates = [
                Coordinates(lat=c["latitude"], lng=c["longitude"])
                for c in coords_data
            ]
            
            # Extract speed data
            current_speed = flow_data.get("currentSpeed", 0)  # Current speed in km/h
            free_flow_speed = flow_data.get("freeFlowSpeed", 1)  # Free-flow speed in km/h
            # Calculate speed ratio (0-1): how fast compared to free-flow
            speed_ratio = current_speed / free_flow_speed if free_flow_speed > 0 else 0
            
            # Extract travel time data
            current_time = flow_data.get("currentTravelTime", 0)  # Current travel time in seconds
            free_flow_time = flow_data.get("freeFlowTravelTime", 0)  # Free-flow time in seconds
            
            # Create and return RoadSegment model
            return RoadSegment(
                id=self._generate_segment_id(point, zoom),  # Unique ID for this segment
                name=flow_data.get("roadName"),  # Road name (e.g., "Main St")
                coordinates=coordinates,  # Array of coordinate points
                current_speed=current_speed,
                free_flow_speed=free_flow_speed,
                current_travel_time=current_time,
                free_flow_travel_time=free_flow_time,
                congestion_level=RoadSegment.calculate_congestion_level(speed_ratio),  # Calculate congestion level
                delay_seconds=max(0, current_time - free_flow_time),  # Delay compared to free-flow
                speed_ratio=speed_ratio,
                road_type=flow_data.get("frc"),  # Functional Road Class (0-8, lower = more important)
            )
            
        except httpx.HTTPError as e:
            # Log error but don't crash - return None so calling code can handle it
            print(f"Error fetching flow segment data: {e}")
            return None
    
    async def get_traffic_flow_tiles(
        self,
        bbox: BoundingBox,
        style: str = "relative0",
        grid_size: int = 8
    ) -> TrafficFlowData:
        """
        Get traffic flow data for a bounding box region.
        
        This method samples multiple points across the bounding box in a grid pattern
        and fetches traffic data for each point in parallel. This provides comprehensive
        coverage of the entire region.
        
        Performance optimizations:
        - Parallel requests using asyncio.gather()
        - Concurrency limiting (max 10 simultaneous requests) to avoid rate limits
        - Deduplication of overlapping segments
        
        Args:
            bbox: Geographic bounding box defining the region to query
            style: Flow style (not currently used, reserved for future API features)
            grid_size: Number of sample points per dimension.
                      Default 8 = 8x8 grid = 64 sample points
                      Higher = more coverage but slower and more API calls
        
        Returns:
            TrafficFlowData object containing:
            - List of all unique road segments in the region
            - Aggregate metrics (average speed ratio, congestion counts)
            - Bounding box and timestamp
        
        Example:
            >>> bbox = BoundingBox(north=40.8, south=40.7, east=-74.0, west=-74.1)
            >>> data = await service.get_traffic_flow_tiles(bbox, grid_size=8)
            >>> print(f"Found {data.total_segments} segments")
        """
        import asyncio
        
        # Calculate step size for grid sampling
        # Divides the bounding box into a grid of sample points
        lat_step = (bbox.north - bbox.south) / grid_size
        lng_step = (bbox.east - bbox.west) / grid_size
        
        # Generate grid of sample points
        # Each point is at the center of its grid cell
        points = []
        for i in range(grid_size):
            for j in range(grid_size):
                point = Coordinates(
                    lat=bbox.south + lat_step * (i + 0.5),  # Center of cell
                    lng=bbox.west + lng_step * (j + 0.5)    # Center of cell
                )
                points.append(point)
        
        # Fetch all segments in parallel with concurrency limiting
        # Semaphore limits to 10 concurrent requests to avoid API rate limits
        semaphore = asyncio.Semaphore(10)
        
        async def fetch_with_limit(point: Coordinates):
            """
            Wrapper function that respects concurrency limit.
            Only 10 requests will run simultaneously.
            """
            async with semaphore:
                return await self.get_flow_segment_data(point, zoom=12)
        
        # Execute all requests in parallel
        # return_exceptions=True allows us to handle individual failures gracefully
        results = await asyncio.gather(*[fetch_with_limit(p) for p in points], return_exceptions=True)
        
        # Process results: filter errors, deduplicate segments
        segments = []
        seen_ids = set()  # Track seen segment IDs to avoid duplicates
        
        for result in results:
            # Skip exceptions (logged but don't fail entire request)
            if isinstance(result, Exception):
                print(f"Error fetching segment: {result}")
                continue
            
            # Skip None results (API returned no data for this point)
            if result and result.id not in seen_ids:
                # Validate segment has valid coordinates before adding
                if result.coordinates and len(result.coordinates) >= 2:
                    seen_ids.add(result.id)
                    segments.append(result)
        
        # Calculate aggregate metrics for the region
        if segments:
            # Average speed ratio across all segments
            total_ratio = sum(s.speed_ratio for s in segments)
            avg_ratio = total_ratio / len(segments)
            
            # Count segments with heavy or severe congestion
            congested = sum(
                1 for s in segments 
                if s.congestion_level in [CongestionLevel.HEAVY, CongestionLevel.SEVERE]
            )
        else:
            # No segments found - set defaults
            avg_ratio = 0
            congested = 0
        
        # Return aggregated traffic flow data
        return TrafficFlowData(
            segments=segments,
            bounding_box=bbox,
            timestamp=datetime.utcnow(),
            average_speed_ratio=avg_ratio,
            total_segments=len(segments),
            congested_segments=congested,
        )
    
    # ============================================================
    # TRAFFIC INCIDENTS API
    # ============================================================
    
    async def get_incidents(
        self,
        bbox: BoundingBox
    ) -> list[TrafficIncident]:
        """
        Get traffic incidents within a bounding box.
        
        Args:
            bbox: Geographic bounding box
        
        Returns:
            List of traffic incidents
        """
        client = await self.get_client()
        
        url = f"{self.BASE_URL}/traffic/services/5/incidentDetails"
        params = {
            "key": self.api_key,
            "bbox": bbox.to_tomtom_format(),
            "fields": "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime}}}",
            "language": "en-US",
            "categoryFilter": "0,1,2,3,4,5,6,7,8,9,10,11,14",
            "timeValidityFilter": "present",
        }
        
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            incidents = []
            for item in data.get("incidents", []):
                props = item.get("properties", {})
                geom = item.get("geometry", {})
                coords = geom.get("coordinates", [0, 0])
                
                # Handle both Point and LineString geometries
                if geom.get("type") == "Point":
                    location = Coordinates(lat=coords[1], lng=coords[0])
                else:
                    # For LineString, use first coordinate
                    first_coord = coords[0] if coords else [0, 0]
                    location = Coordinates(lat=first_coord[1], lng=first_coord[0])
                
                events = props.get("events", [])
                description = events[0].get("description") if events else None
                
                incident = TrafficIncident(
                    id=props.get("id", ""),
                    type=self._map_incident_type(props.get("iconCategory", 0)),
                    location=location,
                    description=description,
                    severity=min(5, max(1, props.get("magnitudeOfDelay", 1) + 1)),
                    start_time=datetime.fromisoformat(
                        props.get("startTime", datetime.utcnow().isoformat())
                        .replace("Z", "+00:00")
                    ),
                    end_time=datetime.fromisoformat(
                        props.get("endTime").replace("Z", "+00:00")
                    ) if props.get("endTime") else None,
                )
                incidents.append(incident)
            
            return incidents
            
        except httpx.HTTPError as e:
            print(f"Error fetching incidents: {e}")
            return []
    
    # ============================================================
    # HELPER METHODS
    # ============================================================
    
    def _generate_segment_id(self, point: Coordinates, zoom: int) -> str:
        """Generate a deterministic segment ID from coordinates."""
        raw = f"{point.lat:.5f},{point.lng:.5f},{zoom}"
        return hashlib.md5(raw.encode()).hexdigest()[:12]
    
    def _map_incident_type(self, icon_category: int) -> str:
        """Map TomTom icon category to incident type."""
        mapping = {
            0: "unknown",
            1: "accident",
            2: "fog",
            3: "dangerous_conditions",
            4: "rain",
            5: "ice",
            6: "jam",
            7: "lane_closed",
            8: "road_closed",
            9: "road_works",
            10: "wind",
            11: "flooding",
            14: "broken_down_vehicle",
        }
        return mapping.get(icon_category, "unknown")


# Singleton instance
_tomtom_service: Optional[TomTomService] = None


def get_tomtom_service() -> TomTomService:
    """Get or create the TomTom service singleton."""
    global _tomtom_service
    if _tomtom_service is None:
        _tomtom_service = TomTomService()
    return _tomtom_service

