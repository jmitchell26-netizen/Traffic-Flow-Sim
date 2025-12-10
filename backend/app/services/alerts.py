"""
Traffic Alerts Service

Manages user-defined traffic alerts and checks them against current traffic data.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from ..models.traffic import TrafficAlert, TrafficFlowData, BoundingBox


class AlertService:
    """
    Service for managing traffic alerts.
    
    Stores alerts and checks them against current traffic data to trigger notifications.
    """
    
    def __init__(self, storage_file: Optional[str] = None):
        """
        Initialize alert service.
        
        Args:
            storage_file: Path to JSON file for storing alerts.
                         Defaults to ./data/alerts.json
        """
        if storage_file is None:
            base_dir = Path(__file__).parent.parent.parent
            storage_file = str(base_dir / "data" / "alerts.json")
        
        self.storage_file = Path(storage_file)
        self.storage_file.parent.mkdir(parents=True, exist_ok=True)
        self._alerts: List[TrafficAlert] = []
        self._alert_history: List[dict] = []
        self._load_alerts()
    
    def _load_alerts(self):
        """Load alerts from storage file."""
        if self.storage_file.exists():
            try:
                with open(self.storage_file, 'r') as f:
                    data = json.load(f)
                    self._alerts = [TrafficAlert(**alert) for alert in data.get("alerts", [])]
                    self._alert_history = data.get("history", [])
            except Exception as e:
                print(f"Error loading alerts: {e}")
                self._alerts = []
                self._alert_history = []
        else:
            self._alerts = []
            self._alert_history = []
    
    def _save_alerts(self):
        """Save alerts to storage file."""
        try:
            data = {
                "alerts": [alert.dict() for alert in self._alerts],
                "history": self._alert_history[-100:],  # Keep last 100 history entries
            }
            with open(self.storage_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Error saving alerts: {e}")
    
    def create_alert(
        self,
        name: str,
        area: BoundingBox,
        conditions: dict
    ) -> TrafficAlert:
        """
        Create a new alert.
        
        Args:
            name: Alert name
            area: Bounding box for alert area
            conditions: Alert conditions dict
        
        Returns:
            Created TrafficAlert
        """
        alert = TrafficAlert(
            id=str(uuid.uuid4()),
            name=name,
            area=area,
            conditions=conditions,
            enabled=True,
        )
        self._alerts.append(alert)
        self._save_alerts()
        return alert
    
    def get_alerts(self) -> List[TrafficAlert]:
        """Get all alerts."""
        return self._alerts
    
    def get_alert(self, alert_id: str) -> Optional[TrafficAlert]:
        """Get alert by ID."""
        for alert in self._alerts:
            if alert.id == alert_id:
                return alert
        return None
    
    def update_alert(self, alert_id: str, **updates) -> Optional[TrafficAlert]:
        """Update an alert."""
        alert = self.get_alert(alert_id)
        if alert:
            for key, value in updates.items():
                if hasattr(alert, key):
                    setattr(alert, key, value)
            self._save_alerts()
        return alert
    
    def delete_alert(self, alert_id: str) -> bool:
        """Delete an alert."""
        initial_count = len(self._alerts)
        self._alerts = [a for a in self._alerts if a.id != alert_id]
        if len(self._alerts) < initial_count:
            self._save_alerts()
            return True
        return False
    
    def check_alerts(self, traffic_data: TrafficFlowData) -> List[dict]:
        """
        Check all enabled alerts against current traffic data.
        
        Args:
            traffic_data: Current traffic data to check against
        
        Returns:
            List of triggered alerts with details
        """
        triggered = []
        
        for alert in self._alerts:
            if not alert.enabled:
                continue
            
            # Check if traffic data overlaps with alert area
            if not self._areas_overlap(alert.area, traffic_data.bounding_box):
                continue
            
            # Check conditions
            if alert.check_conditions(traffic_data):
                trigger_info = {
                    "alert_id": alert.id,
                    "alert_name": alert.name,
                    "triggered_at": datetime.utcnow().isoformat(),
                    "conditions_met": alert.conditions,
                }
                triggered.append(trigger_info)
                
                # Add to history
                self._alert_history.append(trigger_info)
        
        # Save history
        if triggered:
            self._save_alerts()
        
        return triggered
    
    def _areas_overlap(self, bbox1: BoundingBox, bbox2: BoundingBox) -> bool:
        """Check if two bounding boxes overlap."""
        return not (
            bbox1.east < bbox2.west or
            bbox1.west > bbox2.east or
            bbox1.north < bbox2.south or
            bbox1.south > bbox2.north
        )
    
    def get_alert_history(self, alert_id: Optional[str] = None) -> List[dict]:
        """Get alert trigger history."""
        if alert_id:
            return [h for h in self._alert_history if h.get("alert_id") == alert_id]
        return self._alert_history


# Singleton instance
_alert_service: Optional[AlertService] = None


def get_alert_service() -> AlertService:
    """Get or create the alert service singleton."""
    global _alert_service
    if _alert_service is None:
        _alert_service = AlertService()
    return _alert_service

