# Quick Reference: Unified Input Implementation

## What's Been Done ✅

### 1. **BACK Gesture Support**
- **Eyes MediaPipe:** Sustained center gaze for 2 seconds → `dispatch("BACK")`
- **Eyes CNN:** Hold eyes closed for 3 seconds → `dispatch("BACK")`
- **HEAD:** Already supported (uses BACK button on sensor)

**Code Location:** `frontend/src/pages/InputControlContext.jsx`
- Lines 68–70: Added refs for center gaze tracking
- Lines 305–325: CENTER gaze logic (fires BACK after 2s)
- Lines 290–298: CNN CLOSED logic (fires BACK after 3s)

### 2. **Unified Input Hook**
**File:** `frontend/src/hooks/useUnifiedInput.js` (NEW)

Maps all three input modes to standard commands:
```javascript
// Usage in a component:
const { setHandlers, mode } = useUnifiedInput();

useEffect(() => {
  setHandlers({
    navigateUp: () => { /* move up */ },
    navigateDown: () => { /* move down */ },
    navigateLeft: () => { /* move left */ },
    navigateRight: () => { /* move right */ },
    select: () => { /* activate */ },
    back: () => { /* exit */ },
    menu: () => { /* open menu */ },
  });
}, [/* deps */]);
```

### 3. **Grid-Based Communication Page**
**File:** `frontend/src/pages/Communicate_NEW.jsx` (NEW)

- Menu row (top): Back, Keyboard, Speak, Clear
- Content row (main): Starters or suggestions
- Navigate: UP/DOWN between rows, LEFT/RIGHT within rows
- Select: FORWARD or dwell to add word
- Back: BACK command or BACK gesture

---

## Next Steps 👉

### **Step 1: Test BACK Gestures** (15 mins)
```bash
cd frontend
npm run dev
```

Go to Settings, toggle Eyes or CNN mode, then:
- **Eyes MediaPipe:** Look at center of screen and hold for 2s → should dispatch BACK
- **Eyes CNN:** Close eyes and hold for 3s → should dispatch BACK
- Verify in browser console: `[Eyes] CENTER held 2s → dispatching BACK`

### **Step 2: Swap Communication Page** (5 mins)
```bash
cd frontend/src/pages
mv Communicate.jsx Communicate_OLD.jsx
mv Communicate_NEW.jsx Communicate.jsx
```

### **Step 3: Test Communication in All Modes** (30 mins)

#### **HEAD Mode Test:**
1. Go to Settings → toggle HEAD mode
2. Go to Home → select Communicate (FORWARD)
3. Navigate menu: LEFT to cycle [← Back], [⌨ Keyboard], [🔊 Speak], [✕ Clear]
4. Navigate content: UP/DOWN to starters
5. Select starter: FORWARD to add word
6. Backspace: BACK to remove word
7. Go back: BACK to exit page
8. ✓ Should work seamlessly

#### **Eyes MediaPipe Test:**
1. Go to Settings → toggle EYES mode
2. Calibrate eyes (center for 90 frames)
3. Go to Home → dwell on Communicate card 1.5s
4. Dwell on menu item: [⌨ Keyboard] → navigates there ✓
5. Look away, look at starter phrase, dwell 1.5s → adds word ✓
6. Look at center of screen, hold for 2s → goes BACK ✓
7. ✓ All features working

#### **Eyes CNN Test:**
1. Go to Settings → toggle CNN mode
2. Wait for gaze prediction ready
3. Go to Home → close eyes briefly → navigates ✓
4. Look left/right/up/down → navigates menu/content ✓
5. Close eyes briefly → adds word ✓
6. Hold eyes closed for 3s → goes BACK ✓
7. ✓ All features working

