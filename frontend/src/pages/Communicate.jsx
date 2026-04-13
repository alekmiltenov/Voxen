import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost, createSuggestSocket } from "../api";
import { useInputControl } from "./InputControlContext";

const DEFAULT_STARTERS = [
  "I", "I need", "I want", "I feel",
  "Help", "Can you", "Yes", "No",
  "Please", "Thank you", "I am", "I would like",
];

const SLOT_STYLE = {
  "-2": { opacity: 0.15, fontSize: "34px", fontWeight: 300 },
  "-1": { opacity: 0.42, fontSize: "54px", fontWeight: 300 },
   "0": { opacity: 1.00, fontSize: "80px", fontWeight: 400 },
   "1": { opacity: 0.42, fontSize: "54px", fontWeight: 300 },
   "2": { opacity: 0.15, fontSize: "34px", fontWeight: 300 },
};


export default function Communicate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, enabled, register, unregister } = useInputControl();

  const [words,       setWords]       = useState(location.state?.words ?? []);
  const [starters,    setStarters]    = useState(DEFAULT_STARTERS);
  const [suggestions, setSuggestions] = useState([]);
  const [selIdx,      setSelIdx]      = useState(0);
  const [speaking,    setSpeaking]    = useState(false);
  const [panelFocus,  setPanelFocus]  = useState("left"); // "left" or "right"
  const wsRef = useRef(null);

  const selRef         = useRef(0);
  const wordsRef       = useRef([]);
  const suggestionsRef = useRef([]);
  const startersRef    = useRef(DEFAULT_STARTERS);
  const modePageRef    = useRef("starters");
  const panelFocusRef  = useRef("left");

  const setSel = (v) => { selRef.current = v; setSelIdx(v); };
  const setPanelFocusVal = (v) => { panelFocusRef.current = v; setPanelFocus(v); };

  useEffect(() => { wordsRef.current       = words;       }, [words]);
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);
  useEffect(() => { startersRef.current    = starters;    }, [starters]);
  useEffect(() => {
    modePageRef.current = words.length === 0 ? "starters" : "drum";
  }, [words]);

  const pageMode = words.length === 0 ? "starters" : "drum";

  // ── Build drum items: inject "🔊 Speak" and "⌨️ Keyboard" at the top ──
  const drumItems = pageMode === "drum" ? suggestions : [];
  const drumItemsRef = useRef(drumItems);
  useEffect(() => { drumItemsRef.current = drumItems; }, [drumItems]);

  const loadStarters = useCallback(() => {
    apiGet("/vocab/starters?limit=12")
      .then(d => {
        const learned = d.starters.map(s => s.word).filter(Boolean);
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

  // ── personalized starters ────────────────────────────────────────────────
  useEffect(() => {
    loadStarters();
  }, [loadStarters]);

  // Refresh starters whenever sentence is cleared back to empty.
  useEffect(() => {
    if (words.length === 0) loadStarters();
  }, [words.length, loadStarters]);

  // ── suggestion WebSocket ─────────────────────────────────────────────────
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;
    let closedByCleanup = false;

    const sendCurrentWords = () => {
      const currentWords = wordsRef.current || [];
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (currentWords.length === 0) {
        setSuggestions([]);
        return;
      }
      ws.send(JSON.stringify({ text: currentWords.join(" "), words: currentWords, top_k: 8 }));
    };

    const connect = () => {
      ws = createSuggestSocket();
      wsRef.current = ws;

      ws.onopen = () => {
        sendCurrentWords();
      };

      ws.onmessage = e => {
        const d = JSON.parse(e.data);
        if (d.suggestions) {
          setSuggestions(d.suggestions.map(s => s.word ?? s));
          setSel(0);
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (closedByCleanup) return;
        reconnectTimer = setTimeout(connect, 1200);
      };
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (words.length === 0) { setSuggestions([]); return; }
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: words.join(" "), words, top_k: 8 }));
    }
  }, [words]);

  // ── word helpers ─────────────────────────────────────────────────────────
  const wrap = (i, n) => n === 0 ? 0 : ((i % n) + n) % n;

  function selectStarter(phrase) {
    const phraseWords = phrase.trim().split(/\s+/);
    setWords(phraseWords);
    wordsRef.current = phraseWords; // Update ref immediately
    setSuggestions([]); // Clear old suggestions
    setPanelFocusVal("left"); // Start on left panel
    setSel(0); // Start on first command
  }

  function confirmDrumItem() {
    const items = drumItemsRef.current;
    if (!items.length) return;
    const item = items[selRef.current];
    if (item) {
      setWords(prev => [...prev, item.trim()]);
      setSel(2);
    }
  }

  function backspace() {
    setSel(2);
    setWords(prev => prev.slice(0, -1));
  }

  function speak() {
    const w = wordsRef.current;
    if (!w.length) return;
    const utt = new SpeechSynthesisUtterance(w.join(" "));
    setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
    apiPost("/vocab/sentence", { words: w }).catch(console.error);
  }

  function clear() {
    window.speechSynthesis.cancel();
    setWords([]);
    setSuggestions([]);
    setSel(0);
    setSpeaking(false);
  }

  // ── unified control handler ──────────────────────────────────────────────
  // Starters page: 2D grid navigation (0-11 = grid, 12 = Keyboard, 13 = BACK)
  useEffect(() => {
    register((cmd) => {
      const m = modePageRef.current;

      if (m === "starters") {
        const gridSize = 4;
        const gridItems = 12;
        const totalItems = gridItems + 2;
        let newSel = selRef.current;

        if (mode === "head") {
          if (cmd === "LEFT")    newSel = wrap(selRef.current - 1, totalItems);
          if (cmd === "RIGHT")   newSel = wrap(selRef.current + 1, totalItems);
          if (cmd === "UP")      newSel = Math.max(0, selRef.current - gridSize);
          if (cmd === "DOWN")    newSel = Math.min(totalItems - 1, selRef.current + gridSize);
          if (cmd === "FORWARD") {
            if (selRef.current < gridItems) selectStarter(startersRef.current[selRef.current]);
            else if (selRef.current === gridItems) navigate("/keyboard", { state: { words } });
            else if (selRef.current === gridItems + 1) navigate("/");
          }
          if (cmd === "BACK")    navigate("/");
        } else if (mode === "cnn") {
          if (cmd === "UP")      newSel = Math.max(0, selRef.current - gridSize);
          if (cmd === "DOWN")    newSel = Math.min(totalItems - 1, selRef.current + gridSize);
          if (cmd === "LEFT")    newSel = wrap(selRef.current - 1, totalItems);
          if (cmd === "RIGHT")   newSel = wrap(selRef.current + 1, totalItems);
          if (cmd === "FORWARD") {
            if (selRef.current < gridItems) selectStarter(startersRef.current[selRef.current]);
            else if (selRef.current === gridItems) navigate("/keyboard", { state: { words } });
            else if (selRef.current === gridItems + 1) navigate("/");
          }
        } else {
          if (cmd === "UP")      newSel = Math.max(0, selRef.current - gridSize);
          if (cmd === "DOWN")    newSel = Math.min(totalItems - 1, selRef.current + gridSize);
          if (cmd === "LEFT")    newSel = wrap(selRef.current - 1, totalItems);
          if (cmd === "RIGHT")   newSel = wrap(selRef.current + 1, totalItems);
          if (cmd === "FORWARD") {
            if (selRef.current < gridItems) selectStarter(startersRef.current[selRef.current]);
            else if (selRef.current === gridItems) navigate("/keyboard", { state: { words } });
            else if (selRef.current === gridItems + 1) navigate("/");
          }
        }
        setSel(newSel);

      } else {
        // ── DRUM PAGE: Two-panel layout ──
        // Left panel: 5 commands (Speak, Keyboard, Delete Last, Clear All, Switch)
        // Right panel: suggestions carousel
        const leftCommands = 5;
        const rightCount = suggestionsRef.current.length || 0;

        if (panelFocusRef.current === "left") {
          // LEFT PANEL NAVIGATION
          if (cmd === "UP")      setSel(wrap(selRef.current - 1, leftCommands));
          if (cmd === "DOWN")    setSel(wrap(selRef.current + 1, leftCommands));
          if (cmd === "LEFT" || cmd === "RIGHT") {
            // Switch to right panel
            if (rightCount > 0) {
              setPanelFocusVal("right");
              setSel(0); // Start at first suggestion
            }
          }
          if (cmd === "FORWARD") {
            const actions = [speak, () => navigate("/keyboard", { state: { words: wordsRef.current } }), backspace, clear, () => setPanelFocusVal("right")];
            actions[selRef.current]?.();
            if (selRef.current === 4) setSel(0); // Switch button - select first suggestion
          }
        } else {
          // RIGHT PANEL NAVIGATION (Suggestions)
          if (cmd === "UP")      setSel(wrap(selRef.current - 1, rightCount));
          if (cmd === "DOWN")    setSel(wrap(selRef.current + 1, rightCount));
          if (cmd === "LEFT" || cmd === "RIGHT") {
            // Switch back to left panel
            setPanelFocusVal("left");
            setSel(0); // Start at Speak button
          }
          if (cmd === "FORWARD") {
            confirmDrumItem(); // Add selected suggestion
          }
        }
      }
    });
    return () => unregister();
  }, [mode, navigate, words]);

  // ── drum display helpers ─────────────────────────────────────────────────
  const n = drumItems.length;
  const slotWords = {};
  if (n > 0) {
    [-2, -1, 0, 1, 2].forEach(slot => {
      const item = drumItems[wrap(selIdx + slot, n)];
      slotWords[slot] = item ?? "";
    });
  }

  const isEyes = mode === "eyes";

  // ── STARTERS PAGE ────────────────────────────────────────────────────────
  // Grid has 12 starters (indices 0-11) + Keyboard button (12) + BACK button (13)
  if (pageMode === "starters") {
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
            onMouseEnter={e => {
              if (!(enabled && selIdx === gridItems + 1)) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={e => {
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
              : mode === "head" ? "🎮 HEAD: Use LEFT/RIGHT/UP/DOWN to browse · FORWARD to select · BACK to exit"
              : mode === "eyes" ? "👁️ EYES: Use LEFT/RIGHT/UP/DOWN to browse · FORWARD to select"
              : mode === "cnn" ? "🧠 CNN: Use LEFT/RIGHT/UP/DOWN to browse · FORWARD to select"
              : mode === "custom" ? "🧭 CUSTOM: Commands follow your action-source bindings"
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
                    borderColor: isSelected ? "rgba(255,255,255,0.4)"  : "rgba(255,255,255,0.08)",
                    background:  isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                    color:       isSelected ? "rgba(255,255,255,1)"    : "rgba(255,255,255,0.85)",
                    transform:   isSelected ? "scale(1.04)"            : "scale(1)",
                  }}
                  onMouseEnter={e => !isSelected && (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                  onMouseLeave={e => !isSelected && (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
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
                background:  enabled && selIdx === gridItems ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                color:       enabled && selIdx === gridItems ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.85)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              onClick={() => navigate("/keyboard", { state: { words } })}
            >
              Keyboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DRUM PAGE ────────────────────────────────────────────────────────────
  // Menu bar items: accessible via UP/DOWN navigation
  const menuItems = [
    { label: "🔊 Speak", action: speak },
    { label: "⌨️ Keyboard", action: () => navigate("/keyboard", { state: { words } }) },
    { label: "⌫ Delete Last", action: backspace },
    { label: "✕ Clear All", action: clear },
  ];

  // Navigation state: selIdx can be -1 to -4 (menu) or 0+ (drum items)
  const isInMenu = selIdx < 0;
  const menuIdx = isInMenu ? Math.abs(selIdx) - 1 : -1;
  const itemIdx = !isInMenu ? selIdx : -1;

  // Instructions
  const getInstructions = () => {
    if (mode === "head") {
      return "🎮 HEAD: Tilt LEFT/RIGHT to browse · FORWARD to add · BACK to delete";
    } else if (mode === "eyes") {
      return "👁️ EYES: Look UP to menu · DOWN/LEFT/RIGHT to browse · Hold RIGHT ~1.5s to add";
    } else if (mode === "cnn") {
      return "🧠 CNN: Look UP to menu · DOWN/LEFT/RIGHT to browse · Close eyes 500ms to add";
    }
    return "Browse and add words · Click menu button for more options";
  };

  return (
    <div style={s.drumPageContainer}>
      {/* SENTENCE PANEL — Top */}
      <div style={s.drumSentencePanel}>
        <p style={s.drumSentenceText}>{words.join(" ") || "(empty)"}</p>
      </div>

      {/* TWO-PANEL LAYOUT */}
      <div style={s.twoPanelWrapper}>
        {/* LEFT PANEL — Commands */}
        <div style={s.leftPanel}>
          <p style={s.panelTitle}>Commands</p>
          {[
            { label: "🔊 Speak", action: speak },
            { label: "⌨️ Keyboard", action: () => navigate("/keyboard", { state: { words: wordsRef.current } }) },
            { label: "⌫ Delete Last", action: backspace },
            { label: "🗑️ Clear All", action: clear },
            { label: "→ Switch", action: () => {} },
          ].map((item, i) => (
            <button
              key={i}
              style={{
                ...s.commandBtn,
                background: panelFocus === "left" && selIdx === i ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)",
                borderColor: panelFocus === "left" && selIdx === i ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)",
                color: panelFocus === "left" && selIdx === i ? "#86efac" : "rgba(255,255,255,0.7)",
                transform: panelFocus === "left" && selIdx === i ? "scale(1.05)" : "scale(1)",
              }}
              onClick={item.action}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* RIGHT PANEL — Suggestions */}
        <div style={s.rightPanel}>
          <p style={s.panelTitle}>Suggestions</p>
          {suggestions.length > 0 ? (
            <div style={s.suggestionsCarousel}>
              {suggestions.map((word, i) => (
                <button
                  key={i}
                  style={{
                    ...s.suggestionItem,
                    background: panelFocus === "right" && selIdx === i ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)",
                    borderColor: panelFocus === "right" && selIdx === i ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)",
                    color: panelFocus === "right" && selIdx === i ? "#86efac" : "rgba(255,255,255,0.7)",
                    transform: panelFocus === "right" && selIdx === i ? "scale(1.08)" : "scale(1)",
                  }}
                  onClick={() => {
                    setWords([...wordsRef.current, word]);
                    setSel(0);
                  }}
                >
                  {word}
                </button>
              ))}
            </div>
          ) : (
            <p style={s.noSuggestions}>No suggestions yet…</p>
          )}
        </div>
      </div>

      {/* INSTRUCTIONS */}
      <p style={s.drumInstructions}>
        {panelFocus === "left" 
          ? "🎮 Commands · UP/DOWN to navigate · LEFT/RIGHT to switch · FORWARD to select"
          : "💡 Suggestions · UP/DOWN to browse · LEFT/RIGHT to switch · FORWARD to add"}
      </p>

      {/* BACK TO HOME */}
      <button style={s.drumBackBtn} onClick={() => navigate("/")} title="Back to home">
        ← Back
      </button>
    </div>
  );
}

const drumLegendItem = {
  fontSize: 12, color: "rgba(255,255,255,0.2)",
  letterSpacing: "0.06em", textTransform: "uppercase",
};

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
    cursor: "pointer", transition: "all 0.15s ease", letterSpacing: "-0.2px",
  },
  pill: {
    padding: "8px 18px", borderRadius: "20px", background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)",
    fontSize: "13px", cursor: "pointer",
  },

  // Drum Page Styles
  drumPageContainer: {
    position: "relative", width: "100vw", height: "100vh",
    background: "#111111", display: "flex", flexDirection: "column",
    padding: "28px 32px", boxSizing: "border-box", gap: "16px",
    overflow: "hidden",
  },
  drumMenuBar: {
    display: "flex", gap: "12px", justifyContent: "center",
    flexShrink: 0,
  },
  drumMenuBtn: {
    padding: "12px 20px", borderRadius: "14px", border: "1px solid",
    fontSize: "14px", fontWeight: "500", cursor: "pointer",
    transition: "all 0.15s", letterSpacing: "0.05em", whiteSpace: "nowrap",
  },
  drumInstructions: {
    margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center",
    flexShrink: 0,
  },
  drumSentencePanel: {
    flex: "0 0 auto", padding: "20px 24px", borderRadius: "16px",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    minHeight: "80px", display: "flex", alignItems: "center", justifyContent: "center",
  },
  drumSentenceText: {
    margin: 0, fontSize: "28px", fontWeight: "300", color: "rgba(255,255,255,0.9)",
    lineHeight: "1.4", letterSpacing: "-0.3px", textAlign: "center",
  },
  drumSelectorContainer: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "12px", minHeight: 0,
  },
  drumScrollHint: {
    fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  drumCarousel: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "16px", flex: 1, justifyContent: "center", minHeight: 0,
  },
  drumArrowBtn: {
    width: "48px", height: "48px", borderRadius: "50%", background: "transparent",
    border: "1.5px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.45)",
    fontSize: "16px", cursor: "pointer", transition: "border-color 0.15s",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  drumWordsDisplay: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "4px", flex: 1, minHeight: 0,
  },
  drumWordItem: {
    textAlign: "center", lineHeight: "1.1", letterSpacing: "-0.3px",
    transition: "opacity 0.2s ease, font-size 0.2s ease",
    userSelect: "none", whiteSpace: "nowrap", minHeight: "1em",
  },
  drumSelectHint: {
    fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  drumBackBtn: {
    alignSelf: "center", padding: "8px 18px", borderRadius: "20px",
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.35)", fontSize: "13px", cursor: "pointer",
    transition: "all 0.15s", flexShrink: 0,
  },
  twoPanelWrapper: {
    display: "flex", gap: "24px", flex: 1, minHeight: 0, justifyContent: "center",
    alignItems: "stretch",
  },
  leftPanel: {
    flex: "0 0 280px", display: "flex", flexDirection: "column", gap: "12px",
    padding: "20px", borderRadius: "16px", background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)", overflow: "auto",
  },
  rightPanel: {
    flex: "0 0 280px", display: "flex", flexDirection: "column", gap: "12px",
    padding: "20px", borderRadius: "16px", background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)", overflow: "auto",
  },
  panelTitle: {
    margin: "0 0 8px", fontSize: "12px", fontWeight: "600",
    color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase",
  },
  commandBtn: {
    padding: "16px 12px", borderRadius: "12px", border: "1px solid",
    fontSize: "14px", fontWeight: "500", cursor: "pointer",
    transition: "all 0.15s ease", textAlign: "center",
  },
  suggestionItem: {
    padding: "12px 16px", borderRadius: "10px", border: "1px solid",
    fontSize: "13px", fontWeight: "400", cursor: "pointer",
    transition: "all 0.15s ease", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  suggestionsCarousel: {
    display: "flex", flexDirection: "column", gap: "8px", flex: 1, overflow: "auto",
  },
  noSuggestions: {
    margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.3)",
    textAlign: "center", alignSelf: "center", padding: "20px",
  },
};
