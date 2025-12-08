/**
 * Utility functions for traffic calculations.
 */

import type { Coordinates, RoadSegment, SimulatedVehicle } from '../types/traffic';

/**
 * Calculate the distance between two coordinates in meters using Haversine formula.
 */
export function calculateDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371000; // Earth's radius in meters
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return R * c;
}

/**
 * Convert degrees to radians.
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees.
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate bearing between two points in degrees (0-360).
 */
export function calculateBearing(from: Coordinates, to: Coordinates): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Calculate the total length of a road segment in meters.
 */
export function calculateSegmentLength(segment: RoadSegment): number {
  if (segment.length_meters) return segment.length_meters;
  
  let totalLength = 0;
  for (let i = 0; i < segment.coordinates.length - 1; i++) {
    totalLength += calculateDistance(
      segment.coordinates[i],
      segment.coordinates[i + 1]
    );
  }
  return totalLength;
}

/**
 * Calculate estimated time to traverse a segment in seconds.
 */
export function calculateTravelTime(
  segment: RoadSegment,
  speedKmh?: number
): number {
  const speed = speedKmh ?? segment.current_speed;
  if (speed <= 0) return Infinity;
  
  const lengthKm = calculateSegmentLength(segment) / 1000;
  return (lengthKm / speed) * 3600; // seconds
}

/**
 * Calculate congestion index (0-1) based on speed ratio.
 */
export function calculateCongestionIndex(segment: RoadSegment): number {
  return 1 - segment.speed_ratio;
}

/**
 * Estimate fuel consumption in liters per 100km based on speed.
 * Uses simplified model: optimal at ~80 km/h, worse at extremes.
 */
export function estimateFuelConsumption(speedKmh: number): number {
  const optimal = 80;
  const baseConsumption = 7; // L/100km at optimal speed
  const deviation = Math.abs(speedKmh - optimal) / optimal;
  return baseConsumption * (1 + deviation * 0.5);
}

/**
 * Estimate CO2 emissions in kg/km based on fuel consumption.
 * Average gasoline emits ~2.3 kg CO2 per liter.
 */
export function estimateCO2Emissions(fuelLPer100km: number): number {
  return (fuelLPer100km / 100) * 2.3;
}

/**
 * Find the nearest segment to a given point.
 */
export function findNearestSegment(
  point: Coordinates,
  segments: RoadSegment[]
): RoadSegment | null {
  let nearest: RoadSegment | null = null;
  let minDistance = Infinity;

  for (const segment of segments) {
    for (const coord of segment.coordinates) {
      const distance = calculateDistance(point, coord);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = segment;
      }
    }
  }

  return nearest;
}

/**
 * Check if a point is within a certain distance of a segment.
 */
export function isPointNearSegment(
  point: Coordinates,
  segment: RoadSegment,
  maxDistanceMeters: number
): boolean {
  for (const coord of segment.coordinates) {
    if (calculateDistance(point, coord) <= maxDistanceMeters) {
      return true;
    }
  }
  return false;
}

/**
 * Interpolate a position along a path based on distance traveled.
 */
export function interpolatePosition(
  path: Coordinates[],
  distanceMeters: number
): Coordinates {
  if (path.length === 0) throw new Error('Path cannot be empty');
  if (path.length === 1) return path[0];
  
  let accumulated = 0;
  
  for (let i = 0; i < path.length - 1; i++) {
    const segmentLength = calculateDistance(path[i], path[i + 1]);
    
    if (accumulated + segmentLength >= distanceMeters) {
      const remaining = distanceMeters - accumulated;
      const ratio = remaining / segmentLength;
      
      return {
        lat: path[i].lat + (path[i + 1].lat - path[i].lat) * ratio,
        lng: path[i].lng + (path[i + 1].lng - path[i].lng) * ratio,
      };
    }
    
    accumulated += segmentLength;
  }
  
  return path[path.length - 1];
}

/**
 * Calculate average speed across multiple vehicles.
 */
export function calculateAverageSpeed(vehicles: SimulatedVehicle[]): number {
  if (vehicles.length === 0) return 0;
  const totalSpeed = vehicles.reduce((sum, v) => sum + v.current_speed, 0);
  return totalSpeed / vehicles.length;
}

/**
 * Calculate vehicles per minute flow rate.
 */
export function calculateFlowRate(
  vehicleCount: number,
  timeWindowSeconds: number
): number {
  if (timeWindowSeconds <= 0) return 0;
  return (vehicleCount / timeWindowSeconds) * 60;
}

/**
 * Format a large number with K/M suffixes.
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

