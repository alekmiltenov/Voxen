import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const CONTROL_SERVER = "http://10.237.97.128:5000";

// Single persistent socket — never recreated
const socket = io(CONTROL_SERVER, { transports: ["websocket"] });

const HeadControlContext = createContext(null);

export function HeadControlProvider({ children }) {
  const [enabled, setEnabled] = useState(false);

  // ── Interaction settings (frontend only) ─────────────────────────────────
  const [holdDuration, setHoldDuration] = useState(500);  // ms to hold FORWARD/BACK

  // ── Sensor settings (synced to backend) ──────────────────────────────────
  const [sensorSettings, setSensorSettings] = useState({
    alpha:     0.5,
    threshold: 1.5,
    deadzone:  1.0,
  });

  // ── Refs used inside the socket callback ─────────────────────────────────
  const enabledRef      = useRef(false);
  const handlerRef      = useRef(null);
  const holdRef         = useRef({ cmd: null, start: 0 });
  const holdDurationRef = useRef(500);

  // Keep ref in sync with state so the socket handler always reads the latest value
  useEffect(() => { holdDurationRef.current = holdDuration; }, [holdDuration]);

  // ── Load initial sensor settings from backend ─────────────────────────────
  useEffect(() => {
    fetch(`${CONTROL_SERVER}/settings`)
      .then((r) => r.json())
      .then((s) => {
        setSensorSettings({
          alpha:     s.alpha     ?? 0.5,
          threshold: s.threshold ?? 1.5,
          deadzone:  s.deadzone  ?? 1.0,
        });
      })
      .catch(() => {/* backend unreachable — use defaults */});
  }, []);

  // ── Socket: command processing ────────────────────────────────────────────
  useEffect(() => {
    socket.on("command", ({ cmd }) => {
      if (!enabledRef.current || !handlerRef.current) return;

      const now = Date.now();
      const prev = holdRef.current.cmd;

      // ── cmd is null → head returned to neutral, reset hold timer ──
      if (!cmd) {
        holdRef.current = { cmd: null, start: 0 };
        return;
      }

      // ── Command changed → new direction detected ──
      if (prev !== cmd) {
        holdRef.current = { cmd, start: now };

        // LEFT / RIGHT fire immediately on the first detection.
        // Repeats are ignored until sensor returns to neutral and tilts again.
        if (cmd === "LEFT" || cmd === "RIGHT") {
          handlerRef.current(cmd);
        }
        return;
      }

      // ── Same command still streaming → only FORWARD / BACK care about this ──
      if (cmd === "FORWARD" || cmd === "BACK") {
        const heldTime = now - holdRef.current.start;
        if (heldTime >= holdDurationRef.current) {
          handlerRef.current(cmd);
          // Reset so user must fully release and re-hold for another trigger
          holdRef.current = { cmd: null, start: 0 };
        }
      }
    });

    return () => socket.off("command");
  }, []);

  // ── Sensor settings: push to backend ─────────────────────────────────────
  const updateSensorSettings = (newSettings) => {
    setSensorSettings(newSettings);
    fetch(`${CONTROL_SERVER}/settings`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(newSettings),
    }).catch(() => {});
  };

  // ── Toggle head control on/off ────────────────────────────────────────────
  const toggle = () =>
    setEnabled((prev) => {
      enabledRef.current = !prev;
      return !prev;
    });

  const register   = (fn) => { handlerRef.current = fn;   };
  const unregister = ()   => { handlerRef.current = null; };

  return (
    <HeadControlContext.Provider
      value={{
        enabled, toggle, register, unregister,
        holdDuration, setHoldDuration,
        sensorSettings, updateSensorSettings,
      }}
    >
      {children}

      {/* ── Global status indicator ── */}
      <div style={{
        position:    "fixed",
        bottom:      24,
        right:       24,
        display:     "flex",
        alignItems:  "center",
        gap:         8,
        padding:     "6px 14px 6px 10px",
        borderRadius: 99,
        background:  enabled ? "rgba(255,255,255,0.06)" : "transparent",
        border:      `1px solid ${enabled ? "rgba(255,255,255,0.15)" : "transparent"}`,
        zIndex:      9999,
        transition:  "all 0.25s ease",
      }}>
        <div style={{
          width:        7,
          height:       7,
          borderRadius: "50%",
          background:   enabled ? "#22c55e" : "rgba(255,255,255,0.15)",
          boxShadow:    enabled ? "0 0 8px #22c55e" : "none",
          transition:   "all 0.3s",
        }} />
        {enabled && (
          <span style={{
            fontSize:      11,
            color:         "rgba(255,255,255,0.4)",
            letterSpacing: "0.1em",
          }}>
            Head Control
          </span>
        )}
      </div>
    </HeadControlContext.Provider>
  );
}

export const useHeadControl = () => useContext(HeadControlContext);