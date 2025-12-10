# Implementation Plan: Top 5 High-Impact Improvements

## Overview
This plan outlines the implementation of 5 major features:
1. Location Search & Geocoding
2. Data Export & Reports
3. Historical Data & Trends
4. Route Planning & Directions
5. Traffic Alerts & Notifications

---

## 1. Location Search & Geocoding 🔍

### Backend Changes
**File: `backend/app/services/tomtom.py`**
- Add `search_location(query: str)` method
- Use TomTom Search API (or OpenStreetMap Nominatim as fallback)
- Return: `{name, coordinates, bounds, type}`

**File: `backend/app/api/routes.py`**
- Add endpoint: `GET /traffic/search?q={query}`
- Return list of matching locations

### Frontend Changes
**File: `frontend/src/components/map/LocationSearch.tsx`** (NEW)
- Search input with autocomplete
- Dropdown with suggestions
- Click to navigate to location
- Recent searches storage

**File: `frontend/src/services/api.ts`**
- Add `searchLocation(query: string)` method

**File: `frontend/src/stores/trafficStore.ts`**
- Add `recentSearches: string[]` state
- Add `setRecentSearches` action

**File: `frontend/src/components/map/TrafficMap.tsx`**
- Integrate LocationSearch component in header/controls

### Dependencies
- TomTom Search API (already have API key)
- OR OpenStreetMap Nominatim (free, no key needed)

---

## 2. Data Export & Reports 📊

### Backend Changes
**File: `backend/app/api/routes.py`**
- Add endpoint: `POST /traffic/export`
- Accept: `{format: 'csv' | 'json' | 'pdf', bbox?, timeRange?}`
- Generate and return file

**File: `backend/app/services/export.py`** (NEW)
- `export_to_csv(data)` - Generate CSV
- `export_to_json(data)` - Generate JSON
- `export_to_pdf(data)` - Generate PDF (using reportlab or weasyprint)

### Frontend Changes
**File: `frontend/src/components/dashboard/ExportButton.tsx`** (NEW)
- Export button in Dashboard
- Modal with format selection
- Options: Current view, selected area, time range
- Download file

**File: `frontend/src/services/api.ts`**
- Add `exportData(options)` method

**File: `frontend/src/utils/export.ts`** (NEW)
- Client-side CSV generation (fallback)
- Format data for export

### Dependencies
- Backend: `reportlab` or `weasyprint` for PDF
- Frontend: File download handling

---

## 3. Historical Data & Trends 📈

### Backend Changes
**File: `backend/app/models/traffic.py`**
- Add `HistoricalSnapshot` model
- Add `TimeRange` enum (hour, day, week, month)

**File: `backend/app/services/history.py`** (NEW)
- Store traffic snapshots periodically
- Query historical data by time range
- Calculate trends and averages

**File: `backend/app/api/routes.py`**
- Add endpoint: `GET /traffic/history?start={iso}&end={iso}&bbox={...}`
- Return historical snapshots

**File: `backend/app/main.py`**
- Background task to save snapshots every 5 minutes
- Store in database or file system

### Frontend Changes
**File: `frontend/src/components/dashboard/HistoryPanel.tsx`** (NEW)
- Time range selector (last hour, day, week, month)
- Historical chart showing trends
- Compare different time periods

**File: `frontend/src/stores/trafficStore.ts`**
- Add `historicalData: HistoricalSnapshot[]` state
- Add `timeRange: TimeRange` state

**File: `frontend/src/services/api.ts`**
- Add `getHistoricalData(timeRange, bbox)` method

**File: `frontend/src/components/dashboard/Dashboard.tsx`**
- Add HistoryPanel component
- Show trend indicators

### Dependencies
- Backend: Database (SQLite) or file storage for snapshots
- Frontend: Enhanced charts for time series

---

## 4. Route Planning & Directions 🗺️

### Backend Changes
**File: `backend/app/services/tomtom.py`**
- Add `calculate_route(start, end, options)` method
- Use TomTom Routing API
- Return: route geometry, distance, time, delays

**File: `backend/app/api/routes.py`**
- Add endpoint: `POST /traffic/route`
- Accept: `{start: {lat, lng}, end: {lat, lng}, alternatives: boolean}`
- Return route(s) with traffic data

