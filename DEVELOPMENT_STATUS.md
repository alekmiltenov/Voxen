# VOXEN - Development Status Report
**Date:** April 7, 2026  
**Project:** Unified Input Control System for Accessibility Interface

---

## 📋 Executive Summary

Significant progress has been made on the **unified input control architecture**. The system now supports three independent input modes (HEAD, MediaPipe/Eyes, CNN) with a single consistent interface, comprehensive testing infrastructure, and improved customization options. The codebase has been refactored for maintainability and extensibility.

---

## 🔧 What Has Been Implemented

### 1. **ESP32-CAM Integration** ✅
- **Status:** Connected and streaming
- **Implementation:** Live camera feed from ESP32-CAM → Backend processing → Frontend display
- **Features:**
  - Real-time video streaming to the system
  - Connected to CNN model for eye gaze prediction
  - WebSocket-based real-time communication

⚠️ **Important Note:** The CNN model is **not properly trained yet**, resulting in poor prediction accuracy. For detailed information about CNN model training, dataset collection, and optimization strategies, please open a separate chat with the conversation starter "ESP32-CAM & CNN Integration Details".

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
- Selection: CLOSED + dwell timer
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
  - Closed eye simulator (blink detection)
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
├── server.py                            ← Main API server
├── eyetracking.py                       ← CNN integration
└── ...

eye_tracking/
├── model.pt                             ← Trained CNN weights
├── nn_server.py                         ← WebSocket server for predictions
├── collect.py                           ← Dataset collection
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

### 2. **Accelerometer Integration in ESP32** ❌
- [ ] Firmware code for accelerometer readings
- [ ] Calibration and threshold tuning
- [ ] Sensor fusion (if combining multiple sensors)
- [ ] Power optimization for continuous polling

**Note:** The HEAD control system is fully implemented on the frontend side. Backend ESP32 firmware for accelerometer is needed to complete this feature.

---

### 2. **Keyboard Controllable Interface** ❌
- [ ] Keyboard event handlers
- [ ] Remappable key bindings
- [ ] Keyboard accessibility mode
- [ ] Arrow key support for navigation

**Why:** Prioritized other input modes first. Would be relatively straightforward to add using standard React event handlers.

---

### 3. **AI Chat Controllable Interface** ❌
- **Status:** Backend service exists (`Action_Space/ai_chat_service.py`)
- **Missing:**
  - [ ] Integration with InputControlContext
  - [ ] WebSocket connection for real-time chat
  - [ ] Natural language command parsing
  - [ ] Response streaming to frontend
  - [ ] Error handling and fallbacks

**Note:** Backend infrastructure exists but frontend integration not started.

---

### 4. **Frontend Styling (UI/UX Polish)** ❌
- [ ] Visual consistency across all pages
- [ ] Dark/Light theme support
- [ ] Responsive design for different screen sizes
- [ ] Accessibility (ARIA labels, color contrast)
- [ ] Animation and transitions
- [ ] Loading states and error displays

**Current State:** Functional UI with basic styling. Works but needs professional design polish.

---

### 5. **Catalog of Hardcoded Phrases** ❌
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
│  │ (test server or backend)           │ │
│  │                                    │ │
│  ├─ Eyes Mode ───► Local video       │ │
│  │ (MediaPipe, browser-based)         │ │
│  │                                    │ │
│  ├─ CNN Mode ────► WS :8001/ws/predict
│  │ (test server or backend)           │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Settings ─────► localStorage          │
│  (dwell, selection method, etc.)       │
└─────────────────────────────────────────┘
         │                  │
         ▼                  ▼
    ┌──────────────────────────────┐
    │    BACKEND (Python)          │
    │ http://10.237.97.128:5000    │
    │                              │
    │ ┌─────────────────────────┐  │
    │ │ HEAD Control Handler    │  │
    │ │ POST /head/data         │  │
    │ │ WS /ws/head             │  │
    │ └─────────────────────────┘  │
    │                              │
    │ ┌─────────────────────────┐  │
    │ │ CNN Prediction Service  │  │
    │ │ WS /ws/predict          │  │
    │ │ (via nn_server.py)      │  │
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
    │ │ ESP32-CAM               │  │
    │ │ (camera + CNN model)    │  │
    │ └─────────────────────────┘  │
    │ ┌─────────────────────────┐  │
    │ │ ESP32 (pending)         │  │
    │ │ (accelerometer)         │  │
    │ └─────────────────────────┘  │
    └──────────────────────────────┘
```

---

## 🧪 Testing & Verification

### Manual Testing Procedure
1. **Start all servers:**
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

2. **Access UI:**
   - Frontend: http://localhost:5173
   - CNN Controller: http://localhost:8001
   - HEAD Controller: http://localhost:8002

3. **Test Scenarios:**
   - Click buttons on test controller UIs
   - Verify commands appear in frontend console
   - Check WebSocket connections in browser DevTools
   - Test Settings customization
   - Verify localStorage persistence

### Known Issues
- ✅ CORS errors fixed (settings fetch disabled in dev mode)
- ✅ WebSocket connection failures fixed (proper upgrade handler)
- ✅ Command double-clicks fixed (useRef for throttling)
- ⚠️ CNN predictions unreliable (model not trained)

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
4. Frontend styling and UI polish
5. Keyboard input mode
6. Hardcoded phrase catalog

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
