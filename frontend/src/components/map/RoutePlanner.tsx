/**
 * RoutePlanner Component
 * 
 * Allows users to click two points on the map to calculate and display a route.
 */

import { useState, useEffect } from 'react';
import { MapPin, Navigation, X, Route as RouteIcon } from 'lucide-react';
import { useMap } from 'react-leaflet';
import { Polyline, Marker, Popup } from 'react-leaflet';
import { useTrafficStore } from '../../stores/trafficStore';
import { trafficApi } from '../../services/api';
import type { Coordinates, Route } from '../../types/traffic';
import { CONGESTION_COLORS } from '../../types/traffic';

export function RoutePlanner() {
  const [isActive, setIsActive] = useState(false);
  const [startPoint, setStartPoint] = useState<Coordinates | null>(null);
  const [endPoint, setEndPoint] = useState<Coordinates | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const map = useMap();

  useEffect(() => {
    if (!isActive) return;

    const handleMapClick = (e: any) => {
      const { lat, lng } = e.latlng;
      const point: Coordinates = { lat, lng };

      if (!startPoint) {
        setStartPoint(point);
      } else if (!endPoint) {
        setEndPoint(point);
        calculateRoute(startPoint, point);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isActive, startPoint, endPoint, map]);

  const calculateRoute = async (start: Coordinates, end: Coordinates) => {
    setIsCalculating(true);
    try {
      const response = await trafficApi.calculateRoute(start, end, true);
      setRoutes(response.routes);
      setSelectedRouteIndex(0);
      
      // Zoom to fit route
      if (response.routes.length > 0 && response.routes[0].geometry.length > 0) {
        const bounds = response.routes[0].geometry.map(c => [c.lat, c.lng] as [number, number]);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (err) {
      console.error('Route calculation failed:', err);
      alert('Failed to calculate route. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  const clearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRoutes([]);
    setSelectedRouteIndex(0);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}h ${mins % 60}m`;
    }
    return `${mins}m`;
  };

  const selectedRoute = routes[selectedRouteIndex];

  return (
    <>
      {/* Toggle Button */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <button
          onClick={() => {
            setIsActive(!isActive);
            if (!isActive) {
              clearRoute();
            }
          }}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            isActive
              ? 'bg-dash-accent text-white'
              : 'bg-dash-card border border-dash-border text-dash-text hover:bg-dash-border'
          }`}
          title="Route Planner"
        >
          <RouteIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Route Planner</span>
        </button>
      </div>

      {/* Route Display */}
      {isActive && (
        <div className="absolute bottom-4 left-[180px] z-[1000] bg-dash-card border border-dash-border rounded-lg p-4 max-w-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-dash-text">Route Planner</h3>
            <button
              onClick={() => {
                setIsActive(false);
                clearRoute();
              }}
              className="text-dash-muted hover:text-dash-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!startPoint ? (
            <p className="text-sm text-dash-muted">Click on the map to set start point</p>
          ) : !endPoint ? (
            <p className="text-sm text-dash-muted">Click on the map to set end point</p>
          ) : isCalculating ? (
            <p className="text-sm text-dash-muted">Calculating route...</p>
          ) : routes.length > 0 ? (
            <div className="space-y-3">
              {/* Route Selector */}
              {routes.length > 1 && (
                <div className="flex gap-2">
                  {routes.map((route, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedRouteIndex(idx)}
                      className={`px-3 py-1 text-xs rounded ${
                        selectedRouteIndex === idx
                          ? 'bg-dash-accent text-white'
                          : 'bg-dash-bg text-dash-muted hover:bg-dash-border'
                      }`}
                    >
                      Route {idx + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Route Info */}
              {selectedRoute && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-dash-muted">Distance:</span>
                    <span className="text-dash-text font-medium">
                      {selectedRoute.distance.toFixed(1)} km
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-dash-muted">Time:</span>
                    <span className="text-dash-text font-medium">
                      {formatDuration(selectedRoute.time)}
                    </span>
                  </div>
                  {selectedRoute.delay > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-dash-muted">Delay:</span>
                      <span className="text-red-400 font-medium">
                        +{formatDuration(selectedRoute.delay)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={clearRoute}
                className="w-full px-3 py-2 text-sm bg-dash-bg border border-dash-border rounded hover:bg-dash-border transition-colors"
              >
                Clear Route
              </button>
            </div>
          ) : (
            <p className="text-sm text-dash-muted">No route found</p>
          )}
        </div>
      )}

      {/* Map Markers and Polylines */}
      {startPoint && (
        <Marker position={[startPoint.lat, startPoint.lng]}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold mb-1">Start Point</div>
              <div className="text-xs text-gray-500">
                {startPoint.lat.toFixed(4)}, {startPoint.lng.toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {endPoint && (
        <Marker position={[endPoint.lat, endPoint.lng]}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold mb-1">End Point</div>
              <div className="text-xs text-gray-500">
                {endPoint.lat.toFixed(4)}, {endPoint.lng.toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {selectedRoute && selectedRoute.geometry.length > 0 && (
        <Polyline
          positions={selectedRoute.geometry.map(c => [c.lat, c.lng] as [number, number])}
          color="#06b6d4"
          weight={4}
          opacity={0.8}
        />
      )}
    </>
  );
}

