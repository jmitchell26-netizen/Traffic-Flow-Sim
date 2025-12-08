/**
 * Game Mode Component
 * 
 * Adds gamification to the traffic simulation:
 * - Score system
 * - Objectives/challenges
 * - Achievements
 * - Leaderboard
 * - Time limits
 */

import { useState, useEffect } from 'react';
import { Trophy, Target, Clock, Zap, Star, Award, TrendingUp } from 'lucide-react';
import { useTrafficStore } from '../../stores/trafficStore';
import type { TrafficMetrics } from '../../types/traffic';

interface GameObjective {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  reward: number;
  completed: boolean;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: Date;
}

interface GameState {
  score: number;
  level: number;
  timeRemaining: number;
  objectives: GameObjective[];
  achievements: Achievement[];
  totalVehiclesHelped: number;
  congestionReduced: number;
  bestScore: number;
}

/**
 * Initial game objectives/challenges.
 * 
 * Players complete these objectives to earn points and progress.
 * Each objective has:
 * - A target value to achieve
 * - A reward in points
 * - A completion status
 */
const INITIAL_OBJECTIVES: GameObjective[] = [
  {
    id: 'reduce-congestion',
    title: 'Reduce Congestion',
    description: 'Get average speed ratio above 80%',
    target: 80,  // Target: 80% of free-flow speed
    current: 0,
    reward: 100,  // Points awarded when completed
    completed: false,
  },
  {
    id: 'manage-intersections',
    title: 'Manage Intersections',
    description: 'Keep wait times below 30 seconds',
    target: 30,  // Target: max 30 seconds wait time
    current: 0,
    reward: 150,  // Higher reward for more challenging objective
    completed: false,
  },
  {
    id: 'clear-incidents',
    title: 'Clear Incidents',
    description: 'Remove 3 traffic incidents',
    target: 3,  // Target: remove 3 incidents
    current: 0,
    reward: 200,  // Highest reward for active management
    completed: false,
  },
];

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-light',
    title: 'Traffic Master',
    description: 'Adjust your first traffic light',
    icon: '🚦',
    unlocked: false,
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    description: 'Achieve 90%+ average speed',
    icon: '⚡',
    unlocked: false,
  },
  {
    id: 'incident-solver',
    title: 'Incident Solver',
    description: 'Clear 5 incidents',
    icon: '🚨',
    unlocked: false,
  },
  {
    id: 'congestion-buster',
    title: 'Congestion Buster',
    description: 'Reduce congestion by 50%',
    icon: '🎯',
    unlocked: false,
  },
  {
    id: 'perfect-flow',
    title: 'Perfect Flow',
    description: 'Maintain 95%+ speed for 5 minutes',
    icon: '✨',
    unlocked: false,
  },
];

