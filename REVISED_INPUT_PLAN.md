# Revised Input System Plan (Option 2 + Customizable CENTER/CLOSED)

**Date:** April 6, 2026  
**Status:** Planning Phase — Awaiting Approval  
**Version:** 2.0 (Revised from BACK gestures approach)

---

## Executive Summary

**Previous Approach (❌ Rejected):**
- Added hidden BACK gestures (2-3 second sustained center gaze / closed eyes)
- Merged all modes to unified commands
- Poor UX: slow gestures, MediaPipe tracking dead zones

**New Approach (✅ Approved):**
- Keep each input mode's **natural commands** (no merging)
- Add visible **BACK button** on every page (header, always accessible)
- Make CENTER/CLOSED customizable in Settings (optional, not hidden)
- Fast, discoverable, mode-optimized UX

---

## Input Modes (Native Commands Only)

### HEAD Mode (ESP32 + Socket.io)
```
Inputs:  LEFT, RIGHT, FORWARD
Usage:   2D horizontal navigation + select
Example: Communicate page: LEFT/RIGHT navigate menu items, FORWARD selects
```

### MediaPipe Iris (Laptop Camera)
```
Inputs:  UP, DOWN, LEFT, RIGHT, CENTER
Native:  UP/DOWN/LEFT/RIGHT navigate, CENTER gaze = detect
Custom:  CENTER can map to SELECT if enabled in Settings
Example: Communicate page: UP/DOWN move between rows, LEFT/RIGHT move within row, 
          dwell activates, CENTER optionally = SELECT
```

### CNN Eye Tracking (ESP32-CAM + PyTorch)
```
Inputs:  UP, DOWN, LEFT, RIGHT, CLOSED
Native:  UP/DOWN/LEFT/RIGHT navigate, CLOSED = detect
Custom:  CLOSED can map to SELECT if enabled in Settings
Example: Communicate page: UP/DOWN/LEFT/RIGHT navigate grid, 
          closed eyes 500ms = SELECT, CLOSED long-held optionally = SELECT alt
```

---

## Design: BACK Button on Every Page

### Where?
```
┌─────────────────────────────────────────┐
│ [← Back] | Page Title / Controls        │  ← Header row (always present)
├─────────────────────────────────────────┤
│                                         │
│         Main Content Area               │
│         (Navigation: UP/DOWN/LEFT/RIGHT)│
│                                         │
└─────────────────────────────────────────┘
```

### How to Interact?
- **HEAD mode:** LEFT arrow key or navigate to it, FORWARD selects (or keyboard ESC)
- **MediaPipe:** UP arrow or navigate to it, dwell selects (or dwell anywhere, ESC key)
- **CNN:** UP arrow or navigate to it, closed eyes 500ms selects (or keyboard ESC)

### What It Does?
```javascript
<BackButton onClick={() => navigate(-1)} />
// OR
<BackButton onClick={() => navigate("/")} />
// Page owner decides (back to previous page or home)
```

### Accessibility
- Always in same position (top-left) → familiar
- Visual affordance → users see it immediately
- No learning curve required
- Keyboard shortcut (ESC) for testing/accessibility

---

## Settings Customization

### New Settings Toggles (localStorage)

**Setting 1: MediaPipe CENTER Gaze Behavior**
```
Label:       "MediaPipe: Center Gaze Function"
Default:     "disabled"
Options:     
  - "disabled"      → CENTER gaze ignored
  - "select"        → CENTER gaze = SELECT (alternative to dwell)
  - "reserved"      → Disabled for future features
```

**Setting 2: CNN CLOSED Eyes Behavior**
```
Label:       "CNN: Closed Eyes Function"
Default:     "select"
Options:
  - "disabled"      → CLOSED ignored
  - "select"        → CLOSED held 500ms = SELECT (dual-mode with dwell)
  - "reserved"      → Disabled for future features
```

