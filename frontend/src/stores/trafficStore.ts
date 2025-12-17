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
  
  // Game action tracking
  gameActions: {
    trafficLightsAdjusted: number;
    incidentsRemoved: number;
    intersectionsCreated: number;
    incidentsAdded: number;
  };
  trackTrafficLightAdjustment: () => void;
  trackIncidentRemoval: () => void;
  trackIntersectionCreation: () => void;
  trackIncidentAddition: () => void;
  resetGameActions: () => void;
  
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

// Default to world view - allows navigation anywhere
const DEFAULT_CENTER: Coordinates = {
  lat: 20.0,  // Center of world map
  lng: 0.0,   // Prime meridian
};

const DEFAULT_ZOOM = 3; // World view (low zoom = see whole world)

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
    
    // Game action tracking
    gameActions: {
      trafficLightsAdjusted: 0,
      incidentsRemoved: 0,
      intersectionsCreated: 0,
      incidentsAdded: 0,
    },
    trackTrafficLightAdjustment: () =>
      set((state) => ({
        gameActions: {
          ...state.gameActions,
          trafficLightsAdjusted: state.gameActions.trafficLightsAdjusted + 1,
        },
      })),
    trackIncidentRemoval: () =>
      set((state) => ({
        gameActions: {
          ...state.gameActions,
          incidentsRemoved: state.gameActions.incidentsRemoved + 1,
        },
      })),
    trackIntersectionCreation: () =>
      set((state) => ({
        gameActions: {
          ...state.gameActions,
          intersectionsCreated: state.gameActions.intersectionsCreated + 1,
        },
      })),
    trackIncidentAddition: () =>
      set((state) => ({
        gameActions: {
          ...state.gameActions,
          incidentsAdded: state.gameActions.incidentsAdded + 1,
        },
      })),
    resetGameActions: () =>
      set({
        gameActions: {
          trafficLightsAdjusted: 0,
          incidentsRemoved: 0,
          intersectionsCreated: 0,
          incidentsAdded: 0,
        },
      }),
    
    // Computed values
    /**
     * Calculate bounding box from current map view.
     * 
     * Uses actual map bounds for accurate coverage.
     * This ensures we fetch data for the entire visible area, not just a small region.
     */
    getBoundingBox: () => {
      const { mapView } = get();
      
      // If we have bounds from map, use them (most accurate)
      if (mapView.bounds) {
        return mapView.bounds;
      }
      
      // Fallback: Calculate from center and zoom
      // Use larger offset to cover more area
      // At zoom 3 (world): ~45 degrees (covers most of world)
      // At zoom 10: ~0.5 degrees (~50km)
      // At zoom 15: ~0.01 degrees (~1km)
      const baseOffset = 45; // Base offset for world view
      const zoomFactor = Math.pow(2, 15 - mapView.zoom); // Exponential scaling
      const offset = baseOffset / zoomFactor;
      
      // Clamp to reasonable bounds (don't exceed world limits)
      const maxOffset = 45; // Max ~5000km
      const minOffset = 0.01; // Min ~1km
      const clampedOffset = Math.max(minOffset, Math.min(maxOffset, offset));
      
      return {
        north: Math.min(90, mapView.center.lat + clampedOffset),
        south: Math.max(-90, mapView.center.lat - clampedOffset),
        east: Math.min(180, mapView.center.lng + clampedOffset),
        west: Math.max(-180, mapView.center.lng - clampedOffset),
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

