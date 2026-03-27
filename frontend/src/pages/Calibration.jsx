import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DwellButton from "../components/DwellButton";

// 9 calibration points in reading order (top-left → bottom-right)
const LABELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function Calibration() {
  const navigate = useNavigate();
  const [done, setDone] = useState(new Set());

  function hit(idx) {
    setDone(prev => new Set([...prev, idx]));
  }

  const allDone = done.size === 9;

  return (
    <div style={s.page}>

      {/* status bar pinned to top */}
      <div style={s.topBar}>
        <span style={s.title}>Eye Tracking Calibration</span>
        <span style={s.sub}>
          {allDone
            ? "All points confirmed — you're ready!"
            : `Look at each dot and dwell to confirm  (${done.size} / 9)`}
        </span>
      </div>

      {/* 3×3 grid fills the whole viewport */}
      <div style={s.grid}>
        {LABELS.map((_, i) => {
          const isDone = done.has(i);
          return (
            <div key={i} style={s.cell}>
              <DwellButton
                dwellMs={1200}
                onClick={() => hit(i)}
                style={{
                  width:          72,
                  height:         72,
                  borderRadius:   "50%",
                  background:     isDone ? "rgba(80,220,120,0.2)" : "rgba(255,255,255,0.05)",
                  border:         `2px solid ${isDone ? "rgba(80,220,120,0.8)" : "rgba(255,255,255,0.22)"}`,
                  cursor:         "pointer",
                  transition:     "background 0.2s, border-color 0.2s",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       "13px",
                  color:          isDone ? "rgba(80,220,120,0.95)" : "rgba(255,255,255,0.45)",
                  fontWeight:     "500",
                }}
              >
                {isDone ? "✓" : i + 1}
              </DwellButton>
            </div>
          );
        })}
      </div>

      {/* actions pinned to bottom-center */}
      <div style={s.bottomBar}>
        {allDone ? (
          <DwellButton style={s.doneBtn} onClick={() => navigate("/")}>
            Done — go back
          </DwellButton>
        ) : (
          <button onClick={() => navigate("/")} style={s.skip}>
            skip
          </button>
        )}
      </div>
    </div>
  );
}

const s = {
  page: {
    width:          "100vw",
    height:         "100vh",
    background:     "#111111",
    display:        "flex",
    flexDirection:  "column",
    overflow:       "hidden",
  },
  topBar: {
    flexShrink:     0,
    height:         "60px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "20px",
    paddingTop:     "10px",
  },
  title: {
    fontSize:      "14px",
    fontWeight:    "300",
    color:         "rgba(255,255,255,0.45)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  sub: {
    fontSize: "13px",
    color:    "rgba(255,255,255,0.22)",
  },
  grid: {
    flex:                1,
    display:             "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gridTemplateRows:    "repeat(3, 1fr)",
  },
  cell: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
  bottomBar: {
    flexShrink:     0,
    height:         "70px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
  doneBtn: {
    padding:      "16px 44px",
    borderRadius: "14px",
    background:   "rgba(80,220,120,0.15)",
    border:       "1.5px solid rgba(80,220,120,0.55)",
    color:        "rgba(80,220,120,0.9)",
    fontSize:     "18px",
    fontWeight:   "300",
    cursor:       "pointer",
  },
  skip: {
    background:    "transparent",
    border:        "none",
    color:         "rgba(255,255,255,0.18)",
    fontSize:      "13px",
    cursor:        "pointer",
    letterSpacing: "0.08em",
  },
};
