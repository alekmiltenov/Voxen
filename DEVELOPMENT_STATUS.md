# VOXEN - Development Status Report
**Date:** April 7, 2026  
**Project:** Unified Input Control System for Accessibility Interface

---

## 📋 Executive Summary

Significant progress has been made on the **unified input control architecture**. The system now supports three independent input modes (HEAD, MediaPipe/Eyes, CNN) with a single consistent frontend interaction model, test infrastructure, and improved customization options.

On the backend side, the core real-time pipeline has been refactored into FastAPI so the ESP32-CAM is now the primary CNN input source via WebSocket ingest.

---

## 🔧 What Has Been Implemented

### 1. **XIAO ESP32S3 Sense (ESP32-CAM) Integration** ✅
- **Status:** Connected, streaming, and integrated into FastAPI
- **Implementation path:**
  - ESP32 sends metadata + binary JPEG frames to `ws://<backend>:8000/ws/esp32/camera`
  - Backend ingests frames with a latest-frame strategy (no queue backlog)
  - Worker thread performs decode → optional rotation → grayscale resize (64x64) → CNN inference
  - Stable predictions are published to `/ws/predict` and `/predict`
  - Preview stream available via `/camera/stream`
- **Why this matters:**
  - Removed Raspberry Pi stream dependency from active inference path
  - Reduced latency and improved robustness under variable frame timing
  - Kept frontend integration surface simple (`/ws/predict`)

#### CNN Context (Current State)
- CNN classes are fixed to: `LEFT`, `RIGHT`, `UP`, `DOWN`, `CENTER`.
- Current issue is **model quality/domain mismatch**, not transport.
- Main root causes identified:
  - legacy mixed data (older Pi distribution vs ESP32-CAM distribution)
  - hand-held camera angle variability during collection
  - neutral handling now uses explicit `CENTER` class
- Stabilization exists backend-side (window + confidence gate), but it cannot fix biased training data.

⚠️ **Important Note:** CNN pipeline is operational, but prediction accuracy remains limited until ESP32-specific balanced dataset collection + retraining is completed.

#### Backend Contribution Details (Completed)
- Added ESP32 camera ingest WebSocket endpoint: `/ws/esp32/camera`
- Added latest-frame ingestion pattern (overwrite old frame, process freshest frame)
- Added inference worker separation from ingest (non-blocking receive path)
- Added timing metadata propagation (capture/receive/infer timestamps)
- Added stable prediction layer (windowed smoothing + confidence threshold)
- Added stale-reset behavior to avoid sticky wrong labels
- Added live diagnostics:
  - `/predict/raw` (raw model output)
  - `/debug/cnn` (live debug page with stable/raw + preview)
- Added merged head-control backend endpoints in FastAPI:
  - `/head/data`, `/head/settings`, `/ws/head`

---

### 2. **Unified Interface Architecture** ✅
Major refactoring to support multiple input modes with a single codebase:

#### Core Changes:
- **Central Hub:** `InputControlContext.jsx` - Manages all three input modes
- **Universal Interface Pattern:** Consistent command structure across all modes:
  ```
  Navigation: LEFT / RIGHT (throttled, 200ms default)
  Selection: Hold-confirm pattern (customizable per mode)
  ```

#### Three Input Modes:

**A) HEAD Control (ESP32 Accelerometer)**
- Transport: WebSocket `/ws/head`
- Navigation: LEFT/RIGHT tilt
- Selection: FORWARD/BACK hold (customizable via Settings)
- Implemented in: `InputControlContext.jsx` (lines 130-215)
- Features:
  - Command delay throttling (via `headLastCmdTimeRef`)
  - Configurable selection method (FORWARD or BACK)
  - Settings persistence via localStorage

**B) MediaPipe/Eyes (Browser-based)**
- Transport: Local video feed (no server dependency)
- Navigation: UP/DOWN/LEFT/RIGHT gaze
- Selection: CENTER gaze + dwell timer
- Implemented in: `InputControlContext.jsx` (lines 220+)
- Features:
  - Dwell-time customizable in Settings
  - No external dependencies (runs in browser)

