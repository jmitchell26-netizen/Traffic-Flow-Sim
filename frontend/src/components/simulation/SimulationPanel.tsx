/**
 * SimulationPanel Component
 * 
 * Control panel for the traffic simulation with:
 * - Start/stop/reset controls
 * - Configuration sliders
 * - Traffic light timing adjustments
 * - Incident creation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  Plus,
  Trash2,
  AlertTriangle,
  TrafficCone,
  Clock,
  Gauge,
  Users,
  MapPin,
} from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import { simulationApi } from '../../services/api';
import type { SimulationConfig, TrafficIncident } from '../../types/traffic';

// ============================================================
// CONTROL BUTTON
// ============================================================

interface ControlButtonProps {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

function ControlButton({
  onClick,
  icon: Icon,
  label,
  variant = 'secondary',
  disabled = false,
}: ControlButtonProps) {
  const baseStyles = 'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all';
  const variants = {
    primary: 'bg-dash-accent text-dash-bg hover:bg-cyan-400 shadow-lg shadow-dash-accent/20',
    secondary: 'bg-dash-border text-dash-text hover:bg-dash-muted/30',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// ============================================================
// SLIDER INPUT
// ============================================================

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function SliderInput({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  disabled = false,
}: SliderInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-dash-muted">{label}</span>
        <span className="text-dash-text font-medium">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={`w-full h-2 bg-dash-border rounded-lg appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:w-4
                   [&::-webkit-slider-thumb]:h-4
                   [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-dash-accent
                   [&::-webkit-slider-thumb]:cursor-pointer
                   ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}

// ============================================================
// INCIDENT FORM
// ============================================================

interface IncidentFormProps {
  onSubmit: (incident: Partial<TrafficIncident>) => void;
  onCancel: () => void;
}

interface IntersectionFormProps {
  onSubmit: (data: {
    lat: number;
    lng: number;
    name?: string;
    green_duration?: number;
    yellow_duration?: number;
    red_duration?: number;
  }) => void;
  onCancel: () => void;
}

function IntersectionForm({ onSubmit, onCancel }: IntersectionFormProps) {
  const [name, setName] = useState('');
  const [lat, setLat] = useState(40.7128);
  const [lng, setLng] = useState(-74.006);
  const [greenDuration, setGreenDuration] = useState(30);
  const [yellowDuration, setYellowDuration] = useState(5);
  const [redDuration, setRedDuration] = useState(30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name || undefined,
      lat,
      lng,
      green_duration: greenDuration,
      yellow_duration: yellowDuration,
      red_duration: redDuration,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4 p-4 bg-dash-bg/50 rounded-lg">
      <div>
        <label className="block text-sm text-dash-muted mb-1">Intersection Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Main St & 5th Ave"
          className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-dash-muted mb-1">Latitude</label>
          <input
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(Number(e.target.value))}
            className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
          />
        </div>
        <div>
          <label className="block text-sm text-dash-muted mb-1">Longitude</label>
          <input
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(Number(e.target.value))}
            className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-dash-muted mb-1">Green (s)</label>
          <input
            type="number"
            min={10}
            max={120}
            step={5}
            value={greenDuration}
            onChange={(e) => setGreenDuration(Number(e.target.value))}
            className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
          />
        </div>
        <div>
          <label className="block text-sm text-dash-muted mb-1">Yellow (s)</label>
          <input
            type="number"
            min={3}
            max={10}
            step={1}
            value={yellowDuration}
            onChange={(e) => setYellowDuration(Number(e.target.value))}
            className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
          />
        </div>
        <div>
          <label className="block text-sm text-dash-muted mb-1">Red (s)</label>
          <input
            type="number"
            min={10}
            max={120}
            step={5}
            value={redDuration}
            onChange={(e) => setRedDuration(Number(e.target.value))}
            className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-dash-accent hover:bg-dash-accent/80 text-white rounded-lg font-medium transition-colors"
        >
          Add Intersection
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-dash-border hover:bg-dash-border/80 text-dash-text rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function IncidentForm({ onSubmit, onCancel }: IncidentFormProps) {
  const [type, setType] = useState('accident');
  const [severity, setSeverity] = useState(3);
  const [lat, setLat] = useState(40.7128);
  const [lng, setLng] = useState(-74.006);
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type,
      severity,
      location: { lat, lng },
      description: description || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-dash-muted mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
        >
          <option value="accident">Accident</option>
          <option value="construction">Construction</option>
          <option value="closure">Road Closure</option>
          <option value="event">Event</option>
        </select>
      </div>

      <SliderInput
        label="Severity"
        value={severity}
        min={1}
        max={5}
        onChange={setSeverity}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-dash-muted mb-1">Latitude</label>
          <input
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(Number(e.target.value))}
            className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
          />
        </div>
        <div>
          <label className="block text-sm text-dash-muted mb-1">Longitude</label>
          <input
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(Number(e.target.value))}
            className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-dash-muted mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 bg-dash-accent text-dash-bg py-2 rounded-lg font-medium hover:bg-cyan-400"
        >
          Add Incident
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-dash-border text-dash-text rounded-lg hover:bg-dash-muted/30"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ============================================================
// MAIN PANEL
// ============================================================

export function SimulationPanel() {
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [showIntersectionForm, setShowIntersectionForm] = useState(false);
  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAdjustingLight, setIsAdjustingLight] = useState(false);
  const [config, setConfig] = useState<Partial<SimulationConfig>>({
    tick_interval_ms: 100,
    max_vehicles: 200,
    spawn_rate: 0.5,
  });
  const configUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    simulationState,
    isSimulationRunning,
    setIsSimulationRunning,
    setSimulationState,
    incidents,
    addIncident,
    removeIncident,
    setError,
    trackTrafficLightAdjustment,
    trackIncidentRemoval,
    trackIncidentAddition,
  } = useTrafficStore();

  // Poll for simulation state updates when running
  useEffect(() => {
    if (!isSimulationRunning) return;

    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    const pollInterval = setInterval(async () => {
      try {
        const state = await simulationApi.getState();
        setSimulationState(state);
        consecutiveErrors = 0; // Reset error count on success
      } catch (err) {
        consecutiveErrors++;
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch simulation state';
        console.error('Failed to fetch simulation state:', err);
        
        // Show error after multiple failures
        if (consecutiveErrors >= maxConsecutiveErrors) {
          setActionFeedback({
            message: `Simulation state update failed: ${errorMessage}`,
            type: 'error'
          });
          setTimeout(() => setActionFeedback(null), 5000);
        }
        
        // Stop polling if too many errors
        if (consecutiveErrors >= maxConsecutiveErrors * 2) {
          console.error('Too many consecutive errors, stopping simulation polling');
          setIsSimulationRunning(false);
        }
      }
    }, 500); // Poll every 500ms for smooth updates

    return () => clearInterval(pollInterval);
  }, [isSimulationRunning, setSimulationState, setIsSimulationRunning]);

  // Fetch initial state and config on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [state, currentConfig] = await Promise.all([
          simulationApi.getState(),
          simulationApi.getConfig(),
        ]);
        setSimulationState(state);
        setConfig(currentConfig);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch initial simulation data';
        console.error('Failed to fetch initial simulation data:', err);
        setActionFeedback({
          message: `Initialization error: ${errorMessage}`,
          type: 'error'
        });
        setTimeout(() => setActionFeedback(null), 5000);
      }
    };
    fetchInitialData();
  }, [setSimulationState]);

  const handleStart = async () => {
    try {
      await simulationApi.start();
      setIsSimulationRunning(true);
      // Fetch state immediately after starting
      const state = await simulationApi.getState();
      setSimulationState(state);
      setActionFeedback({
        message: 'Simulation started successfully',
        type: 'success'
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start simulation';
      setError(errorMessage);
      setActionFeedback({
        message: `Failed to start: ${errorMessage}`,
        type: 'error'
      });
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleStop = async () => {
    try {
      await simulationApi.stop();
      setIsSimulationRunning(false);
      // Fetch final state after stopping
      const state = await simulationApi.getState();
      setSimulationState(state);
      setActionFeedback({
        message: 'Simulation stopped',
        type: 'success'
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop simulation';
      setError(errorMessage);
      setActionFeedback({
        message: `Failed to stop: ${errorMessage}`,
        type: 'error'
      });
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleReset = async () => {
    try {
      const result = await simulationApi.reset();
      setSimulationState(result.state);
      setIsSimulationRunning(false);
      setActionFeedback({
        message: 'Simulation reset successfully',
        type: 'success'
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset simulation';
      setError(errorMessage);
      setActionFeedback({
        message: `Failed to reset: ${errorMessage}`,
        type: 'error'
      });
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleConfigChange = useCallback(async (key: keyof SimulationConfig, value: number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    
    // Clear existing timeout
    if (configUpdateTimeoutRef.current) {
      clearTimeout(configUpdateTimeoutRef.current);
    }
    
    // Debounce config updates to avoid spamming the API
    configUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        await simulationApi.updateConfig(newConfig);
        
        // Show feedback for important config changes
        if (key === 'tick_interval_ms') {
          setActionFeedback({ 
            message: `Simulation speed updated to ${value}ms per tick`, 
            type: 'success' 
          });
          setTimeout(() => setActionFeedback(null), 2000);
        } else if (key === 'max_vehicles') {
          setActionFeedback({ 
            message: `Max vehicles set to ${value}`, 
            type: 'success' 
          });
          setTimeout(() => setActionFeedback(null), 2000);
        } else if (key === 'spawn_rate') {
          setActionFeedback({ 
            message: `Spawn rate set to ${value.toFixed(1)}/s`, 
            type: 'success' 
          });
          setTimeout(() => setActionFeedback(null), 2000);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update configuration';
        console.error('Failed to update config:', err);
        setActionFeedback({ 
          message: `Config update failed: ${errorMessage}`, 
          type: 'error' 
        });
        setTimeout(() => setActionFeedback(null), 5000);
      }
    }, 300); // 300ms debounce
  }, [config]);
  
  const handleAddIntersection = async (intersectionData: {
    lat: number;
    lng: number;
    name?: string;
    green_duration?: number;
    yellow_duration?: number;
    red_duration?: number;
  }) => {
    try {
      const result = await simulationApi.addIntersection({
        lat: intersectionData.lat,
        lng: intersectionData.lng,
        name: intersectionData.name,
        green_duration: intersectionData.green_duration || 30,
        yellow_duration: intersectionData.yellow_duration || 5,
        red_duration: intersectionData.red_duration || 30,
      });
      
      // Refresh simulation state to get new intersection
      const updatedState = await simulationApi.getState();
      setSimulationState(updatedState);
      
      setShowIntersectionForm(false);
      setActionFeedback({ 
        message: `Intersection "${result.intersection.name || result.intersection.id}" added successfully!`, 
        type: 'success' 
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      setActionFeedback({ 
        message: err instanceof Error ? err.message : 'Failed to add intersection', 
        type: 'error' 
      });
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const handleAddIncident = async (incidentData: Partial<TrafficIncident>) => {
    try {
      const result = await simulationApi.addIncident({
        type: incidentData.type || 'accident',
        lat: incidentData.location?.lat || 40.7128,
        lng: incidentData.location?.lng || -74.006,
        description: incidentData.description,
        severity: incidentData.severity,
      });
      addIncident(result.incident);
      trackIncidentAddition(); // Track for game scoring
      setShowIncidentForm(false);
      
      // Show success feedback
      setActionFeedback({ 
        message: 'Incident added successfully!', 
        type: 'success' 
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      setActionFeedback({ 
        message: err instanceof Error ? err.message : 'Failed to add incident', 
        type: 'error' 
      });
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const handleRemoveIncident = async (id: string) => {
    try {
      await simulationApi.removeIncident(id);
      removeIncident(id);
      trackIncidentRemoval(); // Track for game scoring
      
      // Show success feedback
      setActionFeedback({ 
        message: 'Incident removed successfully!', 
        type: 'success' 
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      setActionFeedback({ 
        message: err instanceof Error ? err.message : 'Failed to remove incident', 
        type: 'error' 
      });
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const handleTrafficLightAdjustment = async (
    greenDuration?: number,
    yellowDuration?: number,
    redDuration?: number
  ) => {
    if (!selectedLightId) {
      setActionFeedback({ message: 'Please select an intersection first', type: 'error' });
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    setIsAdjustingLight(true);
    try {
      await simulationApi.adjustTrafficLight(
        selectedLightId,
        greenDuration,
        yellowDuration,
        redDuration
      );
      trackTrafficLightAdjustment(); // Track for game scoring
      
      // Show success feedback
      setActionFeedback({ 
        message: `Traffic light timing updated successfully!`, 
        type: 'success' 
      });
      setTimeout(() => setActionFeedback(null), 3000);
      
      // Refresh simulation state to get updated light timings
      const updatedState = await simulationApi.getState();
      setSimulationState(updatedState);
    } catch (err) {
      setActionFeedback({ 
        message: err instanceof Error ? err.message : 'Failed to adjust traffic light', 
        type: 'error' 
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } finally {
      setIsAdjustingLight(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6 bg-dash-bg">
      {/* Action Feedback Toast */}
      {actionFeedback && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg animate-slide-in-right ${
          actionFeedback.type === 'success' 
            ? 'bg-green-500/20 border border-green-500/50 text-green-400' 
            : 'bg-red-500/20 border border-red-500/50 text-red-400'
        }`}>
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <span className="text-lg">✓</span>
            ) : (
              <span className="text-lg">✗</span>
            )}
            <span className="font-semibold">{actionFeedback.message}</span>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-display font-bold text-dash-text">
            Simulation Controls
          </h2>
          <p className="text-dash-muted mt-1">
            Configure and control the traffic simulation
          </p>
        </div>

        {/* Control Buttons */}
        <div className="bg-dash-card border border-dash-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-dash-accent" />
            <h3 className="font-semibold text-dash-text">Simulation Control</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {isSimulationRunning ? (
              <ControlButton
                onClick={handleStop}
                icon={Pause}
                label="Stop"
                variant="danger"
              />
            ) : (
              <ControlButton
                onClick={handleStart}
                icon={Play}
                label="Start"
                variant="primary"
              />
            )}
            <ControlButton
              onClick={handleReset}
              icon={RotateCcw}
              label="Reset"
            />
          </div>

          {/* Simulation Status */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-dash-bg/50 rounded-lg p-3 text-center">
              <div className="text-xl font-display font-bold text-dash-text">
                {simulationState?.tick ?? 0}
              </div>
              <div className="text-xs text-dash-muted">Tick</div>
            </div>
            <div className="bg-dash-bg/50 rounded-lg p-3 text-center">
              <div className="text-xl font-display font-bold text-dash-text">
                {simulationState?.total_vehicles ?? 0}
              </div>
              <div className="text-xs text-dash-muted">Vehicles</div>
            </div>
            <div className="bg-dash-bg/50 rounded-lg p-3 text-center">
              <div className="text-xl font-display font-bold text-dash-text">
                {simulationState?.average_speed?.toFixed(1) ?? 0} km/h
              </div>
              <div className="text-xs text-dash-muted">Avg Speed</div>
            </div>
            <div className="bg-dash-bg/50 rounded-lg p-3 text-center">
              <div className="text-xl font-display font-bold text-dash-text">
                {simulationState?.intersections?.length ?? 0}
              </div>
              <div className="text-xs text-dash-muted">Intersections</div>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="bg-dash-card border border-dash-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-dash-text">Configuration</h3>
          </div>
          <div className="space-y-4">
            <SliderInput
              label="Max Vehicles"
              value={config.max_vehicles ?? 200}
              min={10}
              max={500}
              step={10}
              onChange={(v) => handleConfigChange('max_vehicles', v)}
            />
            <SliderInput
              label="Spawn Rate"
              value={config.spawn_rate ?? 0.5}
              min={0.1}
              max={2}
              step={0.1}
              unit="/s"
              onChange={(v) => handleConfigChange('spawn_rate', v)}
            />
            <SliderInput
              label="Tick Interval"
              value={config.tick_interval_ms ?? 100}
              min={50}
              max={500}
              step={50}
              unit="ms"
              onChange={(v) => handleConfigChange('tick_interval_ms', v)}
            />
            <div className="pt-2 border-t border-dash-border">
              <p className="text-xs text-dash-muted">
                Lower values = faster simulation, higher CPU usage
              </p>
            </div>
          </div>
        </div>

        {/* Advanced Configuration */}
        <div className="bg-dash-card border border-dash-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-dash-text">Advanced Settings</h3>
          </div>
          <div className="space-y-4">
            <SliderInput
              label="Base Acceleration"
              value={config.base_acceleration ?? 2.0}
              min={0.5}
              max={5.0}
              step={0.1}
              unit="m/s²"
              onChange={(v) => handleConfigChange('base_acceleration', v)}
            />
            <SliderInput
              label="Base Deceleration"
              value={config.base_deceleration ?? 4.0}
              min={1.0}
              max={8.0}
              step={0.1}
              unit="m/s²"
              onChange={(v) => handleConfigChange('base_deceleration', v)}
            />
            <SliderInput
              label="Min Following Distance"
              value={config.min_following_distance ?? 5.0}
              min={2.0}
              max={20.0}
              step={0.5}
              unit="m"
              onChange={(v) => handleConfigChange('min_following_distance', v)}
            />
            <div className="pt-2 border-t border-dash-border">
              <p className="text-xs text-dash-muted">
                These settings affect vehicle behavior and physics
              </p>
            </div>
          </div>
        </div>

        {/* Add Intersection */}
        <div className="bg-dash-card border border-dash-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-dash-text">Intersections</h3>
            </div>
            <button
              onClick={() => setShowIntersectionForm(!showIntersectionForm)}
              className="px-3 py-1.5 bg-dash-accent/20 hover:bg-dash-accent/30 text-dash-accent rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Intersection
            </button>
          </div>
          
          {showIntersectionForm && (
            <IntersectionForm
              onSubmit={handleAddIntersection}
              onCancel={() => setShowIntersectionForm(false)}
            />
          )}
          
          {simulationState?.intersections && simulationState.intersections.length > 0 && (
            <div className="mt-4 space-y-2">
              {simulationState.intersections.map((intersection) => (
                <div
                  key={intersection.id}
                  className="bg-dash-bg/50 rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-dash-text">
                      {intersection.name || `Intersection ${intersection.id}`}
                    </div>
                    <div className="text-xs text-dash-muted">
                      {intersection.traffic_lights.length} light(s) • 
                      Wait: {intersection.average_wait_time.toFixed(1)}s
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const firstLight = intersection.traffic_lights[0];
                      if (firstLight) {
                        setSelectedLightId(firstLight.id);
                        // Scroll to traffic light section
                        setTimeout(() => {
                          document.getElementById('traffic-light-section')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }
                    }}
                    className="text-xs text-dash-accent hover:text-dash-accent/80"
                  >
                    Configure
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Traffic Light Timing */}
        <div id="traffic-light-section" className="bg-dash-card border border-dash-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-dash-text">Traffic Light Timing</h3>
          </div>
          
          {/* Intersection Selection */}
          {simulationState?.intersections && simulationState.intersections.length > 0 ? (
            <>
              <div className="mb-4">
                <label className="block text-sm text-dash-muted mb-2">Select Intersection</label>
                <select
                  value={selectedLightId || ''}
                  onChange={(e) => setSelectedLightId(e.target.value)}
                  className="w-full bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text"
                >
                  <option value="">-- Select Intersection --</option>
                  {simulationState.intersections.map((intersection) =>
                    intersection.traffic_lights.map((light) => (
                      <option key={light.id} value={light.id}>
                        {intersection.name || `Intersection ${intersection.id}`} - Light {light.id}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedLightId && (() => {
                // Find selected light to get current values
                let selectedLight = null;
                for (const intersection of simulationState.intersections || []) {
                  selectedLight = intersection.traffic_lights.find(l => l.id === selectedLightId);
                  if (selectedLight) break;
                }
                
                const currentGreen = selectedLight?.green_duration || 30;
                const currentYellow = selectedLight?.yellow_duration || 5;
                const currentRed = selectedLight?.red_duration || 30;
                
                return (
                  <div className="space-y-4">
                    {isAdjustingLight && (
                      <div className="text-sm text-dash-muted mb-2 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-dash-accent border-t-transparent rounded-full animate-spin"></div>
                        Updating...
                      </div>
                    )}
                    <SliderInput
                      label="Green Duration"
                      value={currentGreen}
                      min={10}
                      max={120}
                      step={5}
                      unit="s"
                      onChange={(value) => handleTrafficLightAdjustment(value, undefined, undefined)}
                      disabled={isAdjustingLight}
                    />
                    <SliderInput
                      label="Yellow Duration"
                      value={currentYellow}
                      min={3}
                      max={10}
                      step={1}
                      unit="s"
                      onChange={(value) => handleTrafficLightAdjustment(undefined, value, undefined)}
                      disabled={isAdjustingLight}
                    />
                    <SliderInput
                      label="Red Duration"
                      value={currentRed}
                      min={10}
                      max={120}
                      step={5}
                      unit="s"
                      onChange={(value) => handleTrafficLightAdjustment(undefined, undefined, value)}
                      disabled={isAdjustingLight}
                    />
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="text-sm text-dash-muted py-4 text-center">
              No intersections available. Add an intersection first to adjust traffic light timing.
            </div>
          )}
        </div>

        {/* Incidents */}
        <div className="bg-dash-card border border-dash-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="font-semibold text-dash-text">Traffic Incidents</h3>
            </div>
            {!showIncidentForm && (
              <button
                onClick={() => setShowIncidentForm(true)}
                className="flex items-center gap-1 text-sm text-dash-accent hover:text-cyan-400"
              >
                <Plus className="w-4 h-4" />
                Add Incident
              </button>
            )}
          </div>

          {showIncidentForm ? (
            <IncidentForm
              onSubmit={handleAddIncident}
              onCancel={() => setShowIncidentForm(false)}
            />
          ) : (
            <div className="space-y-2">
              {incidents.length === 0 && simulationState?.active_incidents?.length === 0 ? (
                <p className="text-dash-muted text-sm py-4 text-center">
                  No active incidents. Click "Add Incident" to create one.
                </p>
              ) : (
                [...incidents, ...(simulationState?.active_incidents || [])].map((incident) => (
                  <div
                    key={incident.id}
                    className="flex items-center justify-between bg-dash-bg/50 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <TrafficCone className="w-5 h-5 text-orange-400" />
                      <div>
                        <div className="text-sm font-medium text-dash-text capitalize">
                          {incident.type}
                        </div>
                        <div className="text-xs text-dash-muted">
                          Severity: {incident.severity}/5
                          {incident.description && ` • ${incident.description}`}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveIncident(incident.id)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Driver Profile Distribution */}
        <div className="bg-dash-card border border-dash-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-dash-text">Driver Profiles</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Aggressive', percent: 15, color: '#ef4444' },
              { label: 'Normal', percent: 60, color: '#22c55e' },
              { label: 'Cautious', percent: 20, color: '#f59e0b' },
              { label: 'Learner', percent: 5, color: '#8b5cf6' },
            ].map((profile) => (
              <div key={profile.label} className="bg-dash-bg/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: profile.color }}
                  />
                  <span className="text-sm text-dash-text">{profile.label}</span>
                </div>
                <div className="text-lg font-display font-bold text-dash-text">
                  {profile.percent}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

