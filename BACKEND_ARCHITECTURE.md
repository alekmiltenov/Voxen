# Backend Architecture

## 1) System overview

The active runtime backend is a single FastAPI service in Interface/server.py (started by start.bat on port 8000).

It currently combines multiple responsibilities in one process:
- Input ingestion (ESP32 camera WebSocket)
- CNN inference worker thread
- Head-command processing (accelerometer HTTP + WebSocket broadcast)
- Camera preview streaming
- Suggestion system (Mongo + WebSocket)
- Action execution and AI chat

## 2) Backend servers and responsibilities

### A. Primary backend (active)
- File: Interface/server.py
- Protocols:
  - HTTP: REST endpoints
  - WebSocket: real-time prediction/head/suggestions/device ingest
- Main input-control endpoints:
  - WS /ws/esp32/camera (ingest JPEG + meta)
  - WS /ws/esp32/preview (outputs latest JPEG to clients)
  - WS /ws/predict (stable CNN predictions to frontend)
  - WS /ws/head (head commands to frontend)
  - POST /head/data (accelerometer samples)
  - GET/POST /head/settings (head filtering params)
  - GET /predict and /predict/raw
  - GET /camera/stream (MJPEG)

### B. Frontend test servers (dev simulators)
- Files:
  - frontend/test-servers/cnn-test-server.js
  - frontend/test-servers/head-test-server.js
- Purpose:
  - Simulate hardware behavior for UI testing
  - Not production backends

### C. Legacy/unused backends (prototype)
- Files:
  - control-service/app.py
  - control-service/eyetracking.py
  - eye_tracking/nn_server.py
- Status:
  - Prototype or legacy paths; not the main active pipeline when using Interface/server.py

## 3) Communication protocols and payloads

### CNN output to frontend
- Endpoint: WS /ws/predict
- Format (JSON):
  - label: int
  - name: string (LEFT/RIGHT/UP/DOWN/CENTER/NONE)
  - confidence: float
  - ready: bool
  - optional: source, timing

### ESP32 camera ingest
- Endpoint: WS /ws/esp32/camera
- Message order used by firmware:
  1. Text JSON meta (optional), e.g. {"type":"meta","seq":123,"t_capture_ms":...}
  2. Binary JPEG frame bytes

### Head data ingest
- Endpoint: POST /head/data
- Input JSON:
  - x: float
  - y: float
  - z: float
- Response JSON:
  - status: "ok"
  - cmd: string|null
  - x, y, z: filtered values

### Head output to frontend
- Endpoint: WS /ws/head
- Format (active backend):
  - {"cmd":"LEFT|RIGHT|FORWARD|BACK|null"}
- Format (head test server):
  - {"cmd":...,"x":...,"y":...,"z":...}

## 4) Text data-flow diagrams

### Production-like runtime
ESP32 camera
  -> WS /ws/esp32/camera (Interface/server.py)
  -> latest-frame buffer
  -> CNN worker thread
  -> stabilization
  -> WS /ws/predict
  -> frontend InputControlContextV2
  -> InputManager.handleCNN()

ESP32 accelerometer (intended)
  -> POST /head/data
  -> backend filtering + cmd detection
  -> WS /ws/head
  -> frontend InputControlContextV2
  -> InputManager.handleHead()

### Dev simulation runtime
CNN test UI (localhost:8001)
  -> POST /api/gaze (local test server)
  -> WS /ws/predict (same test server)

HEAD test UI (localhost:8002)
  -> POST /api/accel (local test server)
  -> optional relay to backend /head/data
  -> WS /ws/head (same test server)

## 5) Key architectural findings

- Strong monolith: one service handles unrelated domains (input, NLP, actions, AI chat).
- Legacy overlap: multiple old servers still exist and conflict conceptually.
- Endpoint inconsistency in frontend integration:
  - frontend fetches /settings for head
  - active backend exposes /head/settings
- Test-vs-production mismatches are significant (ports, command mapping, payload richness).
- No unified input envelope schema across camera/head streams.
