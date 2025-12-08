/**
 * SegmentPopup Component
 * 
 * Popup content for road segment markers showing traffic details.
 */

import { ArrowRight, Clock, Gauge } from 'lucide-react';
import {
  CONGESTION_COLORS,
  getCongestionLabel,
  formatSpeed,
  formatDuration,
  type RoadSegment,
} from '../../types/traffic';

interface SegmentPopupProps {
  segment: RoadSegment;
}

export function SegmentPopup({ segment }: SegmentPopupProps) {
  const delayMinutes = Math.round(segment.delay_seconds / 60);
  const speedPercent = Math.round(segment.speed_ratio * 100);

  return (
    <div className="min-w-[200px] p-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: CONGESTION_COLORS[segment.congestion_level] }}
        />
        <span className="font-semibold text-gray-900">
          {segment.name || 'Road Segment'}
        </span>
      </div>

      {/* Congestion status */}
      <div
        className="text-sm font-medium px-2 py-1 rounded mb-3 text-center"
        style={{
          backgroundColor: `${CONGESTION_COLORS[segment.congestion_level]}20`,
          color: CONGESTION_COLORS[segment.congestion_level],
        }}
      >
        {getCongestionLabel(segment.congestion_level)}
      </div>

      {/* Metrics */}
      <div className="space-y-2 text-sm">
        {/* Speed comparison */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Gauge className="w-4 h-4" />
            <span>Speed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{formatSpeed(segment.free_flow_speed)}</span>
            <ArrowRight className="w-3 h-3 text-gray-400" />
            <span className="font-medium text-gray-900">
              {formatSpeed(segment.current_speed)}
            </span>
          </div>
        </div>

        {/* Travel time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Clock className="w-4 h-4" />
            <span>Travel Time</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">
              {formatDuration(segment.free_flow_travel_time)}
            </span>
            <ArrowRight className="w-3 h-3 text-gray-400" />
            <span className="font-medium text-gray-900">
              {formatDuration(segment.current_travel_time)}
            </span>
          </div>
        </div>

        {/* Delay */}
        {segment.delay_seconds > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-gray-600">Delay</span>
            <span className="font-medium text-red-600">
              +{formatDuration(segment.delay_seconds)}
            </span>
          </div>
        )}

        {/* Speed ratio bar */}
        <div className="pt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Speed Ratio</span>
            <span>{speedPercent}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${speedPercent}%`,
                backgroundColor: CONGESTION_COLORS[segment.congestion_level],
              }}
            />
          </div>
        </div>
      </div>

      {/* Road type */}
      {segment.road_type && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Road class: {segment.road_type}
          </span>
        </div>
      )}
    </div>
  );
}

