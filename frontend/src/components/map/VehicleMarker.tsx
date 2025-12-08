/**
 * VehicleMarker Component
 * 
 * Renders a simulated vehicle on the map with directional indicator.
 */

import { CircleMarker, Popup } from 'react-leaflet';
import { Car, Truck, Bike } from 'lucide-react';
import { type SimulatedVehicle, formatSpeed } from '../../types/traffic';

interface VehicleMarkerProps {
  vehicle: SimulatedVehicle;
}

const VEHICLE_COLORS = {
  car: '#3b82f6',
  truck: '#8b5cf6',
  motorcycle: '#10b981',
  bus: '#f59e0b',
  emergency: '#ef4444',
};

const PROFILE_LABELS = {
  aggressive: 'Aggressive',
  normal: 'Normal',
  cautious: 'Cautious',
  learner: 'Learner',
};

export function VehicleMarker({ vehicle }: VehicleMarkerProps) {
  const color = VEHICLE_COLORS[vehicle.vehicle_type];

  return (
    <CircleMarker
      center={[vehicle.position.lat, vehicle.position.lng]}
      radius={4}
      pathOptions={{
        color: vehicle.waiting_at_light ? '#ef4444' : color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: vehicle.waiting_at_light ? 2 : 1,
      }}
    >
      <Popup>
        <div className="min-w-[160px] p-1">
          <div className="flex items-center gap-2 mb-2">
            {vehicle.vehicle_type === 'car' && <Car className="w-4 h-4" />}
            {vehicle.vehicle_type === 'truck' && <Truck className="w-4 h-4" />}
            {vehicle.vehicle_type === 'motorcycle' && <Bike className="w-4 h-4" />}
            <span className="font-semibold capitalize">{vehicle.vehicle_type}</span>
            <span className="text-xs text-gray-500">#{vehicle.id}</span>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Speed</span>
              <span className="font-medium">{formatSpeed(vehicle.current_speed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Target</span>
              <span className="text-gray-500">{formatSpeed(vehicle.target_speed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Driver</span>
              <span className="font-medium">{PROFILE_LABELS[vehicle.driver_profile]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Heading</span>
              <span className="text-gray-500">{Math.round(vehicle.heading)}°</span>
            </div>
          </div>

          {vehicle.waiting_at_light && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-xs text-red-600 font-medium">
                ⏱ Waiting: {Math.round(vehicle.wait_time_seconds)}s
              </div>
            </div>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}

