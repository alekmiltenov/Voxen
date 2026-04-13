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
        const learned = d.starters.map((s) => s.word).filter(Boolean);
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

  const wrap = (i, n) => (n === 0 ? 0 : ((i % n) + n) % n);

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

      if (mode === "head") {
        if (cmd === "LEFT") newSel = wrap(selRef.current - 1, totalItems);
        if (cmd === "RIGHT") newSel = wrap(selRef.current + 1, totalItems);
        if (cmd === "UP") newSel = Math.max(0, selRef.current - gridSize);
        if (cmd === "DOWN") newSel = Math.min(totalItems - 1, selRef.current + gridSize);
        if (cmd === "FORWARD") {
          if (selRef.current < gridItems) selectStarter(startersRef.current[selRef.current]);
          else if (selRef.current === gridItems) navigate("/keyboard", { state: { words: [] } });
          else if (selRef.current === gridItems + 1) navigate("/");
        }
        if (cmd === "BACK") navigate("/");
      } else if (mode === "cnn") {
        if (cmd === "UP") newSel = Math.max(0, selRef.current - gridSize);
        if (cmd === "DOWN") newSel = Math.min(totalItems - 1, selRef.current + gridSize);
        if (cmd === "LEFT") newSel = wrap(selRef.current - 1, totalItems);
        if (cmd === "RIGHT") newSel = wrap(selRef.current + 1, totalItems);
        if (cmd === "FORWARD") {
          if (selRef.current < gridItems) selectStarter(startersRef.current[selRef.current]);
          else if (selRef.current === gridItems) navigate("/keyboard", { state: { words: [] } });
          else if (selRef.current === gridItems + 1) navigate("/");
        }
      } else {
        if (cmd === "UP") newSel = Math.max(0, selRef.current - gridSize);
        if (cmd === "DOWN") newSel = Math.min(totalItems - 1, selRef.current + gridSize);
        if (cmd === "LEFT") newSel = wrap(selRef.current - 1, totalItems);
        if (cmd === "RIGHT") newSel = wrap(selRef.current + 1, totalItems);
        if (cmd === "FORWARD") {
          if (selRef.current < gridItems) selectStarter(startersRef.current[selRef.current]);
          else if (selRef.current === gridItems) navigate("/keyboard", { state: { words: [] } });
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
        <button
          style={{
            ...s.starterBackBtn,
            borderColor: enabled && selIdx === gridItems + 1 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)",
            background: enabled && selIdx === gridItems + 1 ? "rgba(255,255,255,0.08)" : "transparent",
            color: enabled && selIdx === gridItems + 1 ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.35)",
          }}
          onMouseEnter={(e) => {
            if (!(enabled && selIdx === gridItems + 1)) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={(e) => {
            if (!(enabled && selIdx === gridItems + 1)) e.currentTarget.style.background = "transparent";
          }}
          onClick={() => navigate("/")}
        >
          ← Back
        </button>
        <span style={s.starterTitle}>Communicate</span>
      </div>

      <div style={s.starterBody}>
        <p style={s.starterHint}>
          {!enabled ? "Start with…"
            : mode === "head" ? "HEAD: Use LEFT/RIGHT/UP/DOWN to browse · FORWARD to select · BACK to exit"
            : mode === "eyes" ? "EYES: Use LEFT/RIGHT/UP/DOWN to browse · FORWARD to select"
            : mode === "cnn" ? "CNN: Use LEFT/RIGHT/UP/DOWN to browse · FORWARD to select"
            : mode === "custom" ? "CUSTOM: Commands follow your action-source bindings"
            : "Select a starter…"}
        </p>

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
            onClick={() => navigate("/keyboard", { state: { words: [] } })}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
            </svg>
            <span>Keyboard</span>
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
    top: "28px",
    left: "32px",
    right: "32px",
    minHeight: "34px",
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
    fontSize: "18px",
    fontWeight: "300",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  starterBody: {
    width: "100%", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "32px", paddingTop: "80px",
  },
  starterButtonRow: {
    display: "flex",
    justifyContent: "flex-start",
    width: "min(900px, 90vw)",
    marginTop: "3px",
  },
  starterHint: {
    margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.25)",
    letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center",
  },
  starterGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
    gap: "14px", width: "min(900px, 90vw)",
  },
  starterBtn: {
    padding: "22px 16px", borderRadius: "14px", border: "1px solid",
    color: "rgba(255,255,255,0.85)", fontSize: "20px", fontWeight: "300",
    cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "-0.2px",
  },
  keyboardBtn: {
    marginLeft: "calc(((100% - 42px) / 4) * 0.75)",
    width: "calc((((100% - 42px) / 4) * 2.5) + 42px)",
    maxWidth: "100%",
    padding: "28px 40px", borderRadius: "14px", border: "1px solid",
    color: "rgba(255,255,255,0.85)", fontSize: "18px", fontWeight: "400",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px",
    cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "-0.2px",
  },
};
