/**
 * Traffic Store - Zustand state management
 * 
 * Manages all traffic data, simulation state, and UI state
 * in a centralized, reactive store.
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
  getBoundingBox: () => BoundingBox;
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
    getBoundingBox: () => {
      const { mapView } = get();
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