### Frontend Changes
**File: `frontend/src/components/map/RoutePlanner.tsx`** (NEW)
- Click to set start/end points
- Show route on map
- Display route info (distance, time, delays)
- Show alternative routes

**File: `frontend/src/types/traffic.ts`**
- Add `Route` interface
- Add `RouteLeg` interface

**File: `frontend/src/services/api.ts`**
- Add `calculateRoute(start, end, options)` method

**File: `frontend/src/components/map/TrafficMap.tsx`**
- Integrate RoutePlanner
- Show route polyline on map

### Dependencies
- TomTom Routing API (included with API key)

---

## 5. Traffic Alerts & Notifications 🔔

### Backend Changes
**File: `backend/app/models/traffic.py`**
- Add `Alert` model: `{id, name, area, conditions, enabled}`

**File: `backend/app/services/alerts.py`** (NEW)
- Check alerts against current traffic data
- Trigger notifications when conditions met
- Store alert history

**File: `backend/app/api/routes.py`**
- `GET /alerts` - List user alerts
- `POST /alerts` - Create alert
- `DELETE /alerts/{id}` - Delete alert
- `GET /alerts/{id}/history` - Alert trigger history

### Frontend Changes
**File: `frontend/src/components/alerts/AlertManager.tsx`** (NEW)
- Create/edit/delete alerts
- Alert conditions: congestion level, delay threshold
- Area selection on map

**File: `frontend/src/components/alerts/AlertList.tsx`** (NEW)
- List of active alerts
- Show alert status (triggered/not triggered)
- Alert history

**File: `frontend/src/stores/trafficStore.ts`**
- Add `alerts: Alert[]` state
- Add `alertHistory: AlertEvent[]` state

**File: `frontend/src/services/api.ts`**
- Add alert CRUD methods

**File: `frontend/src/hooks/useAlerts.ts`** (NEW)
- Poll for alert triggers
- Show browser notifications
- Update alert status

**File: `frontend/src/App.tsx`**
- Request notification permission
- Show alert badge in header

### Dependencies
- Browser Notification API
- Background polling for alert checks

---

## Implementation Order

### Phase 1: Foundation (Day 1)
1. ✅ Location Search (easiest, high impact)
2. ✅ Data Export - CSV/JSON (simple, useful)

### Phase 2: Core Features (Day 2)
3. ✅ Historical Data (requires storage)
4. ✅ Route Planning (uses TomTom API)

### Phase 3: Advanced (Day 3)
5. ✅ Traffic Alerts (most complex, requires polling)

---

## File Structure

```
backend/
├── app/
│   ├── services/
│   │   ├── tomtom.py (add search, route methods)
│   │   ├── export.py (NEW)
│   │   ├── history.py (NEW)
│   │   └── alerts.py (NEW)
│   ├── api/
│   │   └── routes.py (add new endpoints)
│   └── models/
│       └── traffic.py (add new models)

frontend/
├── src/
│   ├── components/
│   │   ├── map/
│   │   │   ├── LocationSearch.tsx (NEW)
│   │   │   └── RoutePlanner.tsx (NEW)
│   │   ├── dashboard/
│   │   │   ├── ExportButton.tsx (NEW)
│   │   │   └── HistoryPanel.tsx (NEW)
│   │   └── alerts/
│   │       ├── AlertManager.tsx (NEW)
│   │       └── AlertList.tsx (NEW)
│   ├── services/
│   │   └── api.ts (add new API methods)
│   ├── hooks/
│   │   └── useAlerts.ts (NEW)
│   ├── stores/
│   │   └── trafficStore.ts (add new state)
│   └── utils/
│       └── export.ts (NEW)
```

---

## Testing Checklist

- [ ] Location search finds correct places
- [ ] Export generates valid CSV/JSON
- [ ] Historical data loads correctly
- [ ] Routes calculate and display
- [ ] Alerts trigger correctly
- [ ] Notifications work in browser
- [ ] All features work on mobile
- [ ] Error handling for API failures

---

## Notes

- Use localStorage for client-side storage (alerts, recent searches)
- Consider adding SQLite for backend historical storage
- Browser notifications require user permission
- Rate limit API calls appropriately
- Add loading states for all new features
- Ensure mobile responsiveness

