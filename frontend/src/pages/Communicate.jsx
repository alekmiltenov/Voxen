import { useState, useEffect, useRef } from "react";
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
  const [menuOpen,    setMenuOpen]    = useState(false);
  const wsRef = useRef(null);

  const selRef         = useRef(0);
  const wordsRef       = useRef([]);
  const suggestionsRef = useRef([]);
  const startersRef    = useRef(DEFAULT_STARTERS);
  const modePageRef    = useRef("starters");

  const setSel = (v) => { selRef.current = v; setSelIdx(v); };

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

  // ── personalized starters ────────────────────────────────────────────────
  useEffect(() => {
    apiGet("/vocab/starters?limit=12")
      .then(d => {
        const list = d.starters.map(s => s.word).filter(Boolean);
        if (list.length >= 4) setStarters(list);
      })
      .catch(() => {});
  }, []);

  // ── suggestion WebSocket ─────────────────────────────────────────────────
  useEffect(() => {
    const ws = createSuggestSocket();
    wsRef.current = ws;
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.suggestions) {
        setSuggestions(d.suggestions.map(s => s.word ?? s));
        setSel(0);
      }
    };
    return () => ws.close();
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
    setWords(phrase.trim().split(/\s+/));
    setSel(2);
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
  useEffect(() => {
    register((cmd) => {
      const m = modePageRef.current;

      if (m === "starters") {
        const n = startersRef.current.length;
        const cols = 4; // grid columns

        if (mode === "head") {
          // head: LEFT/RIGHT cycle through items, FORWARD selects
          if (cmd === "LEFT")    setSel(wrap(selRef.current - 1, n));
          if (cmd === "RIGHT")   setSel(wrap(selRef.current + 1, n));
          if (cmd === "FORWARD") selectStarter(startersRef.current[selRef.current]);
          if (cmd === "BACK")    navigate("/");
        } else {
          // eyes: UP = prev item (visually left), DOWN = next item (visually right)
          // LEFT = go back to home, hold RIGHT (FORWARD) = select
          if (cmd === "UP")      setSel(wrap(selRef.current - 1, n));
          if (cmd === "DOWN")    setSel(wrap(selRef.current + 1, n));
          if (cmd === "FORWARD") selectStarter(startersRef.current[selRef.current]);
          if (cmd === "LEFT")    navigate("/");
        }

      } else {
        // drum mode
        const n = drumItemsRef.current.length;

        if (mode === "head") {
          if (cmd === "LEFT")    setSel(wrap(selRef.current - 1, n));
          if (cmd === "RIGHT")   setSel(wrap(selRef.current + 1, n));
          if (cmd === "FORWARD") confirmDrumItem();
          if (cmd === "BACK")    backspace();
        } else {
          // eyes: UP/DOWN scroll drum, hold RIGHT (FORWARD) confirms, LEFT deletes
          if (cmd === "UP")      setSel(wrap(selRef.current - 1, n));
          if (cmd === "DOWN")    setSel(wrap(selRef.current + 1, n));
          if (cmd === "FORWARD") confirmDrumItem();
          if (cmd === "LEFT")    backspace();
        }
      }
    });
    return () => unregister();
  }, [mode]);

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
  if (pageMode === "starters") {
    return (
      <div style={s.page}>
        <div style={s.starterTop}>
          <button style={s.pill} onClick={() => navigate("/")}>← Back</button>
          <div style={{ width: 80 }} />
        </div>

        <div style={s.starterBody}>
          <p style={s.starterHint}>
            {!enabled ? "Start with…"
              : isEyes ? "Look UP to go back · DOWN to go forward · HOLD RIGHT to select"
              : "Tilt LEFT / RIGHT to browse · FORWARD to select"}
          </p>
          <div style={s.starterGrid}>
            {starters.map((phrase, i) => {
              const isSelected = enabled && selIdx === i;
              return (
                <button
                  key={phrase}
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
          <button style={s.keyboardBtn}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
            onClick={() => navigate("/keyboard", { state: { words } })}>
            Keyboard
          </button>
        </div>
      </div>
    );
  }

  // ── DRUM PAGE ────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* LEFT side button — ⋯ menu */}
      <button style={s.sideBtn} onClick={() => setMenuOpen(o => !o)}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
        ⋯
      </button>

      <div style={s.main}>

        {/* sentence panel */}
        <div style={s.sentencePanel}>
          <p style={s.sentenceText}>{words.join(" ")}</p>

          {enabled && (
            <div style={s.drumLegend}>
              {isEyes ? (
                <>
                  <span style={drumLegendItem}>↑ UP · scroll up</span>
                  <span style={drumLegendItem}>↓ DOWN · scroll down</span>
                  <span style={drumLegendItem}>→ HOLD RIGHT · select word</span>
                  <span style={drumLegendItem}>← LEFT · delete</span>
                  <span style={drumLegendItem}>Scroll to 🔊 Speak or ⌨️ Keyboard</span>
                </>
              ) : (
                <>
                  <span style={drumLegendItem}>← scroll up</span>
                  <span style={drumLegendItem}>→ scroll down</span>
                  <span style={drumLegendItem}>FORWARD · add word</span>
                  <span style={drumLegendItem}>BACK · delete</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* drum */}
        <div style={s.drumPanel}>
          <button style={s.arrowBtn}
            onClick={() => setSel(wrap(selIdx - 1, n))}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}>
            ↑
          </button>

          <div style={s.drumWords}>
            {[-2, -1, 0, 1, 2].map(slot => {
              const word = slotWords[slot] ?? "";
              const ds = SLOT_STYLE[String(slot)];
              const isSpecial = false;
              return (
                <div key={slot} style={{
                  ...s.drumWord,
                  fontSize:   ds.fontSize,
                  opacity:    word ? ds.opacity : 0,
                  fontWeight: ds.fontWeight,
                  color: slot === 0 && enabled
                    ? (isSpecial ? "#86efac" : "#ffffff")
                    : "rgba(255,255,255,0.9)",
                }}>
                  {word}
                </div>
              );
            })}
          </div>

          <button style={s.arrowBtn}
            onClick={() => setSel(wrap(selIdx + 1, n))}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}>
            ↓
          </button>
        </div>
      </div>

      {/* ⋯ menu overlay */}
      {menuOpen && (
        <div style={s.menuOverlay} onClick={() => setMenuOpen(false)}>
          <div style={s.menuGrid} onClick={e => e.stopPropagation()}>
            {/* top — last word */}
            <div style={s.menuCell} />
            <div style={s.menuCell}>
              <button style={s.menuBtn} onClick={() => { backspace(); setMenuOpen(false); }}>⌫ Last word</button>
            </div>
            <div style={s.menuCell} />
            {/* middle — close / speak */}
            <div style={s.menuCell}>
              <button style={s.menuBtn} onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <div style={s.menuCell} />
            <div style={s.menuCell}>
              <button style={{ ...s.menuBtn, color: speaking ? "#86efac" : undefined }}
                onClick={() => { speak(); setMenuOpen(false); }}>
                {speaking ? "speaking…" : "🔊 Speak"}
              </button>
            </div>
            {/* bottom — clear all */}
            <div style={s.menuCell} />
            <div style={s.menuCell}>
              <button style={s.menuBtn} onClick={() => { clear(); setMenuOpen(false); }}>Clear all</button>
            </div>
            <div style={s.menuCell} />
          </div>
        </div>
      )}

      {/* RIGHT side button */}
      <button style={s.sideBtn} onClick={confirmDrumItem}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
        {isEyes ? "→" : (enabled ? "FWD" : "OK")}
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
    position: "absolute", top: "28px", left: 0, right: 0,
    display: "flex", justifyContent: "space-between", padding: "0 32px",
  },
  starterBody: {
    width: "100%", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "32px", paddingTop: "80px",
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
    padding: "28px 16px", borderRadius: "14px",
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.85)", fontSize: "24px", fontWeight: "400",
    cursor: "pointer", transition: "background 0.15s",
    width: "calc(50% + 7px)", margin: "24px auto 0",
  },
  pill: {
    padding: "8px 18px", borderRadius: "20px", background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)",
    fontSize: "13px", cursor: "pointer",
  },
  sideBtn: {
    flexShrink: 0, width: "74px", height: "74px", borderRadius: "50%",
    background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.15)",
    color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 500,
    cursor: "pointer", margin: "0 24px", transition: "background 0.15s",
  },
  main: { flex: 1, display: "flex", alignItems: "center", height: "100%" },
  sentencePanel: {
    flex: "0 0 50%", display: "flex", flexDirection: "column",
    justifyContent: "center", paddingLeft: "16px", paddingRight: "32px", height: "100%",
  },
  sentenceText: {
    fontSize: "50px", fontWeight: "300", color: "#ffffff", margin: 0,
    letterSpacing: "-0.5px", lineHeight: "1.25", wordBreak: "break-word",
  },
  controls: { display: "flex", gap: "10px", marginTop: "24px", flexWrap: "wrap" },
  dotsBtn: {
    marginTop: "20px", padding: "6px 18px", borderRadius: "18px",
    background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.4)", fontSize: "20px", cursor: "pointer", letterSpacing: "2px",
  },
  menuOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  menuGrid: {
    display: "grid", gridTemplateColumns: "1fr auto 1fr",
    gridTemplateRows: "1fr auto 1fr", gap: "32px",
    width: "min(600px, 85vw)", height: "min(440px, 75vh)",
  },
  menuCell: { display: "flex", alignItems: "center", justifyContent: "center" },
  menuBtn: {
    padding: "18px 32px", borderRadius: "18px", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)",
    fontSize: "18px", fontWeight: "400", cursor: "pointer", whiteSpace: "nowrap",
  },
  drumLegend: { display: "flex", flexDirection: "column", gap: 4, marginTop: 28 },
  drumPanel: {
    flex: "1", display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "space-between", height: "100%", paddingTop: "40px", paddingBottom: "40px",
  },
  arrowBtn: {
    width: "50px", height: "50px", borderRadius: "50%", background: "transparent",
    border: "1.5px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.45)",
    fontSize: "17px", cursor: "pointer", transition: "border-color 0.15s",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  drumWords: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "8px", flex: 1,
  },
  drumWord: {
    color: "#ffffff", textAlign: "center", lineHeight: "1.15",
    letterSpacing: "-0.5px", transition: "opacity 0.16s ease, font-size 0.16s ease",
    userSelect: "none", whiteSpace: "nowrap", minHeight: "1em",
  },
};
