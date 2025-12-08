/**
 * Traffic Store - Zustand state management
 * 
 * Centralized state management for the entire traffic simulation application.
 * Uses Zustand for lightweight, performant state management with:
 * - Reactive updates (components re-render when data changes)
 * - Selector optimization (components only subscribe to needed data)
 * - Middleware support (subscribeWithSelector for advanced patterns)
 * 
 * Store manages:
 * - Map view state (center, zoom, bounds)
 * - Traffic data (segments, incidents, flow data)
 * - Simulation state (vehicles, lights, metrics)
 * - Dashboard data (metrics, charts, analytics)
 * - UI state (selected features, active tab, loading states)
 * 
 * @example
 * ```tsx
 * // In component
 * const trafficData = useTrafficStore((s) => s.trafficData);
 * const setTrafficData = useTrafficStore((s) => s.setTrafficData);
 * ```
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  BoundingBox,
  Coordinates,
  DashboardData,
  MapViewState,
  RoadSegment,
  SelectedFeature,
  SimulationConfig,
  SimulationState,
  TrafficFlowData,
  TrafficIncident,
  TrafficMetrics,
} from '../types/traffic';

// ============================================================
// STORE TYPES
// ============================================================

interface TrafficStore {
  // Map state
  mapView: MapViewState;
  setMapView: (view: Partial<MapViewState>) => void;
  
  // Traffic data
  trafficData: TrafficFlowData | null;
  setTrafficData: (data: TrafficFlowData) => void;
  
  // Incidents
  incidents: TrafficIncident[];
  setIncidents: (incidents: TrafficIncident[]) => void;
  addIncident: (incident: TrafficIncident) => void;
  removeIncident: (id: string) => void;
  
  // Simulation state
  simulationState: SimulationState | null;
  setSimulationState: (state: SimulationState) => void;
  simulationConfig: SimulationConfig | null;
  setSimulationConfig: (config: SimulationConfig) => void;
  isSimulationRunning: boolean;
  setIsSimulationRunning: (running: boolean) => void;
  
  // Dashboard data
  dashboardData: DashboardData | null;
  setDashboardData: (data: DashboardData) => void;
  metricsHistory: TrafficMetrics[];
  addMetricsSnapshot: (metrics: TrafficMetrics) => void;
  
  // UI state
  selectedFeature: SelectedFeature | null;
  setSelectedFeature: (feature: SelectedFeature | null) => void;
  
  isPanelOpen: boolean;
  togglePanel: () => void;
  
  activeTab: 'map' | 'dashboard' | 'simulation' | 'game';
  setActiveTab: (tab: 'map' | 'dashboard' | 'simulation' | 'game') => void;
  
  // Data loading
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  
    // Computed / derived values
    /**
     * Calculate bounding box from current map view.
     * Used for API requests to fetch data for visible area.
     * 
     * @returns BoundingBox representing the visible map area
     */
    getBoundingBox: () => BoundingBox;
    
    /**
     * Find a road segment by its ID.
     * Useful for looking up segment details when user clicks on map.
     * 
     * @param id - Segment ID to search for
     * @returns RoadSegment if found, undefined otherwise
     */
    getSegmentById: (id: string) => RoadSegment | undefined;
}

// ============================================================
// DEFAULT VALUES
// ============================================================

const DEFAULT_CENTER: Coordinates = {
  lat: 40.7128,
  lng: -74.0060, // New York City
};

const DEFAULT_ZOOM = 13;

const DEFAULT_MAP_VIEW: MapViewState = {
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
};

// ============================================================
// STORE IMPLEMENTATION
// ============================================================

export const useTrafficStore = create<TrafficStore>()(
  subscribeWithSelector((set, get) => ({
    // Map state
    mapView: DEFAULT_MAP_VIEW,
    setMapView: (view) =>
      set((state) => ({
        mapView: { ...state.mapView, ...view },
      })),
    
    // Traffic data
    trafficData: null,
    setTrafficData: (data) => set({ trafficData: data }),
    
    // Incidents
    incidents: [],
    setIncidents: (incidents) => set({ incidents }),
    addIncident: (incident) =>
      set((state) => ({
        incidents: [...state.incidents, incident],
      })),
    removeIncident: (id) =>
      set((state) => ({
        incidents: state.incidents.filter((i) => i.id !== id),
      })),
    
    // Simulation state
    simulationState: null,
    setSimulationState: (simulationState) => set({ simulationState }),
    simulationConfig: null,
    setSimulationConfig: (simulationConfig) => set({ simulationConfig }),
    isSimulationRunning: false,
    setIsSimulationRunning: (isSimulationRunning) => set({ isSimulationRunning }),
    
    // Dashboard data
    dashboardData: null,
    setDashboardData: (dashboardData) => set({ dashboardData }),
    metricsHistory: [],
    addMetricsSnapshot: (metrics) =>
      set((state) => ({
        metricsHistory: [...state.metricsHistory.slice(-100), metrics], // Keep last 100
      })),
    
    // UI state
    selectedFeature: null,
    setSelectedFeature: (selectedFeature) => set({ selectedFeature }),
    
    isPanelOpen: true,
    togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
    
    activeTab: 'map',
    setActiveTab: (activeTab) => set({ activeTab }),
    
    // Data loading
    isLoading: false,
    setIsLoading: (isLoading) => set({ isLoading }),
    error: null,
    setError: (error) => set({ error }),
    
    // Computed values
    /**
     * Calculate bounding box from current map view.
     * 
     * The bounding box size is inversely proportional to zoom level:
     * - Low zoom (zoomed out) = larger bounding box
     * - High zoom (zoomed in) = smaller bounding box
     * 
     * This ensures we fetch appropriate amount of data for the view.
     */
    getBoundingBox: () => {
      const { mapView } = get();
      // Calculate offset based on zoom level
      // At zoom 10, offset is ~0.02 degrees (~2km)
      // Offset decreases as zoom increases (more detail = smaller area)
      const offset = 0.02 / (mapView.zoom / 10);
      return {
        north: mapView.center.lat + offset,
        south: mapView.center.lat - offset,
        east: mapView.center.lng + offset,
        west: mapView.center.lng - offset,
      };
    },
    
    getSegmentById: (id: string) => {
      const { trafficData } = get();
      return trafficData?.segments.find((s) => s.id === id);
    },
  }))
);

// ============================================================
// SELECTORS (for optimized re-renders)
// ============================================================

export const selectMapView = (state: TrafficStore) => state.mapView;
export const selectTrafficData = (state: TrafficStore) => state.trafficData;
export const selectSimulationState = (state: TrafficStore) => state.simulationState;
export const selectIsSimulationRunning = (state: TrafficStore) => state.isSimulationRunning;
export const selectDashboardData = (state: TrafficStore) => state.dashboardData;
export const selectActiveTab = (state: TrafficStore) => state.activeTab;
export const selectIsLoading = (state: TrafficStore) => state.isLoading;

