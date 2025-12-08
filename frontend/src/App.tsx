/**
 * Traffic Flow Simulation - Main Application Component
 * 
 * Renders the main layout with:
 * - Header with navigation tabs
 * - Map view with traffic overlay
 * - Dashboard panel with metrics
 * - Simulation controls
 */

import { useEffect } from 'react';
import { Map, BarChart3, Settings2, Activity, AlertTriangle, Gamepad2 } from 'lucide-react';
import { useTrafficStore } from './stores/trafficStore';
import { TrafficMap } from './components/map/TrafficMap';
import { Dashboard } from './components/dashboard/Dashboard';
import { SimulationPanel } from './components/simulation/SimulationPanel';
import { GameMode } from './components/game/GameMode';
import { trafficApi, dashboardApi } from './services/api';

function App() {
  const {
    activeTab,
    setActiveTab,
    isLoading,
    error,
    setError,
    setTrafficData,
    setDashboardData,
    setIsLoading,
    getBoundingBox,
  } = useTrafficStore();

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const bbox = getBoundingBox();
        
        // Fetch traffic and dashboard data in parallel
        const [trafficData, dashboardData] = await Promise.all([
          trafficApi.getFlow(bbox),
          dashboardApi.getData(),
        ]);
        
        setTrafficData(trafficData);
        setDashboardData(dashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Periodic data refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const bbox = getBoundingBox();
        const trafficData = await trafficApi.getFlow(bbox);
        setTrafficData(trafficData);
      } catch (err) {
        console.error('Failed to refresh traffic data:', err);
      }
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'map' as const, label: 'Map View', icon: Map },
    { id: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
    { id: 'simulation' as const, label: 'Simulation', icon: Settings2 },
    { id: 'game' as const, label: 'Game Mode', icon: Gamepad2 },
  ];

  return (
    <div className="h-screen flex flex-col bg-dash-bg">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-dash-border bg-dash-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-dash-accent to-cyan-400 flex items-center justify-center">
              <Activity className="w-6 h-6 text-dash-bg" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-dash-text tracking-wider">
                TRAFFIC FLOW
              </h1>
              <p className="text-xs text-dash-muted">Real-time Simulation</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-dash-bg/50 rounded-lg p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
                    transition-all duration-200
                    ${isActive
                      ? 'bg-dash-accent text-dash-bg shadow-lg shadow-dash-accent/20'
                      : 'text-dash-muted hover:text-dash-text hover:bg-dash-border/50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Status Indicator */}
          <div className="flex items-center gap-4">
            {isLoading && (
              <div className="flex items-center gap-2 text-dash-muted text-sm">
                <div className="w-2 h-2 rounded-full bg-dash-accent animate-pulse" />
                Loading...
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-traffic-green animate-pulse" />
              <span className="text-dash-muted">Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 bg-red-500/10 border-b border-red-500/20 px-6 py-3">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-xs hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'map' && <TrafficMap />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'simulation' && <SimulationPanel />}
        {activeTab === 'game' && <GameMode />}
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-dash-border bg-dash-card/30 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-dash-muted">
          <span>Data source: TomTom Traffic API</span>
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

