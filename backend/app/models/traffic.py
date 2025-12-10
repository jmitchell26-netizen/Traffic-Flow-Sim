"""
Traffic data models and types.
These models represent data from TomTom API and internal simulation state.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class CongestionLevel(str, Enum):
    """Traffic congestion levels for road segments."""
    FREE_FLOW = "free_flow"      # Green - no delays
    LIGHT = "light"              # Light green - minor delays
    MODERATE = "moderate"        # Yellow - noticeable delays
    HEAVY = "heavy"              # Orange - significant delays
    SEVERE = "severe"            # Red - major delays/standstill


class Coordinates(BaseModel):
    """Geographic coordinates."""
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class BoundingBox(BaseModel):
    """Geographic bounding box for API queries."""
    north: float
    south: float
    east: float
    west: float
    
    def to_tomtom_format(self) -> str:
        """Convert to TomTom API format: south,west,north,east"""
        return f"{self.south},{self.west},{self.north},{self.east}"


class RoadSegment(BaseModel):
    """A road segment with traffic data."""
    id: str
    name: Optional[str] = None
    coordinates: list[Coordinates]
    
    # Traffic metrics
    current_speed: float = Field(..., description="Current speed in km/h")
    free_flow_speed: float = Field(..., description="Free-flow speed in km/h")
    current_travel_time: int = Field(..., description="Current travel time in seconds")
    free_flow_travel_time: int = Field(..., description="Free-flow travel time in seconds")
    
    # Derived metrics
    congestion_level: CongestionLevel
    delay_seconds: int = Field(default=0, description="Delay compared to free-flow")
    speed_ratio: float = Field(default=1.0, description="current_speed / free_flow_speed")
    
    # Metadata
    road_type: Optional[str] = None
    length_meters: Optional[float] = None
    
    @classmethod
    def calculate_congestion_level(cls, speed_ratio: float) -> CongestionLevel:
        """Determine congestion level based on speed ratio."""
        if speed_ratio >= 0.9:
            return CongestionLevel.FREE_FLOW
        elif speed_ratio >= 0.7:
            return CongestionLevel.LIGHT
        elif speed_ratio >= 0.5:
            return CongestionLevel.MODERATE
        elif speed_ratio >= 0.25:
            return CongestionLevel.HEAVY
        else:
            return CongestionLevel.SEVERE


class TrafficFlowData(BaseModel):
    """Complete traffic flow data for a region."""
    segments: list[RoadSegment]
    bounding_box: BoundingBox
    timestamp: datetime
    source: str = "tomtom"
    
    # Aggregate metrics
    average_speed_ratio: float = 0.0
    total_segments: int = 0
    congested_segments: int = 0


class TrafficAlert(BaseModel):
    """User-defined traffic alert."""
    id: str
    name: str
    area: BoundingBox
    conditions: dict  # e.g., {"congestion_level": "heavy", "delay_threshold": 300}
    enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    def check_conditions(self, traffic_data: TrafficFlowData) -> bool:
        """Check if alert conditions are met."""
        if not self.enabled:
            return False
        
        # Check congestion level
        if "congestion_level" in self.conditions:
            required_level = self.conditions["congestion_level"]
            congested_count = sum(
                1 for s in traffic_data.segments
                if s.congestion_level == required_level
            )
            threshold = self.conditions.get("congestion_count", 1)
            if congested_count >= threshold:
                return True
        
        # Check delay threshold
        if "delay_threshold" in self.conditions:
            threshold = self.conditions["delay_threshold"]
            high_delay_count = sum(
                1 for s in traffic_data.segments
                if s.delay_seconds >= threshold
            )
            if high_delay_count > 0:
                return True
        
        # Check average speed ratio
        if "speed_ratio_threshold" in self.conditions:
            threshold = self.conditions["speed_ratio_threshold"]
            if traffic_data.average_speed_ratio <= threshold:
                return True
        
        return False


class TrafficIncident(BaseModel):
    """Traffic incident (accident, road closure, etc.)."""
    id: str
    type: str  # "accident", "construction", "closure", "event"
    location: Coordinates
    description: Optional[str] = None
    severity: int = Field(default=1, ge=1, le=5)
    start_time: datetime
    end_time: Optional[datetime] = None
    affected_segments: list[str] = []


# ============================================================
# SIMULATION MODELS
# ============================================================

class DriverProfile(str, Enum):
    """Driver behavior profiles for simulation."""
    AGGRESSIVE = "aggressive"    # Higher speed, shorter following distance
    NORMAL = "normal"            # Average behavior
    CAUTIOUS = "cautious"        # Lower speed, longer following distance
    LEARNER = "learner"          # Very cautious, slower reactions


class VehicleType(str, Enum):
    """Types of vehicles in simulation."""
    CAR = "car"
    TRUCK = "truck"
    MOTORCYCLE = "motorcycle"
    BUS = "bus"
    EMERGENCY = "emergency"


class SimulatedVehicle(BaseModel):
    """A vehicle in the simulation."""
    id: str
    vehicle_type: VehicleType = VehicleType.CAR
    driver_profile: DriverProfile = DriverProfile.NORMAL
    
    # Position and movement
    position: Coordinates
    heading: float = Field(default=0, ge=0, lt=360)  # Degrees from north
    current_speed: float = 0  # km/h
    target_speed: float = 50  # km/h
    
    # Route
    current_segment_id: Optional[str] = None
    route_segment_ids: list[str] = []
    destination: Optional[Coordinates] = None
    
    # State
    waiting_at_light: bool = False
    wait_time_seconds: float = 0


class TrafficLightPhase(str, Enum):
    """Traffic light phases."""
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class TrafficLight(BaseModel):
    """A traffic light at an intersection."""
    id: str
    location: Coordinates
    current_phase: TrafficLightPhase = TrafficLightPhase.RED
    
    # Timing (in seconds)
    green_duration: int = 30
    yellow_duration: int = 5
    red_duration: int = 30
    
    # State
    time_in_current_phase: float = 0
    controlled_segment_ids: list[str] = []


class Intersection(BaseModel):
    """An intersection with traffic control."""
    id: str
    location: Coordinates
    name: Optional[str] = None
    traffic_lights: list[TrafficLight] = []
    connected_segment_ids: list[str] = []
    
    # Metrics
    average_wait_time: float = 0
    vehicles_per_minute: float = 0


class SimulationState(BaseModel):
    """Complete state of the traffic simulation."""
    tick: int = 0
    timestamp: datetime
    
    vehicles: list[SimulatedVehicle] = []
    traffic_lights: list[TrafficLight] = []
    intersections: list[Intersection] = []
    active_incidents: list[TrafficIncident] = []
    
    # Global metrics
    total_vehicles: int = 0
    average_speed: float = 0
    total_wait_time: float = 0
    vehicles_completed: int = 0


class SimulationConfig(BaseModel):
    """Configuration for the simulation engine."""
    tick_interval_ms: int = 100
    max_vehicles: int = 500
    spawn_rate: float = 0.5  # Vehicles per second
    
    # Behavior modifiers
    base_acceleration: float = 2.0  # m/s²
    base_deceleration: float = 4.0  # m/s²
    min_following_distance: float = 5.0  # meters
    
    # Randomness
    speed_variance: float = 0.1  # ±10% of target speed
    profile_distribution: dict[DriverProfile, float] = {
        DriverProfile.AGGRESSIVE: 0.15,
        DriverProfile.NORMAL: 0.60,
        DriverProfile.CAUTIOUS: 0.20,
        DriverProfile.LEARNER: 0.05,
    }


# ============================================================
# ANALYTICS MODELS
# ============================================================

class EmissionsEstimate(BaseModel):
    """Estimated emissions based on traffic state."""
    co2_kg_per_hour: float
    nox_grams_per_hour: float
    fuel_liters_per_hour: float
    
    # Per vehicle averages
    avg_co2_per_vehicle: float
    avg_fuel_per_vehicle: float


class TrafficMetrics(BaseModel):
    """Aggregated traffic metrics for dashboard."""
    timestamp: datetime
    
    # Flow metrics
    average_speed: float
    vehicles_per_minute: float
    congestion_index: float  # 0-1 scale
    
    # Time metrics
    average_wait_time: float
    average_travel_time_delta: float  # Actual - ideal
    
    # Counts
    total_active_vehicles: int
    vehicles_waiting: int
    active_incidents: int
    
    # Emissions
    emissions: EmissionsEstimate


class TimeSeriesDataPoint(BaseModel):
    """A single data point for time series charts."""
    timestamp: datetime
    value: float
    label: Optional[str] = None


class DashboardData(BaseModel):
    """Complete data package for dashboard rendering."""
    current_metrics: TrafficMetrics
    
    # Time series data
    speed_history: list[TimeSeriesDataPoint] = []
    flow_history: list[TimeSeriesDataPoint] = []
    congestion_history: list[TimeSeriesDataPoint] = []
    
    # Comparisons
    rush_hour_avg_speed: Optional[float] = None
    off_peak_avg_speed: Optional[float] = None

