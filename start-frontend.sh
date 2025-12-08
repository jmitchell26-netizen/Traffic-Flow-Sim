#!/bin/bash

# Start Frontend Server Script

echo "🚀 Starting Traffic Flow Simulation Frontend..."
echo ""

cd "$(dirname "$0")/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies..."
    npm install
fi

echo ""
echo "✅ Starting Vite development server..."
echo "📍 Frontend will be available at: http://localhost:5173"
echo ""
echo "Press CTRL+C to stop the server"
echo ""

# Start the server
npm run dev

