import { useEffect, useState } from "react";
import { useInputControl } from "../pages/InputControlContext";
import { useLocation } from "react-router-dom";

/**
 * Real-time eye tracking visualization and debug panel
 * Shows gaze position, center calibration, detected direction, and a visual marker
 * On Settings page: full debug panel
 * On other pages: minimal direction indicator only
 */
export default function EyeTrackingDebug() {
  const { mode, eyeDebug, cnnDebug } = useInputControl();
  const location = useLocation();
  const isSettingsPage = location.pathname === "/settings";
  const showCnnIndicator = mode === "cnn" && ["/", "/communicate"].includes(location.pathname);

  if (mode === "eyes" && eyeDebug) {
    // For non-Settings pages, show minimal direction indicator only
    if (!isSettingsPage) {
      const directionColors = {
        UP: "#4f46e5",
        DOWN: "#ef4444",
        LEFT: "#f59e0b",
        RIGHT: "#10b981",
        CENTER: "#8b5cf6",
      };
      const dirColor = directionColors[eyeDebug.direction] || "#6b7280";

      return (
        <div
          style={{
            position: "fixed",
            top: 90,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            backgroundColor: "rgba(17, 24, 39, 0.92)",
            border: "1.5px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "14px",
            padding: "16px 28px",
            fontFamily: "monospace",
            fontSize: "18px",
            fontWeight: "700",
            color: dirColor,
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.7)",
            letterSpacing: "0.08em",
          }}
        >
          {eyeDebug.direction}
        </div>
      );
    }

    // Settings page: full debug panel
    return (
      <FullDebugPanel eyeDebug={eyeDebug} />
    );
  }

  if (showCnnIndicator && cnnDebug) {
    return <CnnIndicator cnnDebug={cnnDebug} />;
  }

  return null;
}

