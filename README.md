# 🚦 Traffic Flow Simulation + Data Dashboard

A hybrid real-time traffic data and simulation system that combines live TomTom Traffic API data with a custom vehicle simulation engine, presented through an interactive dashboard.

![Dashboard Preview](docs/dashboard-preview.png)

## ✨ Features

### Real-Time Traffic Data
- Live traffic flow data from TomTom Traffic API
- Color-coded road segments by congestion level
- Traffic incident tracking and display
- Automatic data refresh every 60 seconds

### Traffic Simulation Engine
- Simulated vehicles with behavior profiles (aggressive, normal, cautious, learner)
- Traffic light control with adjustable timing
- User-created incidents (accidents, closures, construction)
- Real-time speed and position updates

### Analytics Dashboard
- Average speed and flow rate charts
- Congestion distribution visualization
- Emissions and fuel usage estimates
- Rush hour vs off-peak comparisons
- Intersection-specific metrics

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Map View   │  │  Dashboard  │  │  Simulation Controls    │  │
│  │  (Leaflet)  │  │  (Recharts) │  │  (Config & Incidents)   │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│  ┌──────┴────────────────┴──────────────────────┴──────────┐    │
│  │              Zustand State Management                    │    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                             │ HTTP/WebSocket                     │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│                         BACKEND                                  │
│  ┌──────────────────────────┴───────────────────────────────┐   │
│  │                    FastAPI Server                         │   │
│  │  /traffic/*    /simulation/*    /dashboard/*              │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│         │                   │                     │              │
│  ┌──────┴──────┐  ┌─────────┴─────────┐  ┌───────┴───────┐     │
│  │  TomTom     │  │  Simulation       │  │  Analytics    │     │
│  │  Service    │  │  Engine           │  │  Service      │     │
│  └──────┬──────┘  └───────────────────┘  └───────────────┘     │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
    ┌─────┴─────┐
    │  TomTom   │
    │  API      │
    └───────────┘
```

## 📁 Project Structure

```
traffic-flow-sim/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py          # FastAPI route definitions
│   │   ├── core/
│   │   │   └── config.py          # Pydantic settings
│   │   ├── models/
│   │   │   └── traffic.py         # Data models
│   │   ├── services/
│   │   │   └── tomtom.py          # TomTom API wrapper
│   │   ├── simulation/
│   │   │   └── engine.py          # Traffic simulation engine
│   │   └── main.py                # FastAPI application
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── map/               # Map components
│   │   │   ├── dashboard/         # Dashboard charts
│   │   │   └── simulation/        # Simulation controls
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── stores/
│   │   │   └── trafficStore.ts    # Zustand store
│   │   ├── services/
│   │   │   └── api.ts             # API client
│   │   ├── types/
│   │   │   └── traffic.ts         # TypeScript types
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── docs/
├── env.example
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- TomTom API Key ([Get one free](https://developer.tomtom.com/))

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp ../env.example .env
# Edit .env and add your TOMTOM_API_KEY

# Run the server
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend runs at `http://localhost:5173`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TOMTOM_API_KEY` | Your TomTom API key | *Required* |
| `BACKEND_HOST` | Backend server host | `0.0.0.0` |
| `BACKEND_PORT` | Backend server port | `8000` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:5173` |
| `TRAFFIC_POLL_INTERVAL_SECONDS` | Data refresh interval | `60` |
| `DEFAULT_MAP_CENTER_LAT` | Default map latitude | `40.7128` (NYC) |
| `DEFAULT_MAP_CENTER_LNG` | Default map longitude | `-74.0060` |
| `SIMULATION_TICK_MS` | Simulation update interval | `100` |
| `MAX_SIMULATED_VEHICLES` | Max vehicles in simulation | `500` |

## 📚 API Reference

### Traffic Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/traffic/flow` | Get traffic flow data for a bounding box |
| GET | `/traffic/segment` | Get data for a single road segment |
| GET | `/traffic/incidents` | Get traffic incidents |
| GET | `/traffic/congestion` | Get congestion summary |

### Simulation Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/simulation/state` | Get current simulation state |
| POST | `/simulation/start` | Start simulation |
| POST | `/simulation/stop` | Stop simulation |
| POST | `/simulation/reset` | Reset simulation |
| GET | `/simulation/config` | Get simulation config |
| PUT | `/simulation/config` | Update simulation config |
| POST | `/simulation/intersection` | Add an intersection |
| PUT | `/simulation/traffic-light` | Adjust traffic light timing |
| POST | `/simulation/incident` | Add a traffic incident |
| DELETE | `/simulation/incident/{id}` | Remove an incident |
| WS | `/simulation/ws` | WebSocket for real-time updates |

### Dashboard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/metrics` | Get current traffic metrics |
| GET | `/dashboard/data` | Get complete dashboard data |
| GET | `/dashboard/intersection/{id}` | Get intersection metrics |

## 🎮 Simulation Engine

### Vehicle Behavior

Vehicles in the simulation have different behavior profiles:

| Profile | Speed Modifier | Acceleration | Following Distance |
|---------|---------------|--------------|-------------------|
| Aggressive | +20% | +30% | -20% |
| Normal | 100% | 100% | 100% |
| Cautious | -15% | -30% | +20% |
| Learner | -30% | -50% | +40% |

### Traffic Light Cycles

Traffic lights follow standard phase cycles:
- **Green** → **Yellow** → **Red** → **Green**

Default timings (adjustable):
- Green: 30 seconds
- Yellow: 5 seconds
- Red: 30 seconds

### Emissions Model

Simplified emissions estimates based on:
- Number of active vehicles
- Average speed (deviation from optimal ~60 km/h increases emissions)
- Vehicle types

## 📈 Implementation Phases

### Phase 1: Setup ✅
- [x] Project structure
- [x] Environment configuration
- [x] Basic dependencies

### Phase 2: Traffic Data Ingestion ✅
- [x] TomTom API wrapper
- [x] Data normalization
- [x] Backend routes

### Phase 3: Map Rendering ✅
- [x] Leaflet integration
- [x] Congestion color coding
- [x] Interactive popups

### Phase 4: Simulation Engine ✅
- [x] Vehicle spawning
- [x] Movement physics
- [x] Driver profiles

### Phase 5: Traffic Control ✅
- [x] Traffic light model
- [x] Adjustable timing
- [x] Intersection management

### Phase 6: Dashboard ✅
- [x] Metrics cards
- [x] Time series charts
- [x] Congestion distribution

### Phase 7: Advanced Metrics ✅
- [x] Emissions calculations
- [x] Wait time tracking
- [x] Speed analysis

### Phase 8: Polish 🚧
- [ ] UI animations
- [ ] Export reports
- [ ] Performance optimization

## 🎯 Stretch Goals

- [ ] **Predictive Congestion**: ML-based traffic prediction
- [ ] **Replay Mode**: View historical traffic as timeline
- [ ] **Save/Load States**: Persist simulation states
- [ ] **Sandbox Mode**: Build custom road networks

## 🛠 Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **Pydantic** - Data validation
- **httpx** - Async HTTP client
- **uvicorn** - ASGI server

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Zustand** - State management
- **Leaflet** - Map rendering
- **Recharts** - Charts and graphs
- **Tailwind CSS** - Styling
- **Lucide** - Icons

## 📝 Data Models

### Road Segment
```typescript
interface RoadSegment {
  id: string;
  name?: string;
  coordinates: Coordinates[];
  current_speed: number;        // km/h
  free_flow_speed: number;      // km/h
  current_travel_time: number;  // seconds
  free_flow_travel_time: number;
  congestion_level: CongestionLevel;
  delay_seconds: number;
  speed_ratio: number;          // 0-1
}
```

### Simulated Vehicle
```typescript
interface SimulatedVehicle {
  id: string;
  vehicle_type: VehicleType;
  driver_profile: DriverProfile;
  position: Coordinates;
  heading: number;              // degrees
  current_speed: number;        // km/h
  target_speed: number;
  waiting_at_light: boolean;
  wait_time_seconds: number;
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [TomTom](https://developer.tomtom.com/) for the Traffic API
- [OpenStreetMap](https://www.openstreetmap.org/) contributors
- [CARTO](https://carto.com/) for dark map tiles

