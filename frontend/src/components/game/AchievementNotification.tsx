/**
 * Achievement Notification Component
 * 
 * Displays a notification when an achievement is unlocked.
 * Includes animation and celebration effects.
 */

import { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: Date;
}

interface AchievementNotificationProps {
  achievement: Achievement | null;
  onClose: () => void;
}

export function AchievementNotification({ achievement, onClose }: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setIsVisible(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onClose]);

  if (!achievement || !isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-slide-in-right">
      <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-2 border-yellow-500/50 rounded-xl p-5 shadow-2xl backdrop-blur-sm min-w-[320px] max-w-md">
        <div className="flex items-start gap-4">
          <div className="text-5xl animate-bounce">{achievement.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h4 className="font-bold text-yellow-400">Achievement Unlocked!</h4>
            </div>
            <h5 className="font-semibold text-dash-text text-lg mb-1">
              {achievement.title}
            </h5>
            <p className="text-sm text-dash-muted">{achievement.description}</p>
            <div className="mt-2 text-xs text-yellow-400/80">
              +50 points
            </div>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="text-dash-muted hover:text-dash-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

