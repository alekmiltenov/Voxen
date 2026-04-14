# Accelerometer Analysis

## 1) What exists today

## A. Active backend head logic
- In Interface/server.py:
  - POST /head/data receives x,y,z
  - Applies EMA smoothing (alpha)
  - Detects command using threshold/deadzone
  - Broadcasts command via WS /ws/head
  - Exposes GET/POST /head/settings

## B. Frontend consumption
- In InputControlContextV2.jsx:
  - Subscribes to WS /ws/head
  - Passes payload into InputManager.handleHead()
  - InputManager/headProcessor handle hold-based selection timing

## C. Dev simulator
- frontend/test-servers/head-test-server.js:
  - UI sends synthetic x,y,z
  - Optional relay to backend /head/data
  - Fallback local command simulation
  - Broadcasts WS /ws/head

## D. ESP firmware state
- esp32/esp32_controller.ino:
  - Active code: camera WebSocket sender
  - Accelerometer code exists only in commented legacy block
  - Legacy block posts to /data at port 5000 (old prototype backend), not current /head/data at port 8000

## 2) Problems identified

- Not end-to-end active with real hardware:
  - Real ESP accelerometer pipeline is effectively disabled in current firmware.

- Endpoint mismatch:
  - Frontend requests HEAD_SERVER/settings
  - Active backend provides /head/settings
  - This breaks production settings sync.

- Command mapping inconsistency:
  - Backend mapping and head test simulator mapping differ.
  - Same physical axis can produce different logical commands depending on which path is used.

- Legacy fragmentation:
  - control-service/app.py and control-service/eyetracking.py define older APIs (/data, /settings, socket.io).
  - Active frontend/backend primarily use FastAPI + native WebSocket.

- No shared sensor message contract:
  - Head payload is minimal in production (cmd only on WS).
  - Test server sends richer WS payload (cmd + xyz), creating behavior ambiguity.

## 3) Is current accelerometer code usable?

Short answer: it is not production-usable as-is.

Decision:
- Reuse only the core ideas (EMA filtering + threshold/deadzone + hold logic).
- Rewrite the accelerometer transport/integration layer for a clean, single pipeline.

Why:
- Real ESP firmware path is outdated/disabled for accelerometer.
- Endpoint and mapping inconsistencies will cause unstable behavior.
- Test and production flows are not equivalent.

## 4) Recommended direction

- Define one canonical head input contract:
  - Sensor uplink payload with timestamp + source id + x/y/z
  - Standard command mapping table

- Make one canonical endpoint set:
  - /head/data and /head/settings (or renamed consistently), then update frontend accordingly

- Keep frontend on one WS output schema:
  - /ws/head always returns same structure (include cmd and optional diagnostics)

- Remove or archive legacy prototypes to avoid accidental usage.
