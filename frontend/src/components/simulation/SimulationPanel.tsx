/**
 * SimulationPanel Component
 * 
 * Control panel for the traffic simulation with:
 * - Start/stop/reset controls
 * - Configuration sliders
 * - Traffic light timing adjustments
 * - Incident creation
 */

import { useState } from 'react';
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
  Car,
  Gauge,
  Users,
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
}

function SliderInput({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
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
        className="w-full h-2 bg-dash-border rounded-lg appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:w-4
                   [&::-webkit-slider-thumb]:h-4
                   [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-dash-accent
                   [&::-webkit-slider-thumb]:cursor-pointer"
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
  const [config, setConfig] = useState<Partial<SimulationConfig>>({
    tick_interval_ms: 100,
    max_vehicles: 200,
    spawn_rate: 0.5,
  });

  const {
    simulationState,
    isSimulationRunning,
    setIsSimulationRunning,
    setSimulationState,
    incidents,
    addIncident,
    removeIncident,
    setError,
  } = useTrafficStore();

  const handleStart = async () => {
    try {
      await simulationApi.start();
      setIsSimulationRunning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start simulation');
    }
  };

  const handleStop = async () => {
    try {
      await simulationApi.stop();
      setIsSimulationRunning(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop simulation');
    }
  };

  const handleReset = async () => {
    try {
      const result = await simulationApi.reset();
      setSimulationState(result.state);
      setIsSimulationRunning(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset simulation');
    }
  };

  const handleConfigChange = async (key: keyof SimulationConfig, value: number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    
    try {
      await simulationApi.updateConfig(newConfig);
    } catch (err) {
      console.error('Failed to update config:', err);
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
      setShowIncidentForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add incident');
    }
  };

  const handleRemoveIncident = async (id: string) => {
    try {
      await simulationApi.removeIncident(id);
      removeIncident(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove incident');
    }
  };

  return (
    <div className="h-full overflow-auto p-6 bg-dash-bg">
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
          </div>
        </div>

        {/* Traffic Light Timing (placeholder) */}
        <div className="bg-dash-card border border-dash-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-dash-text">Traffic Light Timing</h3>
          </div>
          <div className="space-y-4">
            <SliderInput
              label="Green Duration"
              value={30}
              min={10}
              max={120}
              step={5}
              unit="s"
              onChange={() => {}}
            />
            <SliderInput
              label="Yellow Duration"
              value={5}
              min={3}
              max={10}
              step={1}
              unit="s"
              onChange={() => {}}
            />
            <SliderInput
              label="Red Duration"
              value={30}
              min={10}
              max={120}
              step={5}
              unit="s"
              onChange={() => {}}
            />
          </div>
          <p className="text-xs text-dash-muted mt-3">
            * Add intersections on the map to customize individual light timings
          </p>
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

