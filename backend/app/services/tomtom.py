"""
TomTom Traffic API integration service.
Handles all communication with TomTom's Traffic Flow and Incidents APIs.
"""

import hashlib
from datetime import datetime
from typing import Optional
import httpx
import logging

from ..core.config import get_settings
from ..core.logging import get_logger
from ..services.cache import cache_response
from ..constants import (
    TOMTOM_BASE_URL,
    HTTP_TIMEOUT_SECONDS,
    GRID_SIZE_LARGE_AREA,
    GRID_SIZE_MEDIUM_AREA,
    GRID_SIZE_SMALL_AREA,
    GRID_SIZE_VERY_LARGE,
    GRID_SIZE_LARGE,
    GRID_SIZE_MEDIUM,
    GRID_SIZE_SMALL,
    MAX_CONCURRENT_REQUESTS,
    DEFAULT_ZOOM_LEVEL,
    DETAILED_ZOOM_LEVEL,
)
from ..models.traffic import (
    BoundingBox,
    Coordinates,
    CongestionLevel,
    RoadSegment,
    TrafficFlowData,
    TrafficIncident,
)
from ..utils.coordinates import validate_coordinates, validate_bounding_box, calculate_bounding_box_area

logger = get_logger(__name__)


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
    
    BASE_URL = TOMTOM_BASE_URL
    
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
            httpx.AsyncClient: Configured async HTTP client
        """
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS)
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
            logger.error(f"Error fetching flow segment data: {e}", exc_info=True)
            return None
    
    @cache_response(ttl_minutes=5, key_prefix="traffic_flow")
    async def get_traffic_flow_tiles(
        self,
        bbox: BoundingBox,
        style: str = "relative0",
        grid_size: Optional[int] = None
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
        
        # Validate bounding box
        is_valid, error_msg = validate_bounding_box(bbox)
        if not is_valid:
            raise ValueError(error_msg)
        
        # Calculate area in square degrees (approximate)
        area = calculate_bounding_box_area(bbox)
        
        # Calculate adaptive grid size based on bounding box area
        if grid_size is None:
            if area > GRID_SIZE_LARGE_AREA:
                grid_size = GRID_SIZE_VERY_LARGE
            elif area > GRID_SIZE_MEDIUM_AREA:
                grid_size = GRID_SIZE_LARGE
            elif area > GRID_SIZE_SMALL_AREA:
                grid_size = GRID_SIZE_MEDIUM
            else:
                grid_size = GRID_SIZE_SMALL
        
        # Calculate step size for grid sampling
        # Divides the bounding box into a grid of sample points
        lat_step = (bbox.north - bbox.south) / grid_size
        lng_step = (bbox.east - bbox.west) / grid_size
        
        # Generate grid of sample points with overlapping coverage
        # Use multiple offset grids to ensure we catch roads that might be missed
        # This is called "staggered sampling" - improves coverage without massive API calls
        points = []
        
        # Primary grid: sample at cell centers
        for i in range(grid_size):
            for j in range(grid_size):
                point = Coordinates(
                    lat=bbox.south + lat_step * (i + 0.5),  # Center of cell
                    lng=bbox.west + lng_step * (j + 0.5)    # Center of cell
                )
                points.append(point)
        
        # Secondary grid: offset by 1/3 to catch roads missed by primary grid
        # Only add if area is small enough (to avoid too many API calls)
        if area < GRID_SIZE_MEDIUM_AREA:
            for i in range(grid_size):
                for j in range(grid_size):
                    # Offset by 1/3 in both directions
                    offset_lat = bbox.south + lat_step * (i + 1/3)
                    offset_lng = bbox.west + lng_step * (j + 1/3)
                    # Only add if within bounds
                    if (bbox.south <= offset_lat <= bbox.north and 
                        bbox.west <= offset_lng <= bbox.east):
                        point = Coordinates(lat=offset_lat, lng=offset_lng)
                        points.append(point)
        
        # Fetch all segments in parallel with concurrency limiting
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        
        async def fetch_with_limit(point: Coordinates):
            """
            Wrapper function that respects concurrency limit.
            
            Uses detailed zoom level for better road coverage.
            """
            async with semaphore:
                return await self.get_flow_segment_data(point, zoom=DETAILED_ZOOM_LEVEL)
        
        # Execute all requests in parallel
        # return_exceptions=True allows us to handle individual failures gracefully
        results = await asyncio.gather(*[fetch_with_limit(p) for p in points], return_exceptions=True)
        
        # Process results: filter errors, deduplicate segments
        segments = []
        seen_ids = set()  # Track seen segment IDs to avoid duplicates
        
        for result in results:
            # Skip exceptions (logged but don't fail entire request)
            if isinstance(result, Exception):
                logger.warning(f"Error fetching segment: {result}")
                continue
            
            # Skip None results (API returned no data for this point)
            if result and result.id not in seen_ids:
                # Validate segment has valid coordinates before adding
                if result.coordinates and len(result.coordinates) >= 2:
                    seen_ids.add(result.id)
                    segments.append(result)
            
            # Also check if result is None due to no road at that point
            # This is normal - not every point will have a road nearby
            # The grid sampling approach means we'll still get good coverage
        
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
    
    @cache_response(ttl_minutes=2, key_prefix="incidents")
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
            logger.error(f"Error fetching incidents: {e}", exc_info=True)
            return []
    
    # ============================================================
    # HELPER METHODS
    # ============================================================
    
    def _generate_segment_id(self, point: Coordinates, zoom: int) -> str:
        """Generate a deterministic segment ID from coordinates."""
        raw = f"{point.lat:.5f},{point.lng:.5f},{zoom}"
        return hashlib.md5(raw.encode()).hexdigest()[:12]
    
    # ============================================================
    # SEARCH API
    # ============================================================
    
    async def search_location(self, query: str, limit: int = 10) -> list[dict]:
        """
        Search for locations using TomTom Search API.
        
        This method searches for places, addresses, and points of interest
        using TomTom's Search API. Falls back to OpenStreetMap Nominatim
        if TomTom API fails.
        
        Args:
            query: Search query (e.g., "New York", "Times Square", "Paris")
            limit: Maximum number of results to return (default 10)
        
        Returns:
            List of location results with:
            - name: Display name
            - coordinates: {lat, lng}
            - bounds: Bounding box
            - type: Location type (city, address, poi, etc.)
            - address: Full address string
        """
        client = await self.get_client()
        
        try:
            # Try TomTom Search API first
            url = f"{self.BASE_URL}/search/2/search/{query}.json"
            params = {
                "key": self.api_key,
                "limit": limit,
                "typeahead": "true",
                "language": "en-US",
            }
            
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for result in data.get("results", [])[:limit]:
                try:
                    position = result.get("position", {})
                    viewport = result.get("viewport", {})
                    
                    # Validate position
                    lat = position.get("lat")
                    lon = position.get("lon")
                    if lat is None or lon is None:
                        continue
                    
                    lat = float(lat)
                    lon = float(lon)
                    
                    # Validate coordinates using utility
                    coord = Coordinates(lat=lat, lng=lon)
                    is_valid, _ = validate_coordinates(coord)
                    if not is_valid:
                        continue
                    
                    # Get bounds with fallbacks
                    top_left = viewport.get("topLeftPoint", {})
                    bottom_right = viewport.get("bottomRightPoint", {})
                    
                    results.append({
                        "name": result.get("poi", {}).get("name") or result.get("address", {}).get("freeformAddress") or result.get("address", {}).get("municipality") or query,
                        "coordinates": {
                            "lat": lat,
                            "lng": lon,
                        },
                        "bounds": {
                            "north": top_left.get("lat") or lat + 0.01,
                            "south": bottom_right.get("lat") or lat - 0.01,
                            "east": bottom_right.get("lon") or lon + 0.01,
                            "west": top_left.get("lon") or lon - 0.01,
                        },
                        "type": result.get("type", "unknown"),
                        "address": result.get("address", {}).get("freeformAddress", ""),
                    })
                except (ValueError, TypeError, KeyError) as e:
                    logger.warning(f"Error processing search result: {e}")
                    continue
            
            return results
            
        except Exception as e:
            # Fallback to OpenStreetMap Nominatim (free, no API key needed)
            logger.warning(f"TomTom search failed, trying OpenStreetMap: {e}")
            try:
                nominatim_url = "https://nominatim.openstreetmap.org/search"
                params = {
                    "q": query,
                    "format": "json",
                    "limit": limit,
                    "addressdetails": "1",
                }
                headers = {
                    "User-Agent": "TrafficFlowSim/1.0"  # Required by Nominatim
                }
                
                response = await client.get(nominatim_url, params=params, headers=headers)
                response.raise_for_status()
                data = response.json()
                
                results = []
                for result in data[:limit]:
                    try:
                        lat_str = result.get("lat")
                        lon_str = result.get("lon")
                        
                        if not lat_str or not lon_str:
                            continue
                        
                        lat = float(lat_str)
                        lon = float(lon_str)
                        
                        # Validate coordinates using utility
                        coord = Coordinates(lat=lat, lng=lon)
                        is_valid, _ = validate_coordinates(coord)
                        if not is_valid:
                            continue
                        
                        bounds = result.get("boundingbox", [])
                        display_name = result.get("display_name", "")
                        
                        results.append({
                            "name": display_name.split(",")[0] if display_name else query,
                            "coordinates": {
                                "lat": lat,
                                "lng": lon,
                            },
                            "bounds": {
                                "north": float(bounds[1]) if len(bounds) > 1 and bounds[1] else lat + 0.01,
                                "south": float(bounds[0]) if len(bounds) > 0 and bounds[0] else lat - 0.01,
                                "east": float(bounds[3]) if len(bounds) > 3 and bounds[3] else lon + 0.01,
                                "west": float(bounds[2]) if len(bounds) > 2 and bounds[2] else lon - 0.01,
                            },
                            "type": result.get("type", "unknown"),
                            "address": display_name,
                        })
                    except (ValueError, TypeError, KeyError) as e:
                        logger.warning(f"Error processing Nominatim result: {e}")
                        continue
                
                return results
                
            except Exception as fallback_error:
                logger.error(f"OpenStreetMap search also failed: {fallback_error}", exc_info=True)
                return []
    
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
    
    # ============================================================
    # ROUTING API
    # ============================================================
    
    async def calculate_route(
        self,
        start: Coordinates,
        end: Coordinates,
        alternatives: bool = False
    ) -> list[dict]:
        """
        Calculate route between two points using TomTom Routing API.
        
        Args:
            start: Starting coordinates
            end: Destination coordinates
            alternatives: Whether to return alternative routes
        
        Returns:
            List of route dictionaries with geometry, distance, time, and delays
        """
        # Validate coordinates using utility
        is_valid_start, error_start = validate_coordinates(start, "start")
        if not is_valid_start:
            raise ValueError(error_start)
        
        is_valid_end, error_end = validate_coordinates(end, "end")
        if not is_valid_end:
            raise ValueError(error_end)
        
        client = await self.get_client()
        
        try:
            url = f"{self.BASE_URL}/routing/1/calculateRoute/{start.lat},{start.lng}:{end.lat},{end.lng}/json"
            params = {
                "key": self.api_key,
                "routeType": "fastest",  # Options: fastest, shortest, eco, thrilling
                "traffic": "true",  # Include traffic data
                "avoid": "",  # Can add: tollRoads, motorways, etc.
                "travelMode": "car",  # Options: car, pedestrian, taxi, bus, van, motorcycle, truck, bicycle
                "maxAlternatives": 3 if alternatives else 0,
            }
            
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            routes = []
            for route_data in data.get("routes", []):
                summary = route_data.get("summary", {})
                legs = route_data.get("legs", [])
                
                # Extract geometry (coordinates)
                geometry = []
                for leg in legs:
                    points = leg.get("points", [])
                    if not points:
                        # Try alternative structure
                        points = leg.get("geometry", {}).get("coordinates", [])
                    
                    for point in points:
                        # Handle different point formats
                        if isinstance(point, dict):
                            lat = point.get("latitude") or point.get("lat")
                            lng = point.get("longitude") or point.get("lon") or point.get("lng")
                        elif isinstance(point, list) and len(point) >= 2:
                            # GeoJSON format: [lng, lat]
                            lng, lat = point[0], point[1]
                        else:
                            continue
                        
                        if lat is not None and lng is not None:
                            geometry.append({
                                "lat": float(lat),
                                "lng": float(lng),
                            })
                
                # Only add route if it has valid geometry
                if geometry:
                    routes.append({
                        "distance": summary.get("lengthInMeters", 0) / 1000,  # Convert to km
                        "time": summary.get("travelTimeInSeconds", 0),  # seconds
                        "delay": summary.get("delayInSeconds", 0),  # seconds
                        "geometry": geometry,
                        "instructions": self._extract_instructions(route_data),
                    })
            
            return routes
            
        except Exception as e:
            logger.error(f"Error calculating route: {e}", exc_info=True)
            return []
    
    def _extract_instructions(self, route_data: dict) -> list[dict]:
        """Extract turn-by-turn instructions from route data."""
        instructions = []
        for leg in route_data.get("legs", []):
            for guidance in leg.get("guidance", {}).get("instructions", []):
                instructions.append({
                    "instruction": guidance.get("instruction", ""),
                    "distance": guidance.get("distance", 0),
                    "road": guidance.get("road", ""),
                })
        return instructions


# Singleton instance
_tomtom_service: Optional[TomTomService] = None


def get_tomtom_service() -> TomTomService:
    """Get or create the TomTom service singleton."""
    global _tomtom_service
    if _tomtom_service is None:
        _tomtom_service = TomTomService()
    return _tomtom_service

