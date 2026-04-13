import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../api";
import { useInputControl } from "./InputControlContext";
import { GazeIndicator } from "../components/EyeTrackingDebug";

const ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Z","X","C","V","B","N","M"],
];

const getBottomRow = (mode) => (
  (mode === "eyes" || mode === "cnn")
    ? ["DELETE", "SPACE", "DONE", "TOGGLE_REPEAT"]
    : ["DELETE", "SPACE", "DONE"]
);

export default function Keyboard() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const {
    mode, enabled, register, unregister,
    eyeReady, eyeCentered, eyeTracking,
    eyeDebug,
    eyeHoldRepeatEnabled, setEyeHoldRepeatEnabled,
    cnnReady, gazeLabel, cnnDebug,
  } = useInputControl();

  const incomingWords = location.state?.words ?? [];
  const returnTo      = location.state?.returnTo ?? "/communicate";
  const extraState    = location.state?.history ? { history: location.state.history } : {};

  const [text, setText] = useState(() => (
    incomingWords.length ? `${incomingWords.join(" ")} ` : ""
  ));
  const [selRow, setSelRow] = useState(0);
  const [selCol, setSelCol] = useState(0);
  const [hoveredKey, setHoveredKey] = useState(null);
  const modeRef = useRef(mode);
  const eyeHoldRepeatEnabledRef = useRef(eyeHoldRepeatEnabled);
  const selRowRef = useRef(0);
  const selColRef = useRef(0);

  const NAV_ROWS = [
    ROWS[0],
    ROWS[1],
    ROWS[2],
    getBottomRow(mode),
  ];

  const currentTextWords = () => text.trim().split(/\s+/).filter(Boolean);

  const setSelection = (r, c) => {
    selRowRef.current = r;
    selColRef.current = c;
    setSelRow(r);
    setSelCol(c);
  };

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    eyeHoldRepeatEnabledRef.current = eyeHoldRepeatEnabled;
  }, [eyeHoldRepeatEnabled]);

  async function persistAndReturn() {
    const allWords = currentTextWords();
    const prev = incomingWords.map(w => String(w).trim().toLowerCase()).filter(Boolean).join(" ");
    const next = allWords.map(w => String(w).trim().toLowerCase()).filter(Boolean).join(" ");
    const changed = prev !== next;

    if (changed && allWords.length > 0) {
      try {
        await apiPost("/vocab/sentence", { words: allWords });
      } catch (e) {
        console.error(e);
      }
    }

    navigate(returnTo, { state: { words: allWords, ...extraState } });
  }

  function pressKey(key) {
    if (key === "DELETE") setText(t => t.slice(0, -1));
    else setText(t => t + key.toLowerCase());
  }

  function activateSelectedKey(navRows) {
    const key = navRows[selRowRef.current]?.[selColRef.current];
    if (!key) return;
    if (key === "DELETE") { setText(t => t.slice(0, -1)); return; }
    if (key === "SPACE") { setText(t => t + " "); return; }
    if (key === "TOGGLE_REPEAT") {
      setEyeHoldRepeatEnabled(!eyeHoldRepeatEnabledRef.current);
      return;
    }
    if (key === "DONE")  { void persistAndReturn(); return; }
    pressKey(key);
  }

  useEffect(() => {
    const lastRowLen = NAV_ROWS[3].length;
    if (selRowRef.current === 3 && selColRef.current > lastRowLen - 1) {
      setSelection(3, lastRowLen - 1);
    }
  }, [mode]);

  useEffect(() => {
    register((cmd) => {
      const navRows = [
        ROWS[0],
        ROWS[1],
        ROWS[2],
        getBottomRow(modeRef.current),
      ];
      const row = selRowRef.current;
      const col = selColRef.current;
      const rowCount = navRows.length;
      const rowLen = navRows[row]?.length || 1;

      if (cmd === "BACK") {
        void persistAndReturn();
        return;
      }

      if (modeRef.current === "head") {
        if (cmd === "LEFT")  setSelection(row, (col - 1 + rowLen) % rowLen);
        if (cmd === "RIGHT") setSelection(row, (col + 1) % rowLen);
        if (cmd === "FORWARD") activateSelectedKey(navRows);
        return;
      }

      if (cmd === "UP") {
        const nextRow = (row - 1 + rowCount) % rowCount;
        const nextLen = navRows[nextRow].length;
        setSelection(nextRow, Math.min(col, nextLen - 1));
      }
      if (cmd === "DOWN") {
        const nextRow = (row + 1) % rowCount;
        const nextLen = navRows[nextRow].length;
        setSelection(nextRow, Math.min(col, nextLen - 1));
      }
      if (cmd === "LEFT") {
        const curLen = navRows[row].length;
        setSelection(row, (col - 1 + curLen) % curLen);
      }
      if (cmd === "RIGHT") {
        const curLen = navRows[row].length;
        setSelection(row, (col + 1) % curLen);
      }
      if (cmd === "FORWARD") {
        activateSelectedKey(navRows);
      }
    });
    return () => unregister();
  }, [register, unregister]);

  function done() {
    void persistAndReturn();
  }

  function appendPastedText(raw) {
    const normalized = String(raw || "")
      .replace(/\r\n|\r|\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (!normalized) return;

    setText(t => {
      if (!t) return normalized;
      const needsSpace = !t.endsWith(" ");
      return `${t}${needsSpace ? " " : ""}${normalized}`;
    });
  }

  const eyeStateLabel = () => {
    if (!enabled) return "";
    if (mode === "eyes") {
      if (!eyeReady) return "Eyes · init…";
      if (!eyeCentered) return "Eyes · centering…";
      return eyeTracking ? "Eyes · tracking" : "Eyes · no face";
    }
    if (mode === "cnn") {
      return cnnReady ? `CNN · ${gazeLabel}` : "CNN · connecting…";
    }
    if (mode === "head") return "Head · active";
    return "";
  };

  const indicatorDebug = mode === "eyes" ? eyeDebug : (mode === "cnn" ? cnnDebug : null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        setText(t => t.slice(0, -1));
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
        setText(t => t + " ");
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        done();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        void persistAndReturn();
        return;
      }

      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        setText(t => t + e.key.toLowerCase());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [done, persistAndReturn]);

  useEffect(() => {
    const onPaste = (e) => {
      const pasted = e.clipboardData?.getData("text");
      if (!pasted) return;
      e.preventDefault();
      appendPastedText(pasted);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <button style={s.pill}
          onClick={() => void persistAndReturn()}>
          ← Back
        </button>
        <div style={s.titleCluster}>
          {enabled && indicatorDebug && (
            <div style={s.compactIndicatorWrap}>
              <GazeIndicator debug={indicatorDebug}/>
            </div>
          )}
          <span style={s.label}>Keyboard</span>
        </div>
      </div>

      <div style={s.display}>
        <span style={text ? s.displayText : s.placeholder}>
          {text || "Start typing…"}
        </span>
      </div>

      <div style={s.keysArea}>
        {enabled && (
          <div style={s.statusOverlayRow}>
            <div style={s.headHint}>
              {mode === "head"
                ? <>Head control active - tilt <strong>BACK</strong> to return</>
                : <>Eye control active - look <strong>LEFT</strong> to return</>}
            </div>
            <p style={s.stateIndicator}>{eyeStateLabel()}</p>
          </div>
        )}

        {ROWS.map((row, ri) => (
          <div key={ri} style={{ ...s.row, ...s.letterRow }}>
            {row.map((key, ci) => {
              const keyId = `key-${ri}-${ci}`;
              const isSelected = enabled && selRow === ri && selCol === ci;
              const isHovered = !enabled && hoveredKey === keyId;
              return (
                <button key={`${ri}-${ci}-${key}`}
                  style={{ ...s.key, ...s.letterKey, ...((isSelected || isHovered) ? s.selectedKey : s.unselectedKey) }}
                  onMouseEnter={() => setHoveredKey(keyId)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={() => { setSelection(ri, ci); pressKey(key); }}>
                  {key.toLowerCase()}
                </button>
              );
            })}
          </div>
        ))}

        <div style={{ ...s.row, ...s.actionRow }}>
          <button
            style={{
              ...s.key,
              ...s.bsKey,
              flex: 0.7,
              ...((enabled && selRow === 3 && selCol === 0) || (!enabled && hoveredKey === "delete")
                ? s.selectedKey
                : s.unselectedBackspaceKey),
            }}
            onMouseEnter={() => setHoveredKey("delete")}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => { setSelection(3, 0); setText(t => t.slice(0, -1)); }}>
            ⌫
          </button>
          <button style={{ ...s.key, flex: 1, ...((enabled && selRow === 3 && selCol === 1) || (!enabled && hoveredKey === "space") ? s.selectedKey : s.unselectedKey) }}
            onMouseEnter={() => setHoveredKey("space")}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => { setSelection(3, 1); setText(t => t + " "); }}>
            Space
          </button>
          <button
            style={{
              ...s.key,
              ...s.doneKey,
              flex: 0.7,
              ...((enabled && selRow === 3 && selCol === 2) || (!enabled && hoveredKey === "done")
                ? s.selectedKey
                : s.unselectedDoneKey),
            }}
            onMouseEnter={() => setHoveredKey("done")}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => {
              setSelection(3, 2);
              done();
            }}
          >
            Done
          </button>
          {(mode === "eyes" || mode === "cnn") && (
            <button style={{
              ...s.key,
              ...(eyeHoldRepeatEnabled ? s.toggleKeyOn : s.toggleKeyOff),
              flex: 1.2,
              ...((enabled && selRow === 3 && selCol === 3) || (!enabled && hoveredKey === "repeat")
                ? s.selectedKey
                : (eyeHoldRepeatEnabled ? s.unselectedToggleOnKey : s.unselectedToggleOffKey)),
            }}
              onMouseEnter={() => setHoveredKey("repeat")}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => { setSelection(3, 3); setEyeHoldRepeatEnabled(!eyeHoldRepeatEnabled); }}>
              {eyeHoldRepeatEnabled ? "Repeat: ON" : "Repeat: OFF"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    width: "100vw", height: "100vh", background: "#111111",
    display: "flex", flexDirection: "column", padding: "16px", gap: "14px",
  },
  topBar: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    minHeight: "34px",
    marginTop: "10px",
  },
  titleCluster: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  compactIndicatorWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 178,
    maxWidth: 178,
  },
  pill: {
    position: "absolute",
    top: "50%",
    left: 0,
    transform: "translateY(-50%)",
    padding: "8px 18px", borderRadius: "20px", background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)",
    fontSize: "13px", cursor: "pointer",
    zIndex: 2,
  },
  label: {
    fontSize: "14px", color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.1em", textTransform: "uppercase",
  },
  headHint: {
    textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.25)",
    letterSpacing: "0.04em", padding: "6px 0",
    whiteSpace: "nowrap",
  },
  stateIndicator: {
    margin: 0,
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  display: {
    marginTop: "10px",
    minHeight: "64px", padding: "14px 20px", borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center",
  },
  displayText: { fontSize: "26px", fontWeight: "300", color: "#ffffff" },
  placeholder: { fontSize: "20px", color: "rgba(255,255,255,0.2)" },
  keysArea: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    width: "90%",
    alignSelf: "center",
    marginTop: "75px",
    marginBottom: "8px",
    justifyContent: "space-between",
    position: "relative",
  },
  statusOverlayRow: {
    position: "absolute",
    top: "-48px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "96%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 3,
    pointerEvents: "none",
  },
  row: { display: "flex", gap: "5px" },
  actionRow: {
    width: "96%",
    alignSelf: "center",
  },
  letterRow: {
    width: "100%",
    alignSelf: "center",
  },
  key: {
    flex: 1, padding: "0", height: "68px", borderRadius: "10px",
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.75)", fontSize: "17px", cursor: "pointer", transition: "background 0.1s",
  },
  unselectedKey: {
    borderColor: "rgba(255,255,255,0.1)",
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    fontWeight: "400",
    boxShadow: "none",
    transform: "none",
  },
  letterKey: {
    height: "75px",
  },
  bsKey: { background: "transparent", color: "rgba(255,255,255,0.75)" },
  unselectedBackspaceKey: {
    borderColor: "rgba(255,255,255,0.1)",
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    fontWeight: "400",
    boxShadow: "none",
    transform: "none",
  },
  doneKey: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)",
    fontWeight: "600", transition: "background 0.1s",
  },
  unselectedDoneKey: {
    borderColor: "rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
    boxShadow: "none",
    transform: "none",
  },
  toggleKeyOn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.5)",
    fontWeight: "700",
    transition: "background 0.15s ease",
  },
  unselectedToggleOnKey: {
    borderColor: "rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.5)",
    fontWeight: "700",
    boxShadow: "none",
    transform: "none",
  },
  toggleKeyOff: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
    transition: "background 0.15s ease",
  },
  unselectedToggleOffKey: {
    borderColor: "rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
    boxShadow: "none",
    transform: "none",
  },
  selectedKey: {
    borderColor: "rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.14)",
    color: "rgba(255,255,255,0.98)",
    fontWeight: "600",
  },
};
