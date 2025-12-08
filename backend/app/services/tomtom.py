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
    
    API Documentation: https://developer.tomtom.com/traffic-api/documentation/traffic-flow
    """
    
    BASE_URL = "https://api.tomtom.com"
    
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.tomtom_api_key
        self._client: Optional[httpx.AsyncClient] = None
    
    async def get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
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
        
        Args:
            point: Geographic coordinates
            zoom: Zoom level (affects segment selection)
        
        Returns:
            RoadSegment with current traffic data
        """
        client = await self.get_client()
        
        url = f"{self.BASE_URL}/traffic/services/4/flowSegmentData/relative0/{zoom}/json"
        params = {
            "key": self.api_key,
            "point": f"{point.lat},{point.lng}",
            "unit": "KMPH",
            "thickness": 1,
        }
        
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            flow_data = data.get("flowSegmentData", {})
            
            # Parse coordinates from response
            coords_data = flow_data.get("coordinates", {}).get("coordinate", [])
            coordinates = [
                Coordinates(lat=c["latitude"], lng=c["longitude"])
                for c in coords_data
            ]
            
            current_speed = flow_data.get("currentSpeed", 0)
            free_flow_speed = flow_data.get("freeFlowSpeed", 1)
            speed_ratio = current_speed / free_flow_speed if free_flow_speed > 0 else 0
            
            current_time = flow_data.get("currentTravelTime", 0)
            free_flow_time = flow_data.get("freeFlowTravelTime", 0)
            
            return RoadSegment(
                id=self._generate_segment_id(point, zoom),
                name=flow_data.get("roadName"),
                coordinates=coordinates,
                current_speed=current_speed,
                free_flow_speed=free_flow_speed,
                current_travel_time=current_time,
                free_flow_travel_time=free_flow_time,
                congestion_level=RoadSegment.calculate_congestion_level(speed_ratio),
                delay_seconds=max(0, current_time - free_flow_time),
                speed_ratio=speed_ratio,
                road_type=flow_data.get("frc"),
            )
            
        except httpx.HTTPError as e:
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
        Uses parallel sampling across a grid for comprehensive coverage.
        
        Args:
            bbox: Geographic bounding box
            style: Flow style (relative0, relative-delay, reduced-sensitivity)
            grid_size: Number of points per dimension (default 8 = 64 points)
        
        Returns:
            TrafficFlowData with all segments in the region
        """
        import asyncio
        
        # Create a grid of sample points
        lat_step = (bbox.north - bbox.south) / grid_size
        lng_step = (bbox.east - bbox.west) / grid_size
        
        # Generate all sample points
        points = []
        for i in range(grid_size):
            for j in range(grid_size):
                point = Coordinates(
                    lat=bbox.south + lat_step * (i + 0.5),
                    lng=bbox.west + lng_step * (j + 0.5)
                )
                points.append(point)
        
        # Fetch all segments in parallel (with concurrency limit to avoid rate limits)
        semaphore = asyncio.Semaphore(10)  # Max 10 concurrent requests
        
        async def fetch_with_limit(point: Coordinates):
            async with semaphore:
                return await self.get_flow_segment_data(point, zoom=12)
        
        # Fetch all segments in parallel
        results = await asyncio.gather(*[fetch_with_limit(p) for p in points], return_exceptions=True)
        
        # Filter out None results and exceptions, and deduplicate
        segments = []
        seen_ids = set()
        
        for result in results:
            if isinstance(result, Exception):
                # Log but continue
                print(f"Error fetching segment: {result}")
                continue
            
            if result and result.id not in seen_ids:
                # Validate segment has valid coordinates
                if result.coordinates and len(result.coordinates) >= 2:
                    seen_ids.add(result.id)
                    segments.append(result)
        
        # Calculate aggregate metrics
        if segments:
            total_ratio = sum(s.speed_ratio for s in segments)
            avg_ratio = total_ratio / len(segments)
            congested = sum(
                1 for s in segments 
                if s.congestion_level in [CongestionLevel.HEAVY, CongestionLevel.SEVERE]
            )
        else:
            avg_ratio = 0
            congested = 0
        
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

