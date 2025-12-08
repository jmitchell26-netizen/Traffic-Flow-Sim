"""
FastAPI route definitions.
All API endpoints for traffic data, simulation control, and dashboard metrics.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from ..models.traffic import (
    BoundingBox,
    Coordinates,
    DashboardData,
    Intersection,
    SimulationConfig,
    SimulationState,
    TrafficFlowData,
    TrafficIncident,
    TrafficLight,
    TrafficLightPhase,
    TrafficMetrics,
    TimeSeriesDataPoint,
)
from ..services.tomtom import get_tomtom_service
from ..simulation.engine import get_simulation_engine


# Create routers
traffic_router = APIRouter(prefix="/traffic", tags=["Traffic Data"])
simulation_router = APIRouter(prefix="/simulation", tags=["Simulation"])
dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class BBoxRequest(BaseModel):
    """Bounding box request for traffic data."""
    north: float
    south: float
    east: float
    west: float


class PointRequest(BaseModel):
    """Single point request."""
    lat: float
    lng: float
    zoom: int = 12


class TrafficLightTimingRequest(BaseModel):
    """Request to adjust traffic light timing."""
    light_id: str
    green_duration: Optional[int] = None
    yellow_duration: Optional[int] = None
    red_duration: Optional[int] = None


class IncidentRequest(BaseModel):
    """Request to add a traffic incident."""
    type: str
    lat: float
    lng: float
    description: Optional[str] = None
    severity: int = 3


class IntersectionRequest(BaseModel):
    """Request to add an intersection."""
    lat: float
    lng: float
    name: Optional[str] = None
    green_duration: int = 30
    yellow_duration: int = 5
    red_duration: int = 30


# ============================================================
# TRAFFIC DATA ENDPOINTS
# ============================================================

@traffic_router.get("/flow")
async def get_traffic_flow(
    north: float,
    south: float,
    east: float,
    west: float
) -> TrafficFlowData:
    """
    Get real-time traffic flow data for a bounding box.
    
    Returns congestion levels, speeds, and travel times for all
    road segments within the specified area.
    """
    tomtom = get_tomtom_service()
    bbox = BoundingBox(north=north, south=south, east=east, west=west)
    
    try:
        data = await tomtom.get_traffic_flow_tiles(bbox)
        
        # Also update simulation with real data
        engine = get_simulation_engine()
        engine.update_real_traffic_data(data)
        
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch traffic data: {str(e)}")


@traffic_router.get("/segment")
async def get_segment_data(lat: float, lng: float, zoom: int = 12):
    """
    Get traffic data for a single road segment near a point.
    """
    tomtom = get_tomtom_service()
    point = Coordinates(lat=lat, lng=lng)
    
    segment = await tomtom.get_flow_segment_data(point, zoom)
    if segment is None:
        raise HTTPException(status_code=404, detail="No segment found at this location")
    
    return segment


@traffic_router.get("/incidents")
async def get_incidents(
    north: float,
    south: float,
    east: float,
    west: float
) -> list[TrafficIncident]:
    """
    Get traffic incidents within a bounding box.
    """
    tomtom = get_tomtom_service()
    bbox = BoundingBox(north=north, south=south, east=east, west=west)
    
    return await tomtom.get_incidents(bbox)


@traffic_router.get("/congestion")
async def get_congestion_summary(
    north: float,
    south: float,
    east: float,
    west: float
):
    """
    Get a summary of congestion levels for an area.
    Returns aggregated statistics.
    """
    tomtom = get_tomtom_service()
    bbox = BoundingBox(north=north, south=south, east=east, west=west)
    
    data = await tomtom.get_traffic_flow_tiles(bbox)
    
    # Aggregate by congestion level
    level_counts = {}
    for segment in data.segments:
        level = segment.congestion_level.value
        level_counts[level] = level_counts.get(level, 0) + 1
    
    return {
        "bounding_box": bbox.model_dump(),
        "total_segments": data.total_segments,
        "congested_segments": data.congested_segments,
        "average_speed_ratio": data.average_speed_ratio,
        "level_distribution": level_counts,
        "timestamp": data.timestamp.isoformat(),
    }


# ============================================================
# SIMULATION ENDPOINTS
# ============================================================

@simulation_router.get("/state")
async def get_simulation_state() -> SimulationState:
    """
    Get the current simulation state.
    """
    engine = get_simulation_engine()
    return engine.state


@simulation_router.post("/start")
async def start_simulation():
    """
    Start the simulation engine.
    """
    engine = get_simulation_engine()
    if engine._running:
        return {"status": "already_running"}
    
    # Start in background (in production, use proper task management)
    import asyncio
    asyncio.create_task(engine.start())
    
    return {"status": "started"}


@simulation_router.post("/stop")
async def stop_simulation():
    """
    Stop the simulation engine.
    """
    engine = get_simulation_engine()
    engine.stop()
    return {"status": "stopped"}


@simulation_router.post("/reset")
async def reset_simulation():
    """
    Reset the simulation to initial state.
    """
    engine = get_simulation_engine()
    engine.reset()
    return {"status": "reset", "state": engine.state}


@simulation_router.get("/config")
async def get_simulation_config() -> SimulationConfig:
    """
    Get current simulation configuration.
    """
    engine = get_simulation_engine()
    return engine.config


@simulation_router.put("/config")
async def update_simulation_config(config: SimulationConfig):
    """
    Update simulation configuration.
    """
    engine = get_simulation_engine()
    engine.config = config
    return {"status": "updated", "config": config}


@simulation_router.post("/intersection")
async def add_intersection(request: IntersectionRequest):
    """
    Add a new intersection to the simulation.
    """
    engine = get_simulation_engine()
    
    import uuid
    intersection_id = str(uuid.uuid4())[:8]
    light_id = str(uuid.uuid4())[:8]
    
    intersection = Intersection(
        id=intersection_id,
        location=Coordinates(lat=request.lat, lng=request.lng),
        name=request.name,
        traffic_lights=[
            TrafficLight(
                id=light_id,
                location=Coordinates(lat=request.lat, lng=request.lng),
                green_duration=request.green_duration,
                yellow_duration=request.yellow_duration,
                red_duration=request.red_duration,
            )
        ]
    )
    
    engine.add_intersection(intersection)
    return {"status": "added", "intersection": intersection}


@simulation_router.put("/traffic-light")
async def adjust_traffic_light(request: TrafficLightTimingRequest):
    """
    Adjust traffic light timing.
    """
    engine = get_simulation_engine()
    engine.adjust_traffic_light_timing(
        light_id=request.light_id,
        green_duration=request.green_duration,
        yellow_duration=request.yellow_duration,
        red_duration=request.red_duration,
    )
    return {"status": "updated"}


@simulation_router.post("/incident")
async def add_incident(request: IncidentRequest):
    """
    Add a traffic incident to the simulation.
    """
    engine = get_simulation_engine()
    
    import uuid
    incident = TrafficIncident(
        id=str(uuid.uuid4())[:8],
        type=request.type,
        location=Coordinates(lat=request.lat, lng=request.lng),
        description=request.description,
        severity=request.severity,
        start_time=datetime.utcnow(),
    )
    
    engine.add_incident(incident)
    return {"status": "added", "incident": incident}


@simulation_router.delete("/incident/{incident_id}")
async def remove_incident(incident_id: str):
    """
    Remove a traffic incident from the simulation.
    """
    engine = get_simulation_engine()
    engine.remove_incident(incident_id)
    return {"status": "removed"}


# ============================================================
# DASHBOARD ENDPOINTS
# ============================================================

@dashboard_router.get("/metrics")
async def get_dashboard_metrics() -> TrafficMetrics:
    """
    Get current traffic metrics for dashboard display.
    """
    engine = get_simulation_engine()
    state = engine.state
    emissions = engine.calculate_emissions()
    
    # Calculate congestion index (0-1 scale based on average speed)
    optimal_speed = 60
    congestion_index = max(0, min(1, 1 - (state.average_speed / optimal_speed)))
    
    return TrafficMetrics(
        timestamp=state.timestamp,
        average_speed=state.average_speed,
        vehicles_per_minute=len(state.vehicles) / max(1, state.tick * engine.config.tick_interval_ms / 60000),
        congestion_index=congestion_index,
        average_wait_time=state.total_wait_time / max(1, len(state.vehicles)),
        average_travel_time_delta=0,  # Would need baseline data
        total_active_vehicles=state.total_vehicles,
        vehicles_waiting=sum(1 for v in state.vehicles if v.waiting_at_light),
        active_incidents=len(state.active_incidents),
        emissions=emissions,
    )


@dashboard_router.get("/data")
async def get_dashboard_data() -> DashboardData:
    """
    Get complete dashboard data package.
    """
    metrics = await get_dashboard_metrics()
    
    # In a real implementation, these would come from a time-series store
    return DashboardData(
        current_metrics=metrics,
        speed_history=[],
        flow_history=[],
        congestion_history=[],
    )


@dashboard_router.get("/intersection/{intersection_id}")
async def get_intersection_metrics(intersection_id: str):
    """
    Get metrics for a specific intersection.
    """
    engine = get_simulation_engine()
    
    for intersection in engine.state.intersections:
        if intersection.id == intersection_id:
            # Count vehicles near this intersection
            nearby_vehicles = [
                v for v in engine.state.vehicles
                if engine._calculate_distance(v.position, intersection.location) < 100
            ]
            
            return {
                "intersection": intersection,
                "nearby_vehicles": len(nearby_vehicles),
                "waiting_vehicles": sum(1 for v in nearby_vehicles if v.waiting_at_light),
                "average_wait_time": intersection.average_wait_time,
            }
    
    raise HTTPException(status_code=404, detail="Intersection not found")


# ============================================================
# WEBSOCKET ENDPOINTS (Real-time updates)
# ============================================================

class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""
    
    def __init__(self):
        self.active_connections: list[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def broadcast(self, data: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


@simulation_router.websocket("/ws")
async def simulation_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time simulation updates.
    Clients receive state updates on each simulation tick.
    """
    await manager.connect(websocket)
    
    engine = get_simulation_engine()
    
    # Add listener for simulation updates
    async def on_state_update(state: SimulationState):
        await manager.broadcast({
            "type": "state_update",
            "tick": state.tick,
            "vehicles": len(state.vehicles),
            "average_speed": state.average_speed,
            "timestamp": state.timestamp.isoformat(),
        })
    
    # Note: In production, use proper async listener pattern
    
    try:
        while True:
            # Keep connection alive and handle client messages
            data = await websocket.receive_json()
            
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif data.get("type") == "get_state":
                state = engine.state
                await websocket.send_json({
                    "type": "state",
                    "data": state.model_dump(),
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)

