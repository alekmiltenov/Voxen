import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiGet, apiPost, createSuggestSocket } from "../api";
import DwellButton from "../components/DwellButton";

const DEFAULT_STARTERS = [
  "I need", "I feel", "I want", "Can you",
  "Help me", "What is", "How do I", "Please",
  "Tell me", "I am", "Why is", "Thank you",
];

export default function AIChat() {
  const navigate = useNavigate();
  const location = useLocation();

  const [words,       setWords]       = useState(location.state?.words   ?? []);
  const [starters,    setStarters]    = useState(DEFAULT_STARTERS);
  const [suggestions, setSuggestions] = useState([]);
  const [history,     setHistory]     = useState(location.state?.history ?? []);
  const [loading,     setLoading]     = useState(false);
  const wsRef      = useRef(null);
  const historyRef = useRef(null);

  const mode = words.length === 0 ? "starters" : "compose";

  useEffect(() => {
    apiGet("/vocab/starters?limit=12")
      .then(d => {
        const list = d.starters.map(s => s.word).filter(Boolean);
        if (list.length >= 4) setStarters(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const ws = createSuggestSocket();
    wsRef.current = ws;
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.suggestions) setSuggestions(d.suggestions.map(s => s.word ?? s));
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (words.length === 0) { setSuggestions([]); return; }
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ text: words.join(" "), words, top_k: 8 }));
  }, [words]);

  useEffect(() => {
    if (historyRef.current)
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [history]);

  async function sendMessage() {
    if (!words.length || loading) return;
    const message = words.join(" ");
    setHistory(h => [...h, { role: "user", text: message }]);
    setWords([]);
    setSuggestions([]);
    setLoading(true);
    try {
      const res = await apiPost("/ai/chat", { message });
      setHistory(h => [...h, { role: "ai", text: res.reply }]);
    } catch (e) {
      setHistory(h => [...h, { role: "ai", text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  // ── STARTERS ──────────────────────────────────────────────────────────────
  if (mode === "starters") {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <DwellButton style={s.pill} onClick={() => navigate("/actions")}>← Back</DwellButton>
          <span style={s.label}>AI Chat</span>
          <DwellButton style={s.pill}
            onClick={() => navigate("/keyboard", { state: { words: [], returnTo: "/ai-chat", history } })}>
            keyboard
          </DwellButton>
        </div>

        {history.length > 0 && (
          <div style={s.historyStrip} ref={historyRef}>
            {history.map((m, i) => (
              <div key={i} style={m.role === "user" ? s.userBubble : s.aiBubble}>{m.text}</div>
            ))}
            {loading && <div style={s.aiBubble}>…</div>}
          </div>
        )}

        <div style={s.starterGrid}>
          {starters.map(phrase => (
            <DwellButton key={phrase} style={s.starterBtn}
              hoverBg="rgba(255,255,255,0.08)"
              onClick={() => setWords(phrase.trim().split(/\s+/))}>
              {phrase}
            </DwellButton>
          ))}
        </div>
      </div>
    );
  }

  // ── COMPOSE ───────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <DwellButton style={s.pill} onClick={() => setWords([])}>← Back</DwellButton>
        <span style={s.label}>AI Chat</span>
        <DwellButton style={s.pill}
          onClick={() => navigate("/keyboard", { state: { words, returnTo: "/ai-chat", history } })}>
          keyboard
        </DwellButton>
      </div>

      {/* conversation */}
      {history.length > 0 && (
        <div style={s.historyStrip} ref={historyRef}>
          {history.map((m, i) => (
            <div key={i} style={m.role === "user" ? s.userBubble : s.aiBubble}>{m.text}</div>
          ))}
          {loading && <div style={s.aiBubble}>…</div>}
        </div>
      )}

      {/* composing message */}
      <div style={s.composeRow}>
        <p style={s.composeText}>{words.join(" ")}</p>
        <DwellButton style={s.eraseBtn} onClick={() => setWords(w => w.slice(0, -1))}>⌫</DwellButton>
        <DwellButton
          style={{ ...s.sendBtn, ...(loading ? s.sendDisabled : {}) }}
          onClick={sendMessage}
          disabled={loading || !words.length}>
          {loading ? "…" : "Send"}
        </DwellButton>
      </div>

      {/* tap-to-add suggestions */}
      <div style={s.sugGrid}>
        {suggestions.map(word => (
          <DwellButton key={word} style={s.sugBtn}
            hoverBg="rgba(255,255,255,0.08)"
            onClick={() => setWords(w => [...w, word])}>
            {word}
          </DwellButton>
        ))}
      </div>
    </div>
  );
}

const s = {
  page: {
    width:         "100vw",
    height:        "100vh",
    background:    "#111111",
    display:       "flex",
    flexDirection: "column",
    padding:       "20px 28px",
    gap:           "16px",
    overflow:      "hidden",
  },
  topBar: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    flexShrink:     0,
  },
  pill: {
    padding:      "8px 18px",
    borderRadius: "20px",
    background:   "transparent",
    border:       "1px solid rgba(255,255,255,0.1)",
    color:        "rgba(255,255,255,0.35)",
    fontSize:     "13px",
    cursor:       "pointer",
  },
  label: {
    fontSize:      "13px",
    color:         "rgba(255,255,255,0.25)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  historyStrip: {
    flex:          1,
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    gap:           "8px",
  },
  userBubble: {
    alignSelf:    "flex-end",
    maxWidth:     "75%",
    padding:      "10px 16px",
    borderRadius: "16px 16px 4px 16px",
    background:   "rgba(255,255,255,0.08)",
    border:       "1px solid rgba(255,255,255,0.1)",
    color:        "rgba(255,255,255,0.9)",
    fontSize:     "16px",
    fontWeight:   "300",
    lineHeight:   "1.4",
  },
  aiBubble: {
    alignSelf:    "flex-start",
    maxWidth:     "85%",
    padding:      "10px 16px",
    borderRadius: "16px 16px 16px 4px",
    background:   "rgba(255,255,255,0.03)",
    border:       "1px solid rgba(255,255,255,0.06)",
    color:        "rgba(255,255,255,0.7)",
    fontSize:     "16px",
    fontWeight:   "300",
    lineHeight:   "1.4",
  },
  starterGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap:                 "12px",
    flex:                1,
  },
  starterBtn: {
    borderRadius: "14px",
    background:   "rgba(255,255,255,0.03)",
    border:       "1px solid rgba(255,255,255,0.08)",
    color:        "rgba(255,255,255,0.85)",
    fontSize:     "20px",
    fontWeight:   "300",
    cursor:       "pointer",
    transition:   "background 0.15s",
  },
  composeRow: {
    display:     "flex",
    alignItems:  "center",
    gap:         "12px",
    flexShrink:  0,
    borderTop:   "1px solid rgba(255,255,255,0.06)",
    paddingTop:  "16px",
  },
  composeText: {
    flex:          1,
    fontSize:      "36px",
    fontWeight:    "300",
    color:         "#ffffff",
    margin:        0,
    letterSpacing: "-0.3px",
    lineHeight:    "1.2",
    wordBreak:     "break-word",
    minHeight:     "1.2em",
  },
  eraseBtn: {
    flexShrink:   0,
    width:        "52px",
    height:       "52px",
    borderRadius: "50%",
    background:   "rgba(255,255,255,0.05)",
    border:       "1px solid rgba(255,255,255,0.12)",
    color:        "rgba(255,255,255,0.5)",
    fontSize:     "18px",
    cursor:       "pointer",
  },
  sendBtn: {
    flexShrink:   0,
    padding:      "14px 32px",
    borderRadius: "14px",
    background:   "rgba(255,255,255,0.9)",
    border:       "none",
    color:        "#111111",
    fontSize:     "18px",
    fontWeight:   "600",
    cursor:       "pointer",
  },
  sendDisabled: {
    background: "rgba(255,255,255,0.2)",
    color:      "rgba(255,255,255,0.4)",
    cursor:     "default",
  },
  sugGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap:                 "10px",
    flexShrink:          0,
  },
  sugBtn: {
    padding:      "16px 8px",
    borderRadius: "12px",
    background:   "rgba(255,255,255,0.03)",
    border:       "1px solid rgba(255,255,255,0.08)",
    color:        "rgba(255,255,255,0.8)",
    fontSize:     "18px",
    fontWeight:   "300",
    cursor:       "pointer",
    transition:   "background 0.15s",
  },
};
