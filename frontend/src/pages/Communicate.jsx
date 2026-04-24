import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost, createSuggestSocket } from "../api";
import { useInputControl } from "./InputControlContextV2";

const DEFAULT_STARTERS = [
  "I", "I need", "I want", "I feel",
  "Help", "Can you", "Yes", "No",
  "Please", "Thank you", "I am", "I would like",
];

export default function Communicate() {
  const navigate = useNavigate();
  const { mode, enabled, register, unregister } = useInputControl();

  const [starters, setStarters] = useState(DEFAULT_STARTERS);
  const [selIdx, setSelIdx] = useState(0);

  const selRef = useRef(0);
  const startersRef = useRef(DEFAULT_STARTERS);

  const setSel = (v) => {
    selRef.current = v;
    setSelIdx(v);
  };

  useEffect(() => {
    startersRef.current = starters;
  }, [starters]);

  const loadStarters = useCallback(() => {
    apiGet("/vocab/starters?limit=12")
      .then((d) => {
        const learned = d.starters.map((s) => {
          const word = String(s.word).trim();
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).filter(Boolean);
        const merged = [];
        const seen = new Set();

        for (const w of learned) {
          const key = String(w).trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(w);
        }

        for (const w of DEFAULT_STARTERS) {
          const key = String(w).trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(w);
          if (merged.length >= 12) break;
        }

        if (merged.length > 0) setStarters(merged.slice(0, 12));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStarters();
  }, [loadStarters]);

  function selectStarter(phrase) {
    const start = encodeURIComponent(String(phrase || "").trim());
    navigate(`/compose?start=${start}`);
  }

  useEffect(() => {
    register((cmd) => {
      const gridSize = 4;
      const gridItems = 12;
      const totalItems = gridItems + 2;
      let newSel = selRef.current;

      const moveLeft = () => {
        const current = selRef.current;
        if (current < gridItems) {
          if (current % gridSize !== 0) newSel = current - 1;
          return;
        }
        if (current === gridItems + 1) newSel = gridItems;
      };

      const moveRight = () => {
        const current = selRef.current;
        if (current < gridItems) {
          if (current % gridSize !== gridSize - 1) newSel = current + 1;
          return;
        }
        if (current === gridItems) newSel = gridItems + 1;
      };

      if (mode === "head") {
        if (cmd === "LEFT") moveLeft();
        if (cmd === "RIGHT") moveRight();
        if (cmd === "UP") newSel = Math.max(0, selRef.current - gridSize);
        if (cmd === "DOWN") newSel = Math.min(totalItems - 1, selRef.current + gridSize);
        if (cmd === "FORWARD") {
          if (selRef.current < gridItems) selectStarter(startersRef.current[selRef.current]);
          else if (selRef.current === gridItems) navigate("/keyboard", { state: { words: [], returnTo: "/compose" } });
          else if (selRef.current === gridItems + 1) navigate("/");
        }
        if (cmd === "BACK") navigate("/");
      } else if (mode === "cnn") {
        if (cmd === "UP") newSel = Math.max(0, selRef.current - gridSize);
        if (cmd === "DOWN") newSel = Math.min(totalItems - 1, selRef.current + gridSize);
        if (cmd === "LEFT") moveLeft();
        if (cmd === "RIGHT") moveRight();
        if (cmd === "FORWARD") {
          if (selRef.current < gridItems) selectStarter(startersRef.current[selRef.current]);
          else if (selRef.current === gridItems) navigate("/keyboard", { state: { words: [], returnTo: "/compose" } });
          else if (selRef.current === gridItems + 1) navigate("/");
        }
      } else {
        if (cmd === "UP") newSel = Math.max(0, selRef.current - gridSize);
        if (cmd === "DOWN") newSel = Math.min(totalItems - 1, selRef.current + gridSize);
        if (cmd === "LEFT") moveLeft();
        if (cmd === "RIGHT") moveRight();
        if (cmd === "FORWARD") {
          if (selRef.current < gridItems) selectStarter(startersRef.current[selRef.current]);
          else if (selRef.current === gridItems) navigate("/keyboard", { state: { words: [], returnTo: "/compose" } });
          else if (selRef.current === gridItems + 1) navigate("/");
        }
      }

      setSel(newSel);
    });

    return () => unregister();
  }, [mode, navigate, register, unregister]);

  const gridSize = 4;
  const gridItems = 12;

  return (
    <div style={s.page}>
      <div style={s.starterTop}>
        <span style={s.starterTitle}>Communicate</span>
      </div>

      <div style={s.starterBody}>
        {/* <p style={s.starterHint}>
          {!enabled ? "Start with:"
            : mode === "head" ? "HEAD: Use LEFT/RIGHT/UP/DOWN to browse · FORWARD to select · BACK to exit"
            : mode === "eyes" ? "EYES: Use LEFT/RIGHT/UP/DOWN to browse · FORWARD to select"
            : mode === "cnn" ? "CNN: Use LEFT/RIGHT/UP/DOWN to browse · FORWARD to select"
            : mode === "custom" ? "CUSTOM: Commands follow your action-source bindings"
            : "Select a starter…"}
        </p> */}

        <div style={s.starterGrid}>
          {starters.map((phrase, i) => {
            const isSelected = enabled && selIdx === i;
            return (
              <button
                key={i}
                style={{
                  ...s.starterBtn,
                  borderColor: isSelected ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.08)",
                  background: isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  color: isSelected ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.85)",
                  transform: isSelected ? "scale(1.04)" : "scale(1)",
                }}
                onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onClick={() => selectStarter(phrase)}
              >
                {phrase}
              </button>
            );
          })}
        </div>

        <div style={s.starterButtonRow}>
          <button
            style={{
              ...s.keyboardBtn,
              borderColor: enabled && selIdx === gridItems ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.08)",
              background: enabled && selIdx === gridItems ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              color: enabled && selIdx === gridItems ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.85)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onClick={() => navigate("/keyboard", { state: { words: [], returnTo: "/compose" } })}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
            </svg>
            <span>Keyboard</span>
          </button>
          <button
            style={{
              ...s.backBtn,
              borderColor: enabled && selIdx === gridItems + 1 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.08)",
              background: enabled && selIdx === gridItems + 1 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              color: enabled && selIdx === gridItems + 1 ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.85)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onClick={() => navigate("/")}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    position: "relative", width: "100vw", height: "100vh",
    background: "#111111", display: "flex", alignItems: "center", overflow: "hidden",
  },
  starterTop: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: "3%",
    left: 0,
    right: 0,
    minHeight: "5%",
    marginTop: "12px",
  },
  starterBackBtn: {
    position: "absolute",
    top: "50%",
    left: 0,
    transform: "translateY(-50%)",
    padding: "8px 18px",
    borderRadius: "20px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.35)",
    fontSize: "13px",
    cursor: "pointer",
    zIndex: 2,
  },
  starterTitle: {
    fontSize: "clamp(14px, 2.5vw, 18px)",
    fontWeight: "300",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  starterBody: {
    width: "100%", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "clamp(20px, 3vw, 32px)", paddingTop: "clamp(50px, 8vh, 100px)",
  },
  starterButtonRow: {
    display: "flex",
    justifyContent: "flex-start",
    width: "min(900px, 90vw)",
    gap: "clamp(8px, 1.5vw, 14px)",
    marginTop: "clamp(2px, 0.5vh, 10px)",
  },
  starterHint: {
    margin: 0, fontSize: "clamp(12px, 1.5vw, 14px)", color: "rgba(255,255,255,0.25)",
    letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "left",
    width: "min(900px, 90vw)",
    boxSizing: "border-box",
  },
  starterGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
    gap: "clamp(10px, 1.5vw, 14px)", width: "min(900px, 90vw)",
  },
  starterBtn: {
    padding: "clamp(16px, 2vh, 22px) clamp(12px, 2vw, 16px)", borderRadius: "14px", border: "1px solid",
    color: "rgba(255,255,255,0.85)", fontSize: "clamp(16px, 2vw, 20px)", fontWeight: "300",
    cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "-0.2px",
  },
  keyboardBtn: {
    marginLeft: "12.5%",
    flex: "1 1 0",
    padding: "clamp(18px, 2.2vh, 22px) clamp(20px, 2vw, 40px)", borderRadius: "14px", border: "1px solid",
    color: "rgba(255,255,255,0.85)", fontSize: "clamp(16px, 1.8vw, 18px)", fontWeight: "400",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
    cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "-0.2px",
  },
  backBtn: {
    marginRight: "12.5%",
    flex: "0 0 25%",
    padding: "clamp(16px, 2vh, 22px) clamp(12px, 2vw, 16px)", borderRadius: "14px", borderWidth: "1px", borderStyle: "solid",
    color: "rgba(255,255,255,0.85)", fontSize: "clamp(16px, 1.8vw, 18px)", fontWeight: "400",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
    cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "-0.2px",
  },
};
