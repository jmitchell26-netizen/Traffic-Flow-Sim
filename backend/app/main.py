"""
Traffic Flow Simulation API - FastAPI Application

Main entry point for the backend server.
Provides endpoints for:
- Real-time traffic data from TomTom API
- Traffic simulation control and state
- Dashboard metrics and analytics
- WebSocket real-time updates
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import traffic_router, simulation_router, dashboard_router
from .core.config import get_settings
from .services.tomtom import get_tomtom_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    Manages startup and shutdown tasks.
    """
    # Startup
    print("🚗 Traffic Flow Simulation API starting up...")
    settings = get_settings()
    print(f"   Map center: ({settings.default_map_center_lat}, {settings.default_map_center_lng})")
    print(f"   Poll interval: {settings.traffic_poll_interval_seconds}s")
    
    yield
    
    # Shutdown
    print("🛑 Shutting down...")
    tomtom = get_tomtom_service()
    await tomtom.close()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    settings = get_settings()
    
    app = FastAPI(
        title="Traffic Flow Simulation API",
        description="""
        A hybrid real-time traffic data and simulation system.
        
        ## Features
        
        - **Real-time Traffic Data**: Fetches live congestion data from TomTom API
        - **Traffic Simulation**: Simulates vehicle movement, traffic lights, and incidents
        - **Dashboard Metrics**: Provides analytics including wait times, flow rates, emissions
        - **WebSocket Updates**: Real-time simulation state streaming
        
        ## API Sections
        
        - `/traffic/*` - Real-time traffic data endpoints
        - `/simulation/*` - Simulation control and state
        - `/dashboard/*` - Analytics and metrics
        """,
        version="1.0.0",
        lifespan=lifespan,
    )
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(traffic_router)
    app.include_router(simulation_router)
    app.include_router(dashboard_router)
    
    @app.get("/")
    async def root():
        """Health check endpoint."""
        return {
            "service": "Traffic Flow Simulation API",
            "status": "healthy",
            "version": "1.0.0",
        }
    
    @app.get("/health")
    async def health_check():
        """Detailed health check."""
        return {
            "status": "healthy",
            "services": {
                "tomtom_api": "configured",
                "simulation_engine": "ready",
            }
        }
    
    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True,
    )

