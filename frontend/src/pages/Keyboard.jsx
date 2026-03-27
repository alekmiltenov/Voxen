import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../api";

const ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Z","X","C","V","B","N","M","⌫"],
];

export default function Keyboard() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const incomingWords = location.state?.words    ?? [];
  const returnTo      = location.state?.returnTo ?? "/communicate";
  const extraState    = location.state?.history !== undefined ? { history: location.state.history } : {};
  const [text, setText] = useState(incomingWords.join(" "));

  function pressKey(key) {
    if (key === "⌫") setText(t => t.slice(0, -1));
    else setText(t => t + key.toLowerCase());
  }

  function done() {
    const allWords = text.trim().split(/\s+/).filter(Boolean);
    const newWords = allWords.slice(incomingWords.length);
    if (newWords.length > 0) {
      apiPost("/vocab/sentence", { words: allWords }).catch(console.error);
    }
    navigate(returnTo, { state: { words: allWords, ...extraState } });
  }

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <button style={s.pill}
          onClick={() => navigate(returnTo, { state: { words: incomingWords, ...extraState } })}>
          ← Back
        </button>
        <span style={s.label}>Keyboard</span>
        <div style={{ width: 80 }} />
      </div>

      <div style={s.display}>
        <span style={text ? s.displayText : s.placeholder}>
          {text || "Start typing…"}
        </span>
      </div>

      <div style={s.keysArea}>
        {ROWS.map((row, ri) => (
          <div key={ri} style={s.row}>
            {row.map(key => (
              <button
                key={key}
                style={key === "⌫" ? { ...s.key, ...s.bsKey } : s.key}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = key === "⌫"
                  ? "rgba(255,255,255,0.05)" : "transparent"}
                onClick={() => pressKey(key)}>
                {key === "⌫" ? "⌫" : key.toLowerCase()}
              </button>
            ))}
          </div>
        ))}

        <div style={s.row}>
          <button style={{ ...s.key, flex: 3 }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            onClick={() => setText(t => t + " ")}>
            space
          </button>
          <button style={{ ...s.key, ...s.doneKey, flex: 2 }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.92)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.85)"}
            onClick={done}>
            Done ↩
          </button>
        </div>
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
    padding:       "16px",
    gap:           "14px",
  },
  topBar: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  pill: {
    padding:      "8px 18px",
    borderRadius: "20px",
    background:   "transparent",
    border:       "1px solid rgba(255,255,255,0.12)",
    color:        "rgba(255,255,255,0.4)",
    fontSize:     "14px",
    cursor:       "pointer",
    width:        80,
  },
  label: {
    fontSize:      "14px",
    color:         "rgba(255,255,255,0.25)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  display: {
    minHeight:    "64px",
    padding:      "14px 20px",
    borderRadius: "14px",
    border:       "1px solid rgba(255,255,255,0.08)",
    display:      "flex",
    alignItems:   "center",
  },
  displayText: {
    fontSize:   "26px",
    fontWeight: "300",
    color:      "#ffffff",
  },
  placeholder: {
    fontSize: "20px",
    color:    "rgba(255,255,255,0.2)",
  },
  keysArea: {
    display:       "flex",
    flexDirection: "column",
    gap:           "6px",
    flex:          1,
  },
  row: {
    display: "flex",
    gap:     "5px",
  },
  key: {
    flex:          1,
    padding:       "0",
    height:        "52px",
    borderRadius:  "10px",
    background:    "transparent",
    border:        "1px solid rgba(255,255,255,0.1)",
    color:         "rgba(255,255,255,0.75)",
    fontSize:      "17px",
    cursor:        "pointer",
    transition:    "background 0.1s",
  },
  bsKey: {
    background: "rgba(255,255,255,0.05)",
    color:      "rgba(255,255,255,0.5)",
  },
  doneKey: {
    background: "rgba(255,255,255,0.85)",
    border:     "none",
    color:      "#111111",
    fontWeight: "600",
    transition: "background 0.1s",
  },
};
