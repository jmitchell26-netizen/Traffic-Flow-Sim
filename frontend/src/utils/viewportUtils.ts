/**
 * Viewport Utilities
 * 
 * Functions for filtering and culling elements based on map viewport.
 * This dramatically improves performance by only rendering visible elements.
 */

import type { Coordinates, BoundingBox, RoadSegment, SimulatedVehicle } from '../types/traffic';

/**
 * Check if a point is within bounding box
 */
export function isPointInBounds(point: Coordinates, bounds: BoundingBox): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

/**
 * Check if a segment intersects with bounding box
 */
export function segmentIntersectsBounds(segment: RoadSegment, bounds: BoundingBox): boolean {
  if (!segment.coordinates || segment.coordinates.length === 0) {
    return false;
  }

  // Quick check: if any coordinate is in bounds, segment is visible
  for (const coord of segment.coordinates) {
    if (isPointInBounds(coord, bounds)) {
      return true;
    }
  }

  // Check if segment crosses bounds (more expensive but more accurate)
  // For now, simple check is sufficient
  return false;
}

/**
 * Filter segments to only those visible in viewport
 */
export function filterSegmentsByViewport(
  segments: RoadSegment[],
  bounds: BoundingBox
): RoadSegment[] {
  return segments.filter((segment) => segmentIntersectsBounds(segment, bounds));
}

/**
 * Filter vehicles to only those visible in viewport
 */
export function filterVehiclesByViewport(
  vehicles: SimulatedVehicle[],
  bounds: BoundingBox
): SimulatedVehicle[] {
  return vehicles.filter((vehicle) => isPointInBounds(vehicle.position, bounds));
}

/**
 * Calculate bounding box with padding (for pre-loading nearby data)
 */
export function expandBounds(bounds: BoundingBox, paddingPercent: number = 0.1): BoundingBox {
  const latRange = bounds.north - bounds.south;
  const lngRange = bounds.east - bounds.west;

  return {
    north: bounds.north + latRange * paddingPercent,
    south: bounds.south - latRange * paddingPercent,
    east: bounds.east + lngRange * paddingPercent,
    west: bounds.west - lngRange * paddingPercent,
  };
}

/**
 * Get zoom-based detail level
 * Higher zoom = more detail
 * 
 * Updated thresholds to show more detail at lower zoom levels:
 * - Low: zoom < 8 (was 10) - shows major roads and heavy congestion
 * - Medium: zoom < 12 (was 13) - shows moderate+ congestion
 * - High: zoom >= 12 - shows all roads
 */
export function getDetailLevel(zoom: number): 'low' | 'medium' | 'high' {
  if (zoom < 8) return 'low';   // Lowered from 10 to show more at medium zoom
  if (zoom < 12) return 'medium'; // Lowered from 13
  return 'high';
}

/**
 * Filter segments based on zoom level (LOD)
 */
export function filterSegmentsByZoom(
  segments: RoadSegment[],
  zoom: number
): RoadSegment[] {
  const detailLevel = getDetailLevel(zoom);

  if (detailLevel === 'low') {
    // Only show major roads (high congestion or main routes)
    return segments.filter(
      (s) =>
        s.congestion_level === 'heavy' ||
        s.congestion_level === 'severe' ||
        (s.road_type && parseInt(s.road_type) <= 2) // Major road types
    );
  }

  if (detailLevel === 'medium') {
    // Show moderate+ congestion and major roads
    return segments.filter(
      (s) =>
        s.congestion_level !== 'free_flow' ||
        (s.road_type && parseInt(s.road_type) <= 3)
    );
  }

  // High detail: show everything
  return segments;
}

/**
 * Limit vehicle count based on zoom level
 */
export function getMaxVehiclesForZoom(zoom: number): number {
  if (zoom < 10) return 20; // Very few at low zoom
  if (zoom < 12) return 50; // Moderate at medium zoom
  if (zoom < 14) return 100; // More at high zoom
  return 200; // Many at very high zoom
}

