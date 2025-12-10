/**
 * useAlerts Hook
 * 
 * Polls for alert triggers and shows browser notifications.
 */

import { useEffect, useRef } from 'react';
import { trafficApi } from '../services/api';
import { useTrafficStore } from '../stores/trafficStore';

const POLL_INTERVAL = 30000; // 30 seconds

export function useAlerts() {
  const getBoundingBox = useTrafficStore((s) => s.getBoundingBox);
  const intervalRef = useRef<NodeJS.Timeout>();
  const lastTriggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkAlerts = async () => {
      try {
        const bbox = getBoundingBox();
        const triggered = await trafficApi.checkAlerts(bbox);

        // Show notifications for new triggers
        for (const trigger of triggered) {
          const key = `${trigger.alert_id}-${trigger.triggered_at}`;
          if (!lastTriggeredRef.current.has(key)) {
            lastTriggeredRef.current.add(key);
            
            // Show browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Traffic Alert: ${trigger.alert_name}`, {
                body: 'Alert conditions have been met',
                icon: '/vite.svg',
                tag: trigger.alert_id, // Prevent duplicate notifications
              });
            }
          }
        }

        // Clean up old triggers (keep last 100)
        if (lastTriggeredRef.current.size > 100) {
          const entries = Array.from(lastTriggeredRef.current);
          lastTriggeredRef.current = new Set(entries.slice(-50));
        }
      } catch (err) {
        console.error('Error checking alerts:', err);
      }
    };

    // Initial check
    checkAlerts();

    // Set up polling
    intervalRef.current = setInterval(checkAlerts, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [getBoundingBox]);
}

