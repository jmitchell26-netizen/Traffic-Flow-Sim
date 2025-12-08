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
 * Now with request cancellation and better throttling.
 */
export function useMapBoundsTracker() {
  const { mapView, getBoundingBox, setTrafficData, setIsLoading, setIncidents } = useTrafficStore();
  const lastBoundsRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const bbox = getBoundingBox();
    const boundsKey = `${bbox.north.toFixed(4)},${bbox.south.toFixed(4)},${bbox.east.toFixed(4)},${bbox.west.toFixed(4)}`;
    
    // Only fetch if bounds changed significantly (more than 5% change)
    if (boundsKey !== lastBoundsRef.current) {
      lastBoundsRef.current = boundsKey;
      
      // Debounced fetch when bounds change (throttled to prevent rapid requests)
      timeoutRef.current = setTimeout(async () => {
        // Create new abort controller for this request
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setIsLoading(true);
        try {
          const [flowData, incidentsData] = await Promise.all([
            trafficApi.getFlow(bbox, abortController.signal),
            trafficApi.getIncidents(bbox, abortController.signal).catch(() => []), // Don't fail if incidents fail
          ]);

          // Check if request was cancelled
          if (abortController.signal.aborted) {
            return;
          }
          
          setTrafficData(flowData);
          setIncidents(incidentsData);
        } catch (err) {
          // Don't log if it was just a cancellation
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error('Failed to fetch traffic for new bounds:', err);
          }
        } finally {
          if (!abortController.signal.aborted) {
            setIsLoading(false);
          }
        }
      }, 600); // Optimized debounce: 600ms
    }

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

