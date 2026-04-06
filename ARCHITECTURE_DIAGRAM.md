# Architecture Diagram: Unified Input Model

## System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         Voxen Interface                            │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    React App (Frontend)                     │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │   App.jsx → Router → Page Components                 │ │  │
│  │  │   (Home, Communicate, Actions, AIChat, etc.)         │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                           ↑                               │  │
│  │                      (standard commands)                  │  │
│  │                  (NAVIGATE_UP/DOWN/LEFT/RIGHT,            │  │
│  │                   SELECT, BACK, MENU)                    │  │
│  │                           ↑                               │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │   useUnifiedInput Hook (NEW)                         │ │  │
│  │  │   - Maps mode-specific commands to standard          │ │  │
│  │  │   - Pages don't know about HEAD vs EYES vs CNN       │ │  │
│  │  │   - Single source of truth for command mapping       │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                           ↑                               │  │
│  │              (mode-specific commands: UP, DOWN,            │  │
│  │               LEFT, RIGHT, FORWARD, BACK)                 │  │
│  │                           ↑                               │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │   InputControlContext (MODIFIED)                     │ │  │
│  │  │   - Manages all input modes (HEAD, EYES, CNN)        │ │  │
│  │  │   - NEW: BACK gesture for Eyes modes                 │ │  │
│  │  │     * Eyes: center gaze 2s → BACK                    │ │  │
│  │  │     * CNN: closed eyes 3s → BACK                     │ │  │
│  │  │   - Dispatches commands to pages                     │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                           ↑                               │  │
│  │  ┌─────────────┬──────────────┬──────────────────────┐   │  │
│  │  │ HEAD Control│ Eyes (MP)    │ CNN (ESP32)          │   │  │
│  │  │ ESP32 /w    │ Browser      │ ESP32 with Camera    │   │  │
│  │  │ MPU6050     │ MediaPipe    │ PyTorch Model        │   │  │
│  │  │             │              │                      │   │  │
│  │  │ LEFT, RIGHT,│ UP, DOWN,    │ UP, DOWN,           │   │  │
│  │  │ FORWARD,    │ LEFT, RIGHT, │ LEFT, RIGHT,        │   │  │
│  │  │ BACK        │ + NEW:       │ + NEW:              │   │  │
│  │  │             │ CENTER→BACK  │ CLOSED→BACK         │   │  │
│  │  └─────────────┴──────────────┴──────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Gaze → Command → Action

```
                    ┌─────────────────────────┐
                    │   User Input            │
                    │  (gaze, head tilt)      │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ InputControlContext     │
                    │ (detect gesture)        │
                    │  Eyes: center → BACK    │
                    │  CNN: closed → BACK     │
                    │  HEAD: tilt → cmd       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ dispatch(cmd)           │
                    │ (e.g., "FORWARD")       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ useUnifiedInput Hook    │
                    │ (normalize command)     │
                    │ "FORWARD" → "SELECT"    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Page Handler            │
                    │ setHandlers({           │
                    │   select: () => {…}     │
                    │ })                      │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Page State Update       │
                    │ (add word, navigate,    │
                    │  click button, etc.)    │
                    └─────────────────────────┘
```

---

## Component Hierarchy: Unified Commands

```
                        App.jsx
                          │
            ┌─────────────┴─────────────┐
            │                           │
    InputControlProvider        BrowserRouter
            │                           │
    InputControlContext          Routes (5 pages)
            │                           │
            ├─ mode                ┌────┴────┬────────┬────────┐
            ├─ register/unregister │         │        │        │
            ├─ dispatch           Home    Comm.   Actions   AIChat
            │
            └─ All page components call:
                  useInputControl()
                  useUnifiedInput()
                  
               setHandlers({
                 navigateUp: () => {},
                 navigateDown: () => {},
                 navigateLeft: () => {},
                 navigateRight: () => {},
                 select: () => {},
                 back: () => {},
               })
```

---

## Communicate Page: Grid Navigation