### Storage
```javascript
// localStorage keys
localStorage.setItem("mediapiapeCenterMode", "disabled"); // or "select"
localStorage.setItem("cnnClosedMode", "select");          // or "disabled"

// Retrieve in InputControlContext
const centerMode = localStorage.getItem("mediapiapeCenterMode") || "disabled";
const closedMode = localStorage.getItem("cnnClosedMode") || "select";

// Dispatch conditionally
if (centerMode === "select" && direction === "CENTER") {
  dispatch("FORWARD");  // SELECT = FORWARD in existing code
}
if (closedMode === "select" && dir === "CLOSED") {
  dispatch("FORWARD");  // SELECT = FORWARD
}
```

### UI (Settings.jsx)
```jsx
<div className="setting-group">
  <label>MediaPipe Center Gaze</label>
  <select value={mediapiaCenterMode} onChange={...}>
    <option value="disabled">Disabled</option>
    <option value="select">Map to Select</option>
    <option value="reserved">Reserved for Future</option>
  </select>
  <small>If "select", staring at center gaze = confirm/select</small>
</div>

<div className="setting-group">
  <label>CNN Closed Eyes</label>
  <select value={cnnClosedMode} onChange={...}>
    <option value="disabled">Disabled</option>
    <option value="select">Map to Select</option>
    <option value="reserved">Reserved for Future</option>
  </select>
  <small>If "select", closed eyes = confirm/select (alternative to dwell)</small>
</div>
```

---

## Files to Modify

### 1. InputControlContext.jsx
**Action:** Revert BACK gesture changes + add customizable CENTER/CLOSED

**Changes:**
- ❌ Remove: refs `backCenterStartRef`, `backCenterFiredRef` (lines 68-70)
- ❌ Remove: CENTER gaze 2s → BACK logic (lines 305-325)
- ❌ Remove: CLOSED 3s → BACK logic (lines 290-298)
- ✅ Add: Read `mediapiapeCenterMode` and `cnnClosedMode` from localStorage
- ✅ Add: Conditional dispatch:
  ```javascript
  // MediaPipe CENTER
  if (centerMode === "select" && direction === "CENTER") {
    dispatch("FORWARD");
  }
  
  // CNN CLOSED
  if (closedMode === "select" && dir === "CLOSED") {
    dispatch("FORWARD");
  }
  ```

**Lines affected:** ~50 lines total (10 removed, 20 added)

---

### 2. Settings.jsx
**Action:** Add MediaPipe + CNN behavior toggles

**Changes:**
- ✅ Add: MediaPipe CENTER mode selector
- ✅ Add: CNN CLOSED mode selector
- ✅ Add: Handler to save to localStorage
- ✅ Add: Help text explaining each option

**New code:** ~40 lines

---

### 3. Communicate.jsx
**Action:** Add BACK button to header

**Changes:**
- ✅ Add: Import `useNavigate` hook
- ✅ Add: `<BackButton>` component in header
- ✅ Add: OnClick → `navigate(-1)`

**New code:** ~5 lines

---

### 4. Keyboard.jsx
**Action:** Add BACK button to header

**Changes:** Same as Communicate.jsx (~5 lines)

---

### 5. Home.jsx
**Action:** Add BACK button to header (if applicable)

**Changes:** ~5 lines

---

### 6. AIChat.jsx
**Action:** Add BACK button to header

**Changes:** ~5 lines

---

### 7. Actions.jsx
**Action:** Add BACK button to header

**Changes:** ~5 lines

---

### 8. useUnifiedInput.js
**Action:** Delete entirely (no longer needed)

---

### 9. Communicate_NEW.jsx
**Action:** Delete entirely (no longer needed)

---

## Files NOT Modified

- ❌ App.jsx (routing unchanged)
- ❌ InputControlContext.jsx dispatch logic (existing commands stay)
- ❌ api.js (backend API unchanged)
- ❌ server.py (no backend changes needed)
- ❌ Eye tracking models (unchanged)

---

## Implementation Steps (Execution Order)

### Step 1: Clean Up
- [ ] Delete `useUnifiedInput.js`
- [ ] Delete `Communicate_NEW.jsx`

### Step 2: Revert InputControlContext.jsx
- [ ] Remove BACK gesture refs (lines 68-70)
- [ ] Remove CENTER gaze logic (lines 305-325)
- [ ] Remove CLOSED eyes logic (lines 290-298)
- [ ] Verify: File compiles, no dispatch errors

