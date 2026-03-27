import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost, createSuggestSocket } from "../api";
import DwellButton from "../components/DwellButton";

// ── Starter phrases shown on first screen ─────────────────────────────────
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

  const [words,       setWords]       = useState(location.state?.words ?? []);
  const [starters,    setStarters]    = useState(DEFAULT_STARTERS);
  const [suggestions, setSuggestions] = useState([]);
  const [selIdx,      setSelIdx]      = useState(0);
  const [speaking,    setSpeaking]    = useState(false);
  const [showMenu,    setShowMenu]    = useState(false);
  const wsRef = useRef(null);

  const mode = words.length === 0 ? "starters" : "drum";

  // ── personalized starters from backend ───────────────────────────────────
  useEffect(() => {
    apiGet("/vocab/starters?limit=12")
      .then(d => {
        const list = d.starters.map(s => s.word).filter(Boolean);
        if (list.length >= 4) setStarters(list);
      })
      .catch(() => {});
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = createSuggestSocket();
    wsRef.current = ws;
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.suggestions) {
        setSuggestions(d.suggestions.map(s => s.word ?? s));
        setSelIdx(0);
      }
    };
    return () => ws.close();
  }, []);

  // ── send to WS when words change ──────────────────────────────────────────
  useEffect(() => {
    if (words.length === 0) return;
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: words.join(" "), words, top_k: 8 }));
    }
  }, [words]);

  const visibleSuggestions = words.length === 0 ? [] : suggestions;

  // ── starter click → enter drum mode ──────────────────────────────────────
  function selectStarter(phrase) {
    setWords(phrase.trim().split(/\s+/));
    setSelIdx(0);
  }

  // ── drum: circular slot → word map ────────────────────────────────────────
  const n = visibleSuggestions.length;
  const wrap = i => n === 0 ? -1 : ((i % n) + n) % n;
  const slotWords = {};
  if (n > 0) {
    [-2, -1, 0, 1, 2].forEach(slot => {
      slotWords[slot] = visibleSuggestions[wrap(selIdx + slot)];
    });
  }
  const centeredWord = n > 0 ? visibleSuggestions[selIdx] : null;

  function scrollUp()   { setSelIdx(i => wrap(i - 1)); }
  function scrollDown() { setSelIdx(i => wrap(i + 1)); }

  function confirmWord() {
    if (!centeredWord) return;
    setWords(prev => [...prev, centeredWord.trim()]);
    setSelIdx(0);
  }

  function backspace() {
    setSelIdx(0);
    setWords(prev => prev.slice(0, -1));
  }

  function speak() {
    if (!words.length) return;
    const utt = new SpeechSynthesisUtterance(words.join(" "));
    setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
    apiPost("/vocab/sentence", { words }).catch(console.error);
  }

  function clear() {
    window.speechSynthesis.cancel();
    setWords([]);
    setSuggestions([]);
    setSelIdx(0);
    setSpeaking(false);
  }

  // ── STARTERS PAGE ─────────────────────────────────────────────────────────
  if (mode === "starters") {
    return (
      <div style={s.page}>
        <div style={s.starterTop}>
          <DwellButton style={s.pill} onClick={() => navigate("/")}>← Back</DwellButton>
          <DwellButton style={s.pill}
            onClick={() => navigate("/keyboard", { state: { words } })}>
            keyboard
          </DwellButton>
        </div>

        <div style={s.starterBody}>
          <p style={s.starterHint}>Start with…</p>
          <div style={s.starterGrid}>
            {starters.map(phrase => (
              <DwellButton
                key={phrase}
                style={s.starterBtn}
                hoverBg="rgba(255,255,255,0.08)"
                onClick={() => selectStarter(phrase)}
              >
                {phrase}
              </DwellButton>
            ))}
          </div>
          <button
            style={s.keyboardBtn}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
            onClick={() => navigate("/keyboard", { state: { words } })}>
            Keyboard
          </button>
        </div>
      </div>
    );
  }

  // ── DRUM PAGE ─────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* ── action menu overlay ── */}
      {showMenu && (
        <div style={s.overlay} onClick={() => setShowMenu(false)}>
          {/* Speak — right center */}
          <DwellButton style={{ ...s.menuBtn, top: "50%", right: "8%", transform: "translateY(-50%)" }}
            onClick={e => { e.stopPropagation(); speak(); setShowMenu(false); }}>
            {speaking ? "speaking…" : "Speak"}
          </DwellButton>
          {/* Clear — top center */}
          <DwellButton style={{ ...s.menuBtn, top: "10%", left: "50%", transform: "translateX(-50%)" }}
            onClick={e => { e.stopPropagation(); clear(); setShowMenu(false); }}>
            Clear
          </DwellButton>
          {/* Back ⌫ — bottom center */}
          <DwellButton style={{ ...s.menuBtn, bottom: "10%", left: "50%", transform: "translateX(-50%)" }}
            onClick={e => { e.stopPropagation(); backspace(); setShowMenu(false); }}>
            ⌫ Back
          </DwellButton>
        </div>
      )}

      <DwellButton style={s.sideBtn} onClick={() => setShowMenu(true)}
        hoverBg="rgba(255,255,255,0.1)">
        ···
      </DwellButton>

      <div style={s.main}>

        {/* sentence */}
        <div style={s.sentencePanel}>
          <p style={s.sentenceText}>{words.join(" ")}</p>
        </div>

        {/* drum */}
        <div style={s.drumPanel}>
          <DwellButton style={s.arrowBtn} onClick={scrollUp}>
            ↑
          </DwellButton>

          <div style={s.drumWords}>
            {[-2, -1, 0, 1, 2].map(slot => {
              const word = slotWords[slot] ?? "";
              const ds   = SLOT_STYLE[String(slot)];
              return (
                <div key={slot} style={{
                  ...s.drumWord,
                  fontSize:   ds.fontSize,
                  opacity:    word ? ds.opacity : 0,
                  fontWeight: ds.fontWeight,
                }}>
                  {word}
                </div>
              );
            })}
          </div>

          <DwellButton style={s.arrowBtn} onClick={scrollDown}>
            ↓
          </DwellButton>
        </div>
      </div>

      <DwellButton style={s.sideBtn} onClick={confirmWord}
        hoverBg="rgba(255,255,255,0.1)">
        OK
      </DwellButton>
    </div>
  );
}

