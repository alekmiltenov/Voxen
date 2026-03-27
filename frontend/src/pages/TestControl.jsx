import { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const SERVER = "http://10.237.97.128:5000";

// Single socket instance — created once, lives for the app's lifetime
const socket = io(SERVER, { transports: ["websocket"] });

const BOXES = ["LEFT", "RIGHT", "FORWARD", "BACK"];

export default function App() {
  const [command, setCommand]   = useState(null);
  const [selected, setSelected] = useState(0);
  const [connected, setConnected] = useState(false);

  // Settings
  const [alpha,     setAlpha]     = useState(0.6);
  const [threshold, setThreshold] = useState(2.0);
  const [deadzone,  setDeadzone]  = useState(0.8);

  // useRef mirrors selected so the socket callback always reads the latest value
  // without needing to be re-registered every time selected changes.
  const selectedRef = useRef(0);
  const syncSelected = (val) => {
    selectedRef.current = val;
    setSelected(val);
  };

  // -------- FETCH INITIAL SETTINGS --------
  useEffect(() => {
    fetch(`${SERVER}/settings`)
      .then((r) => r.json())
      .then((s) => {
        setAlpha(s.alpha);
        setThreshold(s.threshold);
        setDeadzone(s.deadzone);
      })
      .catch(() => {});
  }, []);

  // -------- WEBSOCKET --------
  useEffect(() => {
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("command", ({ cmd }) => {
      setCommand(cmd);

      if (cmd === "LEFT") {
        syncSelected(Math.max(0, selectedRef.current - 1));
      } else if (cmd === "RIGHT") {
        syncSelected(Math.min(BOXES.length - 1, selectedRef.current + 1));
      } else if (cmd === "FORWARD") {
        alert(`✅ Selected: Box ${selectedRef.current + 1} — ${BOXES[selectedRef.current]}`);
      } else if (cmd === "BACK") {
        // BACK moves selection to the previous row (wraps around 2-column grid)
        syncSelected(Math.max(0, selectedRef.current - 2));
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("command");
    };
  }, []); // empty deps — safe because we read state through refs

  // -------- SEND SETTINGS TO BACKEND --------
  const pushSettings = useCallback((a, t, d) => {
    fetch(`${SERVER}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alpha: a, threshold: t, deadzone: d }),
    }).catch(() => {});
  }, []);

  // -------- RENDER --------
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Head Control</h1>
        <span style={{ ...styles.badge, background: connected ? "#22c55e" : "#ef4444" }}>
          {connected ? "● Connected" : "○ Disconnected"}
        </span>
      </header>

      {/* ---- SELECTION GRID ---- */}
      <div style={styles.grid}>
        {BOXES.map((label, i) => (
          <div
            key={i}
            style={{
              ...styles.box,
              background:  selected === i ? "#14532d" : "#1e293b",
              borderColor: selected === i ? "#22c55e" : "#334155",
              color:       selected === i ? "#86efac" : "#94a3b8",
              transform:   selected === i ? "scale(1.04)" : "scale(1)",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <p style={styles.commandLine}>
        Last command: <strong style={{ color: "#38bdf8" }}>{command ?? "—"}</strong>
      </p>

      {/* ---- SETTINGS PANEL ---- */}
      <section style={styles.panel}>
        <h2 style={styles.panelTitle}>Sensor Settings</h2>

        <SliderRow
          label="Responsiveness (alpha)"
          hint="Higher = faster reaction, less smoothing"
          value={alpha}
          min={0.1} max={1.0} step={0.05}
          onChange={(v) => { setAlpha(v); pushSettings(v, threshold, deadzone); }}
        />

        <SliderRow
          label="Sensitivity (threshold)"
          hint="Lower = triggers on smaller tilts"
          value={threshold}
          min={0.5} max={5.0} step={0.1}
          onChange={(v) => { setThreshold(v); pushSettings(alpha, v, deadzone); }}
        />

        <SliderRow
          label="Deadzone"
          hint="Ignore micro-movements below this value"
          value={deadzone}
          min={0.1} max={2.0} step={0.1}
          onChange={(v) => { setDeadzone(v); pushSettings(alpha, threshold, v); }}
        />
      </section>
    </div>
  );
}

// -------- SLIDER COMPONENT --------
function SliderRow({ label, hint, value, min, max, step, onChange }) {
  return (
    <div style={styles.sliderRow}>
      <div style={styles.sliderMeta}>
        <span style={styles.sliderLabel}>{label}</span>
        <span style={styles.sliderValue}>{value.toFixed(2)}</span>
      </div>
      <p style={styles.sliderHint}>{hint}</p>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={styles.slider}
      />
      <div style={styles.sliderScale}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// -------- STYLES --------
const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "'DM Mono', 'Courier New', monospace",
    padding: "32px 24px",
    maxWidth: 520,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "0.05em",
    margin: 0,
    color: "#f1f5f9",
  },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 99,
    color: "#fff",
    letterSpacing: "0.03em",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 20,
  },
  box: {
    height: 120,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "0.08em",
    transition: "all 0.15s ease",
    cursor: "default",
    userSelect: "none",
  },
  commandLine: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 32,
  },
  panel: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 16,
    padding: "24px 20px",
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#64748b",
    marginTop: 0,
    marginBottom: 24,
  },
  sliderRow: {
    marginBottom: 24,
  },
  sliderMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 2,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#cbd5e1",
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: 700,
    color: "#38bdf8",
    fontVariantNumeric: "tabular-nums",
  },
  sliderHint: {
    fontSize: 11,
    color: "#475569",
    margin: "0 0 8px",
  },
  slider: {
    width: "100%",
    accentColor: "#38bdf8",
    cursor: "pointer",
  },
  sliderScale: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: "#475569",
    marginTop: 2,
  },
};