### Step 3: Add Customization to InputControlContext.jsx
- [ ] Read `mediapiapeCenterMode` from localStorage
- [ ] Read `cnnClosedMode` from localStorage
- [ ] Add conditional dispatch for CENTER → SELECT
- [ ] Add conditional dispatch for CLOSED → SELECT
- [ ] Test: Verify console logs new behavior

### Step 4: Update Settings.jsx
- [ ] Add MediaPipe CENTER toggle UI
- [ ] Add CNN CLOSED toggle UI
- [ ] Add localStorage save/load handlers
- [ ] Test: Toggle settings, verify localStorage updated

### Step 5: Add BACK Button to All Pages
- [ ] Communicate.jsx: Add BACK button
- [ ] Keyboard.jsx: Add BACK button
- [ ] Home.jsx: Add BACK button (if needed)
- [ ] AIChat.jsx: Add BACK button
- [ ] Actions.jsx: Add BACK button

### Step 6: Verify Compilation
- [ ] Run `npm run dev`
- [ ] Check for errors in console
- [ ] No TypeScript/ESLint issues

### Step 7: Manual Testing
- [ ] Test HEAD mode: LEFT/RIGHT/FORWARD work, BACK button accessible
- [ ] Test MediaPipe: UP/DOWN/LEFT/RIGHT work, CENTER toggle in Settings
- [ ] Test CNN: UP/DOWN/LEFT/RIGHT work, CLOSED toggle in Settings
- [ ] Toggle Settings → verify behavior changes

---

## Testing Checklist

### Functional Tests
- [ ] BACK button visible on all 5 pages
- [ ] BACK button navigates back (or to home, depending on design)
- [ ] HEAD mode: LEFT/RIGHT/FORWARD work unchanged
- [ ] MediaPipe: UP/DOWN/LEFT/RIGHT work unchanged
- [ ] CNN: UP/DOWN/LEFT/RIGHT work unchanged

### Settings Tests
- [ ] MediaPipe CENTER mode "disabled" → CENTER gaze has no effect
- [ ] MediaPipe CENTER mode "select" → CENTER gaze = SELECT
- [ ] CNN CLOSED mode "disabled" → CLOSED ignored
- [ ] CNN CLOSED mode "select" → CLOSED = SELECT
- [ ] Settings persist across page reload (localStorage works)

### Edge Cases
- [ ] Toggle CENTER mode while on Communicate page → behavior changes immediately
- [ ] Navigate to page with BACK button in different modes → button always works
- [ ] BACK button accessible from all input modes equally
- [ ] No console errors or warnings

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    User Input (3 Modes)                  │
├──────────────┬──────────────┬───────────────────────────┤
│   HEAD       │  MediaPipe   │        CNN                 │
│ (Socket.io)  │  (Iris)      │   (ESP32-CAM)             │
├──────────────┼──────────────┼───────────────────────────┤
│ LEFT         │ UP           │ UP                         │
│ RIGHT        │ DOWN         │ DOWN                       │
│ FORWARD      │ LEFT         │ LEFT                       │
│ (no BACK)    │ RIGHT        │ RIGHT                      │
│              │ CENTER ◄─────┤ CLOSED ◄─────────────┐     │
│              │ (optional)   │ (optional)           │     │
└──────────────┴──────────────┴───────────────────────┘     │
               │                    │                       │
               └────────────────────┴──────────┬────────┐   │
                                              │        │   │
                                   InputControlContext  │   │
                                   (reads localStorage) │   │
                                              │        │   │
        ┌─────────────────────────────────────┴─────────┴──┐│
        │                                                  ││
        │  Page Components (Communicate, Keyboard, etc.)  ││
        │  ┌──────────────────────────────────────────┐  ││
        │  │ [← Back] | Page Title                    │  ││
        │  │ (BACK button always accessible)          │  ││
        │  │ + Content navigable via UP/DOWN/LEFT/... │  ││
        │  └──────────────────────────────────────────┘  ││
        │                                                  ││
        └──────────────────────────────────────────────────┘│
                                                            │
        ┌──────────────────────────────────────────────────┴┘
        │
        ▼
     Settings Page
     ┌────────────────────────────────────────┐
     │ MediaPipe CENTER: [disabled / select]   │
     │ CNN CLOSED:       [disabled / select]   │
     │ → saves to localStorage                 │
     └────────────────────────────────────────┘
