"""
Traffic Simulation Engine.

Core simulation logic for vehicle movement, traffic light control,
and congestion modeling. Designed to run in real-time alongside
actual traffic data.
"""

import asyncio
import math
import random
import uuid
from datetime import datetime
from typing import Optional, Callable

from ..models.traffic import (
    Coordinates,
    DriverProfile,
    Intersection,
    RoadSegment,
    SimulatedVehicle,
    SimulationConfig,
    SimulationState,
    TrafficFlowData,
    TrafficIncident,
    TrafficLight,
    TrafficLightPhase,
    VehicleType,
    EmissionsEstimate,
)


class SimulationEngine:
    """
    Real-time traffic simulation engine.
    
    This engine simulates vehicle movement, traffic light behavior, and congestion
    in real-time. It integrates with actual traffic data from TomTom API to create
    a hybrid simulation that respects real-world conditions while simulating
    individual vehicle behaviors.
    
    Key Features:
    - Vehicle spawning and movement with physics-based acceleration/deceleration
    - Driver behavior profiles (aggressive, normal, cautious, learner)
    - Traffic light control with adjustable timing
    - Incident management (accidents, closures, slowdowns)
    - Emissions calculations based on traffic state
    - Real-time metrics (wait times, flow rates, speeds)
    
    Attributes:
        config: Simulation configuration (tick rate, max vehicles, etc.)
        state: Current simulation state (vehicles, lights, metrics)
        _running: Whether simulation loop is currently running
        _real_traffic_data: Latest real-world traffic data from API
        _listeners: Callbacks to notify when simulation state changes
    """
    
    def __init__(self, config: Optional[SimulationConfig] = None):
        """
        Initialize simulation engine.
        
        Args:
            config: Optional simulation configuration. If None, uses defaults.
        """
        self.config = config or SimulationConfig()
        self.state = SimulationState(timestamp=datetime.utcnow())
        self._running = False  # Simulation loop not running initially
        self._real_traffic_data: Optional[TrafficFlowData] = None  # Real traffic data
        self._listeners: list[Callable[[SimulationState], None]] = []  # State change listeners
    
    # ============================================================
    # LIFECYCLE METHODS
    # ============================================================
    
    async def start(self):
        """
        Start the simulation loop.
        
        Begins continuous simulation ticks at the configured interval.
        Runs until stop() is called. Each tick updates all vehicles,
        traffic lights, and calculates metrics.
        
        Note: This is an async function that runs indefinitely.
        Use stop() to terminate the loop.
        """
        self._running = True
        while self._running:
            await self.tick()  # Execute one simulation step
            # Wait for configured tick interval before next tick
            await asyncio.sleep(self.config.tick_interval_ms / 1000)
    
    def stop(self):
        """
        Stop the simulation loop.
        
        Sets running flag to False, which will cause the start() loop
        to exit on the next iteration. Simulation state is preserved.
        """
        self._running = False
    
    def reset(self):
        """
        Reset simulation to initial state.
        
        Clears all vehicles, resets metrics, but preserves configuration.
        Useful for restarting simulation from scratch.
        """
        self.state = SimulationState(timestamp=datetime.utcnow())
    
    def add_listener(self, callback: Callable[[SimulationState], None]):
        """Add a listener for state updates."""
        self._listeners.append(callback)
    
    def remove_listener(self, callback: Callable[[SimulationState], None]):
        """Remove a state update listener."""
        if callback in self._listeners:
            self._listeners.remove(callback)
    
    def _notify_listeners(self):
        """Notify all listeners of state change."""
        for listener in self._listeners:
            listener(self.state)
    
    # ============================================================
    # REAL DATA INTEGRATION
    # ============================================================
    
    def update_real_traffic_data(self, data: TrafficFlowData):
        """
        Update simulation with real traffic data.
        Adjusts spawn rates and speed limits based on actual conditions.
        """
        self._real_traffic_data = data
        
        # Adjust simulation parameters based on real congestion
        congestion_factor = 1 - data.average_speed_ratio
        
        # More congested = more vehicles spawning (they're stuck)
        self.config.spawn_rate = 0.3 + (congestion_factor * 0.7)
        
        # Update segment speeds to match reality
        for segment in data.segments:
            self._update_segment_speed_limit(segment)
    
    def _update_segment_speed_limit(self, segment: RoadSegment):
        """Update speed limits for vehicles on a segment."""
        for vehicle in self.state.vehicles:
            if vehicle.current_segment_id == segment.id:
                # Target speed is actual speed with some variance
                variance = random.uniform(-0.1, 0.1)
                vehicle.target_speed = segment.current_speed * (1 + variance)
    
    def add_incident(self, incident: TrafficIncident):
        """Add a traffic incident to the simulation."""
        self.state.active_incidents.append(incident)
        self._apply_incident_effects(incident)
    
    def remove_incident(self, incident_id: str):
        """Remove an incident from the simulation."""
        self.state.active_incidents = [
            i for i in self.state.active_incidents if i.id != incident_id
        ]
    
    def _apply_incident_effects(self, incident: TrafficIncident):
        """Apply effects of an incident to nearby vehicles."""
        # Slow down vehicles near the incident
        for vehicle in self.state.vehicles:
            distance = self._calculate_distance(
                vehicle.position, incident.location
            )
            if distance < 500:  # Within 500 meters
                slowdown_factor = 1 - (incident.severity * 0.15)
                vehicle.target_speed *= max(0.1, slowdown_factor)
    
    # ============================================================
    # CORE SIMULATION TICK
    # ============================================================
    
    async def tick(self):
        """
        Execute one simulation tick.
        Updates all vehicles, traffic lights, and computes metrics.
        """
        self.state.tick += 1
        self.state.timestamp = datetime.utcnow()
        dt = self.config.tick_interval_ms / 1000  # Delta time in seconds
        
        # Phase 1: Spawn new vehicles
        self._spawn_vehicles(dt)
        
        # Phase 2: Update traffic lights
        self._update_traffic_lights(dt)
        
        # Phase 3: Update vehicle positions
        for vehicle in self.state.vehicles:
            self._update_vehicle(vehicle, dt)
        
        # Phase 4: Handle collisions / interactions
        self._handle_vehicle_interactions()
        
        # Phase 5: Remove completed vehicles
        self._remove_completed_vehicles()
        
        # Phase 6: Update metrics
        self._update_metrics()
        
        # Notify listeners
        self._notify_listeners()
    
    # ============================================================
    # VEHICLE SPAWNING
    # ============================================================
    
    def _spawn_vehicles(self, dt: float):
        """Spawn new vehicles based on spawn rate."""
        if len(self.state.vehicles) >= self.config.max_vehicles:
            return
        
        # Probabilistic spawning
        if random.random() < self.config.spawn_rate * dt:
            vehicle = self._create_vehicle()
            self.state.vehicles.append(vehicle)
    
    def _create_vehicle(self) -> SimulatedVehicle:
        """Create a new vehicle with randomized properties."""
        # Select driver profile based on distribution
        profile = self._select_driver_profile()
        
        # Select vehicle type (weighted towards cars)
        vehicle_type = random.choices(
            [VehicleType.CAR, VehicleType.TRUCK, VehicleType.MOTORCYCLE, VehicleType.BUS],
            weights=[0.75, 0.10, 0.10, 0.05]
        )[0]
        
        # Get spawn position (edge of map or entry points)
        position = self._get_spawn_position()
        
        # Set target speed based on profile
        base_speed = 50  # km/h
        speed_modifiers = {
            DriverProfile.AGGRESSIVE: 1.2,
            DriverProfile.NORMAL: 1.0,
            DriverProfile.CAUTIOUS: 0.85,
            DriverProfile.LEARNER: 0.7,
        }
        target_speed = base_speed * speed_modifiers[profile]
        
        return SimulatedVehicle(
            id=str(uuid.uuid4())[:8],
            vehicle_type=vehicle_type,
            driver_profile=profile,
            position=position,
            heading=random.uniform(0, 360),
            current_speed=0,
            target_speed=target_speed,
        )
    
    def _select_driver_profile(self) -> DriverProfile:
        """Select driver profile based on configured distribution."""
        profiles = list(self.config.profile_distribution.keys())
        weights = list(self.config.profile_distribution.values())
        return random.choices(profiles, weights=weights)[0]
    
    def _get_spawn_position(self) -> Coordinates:
        """Get a valid spawn position for a new vehicle."""
        # If we have real traffic data, spawn on actual road segments
        if self._real_traffic_data and self._real_traffic_data.segments:
            segment = random.choice(self._real_traffic_data.segments)
            if segment.coordinates:
                return segment.coordinates[0]
        
        # Fallback: spawn at edge of default map area
        settings_lat = 40.7128
        settings_lng = -74.0060
        
        edge = random.choice(["north", "south", "east", "west"])
        offset = 0.01  # Roughly 1km
        
        if edge == "north":
            return Coordinates(lat=settings_lat + offset, lng=settings_lng + random.uniform(-offset, offset))
        elif edge == "south":
            return Coordinates(lat=settings_lat - offset, lng=settings_lng + random.uniform(-offset, offset))
        elif edge == "east":
            return Coordinates(lat=settings_lat + random.uniform(-offset, offset), lng=settings_lng + offset)
        else:
            return Coordinates(lat=settings_lat + random.uniform(-offset, offset), lng=settings_lng - offset)
    
    # ============================================================
    # VEHICLE UPDATES
    # ============================================================
    
    def _update_vehicle(self, vehicle: SimulatedVehicle, dt: float):
        """Update a single vehicle's position and state."""
        # Check if waiting at traffic light
        if vehicle.waiting_at_light:
            vehicle.wait_time_seconds += dt
            if self._can_proceed(vehicle):
                vehicle.waiting_at_light = False
            return
        
        # Accelerate/decelerate towards target speed
        speed_diff = vehicle.target_speed - vehicle.current_speed
        
        # Driver profile affects acceleration
        accel_modifiers = {
            DriverProfile.AGGRESSIVE: 1.3,
            DriverProfile.NORMAL: 1.0,
            DriverProfile.CAUTIOUS: 0.7,
            DriverProfile.LEARNER: 0.5,
        }
        accel_mod = accel_modifiers[vehicle.driver_profile]
        
        if speed_diff > 0:
            # Accelerating
            accel = self.config.base_acceleration * accel_mod
            vehicle.current_speed = min(
                vehicle.target_speed,
                vehicle.current_speed + accel * dt * 3.6  # Convert m/s² to km/h change
            )
        elif speed_diff < 0:
            # Decelerating
            decel = self.config.base_deceleration * accel_mod
            vehicle.current_speed = max(
                vehicle.target_speed,
                vehicle.current_speed - decel * dt * 3.6
            )
        
        # Check for traffic lights ahead
        if self._should_stop_at_light(vehicle):
            vehicle.waiting_at_light = True
            vehicle.current_speed = 0
            return
        
        # Move vehicle
        distance_km = (vehicle.current_speed * dt) / 3600  # km traveled
        
        # Convert heading to radians and compute new position
        heading_rad = math.radians(vehicle.heading)
        
        # Approximate conversion (1 degree lat ≈ 111km, 1 degree lng varies)
        lat_change = distance_km * math.cos(heading_rad) / 111
        lng_change = distance_km * math.sin(heading_rad) / (111 * math.cos(math.radians(vehicle.position.lat)))
        
        vehicle.position = Coordinates(
            lat=vehicle.position.lat + lat_change,
            lng=vehicle.position.lng + lng_change
        )
    
    def _can_proceed(self, vehicle: SimulatedVehicle) -> bool:
        """Check if vehicle can proceed through intersection."""
        for intersection in self.state.intersections:
            for light in intersection.traffic_lights:
                if vehicle.current_segment_id in light.controlled_segment_ids:
                    return light.current_phase == TrafficLightPhase.GREEN
        return True
    
    def _should_stop_at_light(self, vehicle: SimulatedVehicle) -> bool:
        """Check if vehicle should stop at upcoming light."""
        for intersection in self.state.intersections:
            distance = self._calculate_distance(vehicle.position, intersection.location)
            
            # Check lights within stopping distance
            stopping_distance = (vehicle.current_speed ** 2) / (2 * self.config.base_deceleration * 3.6)
            
            if distance < stopping_distance + 10:  # 10m buffer
                for light in intersection.traffic_lights:
                    if vehicle.current_segment_id in light.controlled_segment_ids:
                        if light.current_phase != TrafficLightPhase.GREEN:
                            return True
        return False
    
    # ============================================================
    # TRAFFIC LIGHT CONTROL
    # ============================================================
    
    def _update_traffic_lights(self, dt: float):
        """Update all traffic light states."""
        for intersection in self.state.intersections:
            for light in intersection.traffic_lights:
                light.time_in_current_phase += dt
                
                # Check for phase transition
                if light.current_phase == TrafficLightPhase.GREEN:
                    if light.time_in_current_phase >= light.green_duration:
                        light.current_phase = TrafficLightPhase.YELLOW
                        light.time_in_current_phase = 0
                
                elif light.current_phase == TrafficLightPhase.YELLOW:
                    if light.time_in_current_phase >= light.yellow_duration:
                        light.current_phase = TrafficLightPhase.RED
                        light.time_in_current_phase = 0
                
                elif light.current_phase == TrafficLightPhase.RED:
                    if light.time_in_current_phase >= light.red_duration:
                        light.current_phase = TrafficLightPhase.GREEN
                        light.time_in_current_phase = 0
    
    def adjust_traffic_light_timing(
        self,
        light_id: str,
        green_duration: Optional[int] = None,
        yellow_duration: Optional[int] = None,
        red_duration: Optional[int] = None
    ):
        """Adjust timing for a specific traffic light."""
        for intersection in self.state.intersections:
            for light in intersection.traffic_lights:
                if light.id == light_id:
                    if green_duration is not None:
                        light.green_duration = green_duration
                    if yellow_duration is not None:
                        light.yellow_duration = yellow_duration
                    if red_duration is not None:
                        light.red_duration = red_duration
                    return
    
    def add_intersection(self, intersection: Intersection):
        """Add an intersection to the simulation."""
        self.state.intersections.append(intersection)
    
    def add_traffic_light(self, intersection_id: str, light: TrafficLight):
        """Add a traffic light to an intersection."""
        for intersection in self.state.intersections:
            if intersection.id == intersection_id:
                intersection.traffic_lights.append(light)
                return
    
    # ============================================================
    # VEHICLE INTERACTIONS
    # ============================================================
    
    def _handle_vehicle_interactions(self):
        """Handle interactions between vehicles (following, collision avoidance)."""
        for i, vehicle in enumerate(self.state.vehicles):
            for other in self.state.vehicles[i+1:]:
                distance = self._calculate_distance(vehicle.position, other.position)
                
                # If too close, slow down the following vehicle
                if distance < self.config.min_following_distance:
                    # Determine which is behind (based on heading)
                    heading_diff = abs(vehicle.heading - other.heading)
                    if heading_diff < 45 or heading_diff > 315:
                        # Similar heading = following situation
                        follower = vehicle if self._is_behind(vehicle, other) else other
                        leader = other if follower == vehicle else vehicle
                        
                        # Match leader's speed or slow down
                        follower.target_speed = min(
                            follower.target_speed,
                            leader.current_speed * 0.9
                        )
    
    def _is_behind(self, a: SimulatedVehicle, b: SimulatedVehicle) -> bool:
        """Check if vehicle A is behind vehicle B."""
        # Simplified check based on position relative to heading
        heading_rad = math.radians(b.heading)
        dx = a.position.lng - b.position.lng
        dy = a.position.lat - b.position.lat
        
        # Project onto heading direction
        projection = dx * math.sin(heading_rad) + dy * math.cos(heading_rad)
        return projection < 0
    
    def _remove_completed_vehicles(self):
        """Remove vehicles that have left the simulation area."""
        # Define simulation bounds (based on real data or defaults)
        if self._real_traffic_data:
            bbox = self._real_traffic_data.bounding_box
            margin = 0.005  # Small margin outside bbox
            
            self.state.vehicles = [
                v for v in self.state.vehicles
                if (bbox.south - margin <= v.position.lat <= bbox.north + margin and
                    bbox.west - margin <= v.position.lng <= bbox.east + margin)
            ]
            
            # Count removed as completed
            removed = self.state.total_vehicles - len(self.state.vehicles)
            self.state.vehicles_completed += max(0, removed)
    
    # ============================================================
    # METRICS CALCULATION
    # ============================================================
    
    def _update_metrics(self):
        """Update aggregate simulation metrics."""
        self.state.total_vehicles = len(self.state.vehicles)
        
        if self.state.vehicles:
            self.state.average_speed = sum(
                v.current_speed for v in self.state.vehicles
            ) / len(self.state.vehicles)
            
            self.state.total_wait_time = sum(
                v.wait_time_seconds for v in self.state.vehicles
            )
        else:
            self.state.average_speed = 0
            self.state.total_wait_time = 0
        
        # Update intersection metrics
        for intersection in self.state.intersections:
            waiting_vehicles = [
                v for v in self.state.vehicles
                if v.waiting_at_light and 
                self._calculate_distance(v.position, intersection.location) < 50
            ]
            
            if waiting_vehicles:
                intersection.average_wait_time = sum(
                    v.wait_time_seconds for v in waiting_vehicles
                ) / len(waiting_vehicles)
    
    def calculate_emissions(self) -> EmissionsEstimate:
        """
        Calculate estimated emissions based on current traffic state.
        Uses simplified emission factors.
        """
        # Emission factors (simplified, per vehicle per hour at average speed)
        # These would ideally come from a proper emissions model
        
        total_vehicles = len(self.state.vehicles)
        if total_vehicles == 0:
            return EmissionsEstimate(
                co2_kg_per_hour=0,
                nox_grams_per_hour=0,
                fuel_liters_per_hour=0,
                avg_co2_per_vehicle=0,
                avg_fuel_per_vehicle=0,
            )
        
        # Average speed affects emissions (lower speed in congestion = higher emissions)
        avg_speed = self.state.average_speed or 30
        
        # Simplified model: emissions increase when speed deviates from optimal (~60 km/h)
        optimal_speed = 60
        speed_factor = 1 + abs(avg_speed - optimal_speed) / optimal_speed
        
        # Base emission rates per vehicle
        base_co2_kg = 0.12 * speed_factor  # kg per km
        base_fuel_l = 0.08 * speed_factor  # liters per km
        base_nox_g = 0.5 * speed_factor    # grams per km
        
        # Scale by number of vehicles and assumed distance traveled
        km_per_hour = avg_speed  # Assuming continuous movement
        
        co2_total = base_co2_kg * km_per_hour * total_vehicles
        fuel_total = base_fuel_l * km_per_hour * total_vehicles
        nox_total = base_nox_g * km_per_hour * total_vehicles
        
        return EmissionsEstimate(
            co2_kg_per_hour=co2_total,
            nox_grams_per_hour=nox_total,
            fuel_liters_per_hour=fuel_total,
            avg_co2_per_vehicle=co2_total / total_vehicles,
            avg_fuel_per_vehicle=fuel_total / total_vehicles,
        )
    
    # ============================================================
    # UTILITY METHODS
    # ============================================================
    
    @staticmethod
    def _calculate_distance(a: Coordinates, b: Coordinates) -> float:
        """Calculate approximate distance between two points in meters."""
        # Haversine formula simplified for short distances
        lat_diff = math.radians(b.lat - a.lat)
        lng_diff = math.radians(b.lng - a.lng)
        
        avg_lat = math.radians((a.lat + b.lat) / 2)
        
        x = lng_diff * math.cos(avg_lat)
        y = lat_diff
        
        # Earth radius in meters
        return math.sqrt(x*x + y*y) * 6371000


# Singleton engine instance
_simulation_engine: Optional[SimulationEngine] = None


def get_simulation_engine() -> SimulationEngine:
    """Get or create the simulation engine singleton."""
    global _simulation_engine
    if _simulation_engine is None:
        _simulation_engine = SimulationEngine()
    return _simulation_engine

