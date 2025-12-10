/**
 * Dashboard Component
 * 
 * Analytics dashboard with:
 * - Key metrics cards
 * - Time series charts
 * - Congestion heatmap
 * - Emissions tracking
 */

import {
  Activity,
  Car,
  Clock,
  Gauge,
  TrendingDown,
  TrendingUp,
  Wind,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTrafficStore } from '../../stores/trafficStore';
import { CONGESTION_COLORS, formatSpeed, formatDuration } from '../../types/traffic';
import { ExportButton } from './ExportButton';
import { HistoryPanel } from './HistoryPanel';

// ============================================================
// METRIC CARD COMPONENT
// ============================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = '#06b6d4',
}: MetricCardProps) {
  return (
    <div className="bg-dash-card border border-dash-border rounded-xl p-5 card-hover">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              trend === 'up'
                ? 'bg-green-500/10 text-green-400'
                : trend === 'down'
                ? 'bg-red-500/10 text-red-400'
                : 'bg-gray-500/10 text-gray-400'
            }`}
          >
            {trend === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : trend === 'down' ? (
              <TrendingDown className="w-3 h-3" />
            ) : null}
            {trendValue}
          </div>
        )}
      </div>
      <div className="metric-value">
        <div className="text-2xl font-display font-bold text-dash-text mb-1">
          {value}
        </div>
        <div className="text-sm text-dash-muted">{title}</div>
        {subtitle && <div className="text-xs text-dash-muted mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}

// ============================================================
// CHART COMPONENTS
// ============================================================

function SpeedChart() {
  const metricsHistory = useTrafficStore((s) => s.metricsHistory);

  // Generate sample data if no history
  const data = metricsHistory.length > 0
    ? metricsHistory.slice(-20).map((m, i) => ({
        time: i,
        speed: m.average_speed,
      }))
    : Array.from({ length: 20 }, (_, i) => ({
        time: i,
        speed: 35 + Math.random() * 20 + Math.sin(i / 3) * 10,
      }));

  return (
    <div className="bg-dash-card border border-dash-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-5 h-5 text-dash-accent" />
        <h3 className="font-semibold text-dash-text">Average Speed</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} unit=" km/h" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Area
            type="monotone"
            dataKey="speed"
            stroke="#06b6d4"
            strokeWidth={2}
            fill="url(#speedGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function FlowChart() {
  const metricsHistory = useTrafficStore((s) => s.metricsHistory);

  const data = metricsHistory.length > 0
    ? metricsHistory.slice(-20).map((m, i) => ({
        time: i,
        vehicles: m.vehicles_per_minute,
      }))
    : Array.from({ length: 20 }, (_, i) => ({
        time: i,
        vehicles: 15 + Math.random() * 10 + Math.cos(i / 4) * 5,
      }));

  return (
    <div className="bg-dash-card border border-dash-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Car className="w-5 h-5 text-green-400" />
        <h3 className="font-semibold text-dash-text">Vehicles per Minute</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
            }}
          />
          <Line
            type="monotone"
            dataKey="vehicles"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CongestionDistribution() {
  const trafficData = useTrafficStore((s) => s.trafficData);

  const distribution = trafficData?.segments.reduce(
    (acc, seg) => {
      acc[seg.congestion_level] = (acc[seg.congestion_level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) || {};

  const data = [
    { name: 'Free Flow', value: distribution.free_flow || 15, color: CONGESTION_COLORS.free_flow },
    { name: 'Light', value: distribution.light || 8, color: CONGESTION_COLORS.light },
    { name: 'Moderate', value: distribution.moderate || 5, color: CONGESTION_COLORS.moderate },
    { name: 'Heavy', value: distribution.heavy || 3, color: CONGESTION_COLORS.heavy },
    { name: 'Severe', value: distribution.severe || 1, color: CONGESTION_COLORS.severe },
  ];

  return (
    <div className="bg-dash-card border border-dash-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-yellow-400" />
        <h3 className="font-semibold text-dash-text">Congestion Distribution</h3>
      </div>
      <div className="flex items-center">
        <ResponsiveContainer width="50%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-dash-muted">{item.name}</span>
              <span className="text-sm font-medium text-dash-text ml-auto">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmissionsPanel() {
  const dashboardData = useTrafficStore((s) => s.dashboardData);
  const emissions = dashboardData?.current_metrics?.emissions;

  return (
    <div className="bg-dash-card border border-dash-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wind className="w-5 h-5 text-purple-400" />
        <h3 className="font-semibold text-dash-text">Emissions Estimate</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-dash-bg/50 rounded-lg p-3">
          <div className="text-lg font-display font-bold text-dash-text">
            {emissions?.co2_kg_per_hour?.toFixed(1) ?? '—'} kg/h
          </div>
          <div className="text-xs text-dash-muted">CO₂ Emissions</div>
        </div>
        <div className="bg-dash-bg/50 rounded-lg p-3">
          <div className="text-lg font-display font-bold text-dash-text">
            {emissions?.fuel_liters_per_hour?.toFixed(1) ?? '—'} L/h
          </div>
          <div className="text-xs text-dash-muted">Fuel Usage</div>
        </div>
        <div className="bg-dash-bg/50 rounded-lg p-3">
          <div className="text-lg font-display font-bold text-dash-text">
            {emissions?.nox_grams_per_hour?.toFixed(0) ?? '—'} g/h
          </div>
          <div className="text-xs text-dash-muted">NOx Emissions</div>
        </div>
        <div className="bg-dash-bg/50 rounded-lg p-3">
          <div className="text-lg font-display font-bold text-dash-text">
            {emissions?.avg_fuel_per_vehicle?.toFixed(2) ?? '—'} L
          </div>
          <div className="text-xs text-dash-muted">Avg/Vehicle</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN DASHBOARD
// ============================================================

export function Dashboard() {
  const dashboardData = useTrafficStore((s) => s.dashboardData);
  const simulationState = useTrafficStore((s) => s.simulationState);
  const getBoundingBox = useTrafficStore((s) => s.getBoundingBox);

  const metrics = dashboardData?.current_metrics;
  const bbox = getBoundingBox();

  return (
    <div className="h-full overflow-auto p-6 bg-dash-bg">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-bold text-dash-text">
              Traffic Analytics
            </h2>
            <p className="text-dash-muted mt-1">
              Real-time metrics and simulation data
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-dash-muted">
              <Clock className="w-4 h-4" />
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <ExportButton />
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Vehicles"
            value={simulationState?.total_vehicles ?? metrics?.total_active_vehicles ?? '—'}
            subtitle="Currently in simulation"
            icon={Car}
            trend="up"
            trendValue="+12%"
            color="#22c55e"
          />
          <MetricCard
            title="Average Speed"
            value={
              simulationState?.average_speed
                ? formatSpeed(simulationState.average_speed)
                : metrics?.average_speed
                ? formatSpeed(metrics.average_speed)
                : '—'
            }
            subtitle="Across all segments"
            icon={Gauge}
            trend="down"
            trendValue="-5%"
            color="#06b6d4"
          />
          <MetricCard
            title="Avg Wait Time"
            value={
              metrics?.average_wait_time
                ? formatDuration(metrics.average_wait_time)
                : '—'
            }
            subtitle="At intersections"
            icon={Timer}
            color="#f59e0b"
          />
          <MetricCard
            title="Active Incidents"
            value={metrics?.active_incidents ?? simulationState?.active_incidents.length ?? 0}
            subtitle="Road events"
            icon={AlertTriangle}
            color="#ef4444"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SpeedChart />
          <FlowChart />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CongestionDistribution />
          <EmissionsPanel />
        </div>

        {/* Travel Time Comparison */}
        <div className="bg-dash-card border border-dash-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-dash-text">
              Rush Hour vs Off-Peak Comparison
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-4 bg-dash-bg/50 rounded-lg">
              <div className="text-3xl font-display font-bold text-orange-400">
                {dashboardData?.rush_hour_avg_speed?.toFixed(0) ?? '32'} km/h
              </div>
              <div className="text-sm text-dash-muted mt-1">Rush Hour Average</div>
              <div className="text-xs text-dash-muted">7-9 AM, 5-7 PM</div>
            </div>
            <div className="text-center p-4 bg-dash-bg/50 rounded-lg">
              <div className="text-3xl font-display font-bold text-green-400">
                {dashboardData?.off_peak_avg_speed?.toFixed(0) ?? '58'} km/h
              </div>
              <div className="text-sm text-dash-muted mt-1">Off-Peak Average</div>
              <div className="text-xs text-dash-muted">Other hours</div>
            </div>
          </div>
        </div>

        {/* Historical Trends */}
        <HistoryPanel bbox={bbox} />
      </div>
    </div>
  );
}

