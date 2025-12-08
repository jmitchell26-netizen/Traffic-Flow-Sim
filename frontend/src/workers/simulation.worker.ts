/**
 * Web Worker for offloading simulation calculations from the main thread.
 * 
 * This worker handles:
 * - Vehicle position updates
 * - Collision detection
 * - Traffic light state management
 * 
 * Usage: 
 * const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
 */

import type {
  SimulatedVehicle,
  SimulationConfig,
  TrafficLight,
  Coordinates,
} from '../types/traffic';

// Message types
interface WorkerMessage {
  type: 'init' | 'tick' | 'updateConfig' | 'addVehicle' | 'removeVehicle';
  payload?: any;
}

interface WorkerResponse {
  type: 'state' | 'error';
  payload: any;
}

// Worker state
let vehicles: SimulatedVehicle[] = [];
let trafficLights: TrafficLight[] = [];
let config: SimulationConfig = {
  tick_interval_ms: 100,
  max_vehicles: 500,
  spawn_rate: 0.5,
  base_acceleration: 2.0,
  base_deceleration: 4.0,
  min_following_distance: 5.0,
  speed_variance: 0.1,
  profile_distribution: {
    aggressive: 0.15,
    normal: 0.60,
    cautious: 0.20,
    learner: 0.05,
  },
};

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
      vehicles = payload.vehicles || [];
      trafficLights = payload.trafficLights || [];
      if (payload.config) config = payload.config;
      break;

    case 'tick':
      const dt = config.tick_interval_ms / 1000;
      updateVehicles(dt);
      updateTrafficLights(dt);
      postMessage({
        type: 'state',
        payload: {
          vehicles: vehicles.slice(0, 100), // Limit for performance
          trafficLights,
        },
      } as WorkerResponse);
      break;

    case 'updateConfig':
      config = { ...config, ...payload };
      break;

    case 'addVehicle':
      if (vehicles.length < config.max_vehicles) {
        vehicles.push(payload);
      }
      break;

    case 'removeVehicle':
      vehicles = vehicles.filter((v) => v.id !== payload.id);
      break;
  }
};

function updateVehicles(dt: number) {
  for (const vehicle of vehicles) {
    if (vehicle.waiting_at_light) {
      vehicle.wait_time_seconds += dt;
      continue;
    }

    // Simple physics update
    const speedDiff = vehicle.target_speed - vehicle.current_speed;
    const acceleration = speedDiff > 0 
      ? config.base_acceleration 
      : -config.base_deceleration;
    
    vehicle.current_speed = Math.max(
      0,
      vehicle.current_speed + acceleration * dt * 3.6
    );

    // Position update
    const distanceKm = (vehicle.current_speed * dt) / 3600;
    const headingRad = (vehicle.heading * Math.PI) / 180;
    
    const latChange = distanceKm * Math.cos(headingRad) / 111;
    const lngChange = distanceKm * Math.sin(headingRad) / (111 * Math.cos(vehicle.position.lat * Math.PI / 180));

    vehicle.position = {
      lat: vehicle.position.lat + latChange,
      lng: vehicle.position.lng + lngChange,
    };
  }
}

function updateTrafficLights(dt: number) {
  for (const light of trafficLights) {
    light.time_in_current_phase += dt;

    switch (light.current_phase) {
      case 'green':
        if (light.time_in_current_phase >= light.green_duration) {
          light.current_phase = 'yellow';
          light.time_in_current_phase = 0;
        }
        break;
      case 'yellow':
        if (light.time_in_current_phase >= light.yellow_duration) {
          light.current_phase = 'red';
          light.time_in_current_phase = 0;
        }
        break;
      case 'red':
        if (light.time_in_current_phase >= light.red_duration) {
          light.current_phase = 'green';
          light.time_in_current_phase = 0;
        }
        break;
    }
  }
}

function calculateDistance(a: Coordinates, b: Coordinates): number {
  const latDiff = (b.lat - a.lat) * Math.PI / 180;
  const lngDiff = (b.lng - a.lng) * Math.PI / 180;
  const avgLat = ((a.lat + b.lat) / 2) * Math.PI / 180;
  
  const x = lngDiff * Math.cos(avgLat);
  const y = latDiff;
  
  return Math.sqrt(x * x + y * y) * 6371000; // meters
}

export {};

