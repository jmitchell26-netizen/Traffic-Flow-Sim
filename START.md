# 🚀 How to Run Traffic Flow Simulation

## Prerequisites

- Python 3.11+ installed
- Node.js 18+ installed
- TomTom API key (already configured in `.env`)

---

## Step 1: Start the Backend Server

Open **Terminal 1** and run:

```bash
# Navigate to backend directory
cd "/Users/joeymitchell/Coding Winter/traffic-flow-sim/backend"

# Activate virtual environment
source venv/bin/activate

# Start the FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**You should see:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using WatchFiles
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

✅ **Backend is running at:** http://localhost:8000
✅ **API Docs available at:** http://localhost:8000/docs

**Keep this terminal open!**

---

## Step 2: Start the Frontend Server

Open **Terminal 2** (new terminal window) and run:

```bash
# Navigate to frontend directory
cd "/Users/joeymitchell/Coding Winter/traffic-flow-sim/frontend"

# Start the development server
npm run dev
```

**You should see:**
```
VITE v5.4.21  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

✅ **Frontend is running at:** http://localhost:5173

**Keep this terminal open!**

---

## Step 3: Open in Browser

Open your web browser and go to:

**http://localhost:5173**

You should see the Traffic Flow Simulation dashboard! 🎉

---

## Quick Commands Reference

### Backend Commands
```bash
# Start backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Stop backend
Press CTRL+C in Terminal 1

# Check if backend is running
curl http://localhost:8000/health
```

### Frontend Commands
```bash
# Start frontend
cd frontend && npm run dev

# Stop frontend
Press CTRL+C in Terminal 2

# Build for production
cd frontend && npm run build
```

---

## Troubleshooting

### Backend won't start?
- Make sure Python virtual environment is activated: `source venv/bin/activate`
- Check if port 8000 is already in use: `lsof -i :8000`
- Verify `.env` file exists in `backend/` directory with `TOMTOM_API_KEY`

### Frontend won't start?
- Make sure you ran `npm install` first
- Check if port 5173 is already in use: `lsof -i :5173`
- Try deleting `node_modules` and reinstalling: `rm -rf node_modules && npm install`

### No data showing on map?
- Check browser console for errors (F12)
- Verify backend is running and accessible at http://localhost:8000
- Check backend terminal for API errors
- Make sure TomTom API key is valid

### API Connection Issues?
- Verify CORS is configured correctly in `backend/app/main.py`
- Check that frontend proxy is set up in `frontend/vite.config.ts`
- Ensure both servers are running

---

## Stopping the Application

1. **Stop Frontend:** Press `CTRL+C` in Terminal 2
2. **Stop Backend:** Press `CTRL+C` in Terminal 1

---

## Development Tips

- **Backend auto-reloads** when you change Python files (thanks to `--reload` flag)
- **Frontend auto-reloads** when you change React/TypeScript files (Vite HMR)
- **Check API docs** at http://localhost:8000/docs for all available endpoints
- **View logs** in terminal windows to debug issues

---

## Next Steps

Once running, you can:
- 🗺️ View the map with traffic data
- 📊 Check the dashboard for analytics
- 🎮 Control the simulation
- 🔄 Refresh data manually using the refresh button

Enjoy! 🚦