```
┌─────────────────────────────────────────────┐
│         COMMUNICATE PAGE                    │
│                                             │
│  Row 0 (Menu):                              │
│  ┌───────────────────────────────────────┐ │
│  │ [← Back] [Keyboard] [Speak] [Clear]  │ │
│  │  ◄────────────────────────────────►   │ │
│  │       navigate via LEFT/RIGHT         │ │
│  └───────────────────────────────────────┘ │
│     ▲                                       │
│     │ UP/DOWN moves between rows            │
│     ▼                                       │
│  Row 1 (Content):                           │
│  ┌───────────────────────────────────────┐ │
│  │ [I] [Need] [Help] [Want] [Please]... │ │
│  │ ◄──────────────────────────────────► │ │
│  │      navigate via LEFT/RIGHT         │ │
│  │      select via SELECT or dwell      │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Status:                                    │
│  Row: Menu | Col: 1/4 | 🔊 Speaking...     │
│                                             │
└─────────────────────────────────────────────┘

Navigation Commands (all input modes):
  UP → move from Row 1 to Row 0
  DOWN → move from Row 0 to Row 1
  LEFT → move left within row (wrap to right)
  RIGHT → move right within row (wrap to left)
  SELECT → activate current item
  BACK → exit or backspace
```

---

## Input Mode Command Mapping

```
╔══════════════════════════════════════════════════════════════╗
║            COMMAND MAPPING LOGIC                             ║
║  (Implemented in useUnifiedInput Hook)                       ║
╚══════════════════════════════════════════════════════════════╝

┌────────────────────────────────────────────────────────────┐
│ if (mode === "head") {                                     │
│   UP/DOWN/LEFT/RIGHT are not used in HEAD mode             │
│   LEFT → NAVIGATE_LEFT                                     │
│   RIGHT → NAVIGATE_RIGHT                                   │
│   FORWARD → SELECT                                         │
│   BACK → BACK                                              │
│ }                                                          │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ if (mode === "eyes" || mode === "cnn") {                  │
│   UP → NAVIGATE_UP                                         │
│   DOWN → NAVIGATE_DOWN                                     │
│   LEFT → NAVIGATE_LEFT                                     │
│   RIGHT → NAVIGATE_RIGHT                                   │
│   FORWARD (from dwell) → SELECT                            │
│   BACK (from gesture) → BACK                               │
│ }                                                          │
└────────────────────────────────────────────────────────────┘

Result: All modes map to standard commands ✓
        Pages only handle standard commands ✓
        No mode-specific logic in pages ✓
```

---

## BACK Gesture Implementation

```
┌──────────────────────────────────────────────────────┐
│      BACK GESTURE: Eyes MediaPipe                    │
│                                                      │
│  Gaze Direction ──────────────────────────────────┐ │
│                                                   │ │
│    LEFT   UP   RIGHT                              │ │
│     ↙     ↑     ↗                                  │ │
│       ╲   │   ╱                                    │ │
│         ╲ │ ╱                                      │ │
│        ╌─●─╌  ← CENTER (gaze at neutral point)   │ │
│         ╱ │ ╲                                      │ │
│       ╱   │   ╲                                    │ │
│      ↙     ↓     ↘                                 │ │
│   DOWN  DOWN  DOWN                                 │ │
│                                                    │ │
│  State Machine:                                    │ │
│    START ──[gaze CENTER]──► TRACKING              │ │
│                                                    │ │
│    TRACKING ──[1s elapsed]──► TIMING (visual)      │ │
│                                                    │ │
│    TIMING ──[2s elapsed]──► dispatch("BACK")       │ │
│                                                    │ │
│    ANY STATE ──[gaze moves away]──► START          │ │
│                                                    │ │
│  Benefits:                                         │ │
│    ✓ Intuitive (reset gesture)                    │ │
│    ✓ Prevents accidental triggers                 │ │
│    ✓ Visual feedback (timing indicator)           │ │
│                                                    │ │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│      BACK GESTURE: Eyes CNN                         │
│                                                      │
│  Eye State ────────────────────────────────────────┐ │
│                                                   │ │
│    OPEN: Normal navigation                        │ │
│      ↓                                             │ │
│    CLOSED < 500ms ──► SELECT                      │ │
│      ↓                                             │ │
│    CLOSED 500ms–3s ──► wait (disambiguate)        │ │
│      ↓                                             │ │
│    CLOSED ≥ 3s ──────► dispatch("BACK")            │ │
│                                                    │ │
│  State Machine:                                    │ │
│    START ──[OPEN]──────────► READY                │ │
│      ↑                                              │ │
│      └──────[CLOSED < 500ms]──► SELECT fired       │ │
│                                                    │ │
│    READY ──[CLOSED]──► TIMING                     │ │
│                                                    │ │
│    TIMING ──[3s elapsed]──► dispatch("BACK")      │ │
│                                                    │ │
│  Benefits:                                         │ │
│    ✓ Simple (2 states: open/closed)               │ │
│    ✓ Clear distinction (< 500ms vs 3s)            │ │
│    ✓ No false positives from blinks               │ │
│                                                    │ │
└──────────────────────────────────────────────────────┘
```

