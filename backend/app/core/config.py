"""
Application configuration using Pydantic Settings.
Loads environment variables from .env file.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Pydantic v2 configuration (replaces old class Config)
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )
    
    # TomTom API
    tomtom_api_key: str
    
    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:5173"
    
    # Traffic data polling
    traffic_poll_interval_seconds: int = 60
    
    # Default map center (New York City)
    default_map_center_lat: float = 40.7128
    default_map_center_lng: float = -74.0060
    default_zoom_level: int = 13
    
    # Simulation
    simulation_tick_ms: int = 100
    max_simulated_vehicles: int = 500
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()

