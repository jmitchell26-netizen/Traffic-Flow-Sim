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
 */
export function useMapBoundsTracker() {
  const { mapView, getBoundingBox, setTrafficData, setIsLoading } = useTrafficStore();
  const lastBoundsRef = useRef<string | null>(null);

  useEffect(() => {
    const bbox = getBoundingBox();
    const boundsKey = `${bbox.north.toFixed(3)},${bbox.south.toFixed(3)},${bbox.east.toFixed(3)},${bbox.west.toFixed(3)}`;
    
    if (boundsKey !== lastBoundsRef.current) {
      lastBoundsRef.current = boundsKey;
      
      // Debounced fetch when bounds change significantly
      const timeout = setTimeout(async () => {
        setIsLoading(true);
        try {
          const data = await trafficApi.getFlow(bbox);
          setTrafficData(data);
        } catch (err) {
          console.error('Failed to fetch traffic for new bounds:', err);
        } finally {
          setIsLoading(false);
        }
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [mapView.center.lat, mapView.center.lng, mapView.zoom]);
}

