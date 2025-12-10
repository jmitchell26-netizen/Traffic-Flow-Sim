"""
Historical Data Service

Stores and retrieves historical traffic snapshots for trend analysis.
Uses in-memory storage (can be upgraded to database later).
"""

import json
import os
from datetime import datetime, timedelta
from typing import Optional, List
from pathlib import Path

from ..models.traffic import TrafficFlowData, BoundingBox, TrafficMetrics


class HistoryService:
    """
    Service for managing historical traffic data.
    
    Stores snapshots periodically and provides querying capabilities
    for trend analysis and historical comparisons.
    """
    
    def __init__(self, storage_dir: Optional[str] = None):
        """
        Initialize history service.
        
        Args:
            storage_dir: Directory to store historical data files.
                        Defaults to ./data/history in project root.
        """
        if storage_dir is None:
            # Default to ./data/history relative to backend
            base_dir = Path(__file__).parent.parent.parent
            storage_dir = str(base_dir / "data" / "history")
        
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        # In-memory cache for recent data (last hour)
        self._recent_cache: List[dict] = []
        self._max_cache_size = 60  # Keep last 60 snapshots (1 per minute)
    
    def _get_filename(self, timestamp: datetime) -> Path:
        """Get filename for a timestamp (one file per hour)."""
        hour_key = timestamp.strftime("%Y%m%d_%H")
        return self.storage_dir / f"snapshot_{hour_key}.json"
    
    def save_snapshot(self, data: TrafficFlowData, metrics: Optional[TrafficMetrics] = None):
        """
        Save a traffic data snapshot.
        
        Args:
            data: TrafficFlowData to save
            metrics: Optional TrafficMetrics to include
        """
        snapshot = {
            "timestamp": data.timestamp.isoformat(),
            "bounding_box": {
                "north": data.bounding_box.north,
                "south": data.bounding_box.south,
                "east": data.bounding_box.east,
                "west": data.bounding_box.west,
            },
            "summary": {
                "total_segments": data.total_segments,
                "congested_segments": data.congested_segments,
                "average_speed_ratio": data.average_speed_ratio,
            },
            "metrics": metrics.dict() if metrics else None,
        }
        
        # Add to in-memory cache
        self._recent_cache.append(snapshot)
        if len(self._recent_cache) > self._max_cache_size:
            self._recent_cache.pop(0)
        
        # Save to file (one file per hour)
        filename = self._get_filename(data.timestamp)
        try:
            # Load existing data for this hour
            if filename.exists():
                with open(filename, 'r') as f:
                    hour_data = json.load(f)
            else:
                hour_data = {"snapshots": []}
            
            # Add new snapshot
            hour_data["snapshots"].append(snapshot)
            
            # Keep only last 60 snapshots per hour (1 per minute)
            if len(hour_data["snapshots"]) > 60:
                hour_data["snapshots"] = hour_data["snapshots"][-60:]
            
            # Save back
            with open(filename, 'w') as f:
                json.dump(hour_data, f, indent=2)
        except Exception as e:
            print(f"Error saving snapshot: {e}")
    
    def get_historical_data(
        self,
        start_time: datetime,
        end_time: datetime,
        bbox: Optional[BoundingBox] = None
    ) -> List[dict]:
        """
        Get historical snapshots within a time range.
        
        Args:
            start_time: Start of time range
            end_time: End of time range
            bbox: Optional bounding box filter
        
        Returns:
            List of snapshot dictionaries
        """
        results = []
        
        # Check in-memory cache first
        for snapshot in self._recent_cache:
            snapshot_time = datetime.fromisoformat(snapshot["timestamp"])
            if start_time <= snapshot_time <= end_time:
                # Check bounding box if provided
                if bbox:
                    snap_bbox = snapshot["bounding_box"]
                    # Simple overlap check
                    if not (snap_bbox["east"] < bbox.west or snap_bbox["west"] > bbox.east or
                            snap_bbox["north"] < bbox.south or snap_bbox["south"] > bbox.north):
                        results.append(snapshot)
                else:
                    results.append(snapshot)
        
        # Load from files
        current = start_time.replace(minute=0, second=0, microsecond=0)
        while current <= end_time:
            filename = self._get_filename(current)
            if filename.exists():
                try:
                    with open(filename, 'r') as f:
                        hour_data = json.load(f)
                    
                    for snapshot in hour_data.get("snapshots", []):
                        snapshot_time = datetime.fromisoformat(snapshot["timestamp"])
                        if start_time <= snapshot_time <= end_time:
                            # Check bounding box if provided
                            if bbox:
                                snap_bbox = snapshot["bounding_box"]
                                if not (snap_bbox["east"] < bbox.west or snap_bbox["west"] > bbox.east or
                                        snap_bbox["north"] < bbox.south or snap_bbox["south"] > bbox.north):
                                    results.append(snapshot)
                            else:
                                results.append(snapshot)
                except Exception as e:
                    print(f"Error loading snapshot file {filename}: {e}")
            
            current += timedelta(hours=1)
        
        # Sort by timestamp
        results.sort(key=lambda x: x["timestamp"])
        return results
    
    def get_trends(
        self,
        time_range: str = "hour",  # "hour", "day", "week"
        bbox: Optional[BoundingBox] = None
    ) -> dict:
        """
        Calculate trends for a time range.
        
        Args:
            time_range: Time range ("hour", "day", "week")
            bbox: Optional bounding box filter
        
        Returns:
            Dictionary with trend data
        """
        end_time = datetime.utcnow()
        
        if time_range == "hour":
            start_time = end_time - timedelta(hours=1)
        elif time_range == "day":
            start_time = end_time - timedelta(days=1)
        elif time_range == "week":
            start_time = end_time - timedelta(weeks=1)
        else:
            start_time = end_time - timedelta(hours=1)
        
        snapshots = self.get_historical_data(start_time, end_time, bbox)
        
        if not snapshots:
            return {
                "time_range": time_range,
                "snapshot_count": 0,
                "average_speed_ratio": 0,
                "trend": "stable",
            }
        
        # Calculate averages
        speed_ratios = [s["summary"]["average_speed_ratio"] for s in snapshots if s.get("summary")]
        avg_speed_ratio = sum(speed_ratios) / len(speed_ratios) if speed_ratios else 0
        
        # Calculate trend (comparing first half to second half)
        if len(snapshots) >= 4:
            mid = len(snapshots) // 2
            first_half_avg = sum([s["summary"]["average_speed_ratio"] for s in snapshots[:mid] if s.get("summary")]) / mid
            second_half_avg = sum([s["summary"]["average_speed_ratio"] for s in snapshots[mid:] if s.get("summary")]) / (len(snapshots) - mid)
            
            if second_half_avg > first_half_avg * 1.05:
                trend = "improving"
            elif second_half_avg < first_half_avg * 0.95:
                trend = "worsening"
            else:
                trend = "stable"
        else:
            trend = "stable"
        
        return {
            "time_range": time_range,
            "snapshot_count": len(snapshots),
            "average_speed_ratio": avg_speed_ratio,
            "trend": trend,
            "snapshots": snapshots[-20:],  # Return last 20 for chart
        }


# Singleton instance
_history_service: Optional[HistoryService] = None


def get_history_service() -> HistoryService:
    """Get or create the history service singleton."""
    global _history_service
    if _history_service is None:
        _history_service = HistoryService()
    return _history_service

