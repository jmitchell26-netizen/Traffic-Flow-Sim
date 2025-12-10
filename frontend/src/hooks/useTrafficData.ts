/**
 * Custom hooks for traffic data fetching and management.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useTrafficStore } from '../stores/trafficStore';
import { trafficApi, dashboardApi, SimulationWebSocket } from '../services/api';

/**
 * Hook to fetch and refresh traffic data at regular intervals.
 */
export function useTrafficPolling(intervalMs: number = 60000) {
  const {
    setTrafficData,
    setIncidents,
    setIsLoading,
    setError,
    getBoundingBox,
  } = useTrafficStore();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const bbox = getBoundingBox();
      
      const [flowData, incidents] = await Promise.all([
        trafficApi.getFlow(bbox),
        trafficApi.getIncidents(bbox),
      ]);
      
      setTrafficData(flowData);
      setIncidents(incidents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch traffic data');
    } finally {
      setIsLoading(false);
    }
  }, [getBoundingBox, setTrafficData, setIncidents, setIsLoading, setError]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, intervalMs);
    return () => clearInterval(interval);
  }, [fetchData, intervalMs]);

  return { refetch: fetchData };
}

/**
 * Hook to manage WebSocket connection for real-time simulation updates.
 */
export function useSimulationWebSocket() {
  const wsRef = useRef<SimulationWebSocket | null>(null);
  const { setSimulationState, setError } = useTrafficStore();

  useEffect(() => {
    const ws = new SimulationWebSocket(
      (state) => {
        setSimulationState(state as any);
      },
      (error) => {
        setError(error.message);
      }
    );

    wsRef.current = ws;
    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, [setSimulationState, setError]);

  const requestState = useCallback(() => {
    wsRef.current?.requestState();
  }, []);

  return { requestState };
}

/**
 * Hook to fetch dashboard metrics at regular intervals.
 */
export function useDashboardPolling(intervalMs: number = 5000) {
  const {
    setDashboardData,
    addMetricsSnapshot,
    setError,
  } = useTrafficStore();

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await dashboardApi.getData();
      setDashboardData(data);
      addMetricsSnapshot(data.current_metrics);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    }
  }, [setDashboardData, addMetricsSnapshot]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, intervalMs);
    return () => clearInterval(interval);
  }, [fetchMetrics, intervalMs]);

  return { refetch: fetchMetrics };
}

/**
 * Hook to track map bounds changes and trigger data refetch.
 * 
 * This hook monitors map view changes and automatically fetches traffic data
 * when the user pans or zooms. It includes several performance optimizations:
 * 
 * - Request cancellation: Cancels pending requests when map moves again
 * - Debouncing: Waits 600ms after movement stops before fetching
 * - Bounds tracking: Only fetches if bounds changed significantly
 * - Parallel requests: Fetches traffic flow and incidents simultaneously
 * 
 * @example
 * ```tsx
 * function MapComponent() {
 *   useMapBoundsTracker(); // Automatically fetches data on map movement
 *   return <MapContainer>...</MapContainer>;
 * }
 * ```
 */
export function useMapBoundsTracker() {
  const { mapView, getBoundingBox, setTrafficData, setIsLoading, setIncidents } = useTrafficStore();
  
  // Track last bounds to detect changes
  const lastBoundsRef = useRef<string | null>(null);
  
  // Store timeout ID for debouncing
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store abort controller for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any pending requests from previous map movement
    // This prevents unnecessary API calls when user moves map rapidly
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear any pending timeout (debounce reset)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Get current bounding box from map view
    const bbox = getBoundingBox();
    
    // Create a unique key for these bounds (rounded to 2 decimal places for larger tolerance)
    // This allows detecting significant changes while ignoring tiny movements
    // Using 2 decimal places (~1km tolerance) instead of 4 (~100m) reduces unnecessary fetches
    const boundsKey = `${bbox.north.toFixed(2)},${bbox.south.toFixed(2)},${bbox.east.toFixed(2)},${bbox.west.toFixed(2)}`;
    
    // Only fetch if bounds changed significantly
    // Prevents redundant API calls for tiny map movements
    if (boundsKey !== lastBoundsRef.current) {
      lastBoundsRef.current = boundsKey;
      
      // Debounced fetch: wait 1200ms (1.2s) after movement stops before fetching
      // Longer delay = fewer API calls = smoother experience
      // Only show loading if we're actually going to fetch
      timeoutRef.current = setTimeout(async () => {
        // Create new abort controller for this request
        // Allows cancelling if user moves map again before request completes
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Get current zoom from store (may have changed during debounce delay)
        const currentMapView = useTrafficStore.getState().mapView;
        
        // At very low zoom levels (world view), use fewer sample points to avoid massive API calls
        // But still fetch data - we'll filter segments by zoom level for display
        
        // Only set loading state if request wasn't immediately cancelled
        // This prevents flickering loading screens
        if (!abortController.signal.aborted) {
          setIsLoading(true);
        }
        
        try {
          // Fetch traffic flow and incidents in parallel
          // Both requests use the same abort signal so both can be cancelled together
          const [flowData, incidentsData] = await Promise.all([
            trafficApi.getFlow(bbox, abortController.signal),
            // Incidents fetch won't fail entire operation if it errors
            trafficApi.getIncidents(bbox, abortController.signal).catch(() => []),
          ]);

          // Check if request was cancelled (user moved map again)
          // If cancelled, don't update state with stale data
          if (abortController.signal.aborted) {
            return;
          }
          
          // Update store with fresh data
          setTrafficData(flowData);
          setIncidents(incidentsData);
        } catch (err) {
          // Don't log cancellation errors (expected behavior)
          // Only log actual API errors
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error('Failed to fetch traffic for new bounds:', err);
          }
        } finally {
          // Only update loading state if request wasn't cancelled
          if (!abortController.signal.aborted) {
            setIsLoading(false);
          }
        }
      }, 1200); // 1200ms (1.2s) debounce delay - reduces API calls, smoother UX
    }

    // Cleanup: cancel timeout and abort requests on unmount or dependency change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [mapView.center.lat, mapView.center.lng, mapView.zoom, getBoundingBox, setTrafficData, setIsLoading, setIncidents]);
}