---

## State Diagram: Input Mode Lifecycle

```
                    START
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
       HEAD        EYES (MP)     CNN
        MODE        MODE        MODE
          │           │           │
          │       ┌───┴───┐       │
          │       │       │       │
          │   ┌──▼──┐  ┌─▼──┐    │
          │   │Detec│  │Dete│    │
          │   │ting │  │ctin│    │
          │   │HEAD │  │g   │    │
          │   │Tilt │  │Iris│    │
          │   └──┬──┘  │Gaze│    │
          │      │     └─┬──┘    │
          ▼      │       │       ▼
      DISPATCH   ▼       ▼    DISPATCH
       "LEFT"  ┌─────────────┐  "UP"
       "RIGHT" │ Redux State │ "DOWN"
       "FOR"   │   Store     │ "LEFT"
       "BACK"  │             │ "RIGHT"
              │ Current Cmd │ "FOR"
              └──────┬──────┘ "BACK"
                     │       (+ NEW)
                     ▼
            ┌────────────────┐
            │ useUnifiedInput│
            │    (Map to     │
            │   Standard)    │
            └────────┬───────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    NAVIGATE_    NAVIGATE_   NAVIGATE_
      LEFT        UP        RIGHT
        │          │           │
        └──────────┼───────────┘
                   │
        ┌──────────┴───────────┐
        │                      │
        ▼                      ▼
    SELECT                  BACK
        │                      │
        ▼                      ▼
    Page State              Navigation
    Updates             (exit or undo)
```

---

## File Dependencies

```
App.jsx
  │
  ├─► InputControlProvider
  │      │
  │      ├─► InputControlContext.jsx (MODIFIED)
  │      │      │
  │      │      ├─► useInputControl hook
  │      │      │
  │      │      ├─► BACK gesture logic:
  │      │      │    ├─ Eyes: center gaze 2s
  │      │      │    └─ CNN: closed eyes 3s
  │      │      │
  │      │      └─► dispatch(cmd)
  │      │
  │      └─► Pages (Home, Communicate, etc.)
  │             │
  │             ├─► useInputControl()
  │             │
  │             ├─► useUnifiedInput() (NEW)
  │             │      │
  │             │      └─► setHandlers({
  │             │            navigateUp, navigateDown,
  │             │            navigateLeft, navigateRight,
  │             │            select, back, menu
  │             │          })
  │             │
  │             └─► Components (DwellButton, etc.)
  │
  └─► Communicate_NEW.jsx (NEW)
       │
       └─► Grid-based layout:
            ├─ Menu row (always accessible)
            ├─ Content row (starters/suggestions)
            └─ Same navigation for all modes
```

---

## Summary

| Layer | Component | Role | Status |
|-------|-----------|------|--------|
| **Raw Input** | HEAD / EYES / CNN | Capture user gesture | ✅ Existing |
| **Input Processing** | InputControlContext | Detect, debounce, fire command | ✅ Modified (added BACK gesture) |
| **Command Dispatch** | dispatch(cmd) | Fire mode-specific command | ✅ Existing |
| **Command Mapping** | useUnifiedInput | Map to standard commands | ✅ New (created) |
| **Page Logic** | Pages (Communicate, etc.) | Handle standard commands | ✅ New (redesigned) |
| **UI** | Grid layout | Display & interact | ✅ New (created) |

**Result:** Unified, accessible, extensible input model ✓

