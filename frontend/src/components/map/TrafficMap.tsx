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

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Layers, ZoomIn, ZoomOut, Locate, Plus } from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import {
  CONGESTION_COLORS,
  TRAFFIC_LIGHT_COLORS,
  getCongestionLabel,
  formatSpeed,
  formatDuration,
  type RoadSegment,
  type SimulatedVehicle,
  type TrafficLight,
  type TrafficIncident,
} from '../../types/traffic';
import { SegmentPopup } from './SegmentPopup';
import { VehicleMarker } from './VehicleMarker';

// ============================================================
// MAP CONTROLLER (handles view updates)
// ============================================================

function MapController() {
  const map = useMap();
  const mapView = useTrafficStore((s) => s.mapView);
  const setMapView = useTrafficStore((s) => s.setMapView);

  useEffect(() => {
    map.setView([mapView.center.lat, mapView.center.lng], mapView.zoom);
  }, [mapView.center.lat, mapView.center.lng, mapView.zoom, map]);

  useEffect(() => {
    const handleMoveEnd = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      setMapView({
        center: { lat: center.lat, lng: center.lng },
        zoom,
      });
    };

    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, setMapView]);

  return null;
}

// ============================================================
// SEGMENT LAYER
// ============================================================

interface SegmentLayerProps {
  segments: RoadSegment[];
  onSelect: (segment: RoadSegment) => void;
}

function SegmentLayer({ segments, onSelect }: SegmentLayerProps) {
  return (
    <>
      {segments.map((segment) => (
        <Polyline
          key={segment.id}
          positions={segment.coordinates.map((c) => [c.lat, c.lng])}
          pathOptions={{
            color: CONGESTION_COLORS[segment.congestion_level],
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
}

// ============================================================
// VEHICLE LAYER
// ============================================================

interface VehicleLayerProps {
  vehicles: SimulatedVehicle[];
}

function VehicleLayer({ vehicles }: VehicleLayerProps) {
  return (
    <>
      {vehicles.slice(0, 100).map((vehicle) => (
        <VehicleMarker key={vehicle.id} vehicle={vehicle} />
      ))}
    </>
  );
}

// ============================================================
// TRAFFIC LIGHT LAYER
// ============================================================

interface TrafficLightLayerProps {
  lights: TrafficLight[];
}

function TrafficLightLayer({ lights }: TrafficLightLayerProps) {
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
}

// ============================================================
// INCIDENT LAYER
// ============================================================

interface IncidentLayerProps {
  incidents: TrafficIncident[];
}

function IncidentLayer({ incidents }: IncidentLayerProps) {
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
}

// ============================================================
// MAP CONTROLS
// ============================================================

function MapControls() {
  const mapView = useTrafficStore((s) => s.mapView);
  const setMapView = useTrafficStore((s) => s.setMapView);

  const handleZoomIn = () => setMapView({ zoom: mapView.zoom + 1 });
  const handleZoomOut = () => setMapView({ zoom: Math.max(1, mapView.zoom - 1) });
  const handleRecenter = () => {
    setMapView({
      center: { lat: 40.7128, lng: -74.0060 },
      zoom: 13,
    });
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <button
        onClick={handleZoomIn}
        className="w-10 h-10 bg-dash-card border border-dash-border rounded-lg flex items-center justify-center text-dash-text hover:bg-dash-border transition-colors"
      >
        <ZoomIn className="w-5 h-5" />
      </button>
      <button
        onClick={handleZoomOut}
        className="w-10 h-10 bg-dash-card border border-dash-border rounded-lg flex items-center justify-center text-dash-text hover:bg-dash-border transition-colors"
      >
        <ZoomOut className="w-5 h-5" />
      </button>
      <button
        onClick={handleRecenter}
        className="w-10 h-10 bg-dash-card border border-dash-border rounded-lg flex items-center justify-center text-dash-text hover:bg-dash-border transition-colors"
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
  const setSelectedFeature = useTrafficStore((s) => s.setSelectedFeature);

  const handleSegmentSelect = (segment: RoadSegment) => {
    setSelectedFeature({
      type: 'segment',
      id: segment.id,
      data: segment,
    });
  };

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

        {/* Traffic segments */}
        {trafficData?.segments && (
          <SegmentLayer
            segments={trafficData.segments}
            onSelect={handleSegmentSelect}
          />
        )}

        {/* Traffic lights */}
        {simulationState?.traffic_lights && (
          <TrafficLightLayer lights={simulationState.traffic_lights} />
        )}

        {/* Simulated vehicles */}
        {simulationState?.vehicles && (
          <VehicleLayer vehicles={simulationState.vehicles} />
        )}

        {/* Incidents */}
        {incidents.length > 0 && <IncidentLayer incidents={incidents} />}
        {simulationState?.active_incidents && (
          <IncidentLayer incidents={simulationState.active_incidents} />
        )}
      </MapContainer>

      <MapControls />
      <MapLegend />

      {/* Stats overlay */}
      <div className="absolute top-4 left-4 z-[1000] bg-dash-card/90 backdrop-blur-sm border border-dash-border rounded-lg p-4">
        <div className="text-xs text-dash-muted mb-2">Traffic Summary</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="text-dash-muted">Segments:</div>
          <div className="text-dash-text font-medium">
            {trafficData?.total_segments ?? '—'}
          </div>
          <div className="text-dash-muted">Congested:</div>
          <div className="text-congestion-heavy font-medium">
            {trafficData?.congested_segments ?? '—'}
          </div>
          <div className="text-dash-muted">Avg Speed:</div>
          <div className="text-dash-accent font-medium">
            {trafficData
              ? `${Math.round(trafficData.average_speed_ratio * 100)}%`
              : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

