# Unified Input Model & Accessibility Improvements

## Problem Statement

Currently, Voxen has **three input modalities** with **inconsistent command sets** and **page-specific navigation logic**:

| Mode | Commands | Limitations |
|------|----------|-------------|
| **HEAD** | LEFT, RIGHT, FORWARD, BACK | None — fully featured |
| **EYES (MediaPipe)** | UP, DOWN, LEFT, RIGHT, DWELL | ❌ **No BACK** — can't exit pages |
| **CNN (ESP32)** | UP, DOWN, LEFT, RIGHT, CLOSED | ❌ **No BACK** — can't exit pages |

**Concrete Problem:** On Communication page with MediaPipe:
- Can navigate starters/suggestions with UP/DOWN ✓
- Can select with dwell ✓
- **Cannot access left menu (Keyboard, Speak, Clear)** ❌
- **Cannot go back without page redesign** ❌

---

## Solution: Normalized Input + Adaptive UI

### **Three Layers**

#### **1. Normalized Command Layer** (`useUnifiedInput.js`)

All input modes map to **standard commands**:
- `NAVIGATE_UP`, `NAVIGATE_DOWN`, `NAVIGATE_LEFT`, `NAVIGATE_RIGHT`
- `SELECT` (confirm)
- `BACK` (exit)
- `MENU` (open options)

**Mapping:**

```
HEAD Mode (no change):
  LEFT → NAVIGATE_LEFT
  RIGHT → NAVIGATE_RIGHT
  FORWARD → SELECT
  BACK → BACK

Eyes MediaPipe (ADD BACK):
  UP → NAVIGATE_UP
  DOWN → NAVIGATE_DOWN
  LEFT → NAVIGATE_LEFT
  RIGHT → NAVIGATE_RIGHT
  DWELL (gaze right 1.5s) → SELECT (existing)
  SUSTAINED CENTER GAZE (2s) → BACK [NEW]

Eyes CNN (ADD BACK):
  UP → NAVIGATE_UP
  DOWN → NAVIGATE_DOWN
  LEFT → NAVIGATE_LEFT
  RIGHT → NAVIGATE_RIGHT
  CLOSED (< 500ms) → SELECT (existing)
  CLOSED (held 3s) → BACK [NEW]
```

**Benefits:**
- ✓ Pages only handle standard commands, not mode-specific
- ✓ Consistent UX across all input modes
- ✓ Easy to add new modes later (e.g., voice)
- ✓ Eyes modes now have BACK!

---

#### **2. BACK Gesture Implementation**

**Eyes MediaPipe:** Stare at center of screen (neutral gaze position) for 2 seconds
- Intuitive: "reset" gesture = look at neutral position
- Non-intrusive: only fires if sustained; brief glances ignored
- Configurable in Settings

**Eyes CNN:** Close eyes for 3 seconds
- Simple: two eye positions (open/closed) only
- Distinct from SELECT: SELECT is < 500ms, BACK is 3s
- Leaves room for other gestures (e.g., blink count)

**Implementation:** Already added to `InputControlContext.jsx` (lines ~68–70, ~305–320)

---

#### **3. Grid-Based Page Layout**

**Old Communication Layout (inaccessible in eyes mode):**
```
[Carousel of starters/suggestions] 
  ← No menu access; UP/DOWN only navigates carousel
```

**New Communication Layout (grid-based, all-mode accessible):**
```
┌─────────────────────────────────────────────┐
│ [← Back]  [⌨ Keyboard]  [🔊 Speak]  [✕ Clear] │ ← Row 0: Menu (LEFT/RIGHT to navigate)
├─────────────────────────────────────────────┤
│  Composed text: "I need help with medicine" │
├─────────────────────────────────────────────┤
│  [I]  [I need]  [I want]  [Help]  [Can you] │ ← Row 1: Content (LEFT/RIGHT/UP/DOWN)
│  [Yes] [No]  [Please]  [Thank you]  […]   │
└─────────────────────────────────────────────┘
```

**Navigation:**
- `UP` / `DOWN`: Move between Menu row and Content row
- `LEFT` / `RIGHT`: Move within current row
- `SELECT`: Activate (call function or select word)
- `BACK`: Exit or backspace

**Benefits:**
- ✓ All menu items accessible from any input mode
- ✓ Consistent 2D grid pattern (like Actions page)
- ✓ Visual feedback shows current selection
- ✓ No mode-specific logic per page

---

## Implementation Roadmap

### **Phase 1: Core Layer (DONE)**
- [x] Add `useUnifiedInput.js` hook
- [x] Implement BACK gesture for Eyes MediaPipe (center gaze 2s)
- [x] Implement BACK gesture for Eyes CNN (closed eyes 3s)
- [x] Add BACK command mapping in `InputControlContext.jsx`

### **Phase 2: Redesign Communication Page**
- [ ] Replace `Communicate.jsx` with `Communicate_NEW.jsx` (grid-based)
  ```bash
  cd frontend/src/pages
  mv Communicate.jsx Communicate_OLD.jsx
  mv Communicate_NEW.jsx Communicate.jsx
  ```
- [ ] Test menu navigation in all three input modes
- [ ] Test word selection in all modes
- [ ] Test BACK gesture in all modes

### **Phase 3: Generalize to Other Pages** (Optional)
- [ ] Apply same grid pattern to `Actions.jsx` (already 2D; just add visual feedback)
- [ ] Apply to `AIChat.jsx` (add top menu bar)
- [ ] Consider for `Home.jsx` (already working well)

### **Phase 4: Settings & Tuning**
- [ ] Add setting to adjust "CENTER gaze duration for BACK" (default 2s)
- [ ] Add setting to adjust "CLOSED eyes duration for BACK" (default 3s)
- [ ] Add visual hint in bottom-right corner: "Look center 2s to go back" / "Hold eyes closed 3s to go back"

