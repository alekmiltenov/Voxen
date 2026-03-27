import { useState, useRef } from "react";
import { getDwellMs } from "../utils/settings";

/**
 * Drop-in replacement for <button> that auto-clicks after dwelling.
 *
 * Props:
 *   dwellMs      — override dwell duration (default: read from settings)
 *   hoverBg      — background to apply while hovered
 *   All standard button props (style, onClick, children, disabled, …)
 */
export default function DwellButton({
  onClick,
  children,
  style,
  hoverBg,
  dwellMs,          // explicit override; if omitted, reads from localStorage
  disabled,
  ...props
}) {
  const [progress, setProgress] = useState(0);
  const [hovered,  setHovered]  = useState(false);
  const frameRef   = useRef(null);
  const startRef   = useRef(null);
  const activeRef  = useRef(false);
  const durationRef = useRef(0);

  function onEnter() {
    if (disabled) return;
    durationRef.current = dwellMs ?? getDwellMs(); // read setting at hover start
    setHovered(true);
    activeRef.current = true;
    startRef.current  = performance.now();

    (function tick() {
      if (!activeRef.current) return;
      const p = Math.min((performance.now() - startRef.current) / durationRef.current, 1);
      setProgress(p);
      if (p < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        activeRef.current = false;
        setProgress(0);
        setHovered(false);
        onClick?.();
      }
    })();
  }

  function onLeave() {
    setHovered(false);
    activeRef.current = false;
    cancelAnimationFrame(frameRef.current);
    setProgress(0);
  }

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...style,
        ...(hovered && hoverBg ? { background: hoverBg } : {}),
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {children}

      {/* white overlay brightens button as dwell progresses */}
      {progress > 0 && (
        <div style={{
          position:      "absolute",
          inset:         0,
          background:    `rgba(255,255,255,${progress * 0.18})`,
          borderRadius:  "inherit",
          pointerEvents: "none",
        }} />
      )}

      {/* progress bar sweeps along the bottom edge */}
      {progress > 0 && (
        <div style={{
          position:      "absolute",
          bottom:        0,
          left:          0,
          height:        "3px",
          width:         `${progress * 100}%`,
          background:    "rgba(255,255,255,0.9)",
          pointerEvents: "none",
          transition:    "none",
        }} />
      )}
    </button>
  );
}