const s = {
  page: {
    position:   "relative",
    width:      "100vw",
    height:     "100vh",
    background: "#111111",
    display:    "flex",
    alignItems: "center",
    overflow:   "hidden",
  },

  // ── starters ──
  starterTop: {
    position:       "absolute",
    top:            "28px",
    left:           0,
    right:          0,
    display:        "flex",
    justifyContent: "space-between",
    padding:        "0 32px",
  },
  starterBody: {
    width:          "100%",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    gap:            "32px",
    paddingTop:     "80px",
  },
  starterHint: {
    margin:        0,
    fontSize:      "14px",
    color:         "rgba(255,255,255,0.25)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  starterGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap:                 "14px",
    width:               "min(900px, 90vw)",
  },
  starterBtn: {
    padding:      "22px 16px",
    borderRadius: "14px",
    background:   "rgba(255,255,255,0.03)",
    border:       "1px solid rgba(255,255,255,0.08)",
    color:        "rgba(255,255,255,0.85)",
    fontSize:     "20px",
    fontWeight:   "300",
    cursor:       "pointer",
    transition:   "background 0.15s",
    letterSpacing:"-0.2px",
  },
  keyboardBtn: {
    padding:      "28px 16px",
    borderRadius: "14px",
    background:   "rgba(255,255,255,0.03)",
    border:       "1px solid rgba(255,255,255,0.08)",
    color:        "rgba(255,255,255,0.85)",
    fontSize:     "24px",
    fontWeight:   "400",
    cursor:       "pointer",
    transition:   "background 0.15s",
    letterSpacing:"-0.2px",
    width:        "calc(50% + 7px)",
    margin:       "24px auto 0",
  },

  // ── drum page ──
  pill: {
    padding:      "8px 18px",
    borderRadius: "20px",
    background:   "transparent",
    border:       "1px solid rgba(255,255,255,0.1)",
    color:        "rgba(255,255,255,0.35)",
    fontSize:     "28px",
    cursor:       "pointer",
  },
  sideBtn: {
    flexShrink:     0,
    width:          "74px",
    height:         "74px",
    borderRadius:   "50%",
    background:     "rgba(255,255,255,0.05)",
    border:         "1.5px solid rgba(255,255,255,0.15)",
    color:          "rgba(255,255,255,0.7)",
    fontSize:       "14px",
    fontWeight:     500,
    cursor:         "pointer",
    margin:         "0 24px",
    transition:     "background 0.15s",
  },
  main: {
    flex:       1,
    display:    "flex",
    alignItems: "center",
    height:     "100%",
  },
  sentencePanel: {
    flex:           "0 0 28%",
    display:        "flex",
    flexDirection:  "column",
    justifyContent: "center",
    paddingLeft:    "16px",
    paddingRight:   "24px",
    height:         "100%",
  },
  sentenceText: {
    fontSize:      "58px",
    fontWeight:    "300",
    color:         "#ffffff",
    margin:        0,
    letterSpacing: "-0.5px",
    lineHeight:    "1.2",
    wordBreak:     "break-word",
  },
  ctrlActive: {
    borderColor: "rgba(255,255,255,0.35)",
    color:       "rgba(255,255,255,0.7)",
  },
  overlay: {
    position:   "fixed",
    inset:      0,
    background: "rgba(0,0,0,0.82)",
    zIndex:     100,
  },
  menuBtn: {
    position:     "absolute",
    padding:      "28px 48px",
    borderRadius: "20px",
    background:   "rgba(255,255,255,0.06)",
    border:       "1.5px solid rgba(255,255,255,0.18)",
    color:        "#ffffff",
    fontSize:     "32px",
    fontWeight:   "300",
    cursor:       "pointer",
    letterSpacing:"-0.3px",
    transition:   "background 0.15s",
  },
  drumPanel: {
    flex:           "1",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "32px",
  },
  arrowBtn: {
    width:          "50px",
    height:         "50px",
    borderRadius:   "50%",
    background:     "transparent",
    border:         "1.5px solid rgba(255,255,255,0.15)",
    color:          "rgba(255,255,255,0.45)",
    fontSize:       "17px",
    cursor:         "pointer",
    transition:     "border-color 0.15s",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
  drumWords: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "8px",
    flex:           1,
  },
  drumWord: {
    color:         "#ffffff",
    textAlign:     "center",
    lineHeight:    "1.15",
    letterSpacing: "-0.5px",
    transition:    "opacity 0.16s ease, font-size 0.16s ease",
    userSelect:    "none",
    whiteSpace:    "nowrap",
    minHeight:     "1em",
  },
};