function CnnIndicator({ cnnDebug }) {
  const directionColors = {
    UP: "#4f46e5",
    DOWN: "#ef4444",
    LEFT: "#f59e0b",
    RIGHT: "#10b981",
    CENTER: "#a78bfa",
    NONE: "#6b7280",
  };

  const dir = String(cnnDebug.direction || "NONE").toUpperCase();
  const dirColor = directionColors[dir] || "#6b7280";
  const conf = Number(cnnDebug.confidence || 0);
  const [progress, setProgress] = useState(Math.max(0, Math.min(1, Number(cnnDebug.progress || 0))));
  const remainingMs = Math.max(0, Number(cnnDebug.remainingMs || 0));
  const selectionMethod = String(cnnDebug.selectionMethod || "RIGHT").toUpperCase();
  const navLockDir = String(cnnDebug.navLockDir || "").toUpperCase();
  const isSelecting = progress > 0;
  const state = String(cnnDebug.state || "");

  let statusText = "idle";
  if (state === "direction-hold" || state === "center-hold") {
    statusText = `${(remainingMs / 1000).toFixed(1)}s to select`;
  } else if (state === "nav-locked" && navLockDir) {
    statusText = `${navLockDir} locked · center to unlock`;
  }

  useEffect(() => {
    let raf = null;
    const startMs = Number(cnnDebug.selectionStartMs || 0);
    const dwell = Math.max(1, Number(cnnDebug.selectionDwell || 1));

    const tick = () => {
      const active = (cnnDebug.state === "center-hold" || cnnDebug.state === "direction-hold") && startMs > 0;
      if (!active) {
        setProgress(Math.max(0, Math.min(1, Number(cnnDebug.progress || 0))));
        return;
      }

      const elapsed = Math.max(0, Date.now() - startMs);
      const p = Math.max(0, Math.min(1, elapsed / dwell));
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    tick();
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [cnnDebug.selectionStartMs, cnnDebug.selectionDwell, cnnDebug.state, cnnDebug.progress]);

  return (
    <div
      style={{
        position: "fixed",
        top: 86,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10000,
        width: "min(420px, 86vw)",
        backgroundColor: "rgba(17, 24, 39, 0.94)",
        border: `1.5px solid ${isSelecting ? "rgba(167,139,250,0.55)" : "rgba(255, 255, 255, 0.15)"}`,
        borderRadius: "14px",
        padding: "12px 14px",
        boxShadow: isSelecting ? "0 6px 22px rgba(167,139,250,0.25)" : "0 6px 20px rgba(0, 0, 0, 0.7)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: dirColor, letterSpacing: "0.06em" }}>
          {dir}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
          conf {conf.toFixed(2)}
        </span>
      </div>

      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: "100%",
            background: "linear-gradient(90deg, #a78bfa, #8b5cf6)",
            transition: "width 60ms linear",
          }}
        />
      </div>

      <div style={{ marginTop: 7, display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
        <span>Select: {selectionMethod}</span>
        <span>{statusText}</span>
      </div>
    </div>
  );
}

function FullDebugPanel({ eyeDebug }) {

  // Normalize gaze data to 0-1 range for visualization (-4 to 4 scale becomes 0-100%)
  const normalizeCoord = (val) => {
    const norm = (val + 4) / 8;
    return Math.max(0, Math.min(1, norm));
  };

  const gazeXNorm = normalizeCoord(parseFloat(eyeDebug.gazeX));
  const gazeYNorm = normalizeCoord(parseFloat(eyeDebug.gazeY));
  const centerXNorm = normalizeCoord(parseFloat(eyeDebug.centerX));
  const centerYNorm = normalizeCoord(parseFloat(eyeDebug.centerY));

  // Color based on direction
  const directionColors = {
    UP: "#4f46e5",
    DOWN: "#ef4444",
    LEFT: "#f59e0b",
    RIGHT: "#10b981",
    CENTER: "#8b5cf6",
  };

  const dirColor = directionColors[eyeDebug.direction] || "#6b7280";

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        width: "320px",
        zIndex: 10000,
        backgroundColor: "rgba(17, 24, 39, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "12px",
        padding: "16px",
        fontFamily: "monospace",
        fontSize: "11px",
        color: "rgba(255, 255, 255, 0.9)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div style={{ marginBottom: "12px", fontWeight: "bold", fontSize: "12px" }}>
        👁️ Eye Tracking Debug
      </div>

      {/* Visualization Box */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "140px",
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "8px",
          marginBottom: "12px",
          overflow: "hidden",
        }}
      >
        {/* Buffer zone circle - visual indicator */}
        {eyeDebug.centerBuffer && parseFloat(eyeDebug.centerBuffer) > 0 && (
          <div
            style={{
              position: "absolute",
              left: `${centerXNorm * 100}%`,
              top: `${centerYNorm * 100}%`,
              width: `${(0.15 + parseFloat(eyeDebug.centerBuffer) * 0.5) * 50}px`,
              height: `${(0.15 + parseFloat(eyeDebug.centerBuffer) * 0.5) * 50}px`,
              border: "1px dashed rgba(255, 255, 255, 0.15)",
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Center crosshair */}
        <div
          style={{
            position: "absolute",
            left: `${centerXNorm * 100}%`,
            top: `${centerYNorm * 100}%`,
            width: "2px",
            height: "2px",
            backgroundColor: eyeDebug.direction === "CENTER" ? "#8b5cf6" : "rgba(255, 255, 255, 0.3)",
            transform: "translate(-50%, -50%)",
            boxShadow: eyeDebug.direction === "CENTER" ? "0 0 12px #8b5cf6" : "0 0 6px rgba(255, 255, 255, 0.2)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${centerXNorm * 100}%`,
            top: "0",
            width: "1px",
            height: "100%",
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            transform: "translateX(-50%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: `${centerYNorm * 100}%`,
            left: "0",
            width: "100%",
            height: "1px",
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            transform: "translateY(-50%)",
          }}
        />

        {/* Gaze point marker */}
        <div
          style={{
            position: "absolute",
            left: `${gazeXNorm * 100}%`,
            top: `${gazeYNorm * 100}%`,
            width: "10px",
            height: "10px",
            backgroundColor: dirColor,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            boxShadow: `0 0 8px ${dirColor}, inset 0 0 4px rgba(255, 255, 255, 0.3)`,
            border: "1px solid rgba(255, 255, 255, 0.5)",
          }}
        />
      </div>

      {/* Data readout */}
      <div style={{ display: "grid", gap: "4px", fontSize: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Direction:</span>
          <span style={{ color: dirColor, fontWeight: "bold" }}>
            {eyeDebug.direction} {eyeDebug.direction !== eyeDebug.newDirection ? `(→ ${eyeDebug.newDirection})` : ""}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Gaze (raw):</span>
          <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
            ({eyeDebug.gazeX}, {eyeDebug.gazeY})
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Center:</span>
          <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
            ({eyeDebug.centerX}, {eyeDebug.centerY})
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Distance:</span>
          <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>{eyeDebug.distance}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "4px" }}>
          <span>Y-Bias:</span>
          <span style={{ color: "#22c55e", fontWeight: "bold" }}>{eyeDebug.yBias || "0.00"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Center Buffer:</span>
          <span style={{ color: "#22c55e", fontWeight: "bold" }}>{eyeDebug.centerBuffer || "0.00"}</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: "12px", fontSize: "9px", color: "rgba(255, 255, 255, 0.5)" }}>
        <div>✕ = center point</div>
        <div>● = your gaze</div>
        <div style={{ marginTop: "4px", fontStyle: "italic" }}>
          Gaze should move smoothly. If it jumps or stays frozen, eye detection has issues.
        </div>
      </div>
    </div>
  );
}
