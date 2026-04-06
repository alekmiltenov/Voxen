import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, createSuggestSocket } from "../api";
import { useInputControl } from "./InputControlContext";
import DwellButton from "../components/DwellButton";

const DEFAULT_STARTERS = [
  "I", "I need", "I want", "I feel",
  "Help", "Can you", "Yes", "No",
  "Please", "Thank you", "I am", "I would like",
];

/**
 * New Communicate page with unified grid navigation.
 * All input modes (HEAD, EYES, CNN) can navigate the same way:
 *   - UP/DOWN: Move between rows (menu, suggestions)
 *   - LEFT/RIGHT: Move within current row
 *   - SELECT (FORWARD/CLOSED dwell): Activate
 *   - BACK: Exit or backspace
 */
export default function Communicate() {
  const navigate = useNavigate();
  const { mode, enabled, register, unregister } = useInputControl();

  // ── Composition state ──
  const [words, setWords] = useState([]);
  const [starters, setStarters] = useState(DEFAULT_STARTERS);
  const [suggestions, setSuggestions] = useState([]);
  const [speaking, setSpeaking] = useState(false);

  // ── Navigation state ──
  const [curRow, setCurRow] = useState(0);    // 0 = menu row, 1 = starters or suggestions
  const [curCol, setCurCol] = useState(0);    // column within row
  const wsRef = useRef(null);
  const selRef = useRef({ row: 0, col: 0 });

  // ── Menu items ──
  const menuItems = [
    { id: "back", label: "← Back", action: () => navigate("/") },
    { id: "keyboard", label: "⌨ Keyboard", action: () => navigate("/keyboard", { state: { words, returnTo: "/communicate" } }) },
    { id: "speak", label: "🔊 Speak", action: () => speak() },
    { id: "clear", label: "✕ Clear", action: () => clear() },
  ];

  const contentItems = words.length === 0 ? starters : suggestions;

  // ── Load personalized starters ──
  useEffect(() => {
    apiGet("/vocab/starters?limit=12")
      .then(d => {
        const list = d.starters.map(s => s.word).filter(Boolean);
        if (list.length >= 4) setStarters(list);
      })
      .catch(() => {});
  }, []);

  // ── WebSocket for suggestions ──
  useEffect(() => {
    const ws = createSuggestSocket();
    wsRef.current = ws;
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.suggestions) {
        setSuggestions(d.suggestions.map(s => s.word ?? s));
        setCurCol(0);  // Reset column when suggestions change
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (words.length === 0) {
      setSuggestions([]);
      return;
    }
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: words.join(" "), words, top_k: 8 }));
    }
  }, [words]);

  // ── Actions ──
  function selectWord(word) {
    setWords(w => [...w, word]);
    setCurCol(0);
  }

  function backspace() {
    setWords(w => w.slice(0, -1));
  }

  function speak() {
    const w = words;
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
    setSpeaking(false);
    setCurCol(0);
  }

  // ── Helper: wrap index ──
  const wrap = (i, n) => (i % n + n) % n;

  // ── Unified input handler ──
  useEffect(() => {
    register((cmd) => {
      // Map input commands to navigation
      if (cmd === "NAVIGATE_UP" || cmd === "UP") {
        setCurRow(r => wrap(r - 1, 2));
        setCurCol(0);
      } else if (cmd === "NAVIGATE_DOWN" || cmd === "DOWN") {
        setCurRow(r => wrap(r + 1, 2));
        setCurCol(0);
      } else if (cmd === "NAVIGATE_LEFT" || cmd === "LEFT") {
        const itemCount = curRow === 0 ? menuItems.length : contentItems.length;
        setCurCol(c => wrap(c - 1, itemCount));
      } else if (cmd === "NAVIGATE_RIGHT" || cmd === "RIGHT") {
        const itemCount = curRow === 0 ? menuItems.length : contentItems.length;
        setCurCol(c => wrap(c + 1, itemCount));
      } else if (cmd === "SELECT" || cmd === "FORWARD") {
        // Activate current selection
        if (curRow === 0) {
          // Menu row
          menuItems[curCol].action();
        } else {
          // Content row
          selectWord(contentItems[curCol]);
        }
      } else if (cmd === "BACK") {
        if (words.length > 0) {
          backspace();
        } else {
          navigate("/");
        }
      }
    });
    return () => unregister();
  }, [mode, curRow, curCol, words, menuItems, contentItems]);

  // ── Render ──
  return (
    <div style={s.page}>
      {/* ── Top bar: Menu items ── */}
      <div style={s.menuRow}>
        {menuItems.map((item, idx) => {
          const isSelected = curRow === 0 && curCol === idx;
          return (
            <DwellButton
              key={item.id}
              style={{
                ...s.menuItem,
                ...(isSelected ? s.selectedItem : {}),
              }}
              onClick={item.action}
              title={item.label}
            >
              {item.label}
            </DwellButton>
          );
        })}
      </div>

      {/* ── Composed text display ── */}
      <div style={s.composeDisplay}>
        <p style={s.composeText}>
          {words.length > 0 ? words.join(" ") : "Tap menu or select words below"}
        </p>
      </div>

      {/* ── Content row: Starters or suggestions ── */}
      <div style={s.contentRow}>
        {contentItems.length === 0 ? (
          <div style={s.emptyState}>
            {words.length === 0 ? "Loading starters…" : "No suggestions"}
          </div>
        ) : (
          contentItems.map((word, idx) => {
            const isSelected = curRow === 1 && curCol === idx;
            return (
              <DwellButton
                key={`${word}-${idx}`}
                style={{
                  ...s.contentItem,
                  ...(isSelected ? s.selectedItem : {}),
                }}
                onClick={() => selectWord(word)}
              >
                {word}
              </DwellButton>
            );
          })
        )}
      </div>

      {/* ── Status indicators ── */}
      {enabled && (
        <div style={s.hints}>
          <span style={s.hint}>
            Row: {curRow === 0 ? "Menu" : "Content"} | Col: {curCol + 1}/{curRow === 0 ? menuItems.length : contentItems.length}
          </span>
          {speaking && <span style={s.hint}>🔊 Speaking…</span>}
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    width: "100vw",
    height: "100vh",
    background: "#111111",
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    gap: "16px",
    fontFamily: "Inter, sans-serif",
  },
  menuRow: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
  },
  menuItem: {
    padding: "10px 16px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.6)",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  selectedItem: {
    background: "rgba(34,197,94,0.2)",
    borderColor: "rgba(34,197,94,0.5)",
    color: "#86efac",
    boxShadow: "0 0 12px rgba(34,197,94,0.3)",
  },
  composeDisplay: {
    padding: "16px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    minHeight: "64px",
    display: "flex",
    alignItems: "center",
  },
  composeText: {
    margin: 0,
    fontSize: "22px",
    color: "#ffffff",
    fontWeight: "400",
  },
  contentRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    flex: 1,
    overflowY: "auto",
    alignContent: "flex-start",
    padding: "8px 0",
  },
  contentItem: {
    padding: "10px 14px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)",
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
  },
  emptyState: {
    width: "100%",
    textAlign: "center",
    color: "rgba(255,255,255,0.3)",
    padding: "40px 0",
    fontSize: "16px",
  },
  hints: {
    display: "flex",
    gap: "16px",
    justifyContent: "center",
    fontSize: "12px",
    color: "rgba(255,255,255,0.4)",
    padding: "8px 0",
  },
  hint: {
    padding: "4px 12px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "4px",
  },
};
