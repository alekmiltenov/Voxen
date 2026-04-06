import { useCallback, useEffect, useRef } from "react";
import { useInputControl } from "../pages/InputControlContext";

/**
 * Unified input handler that maps all input modes (HEAD, EYES, CNN) to standard commands.
 * 
 * Standard commands:
 *   - NAVIGATE_UP, NAVIGATE_DOWN, NAVIGATE_LEFT, NAVIGATE_RIGHT
 *   - SELECT (confirm/activate)
 *   - BACK (exit/go back)
 *   - MENU (open options)
 * 
 * Usage:
 *   const { navigateUp, navigateDown, navigateLeft, navigateRight, select, back, menu } = useUnifiedInput();
 */
export function useUnifiedInput() {
  const { mode, register, unregister } = useInputControl();
  
  // Callback refs to hold latest handlers (avoid stale closures)
  const handlersRef = useRef({
    navigateUp: () => {},
    navigateDown: () => {},
    navigateLeft: () => {},
    navigateRight: () => {},
    select: () => {},
    back: () => {},
    menu: () => {},
  });

  // Update handlers from latest props
  const setHandlers = useCallback((handlers) => {
    handlersRef.current = { ...handlersRef.current, ...handlers };
  }, []);

  // Unified command dispatcher
  useEffect(() => {
    register((cmd) => {
      // Map mode-specific commands to standard commands
      let standardCmd = null;
      
      if (mode === "head") {
        // HEAD: LEFT, RIGHT, FORWARD, BACK
        if (cmd === "UP") standardCmd = "NAVIGATE_UP";
        if (cmd === "DOWN") standardCmd = "NAVIGATE_DOWN";
        if (cmd === "LEFT") standardCmd = "NAVIGATE_LEFT";
        if (cmd === "RIGHT") standardCmd = "NAVIGATE_RIGHT";
        if (cmd === "FORWARD") standardCmd = "SELECT";
        if (cmd === "BACK") standardCmd = "BACK";
      } else if (mode === "eyes" || mode === "cnn") {
        // EYES (MediaPipe + CNN): UP, DOWN, LEFT, RIGHT, + DWELL/CLOSED
        // DWELL/CLOSED should dispatch SELECT (handled in InputControlContext)
        // For BACK: can use special gesture (e.g., sustained CENTER gaze or specific eye-closed pattern)
        if (cmd === "UP") standardCmd = "NAVIGATE_UP";
        if (cmd === "DOWN") standardCmd = "NAVIGATE_DOWN";
        if (cmd === "LEFT") standardCmd = "NAVIGATE_LEFT";
        if (cmd === "RIGHT") standardCmd = "NAVIGATE_RIGHT";
        if (cmd === "FORWARD") standardCmd = "SELECT";  // Dwell fires FORWARD
        if (cmd === "BACK") standardCmd = "BACK";  // Will come from eye-closed long press
      }
      
      // Dispatch to appropriate handler
      if (standardCmd === "NAVIGATE_UP") handlersRef.current.navigateUp();
      if (standardCmd === "NAVIGATE_DOWN") handlersRef.current.navigateDown();
      if (standardCmd === "NAVIGATE_LEFT") handlersRef.current.navigateLeft();
      if (standardCmd === "NAVIGATE_RIGHT") handlersRef.current.navigateRight();
      if (standardCmd === "SELECT") handlersRef.current.select();
      if (standardCmd === "BACK") handlersRef.current.back();
      if (standardCmd === "MENU") handlersRef.current.menu();
    });

    return () => unregister();
  }, [mode, register, unregister]);

  return {
    setHandlers,
    mode,
  };
}

/**
 * Grid navigation helper for 2D navigation (rows × columns).
 * Handles wrapping and selection within a grid.
 */
export function useGridNav({
  rows, // Array of row items (each row can be string, or object with id)
  colsPerRow = {}, // Optional: {rowIndex: colCount} for variable widths
}) {
  const [curRow, setCurRow] = useRef(0);
  const [curCol, setCurCol] = useRef(0);

  const navigateUp = useCallback(() => {
    setCurRow(r => (r - 1 + rows.length) % rows.length);
  }, [rows.length]);

  const navigateDown = useCallback(() => {
    setCurRow(r => (r + 1) % rows.length);
  }, [rows.length]);

  const navigateLeft = useCallback(() => {
    const cols = colsPerRow[curRow.current] || (Array.isArray(rows[curRow.current]) ? rows[curRow.current].length : 1);
    setCurCol(c => (c - 1 + cols) % cols);
  }, [rows, colsPerRow]);

  const navigateRight = useCallback(() => {
    const cols = colsPerRow[curRow.current] || (Array.isArray(rows[curRow.current]) ? rows[curRow.current].length : 1);
    setCurCol(c => (c + 1) % cols);
  }, [rows, colsPerRow]);

  const getCurrent = useCallback(() => {
    const row = rows[curRow.current];
    if (Array.isArray(row)) return row[curCol.current];
    return row;
  }, [rows]);

  return {
    curRow: curRow.current,
    curCol: curCol.current,
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    getCurrent,
  };
}