export function GameMode() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem('traffic-game-state');
    return saved
      ? JSON.parse(saved)
      : {
          score: 0,
          level: 1,
          timeRemaining: 300, // 5 minutes
          objectives: INITIAL_OBJECTIVES,
          achievements: ACHIEVEMENTS,
          totalVehiclesHelped: 0,
          congestionReduced: 0,
          bestScore: 0,
        };
  });

  const dashboardData = useTrafficStore((s) => s.dashboardData);
  const simulationState = useTrafficStore((s) => s.simulationState);

  /**
   * Update game state based on current simulation metrics.
   * 
   * This effect runs whenever dashboard metrics change and:
   * - Updates objective progress based on current metrics
   * - Checks for objective completion and awards points
   * - Checks for achievement unlocks
   * - Updates best score if current score exceeds it
   * - Saves game state to localStorage
   */
  useEffect(() => {
    // Don't update if no metrics available yet
    if (!dashboardData?.current_metrics) return;

    const metrics = dashboardData.current_metrics;
    const newState = { ...gameState };

    // Update each objective's progress and check for completion
    newState.objectives = newState.objectives.map((obj) => {
      // Skip already completed objectives
      if (obj.completed) return obj;

      let current = obj.current;
      let completed = false;

      // Update current value and check completion based on objective type
      switch (obj.id) {
        case 'reduce-congestion':
          // Use average speed as current value
          current = metrics.average_speed;
          // Completed if speed >= target (80%)
          completed = current >= obj.target;
          break;
        case 'manage-intersections':
          // Use average wait time as current value
          current = metrics.average_wait_time;
          // Completed if wait time <= target (30 seconds)
          completed = current <= obj.target;
          break;
        case 'clear-incidents':
          // TODO: Track incident removals separately
          // This would require additional state tracking
          break;
      }

      // Award points when objective is first completed
      if (completed && !obj.completed) {
        newState.score += obj.reward;
        newState.totalVehiclesHelped += 10;  // Bonus: helped vehicles
      }

      return { ...obj, current, completed };
    });

    // Check achievements
    newState.achievements = newState.achievements.map((ach) => {
      if (ach.unlocked) return ach;

      let unlocked = false;
      switch (ach.id) {
        case 'speed-demon':
          unlocked = metrics.average_speed >= 90;
          break;
        case 'congestion-buster':
          unlocked = newState.congestionReduced >= 50;
          break;
      }

      if (unlocked && !ach.unlocked) {
        newState.score += 50;
      }

      return { ...ach, unlocked, unlockedAt: unlocked ? new Date() : ach.unlockedAt };
    });

    // Update best score
    if (newState.score > newState.bestScore) {
      newState.bestScore = newState.score;
    }

    setGameState(newState);
    localStorage.setItem('traffic-game-state', JSON.stringify(newState));
  }, [dashboardData, simulationState]);

  // Timer countdown
  useEffect(() => {
    if (gameState.timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setGameState((prev) => ({
        ...prev,
        timeRemaining: Math.max(0, prev.timeRemaining - 1),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const completedObjectives = gameState.objectives.filter((o) => o.completed).length;
  const unlockedAchievements = gameState.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="h-full overflow-auto p-6 bg-dash-bg">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-display font-bold text-dash-text flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              Traffic Flow Game
            </h2>
            <p className="text-dash-muted mt-1">Manage traffic and earn points!</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Reset game progress?')) {
                localStorage.removeItem('traffic-game-state');
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Reset Game
          </button>
        </div>

        {/* Score Board */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-dash-muted">Score</span>
            </div>
            <div className="text-3xl font-display font-bold text-yellow-400">
              {gameState.score.toLocaleString()}
            </div>
            <div className="text-xs text-dash-muted mt-1">
              Best: {gameState.bestScore.toLocaleString()}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-dash-muted">Level</span>
            </div>
            <div className="text-3xl font-display font-bold text-blue-400">
              {gameState.level}
            </div>
            <div className="text-xs text-dash-muted mt-1">
              {completedObjectives}/{gameState.objectives.length} Objectives
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-green-400" />
              <span className="text-sm text-dash-muted">Vehicles Helped</span>
            </div>
            <div className="text-3xl font-display font-bold text-green-400">
              {gameState.totalVehiclesHelped}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-dash-muted">Time Remaining</span>
            </div>
            <div className="text-3xl font-display font-bold text-purple-400">
              {formatTime(gameState.timeRemaining)}
            </div>
            {gameState.timeRemaining < 60 && (
              <div className="text-xs text-red-400 mt-1 animate-pulse">Hurry!</div>
            )}
          </div>
        </div>

        {/* Objectives */}
        <div className="bg-dash-card border border-dash-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-6 h-6 text-orange-400" />
            <h3 className="text-xl font-semibold text-dash-text">Objectives</h3>
            <span className="ml-auto text-sm text-dash-muted">
              {completedObjectives}/{gameState.objectives.length} Complete
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gameState.objectives.map((objective) => (
              <div
                key={objective.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  objective.completed
                    ? 'bg-green-500/10 border-green-500/50'
                    : 'bg-dash-bg/50 border-dash-border'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-dash-text">{objective.title}</h4>
                  {objective.completed && (
                    <Award className="w-5 h-5 text-green-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-dash-muted mb-3">{objective.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-dash-muted">Progress</span>
                    <span className="text-dash-text font-medium">
                      {objective.current.toFixed(1)} / {objective.target}
                    </span>
                  </div>
                  <div className="h-2 bg-dash-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        objective.completed ? 'bg-green-400' : 'bg-dash-accent'
                      }`}
                      style={{
                        width: `${Math.min(100, (objective.current / objective.target) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-dash-muted">Reward</span>
                    <span className="text-yellow-400 font-medium">+{objective.reward} pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-dash-card border border-dash-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h3 className="text-xl font-semibold text-dash-text">Achievements</h3>
            <span className="ml-auto text-sm text-dash-muted">
              {unlockedAchievements}/{gameState.achievements.length} Unlocked
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {gameState.achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg border-2 text-center transition-all ${
                  achievement.unlocked
                    ? 'bg-yellow-500/10 border-yellow-500/50'
                    : 'bg-dash-bg/50 border-dash-border opacity-50'
                }`}
              >
                <div className="text-4xl mb-2">{achievement.icon}</div>
                <h4 className="font-semibold text-sm text-dash-text mb-1">
                  {achievement.title}
                </h4>
                <p className="text-xs text-dash-muted">{achievement.description}</p>
                {achievement.unlocked && achievement.unlockedAt && (
                  <div className="text-xs text-yellow-400 mt-2">
                    Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Game Tips */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <h4 className="font-semibold text-blue-400 mb-2">💡 Game Tips</h4>
          <ul className="text-sm text-dash-muted space-y-1 list-disc list-inside">
            <li>Adjust traffic light timings to reduce wait times</li>
            <li>Clear incidents quickly to improve flow</li>
            <li>Monitor average speed to maximize your score</li>
            <li>Complete objectives to earn bonus points</li>
            <li>Unlock achievements for extra rewards</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

