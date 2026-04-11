# Test Servers

Development test servers for simulating hardware input devices without physical hardware. Useful for testing the frontend in development mode.

## Overview

| Server | Port | Purpose | Protocol |
|--------|------|---------|----------|
| **CNN Test Server** | 8001 | Eye gaze prediction simulator | WebSocket `/ws/predict` |
| **HEAD Test Server** | 8002 | Accelerometer (head tilt) simulator | HTTP UI + WebSocket `/ws/head` |

---

## CNN Test Server (Eye Tracking)

**File:** `cnn-test-server.js`

Simulates eye gaze predictions from a CNN model without requiring camera/ML hardware.

### Start

```bash
cd frontend/test-servers
node cnn-test-server.js
```

### Usage

1. Frontend automatically connects to `ws://localhost:8001/ws/predict` when in development mode
2. Open http://localhost:8001 in browser for control UI
3. Click buttons to simulate eye movements (UP, DOWN, LEFT, RIGHT, CENTER)
4. Frontend receives predictions via WebSocket in real-time

### Features

- Direction buttons (↑ ↓ ← →)
- Center/neutral gaze simulator
- Manual confidence slider (0-1)
- Real-time WebSocket broadcast (60ms intervals)

---

## HEAD Test Server (Head Tilt Control)

**File:** `head-test-server.js`

Simulates ESP32 accelerometer data for head tilt control.

### Start

```bash
cd frontend/test-servers
node head-test-server.js
```

### Usage

1. Frontend automatically connects to `ws://localhost:8002/ws/head` when in development mode
2. Open http://localhost:8002 in browser for control UI
3. Click direction buttons or use sliders to simulate head tilts
4. Frontend receives tilt commands via WebSocket

### Features

- Quick direction buttons (↑ ↓ ← →)
- Manual X/Y/Z axis sliders for fine control
- Automatic command simulation based on thresholds:
  - `LEFT`: x < -1.5
  - `RIGHT`: x > 1.5
  - `BACK`: y < -1.5
  - `FORWARD`: y > 1.5
- Real-time WebSocket broadcast (100ms intervals)

### Configuration

Backend address for relay (in dev mode, will timeout gracefully):
```javascript
const BACKEND_URL = 'http://10.237.97.128:5000';
```

---

## Running Both Servers

```bash
# Terminal 1 - Frontend dev server
cd frontend
npx vite --port 5173

# Terminal 2 - CNN test server
cd frontend/test-servers
node cnn-test-server.js

# Terminal 3 - HEAD test server
cd frontend/test-servers
node head-test-server.js
```

Then open:
- **Frontend:** http://localhost:5173
- **CNN Controller:** http://localhost:8001
- **HEAD Controller:** http://localhost:8002

---

## Development Mode Detection

Both servers are only used when the frontend is accessed via `localhost`:
- Development: `window.location.hostname === "localhost"` → Test servers
- Production: Connects to real backend on network

Settings fetches are also skipped in dev mode to avoid CORS errors with network backend.

---

## WebSocket Protocol

### CNN Server

```javascript
// WebSocket message format
{
  "ready": true,
  "name": "UP" | "DOWN" | "LEFT" | "RIGHT" | "CENTER",
  "confidence": 0.0 - 1.0
}
```

### HEAD Server

```javascript
// WebSocket message format
{
  "cmd": "LEFT" | "RIGHT" | "FORWARD" | "BACK" | null,
  "x": -5.0 to 5.0,
  "y": -5.0 to 5.0,
  "z": 0 to 12.0
}
```

---

## Troubleshooting

**"Port already in use"**
```bash
# Kill process on port
Get-Process -Id $(Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue).OwningProcess | Stop-Process -Force
```

**WebSocket connection fails**
- Ensure test server is running
- Check port with: `netstat -ano | findstr "8001" or "8002"`
- Verify frontend is accessing localhost (not IP address)

**Backend connection timeout**
- Expected behavior in dev mode
- Server simulates commands instead
- Check console logs in test server terminal
