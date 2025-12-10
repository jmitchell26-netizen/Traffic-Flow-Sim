/**
 * API Service - HTTP client for backend communication
 * 
 * Provides typed methods for all API endpoints with error handling.
 */

import type {
  BoundingBox,
  CongestionSummary,
  DashboardData,
  IntersectionMetrics,
  LocationResult,
  RoadSegment,
  Route,
  SimulationConfig,
  SimulationState,
  TrafficAlert,
  TrafficFlowData,
  TrafficIncident,
  TrafficMetrics,
} from '../types/traffic';

// ============================================================
// CONFIGURATION
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ============================================================
// HTTP CLIENT
// ============================================================

/**
 * Generic API fetch function with error handling and abort signal support.
 * 
 * This is the base function used by all API methods. It handles:
 * - URL construction with base path
 * - Request headers (JSON content type)
 * - Abort signal for request cancellation
 * - Error parsing and formatting
 * - Response JSON parsing
 * 
 * @template T - Type of data expected in response
 * @param endpoint - API endpoint path (e.g., '/traffic/flow')
 * @param options - Fetch options including optional AbortSignal
 * @returns Promise resolving to typed response data
 * @throws Error if request fails or is aborted
 * 
 * @example
 * ```ts
 * const data = await fetchApi<TrafficFlowData>('/traffic/flow', { signal });
 * ```
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  // Construct full URL from base URL and endpoint
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Make fetch request with headers and abort signal
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,  // Allow custom headers to override
    },
    signal: options?.signal,  // AbortSignal for cancellation
    ...options,  // Spread other options (method, body, etc.)
  });
  
  // Handle HTTP errors
  if (!response.ok) {
    // Don't parse error if request was aborted (expected behavior)
    if (options?.signal?.aborted) {
      throw new Error('Request aborted');
    }
    // Try to parse error message from response, fallback to status code
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }
  
  // Parse and return JSON response
  return response.json();
}

// ============================================================
// TRAFFIC DATA API
// ============================================================

export const trafficApi = {
  /**
   * Get real-time traffic flow data for a bounding box
   */
  async getFlow(bbox: BoundingBox, signal?: AbortSignal): Promise<TrafficFlowData> {
    const params = new URLSearchParams({
      north: bbox.north.toString(),
      south: bbox.south.toString(),
      east: bbox.east.toString(),
      west: bbox.west.toString(),
    });
    return fetchApi<TrafficFlowData>(`/traffic/flow?${params}`, { signal });
  },
  
  /**
   * Get traffic data for a single segment
   */
  async getSegment(lat: number, lng: number, zoom = 12): Promise<RoadSegment> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      zoom: zoom.toString(),
    });
    return fetchApi<RoadSegment>(`/traffic/segment?${params}`);
  },
  
  /**
   * Get traffic incidents in an area
   */
  async getIncidents(bbox: BoundingBox, signal?: AbortSignal): Promise<TrafficIncident[]> {
    const params = new URLSearchParams({
      north: bbox.north.toString(),
      south: bbox.south.toString(),
      east: bbox.east.toString(),
      west: bbox.west.toString(),
    });
    return fetchApi<TrafficIncident[]>(`/traffic/incidents?${params}`, { signal });
  },
  
  /**
   * Get congestion summary for an area
   */
  async getCongestionSummary(bbox: BoundingBox): Promise<CongestionSummary> {
    const params = new URLSearchParams({
      north: bbox.north.toString(),
      south: bbox.south.toString(),
      east: bbox.east.toString(),
      west: bbox.west.toString(),
    });
    return fetchApi<CongestionSummary>(`/traffic/congestion?${params}`);
  },
  
  /**
   * Search for locations by name or address
   */
  async searchLocation(query: string, limit: number = 10) {
    return fetchApi<{ results: LocationResult[]; query: string }>(
      `/traffic/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  },
  
  /**
   * Calculate route between two points
   */
  async calculateRoute(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    alternatives: boolean = false
  ) {
    const params = new URLSearchParams({
      start_lat: start.lat.toString(),
      start_lng: start.lng.toString(),
      end_lat: end.lat.toString(),
      end_lng: end.lng.toString(),
      alternatives: alternatives.toString(),
    });
    return fetchApi<{ routes: Route[] }>(`/traffic/route?${params}`);
  },
  
  /**
   * Check alerts for current traffic data
   */
  async checkAlerts(bbox: BoundingBox) {
    const params = new URLSearchParams({
      north: bbox.north.toString(),
      south: bbox.south.toString(),
      east: bbox.east.toString(),
      west: bbox.west.toString(),
    });
    return fetchApi<Array<{ alert_id: string; alert_name: string; triggered_at: string }>>(
      `/traffic/check-alerts?${params}`
    );
  },
};

// ============================================================
// SIMULATION API
// ============================================================

export const simulationApi = {
  /**
   * Get current simulation state
   */
  async getState(): Promise<SimulationState> {
    return fetchApi<SimulationState>('/simulation/state');
  },
  
  /**
   * Start the simulation
   */
  async start(): Promise<{ status: string }> {
    return fetchApi('/simulation/start', { method: 'POST' });
  },
  
  /**
   * Stop the simulation
   */
  async stop(): Promise<{ status: string }> {
    return fetchApi('/simulation/stop', { method: 'POST' });
  },
  
  /**
   * Reset the simulation
   */
  async reset(): Promise<{ status: string }> {
    return fetchApi('/simulation/reset', { method: 'POST' });
  },
  
  /**
   * Update simulation configuration
   */
  async updateConfig(config: Partial<SimulationConfig>): Promise<SimulationConfig> {
    return fetchApi<SimulationConfig>('/simulation/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
  
  /**
   * Get simulation configuration
   */
  async getConfig(): Promise<SimulationConfig> {
    return fetchApi<SimulationConfig>('/simulation/config');
  },
};

// ============================================================
// DASHBOARD API
// ============================================================

export const dashboardApi = {
  /**
   * Get dashboard data and metrics
   */
  async getData(): Promise<DashboardData> {
    return fetchApi<DashboardData>('/dashboard/data');
  },
  
  /**
   * Get intersection metrics
   */
  async getIntersectionMetrics(intersectionId: string): Promise<IntersectionMetrics> {
    return fetchApi<IntersectionMetrics>(`/dashboard/intersections/${intersectionId}`);
  },
};

// ============================================================
// ALERTS API
// ============================================================

export const alertsApi = {
  /**
   * Get all alerts
   */
  async getAlerts(): Promise<TrafficAlert[]> {
    return fetchApi<TrafficAlert[]>('/alerts');
  },
  
  /**
   * Create a new alert
   */
  async createAlert(alert: {
    name: string;
    north: number;
    south: number;
    east: number;
    west: number;
    conditions: Record<string, any>;
  }): Promise<TrafficAlert> {
    return fetchApi<TrafficAlert>('/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    });
  },
  
  /**
   * Update an alert
   */
  async updateAlert(alertId: string, updates: Partial<TrafficAlert>): Promise<TrafficAlert> {
    return fetchApi<TrafficAlert>(`/alerts/${alertId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  
  /**
   * Delete an alert
   */
  async deleteAlert(alertId: string): Promise<void> {
    return fetchApi(`/alerts/${alertId}`, { method: 'DELETE' });
  },
  
  /**
   * Get alert trigger history
   */
  async getAlertHistory(alertId: string): Promise<Array<{ triggered_at: string; conditions_met: any }>> {
    return fetchApi(`/alerts/${alertId}/history`);
  },
};

// ============================================================
// WEBSOCKET
// ============================================================

export class SimulationWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  constructor(
    private url: string,
    private onMessage: (data: SimulationState) => void,
    private onError?: (error: Event) => void
  ) {}
  
  connect(): void {
    try {
      const wsUrl = this.url.replace('http', 'ws');
      this.ws = new WebSocket(`${wsUrl}/simulation/ws`);
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
      
      this.ws.onerror = (error) => {
        if (this.onError) {
          this.onError(error);
        }
      };
      
      this.ws.onclose = () => {
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
        }
      };
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  }
  
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
