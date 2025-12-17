"""
Application-wide constants.
"""

# ============================================================
# API CONFIGURATION
# ============================================================

TOMTOM_BASE_URL = "https://api.tomtom.com"
HTTP_TIMEOUT_SECONDS = 30.0

# ============================================================
# TRAFFIC FLOW API
# ============================================================

# Grid sizing thresholds (in square degrees)
GRID_SIZE_LARGE_AREA = 1000  # sq degrees
GRID_SIZE_MEDIUM_AREA = 100  # sq degrees
GRID_SIZE_SMALL_AREA = 10    # sq degrees

# Grid sizes for different area ranges
GRID_SIZE_VERY_LARGE = 12  # 12x12 = 144 points
GRID_SIZE_LARGE = 12       # 12x12 = 144 points
GRID_SIZE_MEDIUM = 10      # 10x10 = 100 points
GRID_SIZE_SMALL = 8        # 8x8 = 64 points

# Concurrency limits
MAX_CONCURRENT_REQUESTS = 15

# Default zoom levels
DEFAULT_ZOOM_LEVEL = 10
DETAILED_ZOOM_LEVEL = 12

# ============================================================
# SIMULATION
# ============================================================

DEFAULT_TICK_INTERVAL_MS = 100
DEFAULT_MAX_VEHICLES = 100

# ============================================================
# DATA STORAGE
# ============================================================

# Historical data
HISTORY_CACHE_SIZE = 60  # Keep last 60 snapshots
HISTORY_FILE_PATTERN = "snapshot_{hour_key}.json"

# Alerts
ALERT_HISTORY_LIMIT = 100  # Keep last 100 alert events

# ============================================================
# VALIDATION
# ============================================================

MIN_LATITUDE = -90
MAX_LATITUDE = 90
MIN_LONGITUDE = -180
MAX_LONGITUDE = 180

# ============================================================
# EXPORT
# ============================================================

SUPPORTED_EXPORT_FORMATS = ["csv", "json", "pdf"]

