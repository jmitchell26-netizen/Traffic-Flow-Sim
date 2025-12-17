/**
 * TrafficMap Component
 * 
 * Main map view using Leaflet with:
 * - Real-time traffic flow overlay
 * - Simulated vehicle markers
 * - Traffic light indicators
 * - Incident markers
 * - Interactive segment selection
 */

import { useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Layers, ZoomIn, ZoomOut, Locate, Loader2, RefreshCw } from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import { useMapBoundsTracker } from '../../hooks/useTrafficData';
import { trafficApi } from '../../services/api';
import {
  CONGESTION_COLORS,
  TRAFFIC_LIGHT_COLORS,
  type RoadSegment,
  type SimulatedVehicle,
  type TrafficLight,
  type TrafficIncident,
} from '../../types/traffic';
import { SegmentPopup } from './SegmentPopup';
import { CanvasVehicleLayer } from './CanvasVehicleLayer';
import { LocationSearch } from './LocationSearch';
import { RoutePlanner } from './RoutePlanner';
import {
  filterSegmentsByViewport,
  filterSegmentsByZoom,
} from '../../utils/viewportUtils';

// ============================================================
// MAP CONTROLLER (handles view updates)
// ============================================================

/**
 * MapController Component
 * 
 * Manages synchronization between Leaflet map instance and Zustand store.
 * Handles:
 * - Initial map view setup
 * - Debounced updates when map moves/zooms
 * - Bounds tracking for viewport culling
 */
function MapController() {
  const map = useMap();
  const mapView = useTrafficStore((s) => s.mapView);
  const setMapView = useTrafficStore((s) => s.setMapView);
  const isInitializedRef = useRef(false);

  /**
   * Initialize map view on first render.
   * Sets the initial center and zoom from store state.
   */
  useEffect(() => {
    if (!isInitializedRef.current) {
      map.setView([mapView.center.lat, mapView.center.lng], mapView.zoom);
      isInitializedRef.current = true;
    }
  }, [mapView.center.lat, mapView.center.lng, mapView.zoom, map]);

  /**
   * Update store when map moves or zooms (debounced).
   * Debouncing prevents excessive store updates during rapid panning.
   * Updates center, zoom, and bounds for viewport culling.
   */
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleMoveEnd = () => {
      // Clear any pending update
      clearTimeout(timeoutId);
      
      // Debounce: wait 500ms after movement stops before updating store
      // Longer delay reduces store updates and API calls during rapid panning
      timeoutId = setTimeout(() => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bounds = map.getBounds();
        
        // Update store with current map state
        // Store actual bounds for accurate viewport calculations
        setMapView({
          center: { lat: center.lat, lng: center.lng },
          zoom,
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          },
        });
      }, 500); // 500ms debounce delay - smoother updates
    };

    // Listen for map movement and zoom events
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    // Cleanup: remove listeners and clear timeout
    return () => {
      clearTimeout(timeoutId);
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
    };
  }, [map, setMapView]);

  return null; // This component doesn't render anything
}

// ============================================================
// SEGMENT LAYER
// ============================================================

interface SegmentLayerProps {
  segments: RoadSegment[];
  onSelect: (segment: RoadSegment) => void;
}

/**
 * SegmentLayer Component (Memoized)
 * 
 * Renders road segments as polylines on the map.
 * Optimizations:
 * - Viewport culling: Only renders segments visible in current viewport
 * - Level of Detail (LOD): Shows fewer segments at low zoom levels
 * - Memoized: Prevents re-renders when props haven't changed
 */
const SegmentLayer = memo(function SegmentLayer({ segments, onSelect }: SegmentLayerProps) {
  const map = useMap();

  /**
   * Filter and optimize segments based on viewport and zoom level.
   * This is the main performance optimization - dramatically reduces
   * the number of segments rendered.
   */
  const visibleSegments = useMemo(() => {
    // Get current map bounds and zoom level
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // Convert Leaflet bounds to our bounding box format
    const bbox = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };

    // Step 1: Filter out segments with invalid coordinates
    // Prevents rendering errors and improves performance
    const validSegments = segments.filter(
      (segment) =>
        segment.coordinates &&
        segment.coordinates.length >= 2 && // Need at least 2 points for a line
        segment.coordinates.every(
          (c) =>
            typeof c.lat === 'number' &&
            typeof c.lng === 'number' &&
            !isNaN(c.lat) &&
            !isNaN(c.lng) &&
            c.lat >= -90 && c.lat <= 90 && // Valid latitude range
            c.lng >= -180 && c.lng <= 180   // Valid longitude range
        )
    );

    // Step 2: Apply viewport culling
    // Only include segments that intersect with the visible map area
    const viewportFiltered = filterSegmentsByViewport(validSegments, bbox);

    // Step 3: Apply zoom-based Level of Detail (LOD)
    // At low zoom: show only major roads
    // At high zoom: show all roads
    return filterSegmentsByZoom(viewportFiltered, zoom);
  }, [segments, map]);

  // Memoize coordinate transformations
  const segmentPolylines = useMemo(() => {
    return visibleSegments.map((segment) => ({
      id: segment.id,
      positions: segment.coordinates.map((c) => [c.lat, c.lng] as [number, number]),
      color: CONGESTION_COLORS[segment.congestion_level],
      segment,
    }));
  }, [visibleSegments]);

  if (segmentPolylines.length === 0) {
    return null;
  }

  return (
    <>
      {segmentPolylines.map(({ id, positions, color, segment }) => (
        <Polyline
          key={id}
          positions={positions}
          pathOptions={{
            color,
            weight: 5,
            opacity: 0.8,
          }}
          eventHandlers={{
            click: () => onSelect(segment),
          }}
        >
          <Popup>
            <SegmentPopup segment={segment} />
          </Popup>
        </Polyline>
      ))}
    </>
  );
});

