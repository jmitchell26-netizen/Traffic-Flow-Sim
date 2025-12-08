#!/bin/bash

# Single command startup script for Traffic Flow Simulation
# Runs both backend and frontend in parallel

echo "🚦 Starting Traffic Flow Simulation..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Trap CTRL+C
trap cleanup SIGINT SIGTERM

# Start Backend
echo -e "${BLUE}📡 Starting Backend Server...${NC}"
cd "$(dirname "$0")/backend"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

if [ ! -f "venv/bin/uvicorn" ]; then
    echo "Installing backend dependencies..."
    pip install -q -r requirements.txt
fi

if [ ! -f ".env" ]; then
    cp ../env.example .env
    echo -e "${YELLOW}⚠️  Created .env file. Please add your TOMTOM_API_KEY${NC}"
fi

# Start backend in background
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/traffic-backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start Frontend
echo -e "${BLUE}🎨 Starting Frontend Server...${NC}"
cd "../frontend"

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install --silent
fi

# Start frontend in background
npm run dev > /tmp/traffic-frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 3

echo ""
echo -e "${GREEN}✅ Both servers are starting!${NC}"
echo ""
echo "📍 Backend:  http://localhost:8000"
echo "📍 Frontend: http://localhost:5173"
echo "📍 API Docs: http://localhost:8000/docs"
echo ""
echo -e "${YELLOW}💡 Opening browser in 3 seconds...${NC}"
echo ""
echo "Press CTRL+C to stop both servers"
echo ""

# Open browser after delay
sleep 3
open http://localhost:5173 2>/dev/null || xdg-open http://localhost:5173 2>/dev/null || start http://localhost:5173 2>/dev/null

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

