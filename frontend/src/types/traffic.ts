/**
 * Traffic Flow Simulation - TypeScript Type Definitions
 * 
 * These types mirror the backend Pydantic models for type-safe
 * communication between frontend and backend.
 */

// ============================================================
// CORE TYPES
// ============================================================

export type CongestionLevel = 
  | 'free_flow' 
  | 'light' 
  | 'moderate' 
  | 'heavy' 
  | 'severe';

export type DriverProfile = 
  | 'aggressive' 
  | 'normal' 
  | 'cautious' 
  | 'learner';

export type VehicleType = 
  | 'car' 
  | 'truck' 
  | 'motorcycle' 
  | 'bus' 
  | 'emergency';

export type TrafficLightPhase = 
  | 'green' 
  | 'yellow' 
  | 'red';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface LocationResult {
  name: string;
  coordinates: Coordinates;
  bounds: BoundingBox;
  type: string;
  address: string;
}

export interface Route {
  distance: number;  // km
  time: number;  // seconds
  delay: number;  // seconds
  geometry: Coordinates[];
  instructions?: Array<{
    instruction: string;
    distance: number;
    road: string;
  }>;
}

// ============================================================
// TRAFFIC DATA TYPES
// ============================================================

export interface RoadSegment {
  id: string;
  name?: string;
  coordinates: Coordinates[];
  current_speed: number;
  free_flow_speed: number;
  current_travel_time: number;
  free_flow_travel_time: number;
  congestion_level: CongestionLevel;
  delay_seconds: number;
  speed_ratio: number;
  road_type?: string;
  length_meters?: number;
}

export interface TrafficFlowData {
  segments: RoadSegment[];
  bounding_box: BoundingBox;
  timestamp: string;
  source: string;
  average_speed_ratio: number;
  total_segments: number;
  congested_segments: number;
}

export interface TrafficIncident {
  id: string;
  type: string;
  location: Coordinates;
  description?: string;
  severity: number;
  start_time: string;
  end_time?: string;
  affected_segments: string[];
}

// ============================================================
// SIMULATION TYPES
// ============================================================

export interface SimulatedVehicle {
  id: string;
  vehicle_type: VehicleType;
  driver_profile: DriverProfile;
  position: Coordinates;
  heading: number;
  current_speed: number;
  target_speed: number;
  current_segment_id?: string;
  route_segment_ids: string[];
  destination?: Coordinates;
  waiting_at_light: boolean;
  wait_time_seconds: number;
}

export interface TrafficLight {
  id: string;
  location: Coordinates;
  current_phase: TrafficLightPhase;
  green_duration: number;
  yellow_duration: number;
  red_duration: number;
  time_in_current_phase: number;
  controlled_segment_ids: string[];
}

export interface Intersection {
  id: string;
  location: Coordinates;
  name?: string;
  traffic_lights: TrafficLight[];
  connected_segment_ids: string[];
  average_wait_time: number;
  vehicles_per_minute: number;
}

export interface SimulationState {
  tick: number;
  timestamp: string;
  vehicles: SimulatedVehicle[];
  traffic_lights: TrafficLight[];
  intersections: Intersection[];
  active_incidents: TrafficIncident[];
  total_vehicles: number;
  average_speed: number;
  total_wait_time: number;
  vehicles_completed: number;
}

export interface SimulationConfig {
  tick_interval_ms: number;
  max_vehicles: number;
  spawn_rate: number;
  base_acceleration: number;
  base_deceleration: number;
  min_following_distance: number;
  speed_variance: number;
  profile_distribution: Record<DriverProfile, number>;
}

// ============================================================
// ANALYTICS / DASHBOARD TYPES
// ============================================================

export interface EmissionsEstimate {
  co2_kg_per_hour: number;
  nox_grams_per_hour: number;
  fuel_liters_per_hour: number;
  avg_co2_per_vehicle: number;
  avg_fuel_per_vehicle: number;
}

export interface TrafficMetrics {
  timestamp: string;
  average_speed: number;
  vehicles_per_minute: number;
  congestion_index: number;
  average_wait_time: number;
  average_travel_time_delta: number;
  total_active_vehicles: number;
  vehicles_waiting: number;
  active_incidents: number;
  emissions: EmissionsEstimate;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface DashboardData {
  current_metrics: TrafficMetrics;
  speed_history: TimeSeriesDataPoint[];
  flow_history: TimeSeriesDataPoint[];
  congestion_history: TimeSeriesDataPoint[];
  rush_hour_avg_speed?: number;
  off_peak_avg_speed?: number;
}

// ============================================================
// API REQUEST/RESPONSE TYPES
// ============================================================

export interface CongestionSummary {
  bounding_box: BoundingBox;
  total_segments: number;
  congested_segments: number;
  average_speed_ratio: number;
  level_distribution: Record<CongestionLevel, number>;
  timestamp: string;
}

export interface IntersectionMetrics {
  intersection: Intersection;
  nearby_vehicles: number;
  waiting_vehicles: number;
  average_wait_time: number;
}

// ============================================================
// UI / COMPONENT TYPES
// ============================================================

export interface MapViewState {
  center: Coordinates;
  zoom: number;
  bounds?: BoundingBox;
}

export interface SelectedFeature {
  type: 'segment' | 'vehicle' | 'intersection' | 'incident';
  id: string;
  data: RoadSegment | SimulatedVehicle | Intersection | TrafficIncident;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export const CONGESTION_COLORS: Record<CongestionLevel, string> = {
  free_flow: '#22c55e',
  light: '#84cc16',
  moderate: '#eab308',
  heavy: '#f97316',
  severe: '#dc2626',
};

export const TRAFFIC_LIGHT_COLORS: Record<TrafficLightPhase, string> = {
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
};

export function getCongestionLabel(level: CongestionLevel): string {
  const labels: Record<CongestionLevel, string> = {
    free_flow: 'Free Flow',
    light: 'Light Traffic',
    moderate: 'Moderate',
    heavy: 'Heavy',
    severe: 'Severe Congestion',
  };
  return labels[level];
}

export function formatSpeed(speed: number): string {
  return `${Math.round(speed)} km/h`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

