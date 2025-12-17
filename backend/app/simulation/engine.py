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
import logging
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

# Set up logger for simulation engine
logger = logging.getLogger(__name__)


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
        # Validate configuration before starting
        if not hasattr(self.config, 'tick_interval_ms') or self.config.tick_interval_ms <= 0:
            raise ValueError("Invalid tick_interval_ms configuration")
        
        self._running = True
        logger.info("Simulation engine started")
        
        try:
            while self._running:
                try:
                    await self.tick()  # Execute one simulation step
                except asyncio.CancelledError:
                    # Task was cancelled, exit gracefully
                    logger.info("Simulation cancelled")
                    break
                except Exception as e:
                    # Log error but continue simulation to prevent crashes
                    logger.error(f"Error in simulation tick: {e}", exc_info=True)
                    # Continue running - don't crash the entire simulation
                finally:
                    # Wait for configured tick interval before next tick
                    if self._running:  # Only sleep if still running
                        try:
                            tick_interval = max(0.01, self.config.tick_interval_ms / 1000)  # Minimum 10ms
                            await asyncio.sleep(tick_interval)
                        except asyncio.CancelledError:
                            break
                        except Exception as e:
                            logger.error(f"Error in sleep: {e}", exc_info=True)
                            # Fallback to 100ms if sleep fails
                            await asyncio.sleep(0.1)
        finally:
            self._running = False
            logger.info("Simulation engine stopped")
    
    def stop(self):
        """
        Stop the simulation loop.
        
        Sets running flag to False, which will cause the start() loop
        to exit on the next iteration. Simulation state is preserved.
        """
        self._running = False
        # Cancel the background task if it exists
        if hasattr(self, '_task') and self._task and not self._task.done():
            try:
                self._task.cancel()
            except Exception as e:
                logger.warning(f"Error canceling simulation task: {e}")
        self._task = None
    
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
    
    def _get_incident_effect(self, vehicle: SimulatedVehicle) -> float | None:
        """
        Get the speed limit effect from nearby incidents.
        Returns the maximum speed allowed, or None if no effect.
        """
        min_speed = None
        
        for incident in self.state.active_incidents:
            distance = self._calculate_distance(vehicle.position, incident.location)
            
            # Different impact radius based on incident type
            impact_radii = {
                'accident': 0.002,      # ~200m
                'construction': 0.003,  # ~300m
                'closure': 0.005,       # ~500m
                'slowdown': 0.001,      # ~100m
                'event': 0.002,        # ~200m
            }
            radius = impact_radii.get(incident.type, 0.002)
            
            if distance < radius:
                # Gradual effect: stronger closer to incident
                distance_factor = 1.0 - (distance / radius)
                
                # Different speed reductions by type
                speed_reductions = {
                    'accident': 0.3,      # 70% reduction
                    'construction': 0.5,  # 50% reduction
                    'closure': 0.0,        # Complete stop
                    'slowdown': 0.7,      # 30% reduction
                    'event': 0.4,         # 60% reduction
                }
                reduction = speed_reductions.get(incident.type, 0.5)
                
                # Apply gradual effect
                affected_speed = vehicle.target_speed * (1.0 - reduction * distance_factor)
                
                if min_speed is None or affected_speed < min_speed:
                    min_speed = affected_speed
        
        return min_speed
    
    def _apply_incident_effects(self, incident: TrafficIncident):
        """Apply effects of an incident to nearby vehicles (legacy method, now handled in _update_vehicle)."""
        # Effects are now applied dynamically in _update_vehicle via _get_incident_effect
        pass
    
    # ============================================================
    # CORE SIMULATION TICK
    # ============================================================
    
    async def tick(self):
        """
        Execute one simulation tick.
        Updates all vehicles, traffic lights, and computes metrics.
        """
        try:
            self.state.tick += 1
            self.state.timestamp = datetime.utcnow()
            dt = self.config.tick_interval_ms / 1000  # Delta time in seconds
            
            # Validate dt to prevent division by zero or negative values
            if dt <= 0:
                logger.warning(f"Invalid tick interval: {dt}, using default 0.1s")
                dt = 0.1
            
            # Phase 1: Spawn new vehicles
            try:
                self._spawn_vehicles(dt)
            except Exception as e:
                logger.error(f"Error spawning vehicles: {e}", exc_info=True)
            
            # Phase 2: Update traffic lights
            try:
                self._update_traffic_lights(dt)
            except Exception as e:
                logger.error(f"Error updating traffic lights: {e}", exc_info=True)
            
            # Phase 3: Update vehicle positions
            # Use list copy to avoid modification during iteration
            vehicles_to_update = list(self.state.vehicles)
            for vehicle in vehicles_to_update:
                try:
                    self._update_vehicle(vehicle, dt)
                except Exception as e:
                    logger.error(f"Error updating vehicle {vehicle.id}: {e}", exc_info=True)
                    # Remove problematic vehicle to prevent further errors
                    if vehicle in self.state.vehicles:
                        self.state.vehicles.remove(vehicle)
            
            # Phase 4: Handle collisions / interactions
            try:
                self._handle_vehicle_interactions()
            except Exception as e:
                logger.error(f"Error handling vehicle interactions: {e}", exc_info=True)
            
            # Phase 5: Remove completed vehicles
            try:
                self._remove_completed_vehicles()
            except Exception as e:
                logger.error(f"Error removing completed vehicles: {e}", exc_info=True)
            
            # Phase 6: Update metrics
            try:
                self._update_metrics()
            except Exception as e:
                logger.error(f"Error updating metrics: {e}", exc_info=True)
            
            # Notify listeners
            try:
                self._notify_listeners()
            except Exception as e:
                logger.error(f"Error notifying listeners: {e}", exc_info=True)
        except Exception as e:
            logger.error(f"Critical error in simulation tick: {e}", exc_info=True)
            raise  # Re-raise to be caught by start() loop
    
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
        try:
            if self._real_traffic_data and self._real_traffic_data.segments:
                valid_segments = [s for s in self._real_traffic_data.segments if s.coordinates]
                if valid_segments:
                    segment = random.choice(valid_segments)
                    if segment.coordinates and len(segment.coordinates) > 0:
                        return segment.coordinates[0]
        except Exception as e:
            logger.warning(f"Error getting spawn position from traffic data: {e}")
        
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
        
        # Check for incidents affecting this vehicle
        incident_effect = self._get_incident_effect(vehicle)
        if incident_effect:
            # Apply incident-based speed reduction
            vehicle.target_speed = min(vehicle.target_speed, incident_effect)
        
        # Check for vehicles ahead (better following distance)
        vehicle_ahead = self._find_vehicle_ahead(vehicle)
        if vehicle_ahead:
            # Calculate safe following distance (time-based: 2 seconds)
            safe_distance = vehicle.current_speed / 3.6 * 2.0  # Convert km/h to m/s, then 2 seconds
            actual_distance = self._calculate_distance(vehicle.position, vehicle_ahead.position) * 111000  # Convert to meters
            
            if actual_distance < safe_distance:
                # Too close - slow down to match or be slower than vehicle ahead
                vehicle.target_speed = min(
                    vehicle.target_speed,
                    vehicle_ahead.current_speed * 0.9
                )
        
        # Accelerate/decelerate towards target speed with realistic curves
        speed_diff = vehicle.target_speed - vehicle.current_speed
        
        # Driver profile affects acceleration
        accel_modifiers = {
            DriverProfile.AGGRESSIVE: 1.3,
            DriverProfile.NORMAL: 1.0,
            DriverProfile.CAUTIOUS: 0.7,
            DriverProfile.LEARNER: 0.5,
        }
        accel_mod = accel_modifiers.get(vehicle.driver_profile, 1.0)
        
        # More realistic acceleration curve (faster at low speeds, slower at high speeds)
        speed_factor = max(0.1, 1.0 - (vehicle.current_speed / 120.0) * 0.3)  # Reduce acceleration at high speeds
        
        # Get acceleration/deceleration values with defaults
        base_accel = getattr(self.config, 'base_acceleration', 2.0)
        base_decel = getattr(self.config, 'base_deceleration', 4.0)
        
        if speed_diff > 0:
            # Accelerating
            accel = base_accel * accel_mod * speed_factor
            vehicle.current_speed = min(
                vehicle.target_speed,
                vehicle.current_speed + accel * dt * 3.6  # Convert m/s² to km/h change
            )
        elif speed_diff < 0:
            # Decelerating
            decel = base_decel * accel_mod
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
        
        # Validate distance to prevent invalid positions
        if distance_km <= 0 or not vehicle.position:
            return
        
        # Convert heading to radians and compute new position
        heading_rad = math.radians(vehicle.heading)
        
        # Approximate conversion (1 degree lat ≈ 111km, 1 degree lng varies)
        # Protect against division by zero in cos calculation
        lat_rad = math.radians(vehicle.position.lat)
        cos_lat = math.cos(lat_rad)
        if abs(cos_lat) < 0.0001:  # Near poles, use safe value
            cos_lat = 0.0001 if cos_lat >= 0 else -0.0001
        
        lat_change = distance_km * math.cos(heading_rad) / 111
        lng_change = distance_km * math.sin(heading_rad) / (111 * cos_lat)
        
        # Validate new position coordinates
        new_lat = vehicle.position.lat + lat_change
        new_lng = vehicle.position.lng + lng_change
        
        # Clamp to valid coordinate ranges
        new_lat = max(-90, min(90, new_lat))
        new_lng = max(-180, min(180, new_lng))
        
        vehicle.position = Coordinates(
            lat=new_lat,
            lng=new_lng
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
        try:
            base_decel = getattr(self.config, 'base_deceleration', 4.0)
            if base_decel <= 0:
                base_decel = 4.0  # Safety fallback
            
            for intersection in self.state.intersections:
                distance = self._calculate_distance(vehicle.position, intersection.location)
                
                # Check lights within stopping distance
                # Avoid division by zero
                if vehicle.current_speed <= 0:
                    stopping_distance = 0
                else:
                    stopping_distance = (vehicle.current_speed ** 2) / (2 * base_decel * 3.6)
                
                if distance < stopping_distance + 10:  # 10m buffer
                    for light in intersection.traffic_lights:
                        if vehicle.current_segment_id in light.controlled_segment_ids:
                            if light.current_phase != TrafficLightPhase.GREEN:
                                return True
        except Exception as e:
            logger.warning(f"Error checking traffic light stop: {e}")
        
        return False
    
    # ============================================================
    # TRAFFIC LIGHT CONTROL
    # ============================================================
    
    def _update_traffic_lights(self, dt: float):
        """Update traffic light phases based on timing with smart adjustments."""
        for intersection in self.state.intersections:
            # Count waiting vehicles at this intersection
            waiting_count = sum(
                1 for v in self.state.vehicles
                if v.waiting_at_light and
                self._calculate_distance(v.position, intersection.location) < 50
            )
            
            # Smart timing: extend green if many vehicles waiting
            for light in intersection.traffic_lights:
                light.time_in_current_phase += dt
                
                # Determine base phase duration
                base_phase_duration = {
                    TrafficLightPhase.RED: light.red_duration,
                    TrafficLightPhase.YELLOW: light.yellow_duration,
                    TrafficLightPhase.GREEN: light.green_duration,
                }[light.current_phase]
                
                # Extend green phase if many vehicles waiting (up to 50% longer)
                phase_duration = base_phase_duration
                if light.current_phase == TrafficLightPhase.GREEN and waiting_count > 5:
                    phase_duration = base_phase_duration * (1.0 + min(0.5, waiting_count * 0.05))
                
                # Transition to next phase if duration exceeded
                if light.time_in_current_phase >= phase_duration:
                    if light.current_phase == TrafficLightPhase.RED:
                        light.current_phase = TrafficLightPhase.GREEN
                        light.time_in_current_phase = 0
                    elif light.current_phase == TrafficLightPhase.YELLOW:
                        light.current_phase = TrafficLightPhase.RED
                        light.time_in_current_phase = 0
                    elif light.current_phase == TrafficLightPhase.GREEN:
                        light.current_phase = TrafficLightPhase.YELLOW
                        light.time_in_current_phase = 0
    
    def adjust_traffic_light_timing(
        self,
        light_id: str,
        green_duration: Optional[int] = None,
        yellow_duration: Optional[int] = None,
        red_duration: Optional[int] = None
    ) -> bool:
        """
        Adjust timing for a specific traffic light.
        
        Returns:
            True if the light was found and updated, False otherwise
        """
        for intersection in self.state.intersections:
            for light in intersection.traffic_lights:
                if light.id == light_id:
                    if green_duration is not None:
                        light.green_duration = green_duration
                    if yellow_duration is not None:
                        light.yellow_duration = yellow_duration
                    if red_duration is not None:
                        light.red_duration = red_duration
                    return True
        
        return False
    
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
    
    def _find_vehicle_ahead(self, vehicle: SimulatedVehicle) -> SimulatedVehicle | None:
        """Find the vehicle directly ahead of this vehicle."""
        closest_ahead = None
        min_distance = float('inf')
        
        heading_rad = math.radians(vehicle.heading)
        
        for other in self.state.vehicles:
            if other.id == vehicle.id:
                continue
            
            # Calculate distance
            distance = self._calculate_distance(vehicle.position, other.position)
            
            # Check if vehicle is ahead (within 45 degrees of heading)
            dx = other.position.lng - vehicle.position.lng
            dy = other.position.lat - vehicle.position.lat
            
            # Project onto heading direction
            projection = dx * math.sin(heading_rad) + dy * math.cos(heading_rad)
            
            # Check if ahead and within reasonable distance (200m)
            if projection > 0 and distance < 0.002:  # ~200m
                # Check if within 45 degrees of heading
                angle_to_other = math.degrees(math.atan2(dy, dx))
                heading_diff = abs(angle_to_other - vehicle.heading)
                if heading_diff < 45 or heading_diff > 315:
                    if distance < min_distance:
                        min_distance = distance
                        closest_ahead = other
        
        return closest_ahead
    
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
        try:
            # Define simulation bounds (based on real data or defaults)
            if self._real_traffic_data and hasattr(self._real_traffic_data, 'bounding_box'):
                bbox = self._real_traffic_data.bounding_box
                margin = 0.005  # Small margin outside bbox
                
                # Filter vehicles safely
                valid_vehicles = []
                for v in self.state.vehicles:
                    try:
                        # Validate vehicle position
                        if (hasattr(v, 'position') and v.position and
                            bbox.south - margin <= v.position.lat <= bbox.north + margin and
                            bbox.west - margin <= v.position.lng <= bbox.east + margin):
                            valid_vehicles.append(v)
                    except Exception as e:
                        logger.warning(f"Error validating vehicle {getattr(v, 'id', 'unknown')}: {e}")
                        continue
                
                # Count removed as completed
                removed = len(self.state.vehicles) - len(valid_vehicles)
                self.state.vehicles = valid_vehicles
                self.state.vehicles_completed += max(0, removed)
        except Exception as e:
            logger.error(f"Error removing completed vehicles: {e}", exc_info=True)
    
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

