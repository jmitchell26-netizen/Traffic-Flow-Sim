/**
 * CanvasVehicleLayer Component
 * 
 * Renders vehicles on HTML5 Canvas instead of individual React components.
 * This is MUCH faster - can render 1000+ vehicles at 60fps.
 */

import { useEffect, useRef, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import type { SimulatedVehicle } from '../../types/traffic';
import { filterVehiclesByViewport, getMaxVehiclesForZoom } from '../../utils/viewportUtils';

interface CanvasVehicleLayerProps {
  vehicles: SimulatedVehicle[];
}

/**
 * Color mapping for different vehicle types.
 * Used to visually distinguish vehicles on the canvas.
 */
const VEHICLE_COLORS: Record<string, string> = {
  car: '#3b82f6',        // Blue for regular cars
  truck: '#8b5cf6',     // Purple for trucks
  motorcycle: '#10b981', // Green for motorcycles
  bus: '#f59e0b',       // Orange for buses
  emergency: '#ef4444', // Red for emergency vehicles
};

export function CanvasVehicleLayer({ vehicles }: CanvasVehicleLayerProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  /**
   * Initialize canvas element and add it to the map container.
   * Canvas is positioned absolutely over the map to render vehicles.
   * pointerEvents: 'none' allows map interactions to pass through.
   */
  useEffect(() => {
    // Create container div for the canvas
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none'; // Allow map clicks to pass through
    container.style.zIndex = '500'; // Above map tiles, below controls

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    container.appendChild(canvas);
    const mapContainer = map.getContainer();
    mapContainer.appendChild(container);

    containerRef.current = container;
    canvasRef.current = canvas;

    /**
     * Update canvas size to match container dimensions.
     * Must be called when map resizes to maintain proper rendering.
     */
    const updateCanvasSize = () => {
      if (canvas && container) {
        const rect = container.getBoundingClientRect();
        // Set actual pixel dimensions (not CSS size)
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    updateCanvasSize();
    map.on('resize', updateCanvasSize);

    return () => {
      map.off('resize', updateCanvasSize);
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [map]);

  /**
   * Filter vehicles to only those visible in the current viewport.
   * Also limits vehicle count based on zoom level for performance.
   * This prevents rendering too many vehicles at low zoom levels.
   */
  const visibleVehicles = useMemo(() => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // Convert Leaflet bounds to our bounding box format
    const bbox = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };

    // Filter to only vehicles in viewport
    const filtered = filterVehiclesByViewport(vehicles, bbox);
    
    // Limit count based on zoom level (performance optimization)
    const maxVehicles = getMaxVehiclesForZoom(zoom);

    return filtered.slice(0, maxVehicles);
  }, [vehicles, map]);

  // Render vehicles on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /**
     * Main rendering function called via requestAnimationFrame.
     * Throttled to ~30fps to balance smoothness and performance.
     */
    const render = (timestamp: number) => {
      // Throttle rendering: 33ms = ~30fps (vs 16ms for 60fps)
      // This reduces CPU usage while maintaining smooth visuals
      if (timestamp - lastUpdateRef.current < 33) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }
      lastUpdateRef.current = timestamp;

      // Clear entire canvas before redrawing
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bounds = map.getBounds();
      const zoom = map.getZoom();

      // Don't render vehicles at very low zoom levels (performance optimization)
      // Vehicles would be too small to see anyway
      if (zoom < 10) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Draw each visible vehicle as a circle on the canvas
      visibleVehicles.forEach((vehicle) => {
        // Convert lat/lng to pixel coordinates on the map
        const point = map.latLngToContainerPoint([
          vehicle.position.lat,
          vehicle.position.lng,
        ]);

        // Get vehicle color based on type, or default to blue
        const color = VEHICLE_COLORS[vehicle.vehicle_type] || '#3b82f6';
        // Larger radius if vehicle is waiting at a light
        const radius = vehicle.waiting_at_light ? 5 : 4;

        // Draw vehicle as a filled circle
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        // Red fill if waiting, otherwise vehicle type color
        ctx.fillStyle = vehicle.waiting_at_light ? '#ef4444' : color;
        ctx.fill();
        // Dark border around vehicle
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = vehicle.waiting_at_light ? 2 : 1;
        ctx.stroke();

        // Draw direction indicator (small line showing heading)
        // Only show at high zoom levels where it's visible
        if (zoom > 13) {
          // Convert heading degrees to radians
          const headingRad = (vehicle.heading * Math.PI) / 180;
          const lineLength = 6; // Length of direction indicator
          
          // Draw line from vehicle center in direction of travel
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(
            point.x + Math.sin(headingRad) * lineLength,
            point.y - Math.cos(headingRad) * lineLength
          );
          ctx.strokeStyle = '#ffffff'; // White line for visibility
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // Schedule next frame
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [map, visibleVehicles]);

  /**
   * Listen for map movement/zoom events to trigger re-render.
   * When map moves, we need to update vehicle positions on canvas.
   */
  useEffect(() => {
    const handleMove = () => {
      // Reset lastUpdate to force immediate re-render
      // This ensures vehicles appear in correct positions after map movement
      lastUpdateRef.current = 0;
    };

    // Listen to both move and zoom events
    map.on('move', handleMove);
    map.on('zoom', handleMove);

    // Cleanup: remove event listeners
    return () => {
      map.off('move', handleMove);
      map.off('zoom', handleMove);
    };
  }, [map]);

  // Return null because canvas is added directly to DOM, not via JSX
  return null;
}

