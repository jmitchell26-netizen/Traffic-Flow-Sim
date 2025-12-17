/**
 * AlertManager Component
 * 
 * Manages user-defined traffic alerts.
 * Allows creating, editing, and deleting alerts.
 */

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, X } from 'lucide-react';
import { alertsApi } from '../../services/api';
import { useTrafficStore } from '../../stores/trafficStore';

// TODO: Properly type TrafficAlert when types are fixed
type TrafficAlert = any;

export function AlertManager() {
  const [alerts, setAlerts] = useState<TrafficAlert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // const [editingAlert, setEditingAlert] = useState<TrafficAlert | null>(null);
  // const mapView = useTrafficStore((s) => s.mapView);
  const getBoundingBox = useTrafficStore((s) => s.getBoundingBox);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const data = await alertsApi.getAlerts();
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const name = formData.get('name') as string;
    if (!name || name.trim().length === 0) {
      alert('Please enter an alert name');
      return;
    }
    
    const bbox = getBoundingBox();
    const conditions: Record<string, any> = {};
    
    const congestionLevel = formData.get('congestion_level') as string;
    if (congestionLevel) {
      conditions.congestion_level = congestionLevel;
      const count = formData.get('congestion_count') as string;
      conditions.congestion_count = count ? parseInt(count) || 1 : 1;
    }
    
    const delayThreshold = formData.get('delay_threshold') as string;
    if (delayThreshold && delayThreshold.trim()) {
      const minutes = parseInt(delayThreshold);
      if (!isNaN(minutes) && minutes > 0) {
        conditions.delay_threshold = minutes * 60; // Convert minutes to seconds
      }
    }
    
    const speedThreshold = formData.get('speed_threshold') as string;
    if (speedThreshold && speedThreshold.trim()) {
      const percent = parseFloat(speedThreshold);
      if (!isNaN(percent) && percent >= 0 && percent <= 100) {
        conditions.speed_ratio_threshold = percent / 100;
      }
    }

    // Ensure at least one condition is set
    if (Object.keys(conditions).length === 0) {
      alert('Please set at least one alert condition');
      return;
    }

    try {
      await alertsApi.createAlert({
        name: name.trim(),
        north: bbox.north,
        south: bbox.south,
        east: bbox.east,
        west: bbox.west,
        conditions,
      });
      await loadAlerts();
      setIsCreating(false);
      e.currentTarget.reset();
    } catch (err) {
      console.error('Failed to create alert:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create alert';
      alert(`Failed to create alert: ${errorMessage}`);
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm('Delete this alert?')) return;
    
    try {
      await alertsApi.deleteAlert(alertId);
      await loadAlerts();
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  const handleToggle = async (alert: TrafficAlert) => {
    try {
      await alertsApi.updateAlert(alert.id, { enabled: !alert.enabled });
      await loadAlerts();
    } catch (err) {
      console.error('Failed to update alert:', err);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-dash-card border border-dash-border rounded-lg text-dash-text hover:bg-dash-border transition-colors relative"
        title="Manage Alerts"
      >
        <Bell className="w-4 h-4" />
        <span className="text-sm font-medium">Alerts</span>
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-dash-accent text-white text-xs rounded-full flex items-center justify-center">
            {alerts.filter(a => a.enabled).length}
          </span>
        )}
      </button>

      {/* Alert Panel */}
      {isOpen && (
        <div className="absolute top-16 right-4 z-[2000] w-96 bg-dash-card border border-dash-border rounded-lg shadow-lg max-h-[80vh] overflow-y-auto">
          <div className="p-4 border-b border-dash-border flex items-center justify-between">
            <h3 className="font-semibold text-dash-text">Traffic Alerts</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreating(!isCreating)}
                className="p-1 text-dash-accent hover:bg-dash-border rounded"
                title="Create Alert"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-dash-muted hover:text-dash-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Create Form */}
            {isCreating && (
              <form onSubmit={handleCreate} className="p-4 bg-dash-bg rounded-lg space-y-3 border border-dash-border">
                <h4 className="font-medium text-dash-text mb-2">Create Alert</h4>
                
                <input
                  name="name"
                  placeholder="Alert name"
                  required
                  className="w-full px-3 py-2 bg-dash-card border border-dash-border rounded text-dash-text text-sm"
                />

                <div className="text-xs text-dash-muted mb-2">Alert Conditions (select at least one):</div>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-dash-muted">Congestion Level</label>
                    <select
                      name="congestion_level"
                      className="w-full px-2 py-1 bg-dash-card border border-dash-border rounded text-dash-text text-sm"
                    >
                      <option value="">None</option>
                      <option value="heavy">Heavy</option>
                      <option value="severe">Severe</option>
                    </select>
                    <input
                      name="congestion_count"
                      type="number"
                      placeholder="Min segments"
                      min="1"
                      className="w-full mt-1 px-2 py-1 bg-dash-card border border-dash-border rounded text-dash-text text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-dash-muted">Delay Threshold (minutes)</label>
                    <input
                      name="delay_threshold"
                      type="number"
                      placeholder="e.g., 5"
                      min="1"
                      className="w-full px-2 py-1 bg-dash-card border border-dash-border rounded text-dash-text text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-dash-muted">Speed Ratio Threshold (%)</label>
                    <input
                      name="speed_threshold"
                      type="number"
                      placeholder="e.g., 50"
                      min="0"
                      max="100"
                      className="w-full px-2 py-1 bg-dash-card border border-dash-border rounded text-dash-text text-sm"
                    />
                  </div>
                </div>

                <div className="text-xs text-dash-muted">
                  Alert area: Current map view
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 px-3 py-2 text-sm border border-dash-border rounded hover:bg-dash-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-3 py-2 text-sm bg-dash-accent text-white rounded hover:bg-dash-accent/90"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {/* Alerts List */}
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-dash-muted text-sm">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No alerts yet</p>
                <p className="text-xs mt-1">Create an alert to get notified about traffic conditions</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.enabled ? 'border-dash-accent bg-dash-accent/10' : 'border-dash-border bg-dash-bg'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-dash-text">{alert.name}</div>
                      <div className="text-xs text-dash-muted mt-1">
                        {Object.entries(alert.conditions)
                          .filter(([k]) => k !== 'congestion_count')
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(alert)}
                        className={`px-2 py-1 text-xs rounded ${
                          alert.enabled
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {alert.enabled ? 'On' : 'Off'}
                      </button>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