---

## Testing Checklist

### **Manual Testing (All Input Modes)**

#### **HEAD Mode**
```
✓ Navigate menu: LEFT/RIGHT moves between [Back], [Keyboard], [Speak], [Clear]
✓ Select: FORWARD activates menu item or selects word
✓ Go back: BACK command works
✓ Backspace: BACK command on composed words removes last word
```

#### **Eyes MediaPipe**
```
✓ Navigate menu: LEFT/RIGHT moves between menu items
✓ Select: Dwell on word for 1.5s to add to composition
✓ Go back: Stare at center of screen for 2s
✓ Visual feedback: Selected item highlights in green
✓ No double-fire: Dwell complete, must look away before next dwell
```

#### **Eyes CNN**
```
✓ Navigate menu: LEFT/RIGHT moves between menu items
✓ Select: Close eyes briefly (< 500ms) to add word
✓ Go back: Hold eyes closed for 3s
✓ Visual feedback: Selected item highlights in green
✓ Settings: Can adjust closed-eyes duration
```

### **Unit Tests**

```javascript
// tests/useUnifiedInput.test.js
describe("useUnifiedInput", () => {
  it("maps HEAD LEFT to NAVIGATE_LEFT", () => { … });
  it("maps EYES UP to NAVIGATE_UP", () => { … });
  it("maps CNN CLOSED 3s to BACK", () => { … });
  it("pages only handle standard commands, not mode-specific", () => { … });
});

// tests/Communicate.integration.test.jsx
describe("Communicate (grid-based)", () => {
  it("navigates menu with LEFT/RIGHT in all modes", () => { … });
  it("navigates content with UP/DOWN in all modes", () => { … });
  it("selects item with SELECT in all modes", () => { … });
  it("exits page with BACK in all modes", () => { … });
});
```

---

## File Changes Summary

| File | Change | Status |
|------|--------|--------|
| `frontend/src/hooks/useUnifiedInput.js` | **NEW** — Normalized command mapping | ✅ Created |
| `frontend/src/pages/InputControlContext.jsx` | Add BACK gesture (center 2s, closed 3s) | ✅ Edited |
| `frontend/src/pages/Communicate_NEW.jsx` | **NEW** — Grid-based layout | ✅ Created |
| `frontend/src/pages/Communicate.jsx` | Replace with `Communicate_NEW.jsx` | ⏳ Pending |
| `frontend/src/pages/Actions.jsx` | Apply unified commands + visual feedback | ⏳ Future |
| `frontend/src/pages/AIChat.jsx` | Add top menu bar + unified commands | ⏳ Future |
| `frontend/src/pages/Settings.jsx` | Add "BACK gesture duration" settings | ⏳ Future |

---

## Why This Works

### **Problem: Input Mode Inconsistency**
**Before:** Each page has mode-specific handlers (HEAD vs EYES). Eyes modes lack BACK.

**After:** Pages handle only standard commands. Input modes normalize below. Eyes modes have BACK.

### **Problem: Menu Inaccessibility**
**Before:** Communication page carousel only uses UP/DOWN; no way to access left menu in eyes modes.

**After:** Grid layout with UP/DOWN for rows, LEFT/RIGHT for columns. All menu items accessible in all modes.

### **Problem: No Way to Exit (Eyes Modes)**
**Before:** No BACK command in eyes modes; users stuck on page or must reach for mouse.

**After:** BACK gestures (center gaze 2s / closed eyes 3s) allow eyes-only navigation.

---

## Rollout Strategy

**Step 1:** Test Phase 1 changes (BACK gestures) on a branch
```bash
cd frontend
git checkout -b feature/unified-input
npm run dev
# Manual test: Try sustained center gaze / long eye closure
```

**Step 2:** Swap in new Communication page; test all modes
```bash
mv src/pages/Communicate.jsx src/pages/Communicate_OLD.jsx
mv src/pages/Communicate_NEW.jsx src/pages/Communicate.jsx
npm run dev
# Manual test: Navigate menu, select words, go back in all 3 modes
```

**Step 3:** Create unified settings page option (future)
```bash
# Add sliders for BACK gesture durations
# Show hints in Settings page
```

**Step 4:** Merge to main once all testing passes
```bash
git commit -m "feat: unified input model with grid-based communication page"
git push origin feature/unified-input
# Create PR, request review
```

---

## Open Questions & Future Ideas

1. **Blink count for CNN?** Could use 2 blinks to open menu, 3 blinks to execute action (instead of just CLOSED duration).
2. **Voice mode?** Once speech recognition is added, could map voice commands ("back", "menu", "select") to standard commands.
3. **Gesture mode?** Hand tracking via MediaPipe could add pinch gestures, swipe gestures, etc.
4. **Mobile?** Touch input maps easily: swipe UP/DOWN/LEFT/RIGHT → NAVIGATE, tap → SELECT.
5. **Undo?** Could add a separate gesture for "undo last word" (distinct from BACK).

---

## Success Metrics

After implementation, measure:

1. **Accessibility:** Users in Eyes modes can:
   - Access all menu items ✓
   - Navigate pages without getting stuck ✓
   - Use same interaction pattern across all pages ✓

2. **Consistency:** All three input modes can:
   - Navigate any page without mode-specific code ✓
   - Execute same actions with same gesture ✓
   - Have clear visual feedback for selection ✓

3. **Usability:** Users report:
   - No confusion about how to navigate ✓
   - No accidental back/select from stray gaze ✓
   - Consistent experience across Communication, Actions, Home ✓

---

Generated: 2026-04-06 | Input: HEAD + Eyes (MediaPipe + CNN) | Unified: Standard Commands

