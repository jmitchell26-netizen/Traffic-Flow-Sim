# 🎮 Traffic Flow Game Mode Guide

## 🚀 Super Easy Startup

### One Command to Rule Them All:

```bash
cd "/Users/joeymitchell/Coding Winter/traffic-flow-sim"
./start.sh
```

That's it! The script will:
- ✅ Start backend server
- ✅ Start frontend server  
- ✅ Open your browser automatically
- ✅ Show you all the URLs

**Press CTRL+C to stop both servers**

---

## 🎮 Game Mode Features

### What is Game Mode?

Game Mode transforms the traffic simulation into an interactive game where you:
- **Earn points** by managing traffic efficiently
- **Complete objectives** to unlock rewards
- **Unlock achievements** for special accomplishments
- **Compete** with your best scores

### Game Mechanics

#### 🎯 **Scoring System**
- **Base Score**: Earned continuously based on traffic flow
- **Objective Rewards**: Complete objectives for bonus points
- **Achievement Bonuses**: Unlock achievements for extra points
- **Time Bonus**: Faster completion = more points

#### 📋 **Objectives** (Challenges)
1. **Reduce Congestion** - Get average speed above 80%
2. **Manage Intersections** - Keep wait times below 30 seconds
3. **Clear Incidents** - Remove traffic incidents quickly

#### 🏆 **Achievements**
- 🚦 **Traffic Master** - Adjust your first traffic light
- ⚡ **Speed Demon** - Achieve 90%+ average speed
- 🚨 **Incident Solver** - Clear 5 incidents
- 🎯 **Congestion Buster** - Reduce congestion by 50%
- ✨ **Perfect Flow** - Maintain 95%+ speed for 5 minutes

#### ⏱️ **Time Limits**
- Each game session has a time limit (default: 5 minutes)
- Complete objectives before time runs out
- Time bonuses for quick completion

---

## 🎯 How to Play

### Getting Started

1. **Start the application** (use `./start.sh`)
2. **Click "Game Mode"** tab in the navigation
3. **Read the objectives** - these are your goals
4. **Switch to Simulation tab** to control traffic lights
5. **Switch to Map tab** to see traffic flow
6. **Complete objectives** to earn points!

### Gameplay Tips

#### 🚦 **Traffic Light Management**
- Adjust green light duration to reduce wait times
- Balance traffic flow in all directions
- Monitor wait times in Dashboard

#### 🚨 **Incident Management**
- Add incidents to create challenges
- Remove incidents quickly to improve flow
- Use incidents strategically for objectives

#### 📊 **Monitoring Progress**
- Watch your score increase in real-time
- Check objective progress bars
- Monitor time remaining

#### 🏆 **Achievement Hunting**
- Try different strategies to unlock achievements
- Some achievements require specific conditions
- Check achievement descriptions for hints

---

## 🎨 Game Features

### Score Board
- **Current Score**: Your points this session
- **Best Score**: Your all-time high
- **Level**: Current game level (increases with objectives)
- **Vehicles Helped**: Total vehicles you've helped

### Objectives Panel
- See all active objectives
- Track progress with progress bars
- Earn rewards when completed
- Objectives refresh after completion

### Achievements Panel
- View all available achievements
- See which ones you've unlocked
- Track unlock dates
- Achievement icons show status

### Timer
- Countdown timer for current session
- Warning when time is running low
- Time bonuses for quick completion

---

## 💾 Progress Saving

Your game progress is automatically saved to:
- **Browser LocalStorage**
- Persists between sessions
- Includes: score, achievements, objectives

**To Reset**: Click "Reset Game" button in Game Mode

---

## 🎯 Game Strategies

### Strategy 1: Speed Focus
- Maximize average speed
- Reduce wait times at intersections
- Clear incidents quickly
- **Best for**: Speed Demon achievement

### Strategy 2: Congestion Reduction
- Focus on reducing heavy/severe congestion
- Optimize traffic light timing
- Manage multiple intersections
- **Best for**: Congestion Buster achievement

### Strategy 3: Perfect Flow
- Maintain consistent high speeds
- Prevent any incidents
- Balance all traffic directions
- **Best for**: Perfect Flow achievement

---

## 🏅 Leaderboard (Future Feature)

Coming soon:
- Global leaderboard
- Weekly challenges
- Multiplayer mode
- Team competitions

---

## 🐛 Troubleshooting

### Game not tracking progress?
- Make sure simulation is running
- Check that you're in Game Mode tab
- Verify browser localStorage is enabled

### Objectives not completing?
- Ensure simulation is active
- Check that metrics are updating
- Try refreshing the page

### Score not saving?
- Check browser console for errors
- Verify localStorage is working
- Try resetting the game

---

## 🎉 Have Fun!

Game Mode makes traffic management fun and engaging. Try different strategies, unlock all achievements, and beat your high score!

**Pro Tip**: Combine Game Mode with Dashboard to see detailed metrics while playing!

