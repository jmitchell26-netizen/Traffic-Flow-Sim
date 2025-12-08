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

const VEHICLE_COLORS: Record<string, string> = {
  car: '#3b82f6',
  truck: '#8b5cf6',
  motorcycle: '#10b981',
  bus: '#f59e0b',
  emergency: '#ef4444',
};

export function CanvasVehicleLayer({ vehicles }: CanvasVehicleLayerProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Create canvas element
  useEffect(() => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '500';

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    container.appendChild(canvas);
    const mapContainer = map.getContainer();
    mapContainer.appendChild(container);

    containerRef.current = container;
    canvasRef.current = canvas;

    // Set canvas size
    const updateCanvasSize = () => {
      if (canvas && container) {
        const rect = container.getBoundingClientRect();
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

  // Filter and limit vehicles based on viewport and zoom
  const visibleVehicles = useMemo(() => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    const bbox = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };

    const filtered = filterVehiclesByViewport(vehicles, bbox);
    const maxVehicles = getMaxVehiclesForZoom(zoom);

    return filtered.slice(0, maxVehicles);
  }, [vehicles, map]);

  // Render vehicles on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (timestamp: number) => {
      // Throttle to ~30fps for smoother performance
      if (timestamp - lastUpdateRef.current < 33) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }
      lastUpdateRef.current = timestamp;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bounds = map.getBounds();
      const zoom = map.getZoom();

      // Only render if zoomed in enough
      if (zoom < 10) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Draw each vehicle
      visibleVehicles.forEach((vehicle) => {
        const point = map.latLngToContainerPoint([
          vehicle.position.lat,
          vehicle.position.lng,
        ]);

        const color = VEHICLE_COLORS[vehicle.vehicle_type] || '#3b82f6';
        const radius = vehicle.waiting_at_light ? 5 : 4;

        // Draw vehicle circle
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = vehicle.waiting_at_light ? '#ef4444' : color;
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = vehicle.waiting_at_light ? 2 : 1;
        ctx.stroke();

        // Draw direction indicator (small line)
        if (zoom > 13) {
          const headingRad = (vehicle.heading * Math.PI) / 180;
          const lineLength = 6;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(
            point.x + Math.sin(headingRad) * lineLength,
            point.y - Math.cos(headingRad) * lineLength
          );
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [map, visibleVehicles]);

  // Re-render when map moves
  useEffect(() => {
    const handleMove = () => {
      // Trigger re-render by updating lastUpdate
      lastUpdateRef.current = 0;
    };

    map.on('move', handleMove);
    map.on('zoom', handleMove);

    return () => {
      map.off('move', handleMove);
      map.off('zoom', handleMove);
    };
  }, [map]);

  return null; // Canvas is added directly to DOM
}