### **Step 4: Test Edge Cases** (15 mins)
- [ ] Rapid back-to-back selections (avoid double-fire)
- [ ] Navigation wrapping (LEFT on first item → goes to last)
- [ ] Dwell timeout (look away before 2s in eyes mode → doesn't fire)
- [ ] Speaking doesn't crash UI
- [ ] Empty suggestions (when no words) → shows default message

### **Step 5: Commit & PR** (5 mins)
```bash
git add -A
git commit -m "feat: unified input model with BACK gestures and grid-based communication

- Add BACK gesture for Eyes (center gaze 2s / closed eyes 3s)
- Implement useUnifiedInput hook for command normalization
- Redesign Communicate page with grid-based layout
- All input modes (HEAD/Eyes/CNN) now fully accessible
- Fixes #XX: Eyes modes can now navigate back"

git push origin feature/unified-input
# Create PR on GitHub
```

---

## Command Mapping Reference

### **Standard Commands**
```
NAVIGATE_UP    ← Move up in grid
NAVIGATE_DOWN  ← Move down in grid
NAVIGATE_LEFT  ← Move left in grid
NAVIGATE_RIGHT ← Move right in grid
SELECT         ← Confirm/activate current item
BACK           ← Exit/go back/undo
MENU           ← Open options menu
```

### **Mode-Specific Commands → Standard**

| Input | Mode | Command | → Standard |
|-------|------|---------|-----------|
| Tilt up | HEAD | (none) | — |
| Tilt down | HEAD | (none) | — |
| Tilt left | HEAD | LEFT | NAVIGATE_LEFT |
| Tilt right | HEAD | RIGHT | NAVIGATE_RIGHT |
| Tilt forward (hold) | HEAD | FORWARD | SELECT |
| Tilt back (hold) | HEAD | BACK | BACK |
| Gaze up | EYES | UP | NAVIGATE_UP |
| Gaze down | EYES | DOWN | NAVIGATE_DOWN |
| Gaze left | EYES | LEFT | NAVIGATE_LEFT |
| Gaze right | EYES | RIGHT | NAVIGATE_RIGHT |
| Gaze center (2s) | EYES | (sustained) | BACK |
| Gaze right (1.5s) | EYES | FORWARD | SELECT |
| Gaze up | CNN | UP | NAVIGATE_UP |
| Gaze down | CNN | DOWN | NAVIGATE_DOWN |
| Gaze left | CNN | LEFT | NAVIGATE_LEFT |
| Gaze right | CNN | RIGHT | NAVIGATE_RIGHT |
| Close eyes (3s) | CNN | (sustained) | BACK |
| Close eyes (< 500ms) | CNN | FORWARD | SELECT |

---

## Debugging Checklist

### **BACK Gesture Not Firing?**

**Eyes MediaPipe:**
1. Check console for `[Eyes] CENTER held 2s → dispatching BACK`
2. Verify eye centering is complete (Settings shows "Eye Control · tracking")
3. Increase duration test to 3s (timing might be off)
4. Check `lastEyeCmdRef.current === "CENTER"` in browser devtools

**Eyes CNN:**
1. Check console for `[CNN] CLOSED held 3s → dispatching BACK`
2. Verify CNN is connected (Settings shows gaze label updating)
3. Verify closed-eyes is being detected (Settings shows "CLOSED" label)
4. Increase duration test to 4s (allow margin)

### **Navigation Not Working?**

1. Verify input mode is active (Settings shows green indicator + label)
2. Check handler registration (look for `register((cmd) => { … })` call in page)
3. Check command dispatch (browser console should show command events)
4. Verify mode is passed correctly to `useInputControl()`

### **Double-Selection Bug?**

1. Check `dwellFiredRef` is set to true immediately before dispatch
2. Verify state update doesn't reset between events
3. Add debounce check: `if (Date.now() - lastSelectTime < 300) return;`

---

## Performance Tips

- **Dwell check interval:** Currently 60fps (RAF); acceptable for smooth tracking
- **CNN polling:** Currently every 100ms; acceptable latency (~100–150ms)
- **WebSocket (suggestions):** Sends on word change; no debounce (might want 300ms debounce if lag)
- **BACK gesture duration:** 2s (eyes) / 3s (CNN) — enough to avoid accidental triggers

---

## Rollback Instructions

If something breaks:

```bash
# Revert InputControlContext changes
git checkout HEAD~1 -- frontend/src/pages/InputControlContext.jsx

# Restore old Communication page
mv frontend/src/pages/Communicate.jsx frontend/src/pages/Communicate_NEW.jsx
mv frontend/src/pages/Communicate_OLD.jsx frontend/src/pages/Communicate.jsx

# Verify old behavior
npm run dev
```

---

## Questions?

Check `DESIGN_UNIFIED_INPUT.md` for full architecture doc.

