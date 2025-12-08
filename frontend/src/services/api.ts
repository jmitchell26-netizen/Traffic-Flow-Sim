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
  RoadSegment,
  SimulationConfig,
  SimulationState,
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
  async reset(): Promise<{ status: string; state: SimulationState }> {
    return fetchApi('/simulation/reset', { method: 'POST' });
  },
  
  /**
   * Get simulation configuration
   */
  async getConfig(): Promise<SimulationConfig> {
    return fetchApi<SimulationConfig>('/simulation/config');
  },
  
  /**
   * Update simulation configuration
   */
  async updateConfig(config: Partial<SimulationConfig>): Promise<{ status: string }> {
    return fetchApi('/simulation/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
  
  /**
   * Add an intersection
   */
  async addIntersection(data: {
    lat: number;
    lng: number;
    name?: string;
    green_duration?: number;
    yellow_duration?: number;
    red_duration?: number;
  }): Promise<{ status: string; intersection: unknown }> {
    return fetchApi('/simulation/intersection', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * Adjust traffic light timing
   */
  async adjustTrafficLight(data: {
    light_id: string;
    green_duration?: number;
    yellow_duration?: number;
    red_duration?: number;
  }): Promise<{ status: string }> {
    return fetchApi('/simulation/traffic-light', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * Add a traffic incident
   */
  async addIncident(data: {
    type: string;
    lat: number;
    lng: number;
    description?: string;
    severity?: number;
  }): Promise<{ status: string; incident: TrafficIncident }> {
    return fetchApi('/simulation/incident', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * Remove a traffic incident
   */
  async removeIncident(id: string): Promise<{ status: string }> {
    return fetchApi(`/simulation/incident/${id}`, { method: 'DELETE' });
  },
};

// ============================================================
// DASHBOARD API
// ============================================================

export const dashboardApi = {
  /**
   * Get current traffic metrics
   */
  async getMetrics(): Promise<TrafficMetrics> {
    return fetchApi<TrafficMetrics>('/dashboard/metrics');
  },
  
  /**
   * Get complete dashboard data
   */
  async getData(): Promise<DashboardData> {
    return fetchApi<DashboardData>('/dashboard/data');
  },
  
  /**
   * Get metrics for a specific intersection
   */
  async getIntersectionMetrics(id: string): Promise<IntersectionMetrics> {
    return fetchApi<IntersectionMetrics>(`/dashboard/intersection/${id}`);
  },
};

// ============================================================
// WEBSOCKET CLIENT
// ============================================================

export class SimulationWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  constructor(
    private onStateUpdate: (state: Partial<SimulationState>) => void,
    private onError?: (error: Error) => void
  ) {}
  
  connect() {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/simulation/ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'state_update' || data.type === 'state') {
          this.onStateUpdate(data.data || data);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };
    
    this.ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      this.onError?.(new Error('WebSocket connection error'));
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.attemptReconnect();
    };
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  send(message: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  ping() {
    this.send({ type: 'ping' });
  }
  
  requestState() {
    this.send({ type: 'get_state' });
  }
}

