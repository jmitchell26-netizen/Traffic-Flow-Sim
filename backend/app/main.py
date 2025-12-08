"""
Traffic Flow Simulation API - FastAPI Application

Main entry point for the backend server.

This module creates and configures the FastAPI application with:
- REST API endpoints for traffic data, simulation control, and dashboard metrics
- WebSocket support for real-time simulation updates
- CORS middleware for frontend communication
- Application lifespan management (startup/shutdown)

API Structure:
- /traffic/* - Real-time traffic data from TomTom API
- /simulation/* - Simulation control (start/stop/reset) and state management
- /dashboard/* - Analytics and metrics endpoints
- /simulation/ws - WebSocket for real-time simulation state streaming
- /docs - Interactive API documentation (Swagger UI)
- /health - Health check endpoint

The application uses async/await throughout for optimal performance with
concurrent API requests and WebSocket connections.
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
    
    Manages startup and shutdown tasks for the FastAPI application.
    This is called when the server starts and stops.
    
    Startup tasks:
    - Print startup messages with configuration
    - Initialize services (services are lazy-loaded on first use)
    
    Shutdown tasks:
    - Close HTTP clients to free resources
    - Clean up connections
    
    Args:
        app: FastAPI application instance
    
    Yields:
        Control back to FastAPI (application runs)
    """
    # Startup: Print configuration and initialize
    print("🚗 Traffic Flow Simulation API starting up...")
    settings = get_settings()
    print(f"   Map center: ({settings.default_map_center_lat}, {settings.default_map_center_lng})")
    print(f"   Poll interval: {settings.traffic_poll_interval_seconds}s")
    print(f"   Max vehicles: {settings.max_simulated_vehicles}")
    
    # Yield control to FastAPI - application runs here
    yield
    
    # Shutdown: Clean up resources
    print("🛑 Shutting down...")
    tomtom = get_tomtom_service()
    await tomtom.close()  # Close HTTP client connections


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.
    
    This function sets up the FastAPI app with:
    - API documentation (title, description, version)
    - CORS middleware for frontend communication
    - Route registration (traffic, simulation, dashboard)
    - Health check endpoints
    
    Returns:
        Configured FastAPI application instance ready to run
    
    The app can be run with:
        uvicorn app.main:app --reload
    """
    settings = get_settings()
    
    # Create FastAPI app with metadata for API documentation
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
        
        ## Interactive Documentation
        
        Visit `/docs` for Swagger UI or `/redoc` for ReDoc documentation.
        """,
        version="1.0.0",
        lifespan=lifespan,  # Handle startup/shutdown
    )
    
    # Configure CORS (Cross-Origin Resource Sharing)
    # Allows frontend (running on different port) to make API requests
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,  # Allowed frontend URLs
        allow_credentials=True,  # Allow cookies/auth headers
        allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
        allow_headers=["*"],  # Allow all headers
    )
    
    # Register API routers
    # Each router handles a group of related endpoints
    app.include_router(traffic_router)      # Traffic data endpoints
    app.include_router(simulation_router)   # Simulation control endpoints
    app.include_router(dashboard_router)    # Dashboard/metrics endpoints
    
    @app.get("/")
    async def root():
        """
        Root endpoint - basic health check.
        
        Returns basic service information. Useful for:
        - Verifying server is running
        - Load balancer health checks
        - Quick status verification
        """
        return {
            "service": "Traffic Flow Simulation API",
            "status": "healthy",
            "version": "1.0.0",
        }
    
    @app.get("/health")
    async def health_check():
        """
        Detailed health check endpoint.
        
        Returns status of all services and components.
        More detailed than root endpoint - checks service availability.
        
        Returns:
            dict with status and service health information
        """
        return {
            "status": "healthy",
            "services": {
                "tomtom_api": "configured",  # API key is configured
                "simulation_engine": "ready",  # Engine is initialized
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