**C) CNN (Eye Tracking via ESP32-CAM)**
- Transport: WebSocket `/ws/predict`
- Navigation: UP/DOWN/LEFT/RIGHT predictions
- Selection: directional dwell (LEFT/RIGHT/UP/DOWN)
- Neutral: CENTER (does not trigger actions)
- Implemented in: `InputControlContext.jsx` (lines 290+)
- Features:
  - Command delay throttling (via `cnnLastCmdTimeRef`)
  - Dwell-time customizable
  - Real-time prediction display

---

### 3. **Interface Improvements** ✅

#### Settings Page (`frontend/src/pages/Settings.jsx`)
- **New Feature:** Customizable HEAD selection method
  - Choose between FORWARD or BACK to trigger selection
  - Dropdown UI in HEAD Interaction section
  - Persistent via localStorage

#### Command Delay Throttling
- Fixed critical double-click bug in CNN mode
- Issue: `lastCmdTime` was local variable, reset every frame
- Solution: Converted to useRef (`cnnLastCmdTimeRef`, `headLastCmdTimeRef`)
- Result: Smooth, consistent navigation across all modes

#### Refactored Logic
- **Before:** Separate implementations for each mode (code duplication)
- **After:** Universal pattern with configurable parameters
- **Benefit:** Single source of truth, easier maintenance and testing

---

### 4. **Testing Infrastructure** ✅

Created `/frontend/test-servers/` directory with two development test servers:

#### CNN Test Server (`cnn-test-server.js`)
- **Port:** 8001
- **Protocol:** WebSocket `/ws/predict`
- **Features:**
  - Direction buttons (↑ ↓ ← →)
  - Center/neutral simulator
  - Manual confidence slider
  - Real-time broadcast (60ms intervals)
- **Usage:** `cd frontend/test-servers && node cnn-test-server.js`

#### HEAD Test Server (`head-test-server.js`)
- **Port:** 8002
- **Protocol:** WebSocket `/ws/head` + HTTP UI
- **Features:**
  - Direction buttons with quick presets
  - Manual X/Y/Z axis sliders for fine control
  - Automatic command simulation based on thresholds
  - Backend relay (graceful timeout in dev mode)
  - Real-time broadcast (100ms intervals)
- **Usage:** `cd frontend/test-servers && node head-test-server.js`

#### Development Mode Detection
- Automatic localhost detection in frontend
- Production: Connects to real backend
- Development: Routes to test servers
- **Key File:** `InputControlContext.jsx` (lines 150-160)
  ```javascript
  const wsUrl = window.location.hostname === "localhost" 
    ? testWsUrl 
    : backendWsUrl;
  ```

#### Test Server Documentation
- Comprehensive README: `/frontend/test-servers/README.md`
- Includes: Setup, usage, WebSocket protocols, troubleshooting

---

## 📁 Code Organization

### Frontend Structure
```
frontend/
├── src/
│   ├── pages/
│   │   ├── InputControlContext.jsx      ← Central hub (686 lines)
│   │   ├── Settings.jsx                 ← Configuration UI
│   │   ├── Actions.jsx
│   │   ├── Keyboard.jsx
│   │   ├── Communicate.jsx
│   │   └── ...
│   ├── components/
│   └── utils/
├── test-servers/                        ← NEW
│   ├── cnn-test-server.js
│   ├── head-test-server.js
│   └── README.md
└── ...
```

### Backend Architecture
```
Interface/
├── server.py                            ← Main FastAPI server (camera ingest + CNN + head)
├── eyetracking.py                       ← Legacy / older experiments
└── ...

eye_tracking/
├── model.pt                             ← Trained CNN weights
├── nn_server.py                         ← Legacy server (not active in unified backend path)
├── collect.py                           ← Dataset collection (now supports backend /camera/stream)
└── ...

Action_Space/
├── ai_chat_service.py                   ← AI chat system (not yet integrated)
└── actions/
    ├── calls.py
    ├── sms.py
    └── ...
```

---

## ⚠️ What Is NOT Yet Implemented

### 1. **Actions Page (UI)** 🔄 (Partial)
- **Status:** Page exists but incomplete
- **Missing:**
  - [ ] One-tap action buttons implementation
  - [ ] Action categorization/organization
  - [ ] Integration with Action_Space backend services
  - [ ] Real-time action feedback/response
  - [ ] Action history/logging

**Note:** The Actions page structure exists but needs full implementation of action triggers and backend integration.

---