```

---

## Success Criteria

**After implementation, these must be true:**

1. ✅ BACK button visible on all 5 active pages (Communicate, Keyboard, Home, AIChat, Actions)
2. ✅ BACK button works equally for all input modes (HEAD, MediaPipe, CNN)
3. ✅ CENTER gaze behavior customizable in Settings (disabled or map to SELECT)
4. ✅ CLOSED eyes behavior customizable in Settings (disabled or map to SELECT)
5. ✅ Settings persist across page reloads (localStorage)
6. ✅ No BACK gesture logic in InputControlContext (clean, no hidden gestures)
7. ✅ HEAD mode: LEFT/RIGHT/FORWARD work unchanged
8. ✅ MediaPipe: UP/DOWN/LEFT/RIGHT work unchanged + CENTER optional
9. ✅ CNN: UP/DOWN/LEFT/RIGHT work unchanged + CLOSED optional
10. ✅ No TypeScript/ESLint errors
11. ✅ App compiles with `npm run dev`

---

## File Summary

| File | Action | LOC Change | Reason |
|------|--------|-----------|--------|
| InputControlContext.jsx | Modify | -10, +20 | Remove BACK gestures, add customizable CENTER/CLOSED |
| Settings.jsx | Modify | +40 | Add MediaPipe + CNN toggles |
| Communicate.jsx | Modify | +5 | Add BACK button |
| Keyboard.jsx | Modify | +5 | Add BACK button |
| Home.jsx | Modify | +5 | Add BACK button |
| AIChat.jsx | Modify | +5 | Add BACK button |
| Actions.jsx | Modify | +5 | Add BACK button |
| useUnifiedInput.js | Delete | — | No longer needed |
| Communicate_NEW.jsx | Delete | — | No longer needed |

**Total:** 7 files modified, 2 files deleted, ~85 LOC added

---

## Timeline Estimate

- **Step 1 (Clean Up):** 2 min
- **Step 2 (Revert InputControlContext):** 5 min
- **Step 3 (Add Customization):** 10 min
- **Step 4 (Update Settings):** 15 min
- **Step 5 (Add BACK Button × 5 pages):** 10 min
- **Step 6 (Verification):** 5 min
- **Step 7 (Manual Testing):** 30 min
- **Total:** ~75 minutes

---

## Questions / Decisions Needed

1. **BACK button behavior:**
   - Navigate back one page (`navigate(-1)`)? 
   - OR Always return to home (`navigate("/")`)?
   - → Recommend: `navigate(-1)` for consistency (back to previous page)

2. **BACK button styling:**
   - Same as existing buttons?
   - Highlighted/emphasized (to make it discoverable)?
   - → Recommend: Consistent with existing buttons, label "← Back" for clarity

3. **Settings page HOME link:**
   - Does Settings need a BACK button, or is it only on content pages?
   - → Recommend: Add BACK button to Settings too (consistency)

4. **Default CENTER/CLOSED behavior:**
   - MediaPipe CENTER: disabled by default?
   - CNN CLOSED: enabled (select) by default?
   - → Recommend: Both disabled by default (users opt-in if they want)

5. **CLOSED long-hold conflict:**
   - CNN already has CLOSED 500ms → SELECT (existing dwell)
   - Should we also support long-hold CLOSED as alternative?
   - → Recommend: No, keep it simple (500ms only)

---

## Ready to Proceed?

**User should review and approve:**
- [ ] Overall approach (BACK buttons + customizable toggles)
- [ ] File list and changes
- [ ] Implementation steps
- [ ] Any decisions above (BACK behavior, defaults, etc.)

**Once approved:** I will implement all changes, test, and report results.