// ============================================================
// VEHICLE LAYER (Now using Canvas for performance)
// ============================================================

interface VehicleLayerProps {
  vehicles: SimulatedVehicle[];
}

// Memoized vehicle layer - now uses Canvas instead of React components
const VehicleLayer = memo(function VehicleLayer({ vehicles }: VehicleLayerProps) {
  return <CanvasVehicleLayer vehicles={vehicles} />;
});

// ============================================================
// TRAFFIC LIGHT LAYER (Memoized)
// ============================================================

interface TrafficLightLayerProps {
  lights: TrafficLight[];
}

const TrafficLightLayer = memo(function TrafficLightLayer({ lights }: TrafficLightLayerProps) {
  return (
    <>
      {lights.map((light) => (
        <CircleMarker
          key={light.id}
          center={[light.location.lat, light.location.lng]}
          radius={8}
          pathOptions={{
            color: '#1e293b',
            fillColor: TRAFFIC_LIGHT_COLORS[light.current_phase],
            fillOpacity: 1,
            weight: 2,
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold mb-1">Traffic Light</p>
              <p>Phase: {light.current_phase}</p>
              <p>Time in phase: {Math.round(light.time_in_current_phase)}s</p>
              <p className="text-xs text-gray-500 mt-1">
                G: {light.green_duration}s / Y: {light.yellow_duration}s / R: {light.red_duration}s
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
});

// ============================================================
// INCIDENT LAYER (Memoized)
// ============================================================

interface IncidentLayerProps {
  incidents: TrafficIncident[];
}

const IncidentLayer = memo(function IncidentLayer({ incidents }: IncidentLayerProps) {
  const severityColors = {
    1: '#f59e0b',
    2: '#f97316',
    3: '#ef4444',
    4: '#dc2626',
    5: '#991b1b',
  };

  return (
    <>
      {incidents.map((incident) => (
        <CircleMarker
          key={incident.id}
          center={[incident.location.lat, incident.location.lng]}
          radius={12}
          pathOptions={{
            color: '#1e293b',
            fillColor: severityColors[incident.severity as keyof typeof severityColors] || '#ef4444',
            fillOpacity: 0.9,
            weight: 2,
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold mb-1 capitalize">{incident.type}</p>
              {incident.description && <p className="text-gray-600">{incident.description}</p>}
              <p className="text-xs text-gray-500 mt-1">
                Severity: {incident.severity}/5
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
});

// ============================================================
// MAP CONTROLS
// ============================================================

function MapControls() {
  const mapView = useTrafficStore((s) => s.mapView);
  const setMapView = useTrafficStore((s) => s.setMapView);
  const getBoundingBox = useTrafficStore((s) => s.getBoundingBox);
  const setTrafficData = useTrafficStore((s) => s.setTrafficData);
  const setIsLoading = useTrafficStore((s) => s.setIsLoading);
  const isLoading = useTrafficStore((s) => s.isLoading);

  const handleZoomIn = () => setMapView({ zoom: mapView.zoom + 1 });
  const handleZoomOut = () => setMapView({ zoom: Math.max(1, mapView.zoom - 1) });
  const handleRecenter = () => {
    // Reset to world view - allows user to navigate anywhere
    setMapView({
      center: { lat: 20.0, lng: 0.0 },
      zoom: 3,
    });
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const bbox = getBoundingBox();
      const data = await trafficApi.getFlow(bbox);
      setTrafficData(data);
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className={`w-10 h-10 bg-dash-card border border-dash-border rounded-lg flex items-center justify-center text-dash-text hover:bg-dash-border transition-colors ${
          isLoading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title="Refresh traffic data"
      >
        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
      </button>
      <button
        onClick={handleZoomIn}
        className="w-10 h-10 bg-dash-card border border-dash-border rounded-lg flex items-center justify-center text-dash-text hover:bg-dash-border transition-colors"
        title="Zoom in"
      >
        <ZoomIn className="w-5 h-5" />
      </button>
      <button
        onClick={handleZoomOut}
        className="w-10 h-10 bg-dash-card border border-dash-border rounded-lg flex items-center justify-center text-dash-text hover:bg-dash-border transition-colors"
        title="Zoom out"
      >
        <ZoomOut className="w-5 h-5" />
      </button>
      <button
        onClick={handleRecenter}
        className="w-10 h-10 bg-dash-card border border-dash-border rounded-lg flex items-center justify-center text-dash-text hover:bg-dash-border transition-colors"
        title="Recenter map"
      >
        <Locate className="w-5 h-5" />
      </button>
    </div>
  );
}

// ============================================================
// LEGEND
// ============================================================

function MapLegend() {
  const congestionLevels = [
    { level: 'free_flow', label: 'Free Flow' },
    { level: 'light', label: 'Light' },
    { level: 'moderate', label: 'Moderate' },
    { level: 'heavy', label: 'Heavy' },
    { level: 'severe', label: 'Severe' },
  ] as const;

  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-dash-card/90 backdrop-blur-sm border border-dash-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-dash-accent" />
        <span className="text-sm font-semibold text-dash-text">Congestion</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {congestionLevels.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-2">
            <div
              className="w-4 h-2 rounded-sm"
              style={{ backgroundColor: CONGESTION_COLORS[level] }}
            />
            <span className="text-xs text-dash-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function TrafficMap() {
  const trafficData = useTrafficStore((s) => s.trafficData);
  const simulationState = useTrafficStore((s) => s.simulationState);
  const incidents = useTrafficStore((s) => s.incidents);
  const mapView = useTrafficStore((s) => s.mapView);
  const isLoading = useTrafficStore((s) => s.isLoading);
  const setSelectedFeature = useTrafficStore((s) => s.setSelectedFeature);

  // Track map bounds changes and fetch new data (debounced)
  // This hook handles both traffic flow and incidents
  useMapBoundsTracker();

  const handleSegmentSelect = useCallback((segment: RoadSegment) => {
    setSelectedFeature({
      type: 'segment',
      id: segment.id,
      data: segment,
    });
  }, [setSelectedFeature]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[mapView.center.lat, mapView.center.lng]}
        zoom={mapView.zoom}
        className="w-full h-full"
        zoomControl={false}
      >
        <MapController />
        
        {/* Base map tiles - Dark theme */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Traffic segments - Show at all zoom levels (filtered by LOD) */}
        {trafficData?.segments && trafficData.segments.length > 0 && (
          <SegmentLayer
            segments={trafficData.segments}
            onSelect={handleSegmentSelect}
          />
        )}

        {/* Traffic lights - Only show when zoomed in enough to see them */}
        {mapView.zoom >= 10 && simulationState?.traffic_lights && simulationState.traffic_lights.length > 0 && (
          <TrafficLightLayer lights={simulationState.traffic_lights} />
        )}

        {/* Simulated vehicles - Only show when zoomed in enough to see them */}
        {mapView.zoom >= 10 && simulationState?.vehicles && simulationState.vehicles.length > 0 && (
          <VehicleLayer vehicles={simulationState.vehicles} />
        )}

        {/* Incidents - Show at all zoom levels */}
        {incidents.length > 0 && <IncidentLayer incidents={incidents} />}
        {simulationState?.active_incidents && simulationState.active_incidents.length > 0 && (
          <IncidentLayer incidents={simulationState.active_incidents} />
        )}

        {/* Route Planner */}
        <RoutePlanner />
      </MapContainer>

      <MapControls />
      <MapLegend />

      {/* Loading Overlay - Show when loading */}
      {isLoading && (
        <div className="absolute inset-0 z-[2000] bg-dash-bg/30 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-dash-card/90 border border-dash-border rounded-lg p-4 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-dash-accent animate-spin" />
            <span className="text-xs text-dash-text">Loading traffic data...</span>
          </div>
        </div>
      )}

      {/* Location Search */}
      <div className="absolute top-4 left-4 z-[1000]">
        <LocationSearch />
      </div>

      {/* Stats overlay - Show when have data */}
      {trafficData && (
        <div className="absolute top-4 left-[450px] z-[1000] bg-dash-card/90 backdrop-blur-sm border border-dash-border rounded-lg p-4">
          <div className="text-xs text-dash-muted mb-2">Traffic Summary</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div className="text-dash-muted">Segments:</div>
            <div className="text-dash-text font-medium">
              {trafficData?.total_segments ?? trafficData?.segments?.length ?? 0}
            </div>
            <div className="text-dash-muted">Congested:</div>
            <div className="text-congestion-heavy font-medium">
              {trafficData?.congested_segments ?? 
               trafficData?.segments?.filter(s => s.congestion_level === 'heavy' || s.congestion_level === 'severe').length ?? 0}
            </div>
            <div className="text-dash-muted">Avg Speed:</div>
            <div className="text-dash-accent font-medium">
              {trafficData?.average_speed_ratio
                ? `${Math.round(trafficData.average_speed_ratio * 100)}%`
                : trafficData?.segments?.length
                ? `${Math.round(
                    (trafficData.segments.reduce((sum: number, s: RoadSegment) => sum + s.speed_ratio, 0) /
                      trafficData.segments.length) *
                      100
                  )}%`
                : '—'}
            </div>
          </div>
          {trafficData?.segments && trafficData.segments.length === 0 && !isLoading && (
            <div className="mt-2 text-xs text-yellow-400">
              No traffic data available for this area
            </div>
          )}
        </div>
      )}
    </div>
  );
}