### 2. **Accelerometer Integration in ESP32 Firmware** ❌
- [ ] Firmware code for accelerometer readings
- [ ] Calibration and threshold tuning
- [ ] Sensor fusion (if combining multiple sensors)
- [ ] Power optimization for continuous polling

**Note:** Backend support for accelerometer is already present in FastAPI (`/head/data`, `/ws/head`). The missing piece is stable ESP32 firmware wiring and calibration.

---

### 3. **Keyboard Controllable Interface** ❌
- [ ] Keyboard event handlers
- [ ] Remappable key bindings
- [ ] Keyboard accessibility mode
- [ ] Arrow key support for navigation

**Why:** Prioritized other input modes first. Would be relatively straightforward to add using standard React event handlers.

---

### 4. **AI Chat Controllable Interface** ❌
- **Status:** Backend service exists (`Action_Space/ai_chat_service.py`)
- **Missing:**
  - [ ] Integration with InputControlContext
  - [ ] WebSocket connection for real-time chat
  - [ ] Natural language command parsing
  - [ ] Response streaming to frontend
  - [ ] Error handling and fallbacks

**Note:** Backend infrastructure exists but frontend integration not started.

---

### 5. **Frontend Styling (UI/UX Polish)** ❌
- [ ] Visual consistency across all pages
- [ ] Dark/Light theme support
- [ ] Responsive design for different screen sizes
- [ ] Accessibility (ARIA labels, color contrast)
- [ ] Animation and transitions
- [ ] Loading states and error displays

**Current State:** Functional UI with basic styling. Works but needs professional design polish.

---

### 6. **Catalog of Hardcoded Phrases** ❌
- [ ] Phrase database/file
- [ ] Categories (greetings, responses, needs, etc.)
- [ ] Quick-access phrase list UI
- [ ] Customizable phrase library
- [ ] Export/import functionality

**Use Case:** Quick communication without typing or dictation.

---

## 🔌 System Architecture (Current)

```
┌─────────────────────────────────────────┐
│         FRONTEND (React)                │
│  http://localhost:5173 (dev)            │
│                                         │
│  ┌─ InputControlContext (Hub) ────────┐ │
│  │                                    │ │
│  ├─ HEAD Mode ───► WS :8002/ws/head  │ │
│  │ (dev test server)                  │ │
│  │                                    │ │
│  ├─ Eyes Mode ───► Local video       │ │
│  │ (MediaPipe, browser-based)         │ │
│  │                                    │ │
│  ├─ CNN Mode ────► WS :8001/ws/predict│ │
│  │ (dev test server)                  │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Settings ─────► localStorage          │
│  (dwell, selection method, etc.)       │
└─────────────────────────────────────────┘
         │                  │
         ▼                  ▼
    ┌──────────────────────────────┐
    │    BACKEND (FastAPI)         │
    │    http://<host>:8000        │
    │                              │
    │ ┌─────────────────────────┐  │
    │ │ HEAD Control Handler    │  │
    │ │ POST /head/data         │  │
    │ │ WS /ws/head             │  │
    │ └─────────────────────────┘  │
    │                              │
    │ ┌─────────────────────────┐  │
    │ │ CNN Prediction Service  │  │
    │ │ WS /ws/esp32/camera     │  │
    │ │ WS /ws/predict          │  │
    │ │ GET /predict            │  │
    │ │ GET /predict/raw        │  │
    │ │ GET /debug/cnn          │  │
    │ └─────────────────────────┘  │
    │                              │
    │ ┌─────────────────────────┐  │
    │ │ AI Chat Service         │  │
    │ │ (not yet integrated)    │  │
    │ └─────────────────────────┘  │
    └──────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────┐
    │    HARDWARE                  │
    │ ┌─────────────────────────┐  │
    │ │ XIAO ESP32S3 Sense      │  │
    │ │ (camera stream source)  │  │
    │ └─────────────────────────┘  │
    │ ┌─────────────────────────┐  │
    │ │ ESP32 + Accelerometer   │  │
    │ │ (firmware pending tune) │  │
    │ └─────────────────────────┘  │
    └──────────────────────────────┘
```

---

## 🧪 Testing & Verification

### Manual Testing Procedure
1. **Start backend API:**
  ```bash
  cd Interface
  uvicorn server:app --host 0.0.0.0 --port 8000
  ```

