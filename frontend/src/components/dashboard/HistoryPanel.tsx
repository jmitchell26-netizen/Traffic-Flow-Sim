/**
 * HistoryPanel Component
 * 
 * Displays historical traffic trends and time series data.
 */

import { useState, useEffect } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { BoundingBox } from '../../types/traffic';
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
} from 'recharts';

interface HistoryPanelProps {
  bbox?: BoundingBox;
}

type TimeRange = 'hour' | 'day' | 'week';

export function HistoryPanel({ bbox }: HistoryPanelProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('hour');
  const [historyData, setHistoryData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!bbox) return;
      
      // Validate bounding box
      if (isNaN(bbox.north) || isNaN(bbox.south) || isNaN(bbox.east) || isNaN(bbox.west)) {
        return;
      }
      
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          time_range: timeRange,
          north: bbox.north.toString(),
          south: bbox.south.toString(),
          east: bbox.east.toString(),
          west: bbox.west.toString(),
        });
        
        const response = await fetch(`/api/traffic/history?${params}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setHistoryData(data);
      } catch (err) {
        console.error('Failed to fetch history:', err);
        setHistoryData(null); // Clear data on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [timeRange, bbox]);

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: 'hour', label: 'Last Hour' },
    { value: 'day', label: 'Last 24 Hours' },
    { value: 'week', label: 'Last Week' },
  ];

  const chartData = historyData?.snapshots?.map((snapshot: any) => ({
    time: new Date(snapshot.timestamp).toLocaleTimeString(),
    speedRatio: snapshot.summary?.average_speed_ratio * 100 || 0,
    congested: snapshot.summary?.congested_segments || 0,
  })) || [];

  const getTrendIcon = () => {
    if (!historyData) return null;
    const trend = historyData.trend;
    if (trend === 'improving') {
      return <TrendingUp className="w-5 h-5 text-green-400" />;
    } else if (trend === 'worsening') {
      return <TrendingDown className="w-5 h-5 text-red-400" />;
    } else {
      return <Minus className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    if (!historyData) return 'text-gray-400';
    const trend = historyData.trend;
    if (trend === 'improving') return 'text-green-400';
    if (trend === 'worsening') return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-dash-card border border-dash-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-dash-accent" />
          <h3 className="font-semibold text-dash-text">Historical Trends</h3>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {timeRangeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeRange(option.value)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                timeRange === option.value
                  ? 'bg-dash-accent text-white'
                  : 'bg-dash-bg text-dash-muted hover:bg-dash-border'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-dash-muted">
          Loading historical data...
        </div>
      ) : historyData && historyData.snapshot_count > 0 ? (
        <>
          {/* Trend Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-dash-bg/50 rounded-lg">
              <div className="text-2xl font-bold text-dash-text">
                {historyData.snapshot_count}
              </div>
              <div className="text-xs text-dash-muted mt-1">Snapshots</div>
            </div>
            <div className="text-center p-3 bg-dash-bg/50 rounded-lg">
              <div className="text-2xl font-bold text-dash-text">
                {Math.round(historyData.average_speed_ratio * 100)}%
              </div>
              <div className="text-xs text-dash-muted mt-1">Avg Speed</div>
            </div>
            <div className="text-center p-3 bg-dash-bg/50 rounded-lg">
              <div className={`flex items-center justify-center gap-1 text-2xl font-bold ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="capitalize">{historyData.trend}</span>
              </div>
              <div className="text-xs text-dash-muted mt-1">Trend</div>
            </div>
          </div>

          {/* Speed Ratio Chart */}
          {chartData.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-dash-text mb-2">Speed Ratio Over Time</h4>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="speedHistoryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#64748b" 
                    fontSize={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10}
                    domain={[0, 100]}
                    label={{ value: '%', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="speedRatio"
                    stroke="#06b6d4"
                    fillOpacity={1}
                    fill="url(#speedHistoryGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Congestion Chart */}
          {chartData.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-dash-text mb-2">Congested Segments Over Time</h4>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#64748b" 
                    fontSize={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="congested"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <div className="h-64 flex items-center justify-center text-dash-muted">
          <div className="text-center">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No historical data available</p>
            <p className="text-xs mt-1">Data will be collected over time</p>
          </div>
        </div>
      )}
    </div>
  );
}

