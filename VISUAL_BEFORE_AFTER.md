# Communicate Page: Before vs After

## BEFORE: Mode-Specific, Menu Inaccessible (Eyes)

```
┌─────────────────────────────────────────┐
│                                         │
│  [Carousel of Starters/Suggestions]    │
│                                         │
│  [I need]  [I want]  [Help]  [Can you] │
│                                         │
│          ↑ UP/DOWN navigates carousel   │
│          ← LEFT command does different   │
│            things per mode              │
│                                         │
│  LEFT MENU (inaccessible in EYES):      │
│  - Keyboard                             │
│  - Speak                                │
│  - Last Word                            │
│  ❌ Can't reach with eyes!              │
│                                         │
└─────────────────────────────────────────┘
```

### Problems:
- 🔴 **Eyes modes can't access left menu** → No keyboard, can't speak, can't see history
- 🔴 **Eyes modes have no BACK** → Stuck on page, must click browser back button
- 🔴 **Mode-specific logic** → Each page reimplements HEAD vs EYES differently
- 🔴 **Hard to extend** → Adding new input mode requires rewriting all page logic

---

## AFTER: Unified Grid, All-Mode Accessible

```
┌──────────────────────────────────────────────────────────┐
│ [← Back] [⌨ Keyboard] [🔊 Speak] [✕ Clear]             │ ← Row 0: Menu
│ ←─────  Access via LEFT/RIGHT in ALL modes ─────────→   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Composed: "I need help"                                 │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [I]  [I need]  [I want]  [Help]  [Can you]  [Yes]     │ ← Row 1: Content
│  [No]  [Please]  [Thank you]  [I am]  […]              │
│  ←─  UP/DOWN moves to row 0  ─────→ ←─ LEFT/RIGHT in row ─→
│                                                          │
└──────────────────────────────────────────────────────────┘

Navigation in ALL input modes:
  UP/DOWN     → Move between Menu row and Content row
  LEFT/RIGHT  → Navigate within current row
  SELECT      → Activate (call function or add word)
  BACK        → Exit page or backspace last word

✓ Eyes can access menu (via LEFT/RIGHT)
✓ Eyes can go BACK (via gesture: center 2s / closed 3s)
✓ Same navigation pattern for HEAD, Eyes, CNN
✓ No mode-specific page logic
✓ Extensible to new input modes
```

---

## Input Mode Gesture Reference

### HEAD Mode
```
[Sensor: MPU6050 on ESP32]

  ↑ (FORWARD tilt)
    │
    │ 0.5s+ → SELECT
    │
←──●──→  LEFT/RIGHT for NAVIGATE
    │
    ↓ (BACK tilt)
    
  0.5s+ → BACK
```

### Eyes MediaPipe
```
[Camera: Laptop webcam]

Iris gaze directions:
      ↑ (gaze up)
      │
←─────●─────→  (gaze left/right)
      │
      ↓ (gaze down)

Dwell anywhere: 1.5s → SELECT
Stare at center: 2s → BACK (for navigating back)
```

### Eyes CNN (ESP32-CAM)
```
[Camera: ESP32-CAM on forehead]

Gaze directions:
      ↑ UP
      │
LEFT──●──RIGHT
      │
      ↓ DOWN (blends with CLOSED, unreliable)

Eye position:
  OPEN → Normal navigation
  CLOSED
    < 500ms → SELECT
    ≥ 3s   → BACK (for navigating back)
```

---

## Feature Comparison Table

| Feature | HEAD | EYES (Old) | CNN (Old) | HEAD (New) | EYES (New) | CNN (New) |
|---------|------|-----------|----------|-----------|-----------|----------|
| Navigate UP/DOWN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Navigate LEFT/RIGHT | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ |
| SELECT | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| BACK | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Access Menu | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Mode-Specific Code | Yes | Yes | Yes | No | No | No |
| Extensible | Hard | Hard | Hard | Easy | Easy | Easy |

---

## Example: Navigating to Keyboard in Different Modes

### OLD: Eyes MediaPipe
```
1. Dwell on "I" → selects starter
2. ❌ STUCK: Can't reach keyboard button (it's on left, eyes only have UP/DOWN)
3. Must click browser back, start over
```

### NEW: Eyes MediaPipe
```
1. Stare at center (dwell already active on suggestion)
2. Look UP (navigate to Menu row)
3. Look LEFT/RIGHT to find [⌨ Keyboard]
4. Dwell on [⌨ Keyboard] → navigates to keyboard page
✓ Done! All via eyes.
```

### NEW: Eyes CNN
```
1. Close eyes briefly (select word)
2. Look UP/DOWN (navigate to Menu row)
3. Look LEFT/RIGHT to find [⌨ Keyboard]
4. Close eyes briefly (select menu item) → navigates to keyboard page
✓ Done! All via eyes.
```

### NEW: HEAD
```
1. Tilt FORWARD (select word) [0.5s+]
2. Tilt UP/DOWN (navigate to Menu row)
3. Tilt LEFT/RIGHT to find [⌨ Keyboard]
4. Tilt FORWARD (select menu item) → navigates to keyboard page
✓ Done! Same as always.
```

---

## Implementation Checklist

### Phase 1: Core (READY TO TEST ✅)
- [x] Add BACK gesture for Eyes (center gaze 2s)
- [x] Add BACK gesture for CNN (closed eyes 3s)
- [x] Create useUnifiedInput hook
- [x] Create new Communicate page (grid-based)

### Phase 2: Testing (START HERE 👉)
- [ ] Manual test BACK gestures (Eyes & CNN)
- [ ] Manual test Communication page in all 3 modes
- [ ] Edge case testing (wrapping, timing, etc.)
- [ ] Browser console debugging

### Phase 3: Rollout (AFTER TESTING)
- [ ] Swap Communicate_NEW.jsx → Communicate.jsx
- [ ] Remove Communicate_OLD.jsx (once confirmed working)
- [ ] Create PR with tests
- [ ] Merge to main

### Phase 4: Extend (FUTURE)
- [ ] Apply to Actions page (already 2D grid)
- [ ] Apply to AIChat page
- [ ] Add Settings for BACK gesture durations
- [ ] Consider other pages (Settings, Pain, etc.)

---

## What's New

### ✨ BACK Gestures
- **Eyes:** Look at center for 2 seconds
- **CNN:** Hold eyes closed for 3 seconds
- **HEAD:** Already supported

### ✨ Unified Navigation
All pages use same commands; no mode-specific logic

### ✨ Menu Access in Eyes Modes
All menu items reachable via UP/DOWN/LEFT/RIGHT

### ✨ Grid Layout
Consistent 2D navigation across pages

---

Generated: 2026-04-06 | All input modes unified | Eyes modes now fully featured