2. **Start frontend + test servers (development mode):**
   ```bash
  # Terminal 1: Frontend
   cd frontend
   npx vite --port 5173

   # Terminal 2: CNN Test Server
   cd frontend/test-servers
   node cnn-test-server.js

   # Terminal 3: HEAD Test Server
   cd frontend/test-servers
   node head-test-server.js
   ```

3. **Access UI:**
   - Frontend: http://localhost:5173
   - CNN Controller: http://localhost:8001
   - HEAD Controller: http://localhost:8002

4. **Test Scenarios:**
   - Click buttons on test controller UIs
   - Verify commands appear in frontend console
   - Check WebSocket connections in browser DevTools
   - Test Settings customization
   - Verify localStorage persistence

### Known Issues
- ✅ CORS errors fixed (settings fetch disabled in dev mode)
- ✅ WebSocket connection failures fixed (proper upgrade handler)
- ✅ Command double-clicks fixed (useRef for throttling)
- ⚠️ CNN predictions still unreliable in some sessions (dataset quality/domain consistency still in progress)

---

## 📊 Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| **Input Modes Supported** | 3 (HEAD, Eyes, CNN) | ✅ |
| **Test Servers** | 2 (CNN, HEAD) | ✅ |
| **Command Throttling** | 200ms (customizable) | ✅ |
| **Dwell Time Configurable** | Yes | ✅ |
| **Settings Persistence** | localStorage | ✅ |
| **Frontend Build Size** | 486KB (145KB gzipped) | ✅ |
| **Lines of Code (InputControlContext)** | 686 | - |

---

## 🚀 Next Steps (Recommended Priority)

### High Priority
1. **Train CNN Model** (accuracy critical)
   - Collect larger dataset
   - Implement data augmentation
   - Tune model hyperparameters
   - Evaluate on test set

2. **Implement ESP32 Accelerometer Firmware**
   - Read sensor data
   - Send to backend via HTTP/WebSocket
   - Calibrate thresholds

3. **Integrate AI Chat System**
   - Connect frontend to backend service
   - Add to InputControlContext
   - Test voice/text input flow

### Medium Priority
4. **Design & 3D Print Headband Mount** 🎧
   - Create 3D model for headband holding XIAO ESP32S3 Sense + accelerometer
   - Design should be:
     - Lightweight and comfortable for extended wear
     - Secure mount for sensor alignment
     - Cable routing for accelerometer connection
   - Reference case for XIAO ESP32S3 Sense: https://www.hackster.io/tech_nickk/the-smallest-diy-camera-using-xiao-esp32s3-sense-0f7859
   - Export model for 3D printing (STL format)
   - Test printed prototype

5. Frontend styling and UI polish
6. Keyboard input mode
7. Hardcoded phrase catalog

### Low Priority
7. Advanced features (logging, analytics, etc.)

---

## 📝 Notable Code Changes

### `InputControlContext.jsx`
- **Lines 114:** Added `headLastCmdTimeRef` for throttling
- **Lines 130-215:** HEAD control with WebSocket fallback
- **Lines 150-160:** Localhost detection for dev/prod
- **Lines 35-39:** `getHeadSelectionMethod()` utility
- **Total refactor:** Reduced from multiple files to single hub

### `Settings.jsx`
- **Lines 47-51:** Added `headSelectionMethod` state
- **Lines 108-112:** Persistence effect
- **Lines 150-168:** HEAD selection UI dropdown

### Test Servers
- **New files:** `frontend/test-servers/cnn-test-server.js`, `head-test-server.js`
- **Features:** Command simulation, WebSocket broadcasting, HTTP UI
- **Documentation:** Comprehensive README with setup instructions

---

## 🔗 Related Documentation

- **Frontend Setup:** [frontend/README.md](frontend/README.md)
- **Test Server Guide:** [frontend/test-servers/README.md](frontend/test-servers/README.md)
- **Main Project README:** [README.md](README.md)

---

## ❓ For More Information

- **ESP32-CAM Integration & CNN Training Details:** Please start a new chat with the starter "ESP32-CAM & CNN Integration Details" for deep-dive information on:
  - CNN model architecture and training
  - Dataset collection strategies
  - Model optimization and fine-tuning
  - Hardware integration challenges
  - Performance benchmarking

---

**Last Updated:** April 7, 2026  
**Contributors:** Development Team  
**Status:** Active Development ✅
