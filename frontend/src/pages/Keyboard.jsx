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

const SCAN_MIN_MS = 300;
const SCAN_MAX_MS = 1500;
const SCAN_STEP_MS = 100;
const SCAN_EYES_SELECTION_METHOD = "down";
const SCAN_EYES_DWELL_MS = 650;

const getInitialScanEnabled = () => {
  try {
    return localStorage.getItem("keyboardAutoScanEnabled") === "1";
  } catch {
    return false;
  }
};

const getInitialScanMs = () => {
  try {
    const saved = parseInt(localStorage.getItem("keyboardAutoScanMs") || "", 10);
    if (Number.isFinite(saved)) {
      return Math.max(SCAN_MIN_MS, Math.min(SCAN_MAX_MS, saved));
    }
    return 800;
  } catch {
    return 800;
  }
};

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
  const [scanEnabled, setScanEnabled] = useState(getInitialScanEnabled);
  const [scanMs, setScanMs] = useState(getInitialScanMs);
  const [scanPhase, setScanPhase] = useState("row"); // row | item
  const [scanRow, setScanRow] = useState(0);
  const [scanCol, setScanCol] = useState(0);
  const [scanPulse, setScanPulse] = useState(false);
  const modeRef = useRef(mode);
  const eyeHoldRepeatEnabledRef = useRef(eyeHoldRepeatEnabled);
  const selRowRef = useRef(0);
  const selColRef = useRef(0);
  const scanEnabledRef = useRef(scanEnabled);
  const scanPhaseRef = useRef(scanPhase);
  const scanRowRef = useRef(scanRow);
  const scanColRef = useRef(scanCol);
  const scanPulseTimerRef = useRef(null);
  const scanEyesPrevSelectionMethodRef = useRef(null);
  const scanEyesPrevSelectionDwellRef = useRef(null);
  const scanEyesOverrideActiveRef = useRef(false);

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

  useEffect(() => {
    scanEnabledRef.current = scanEnabled;
    try { localStorage.setItem("keyboardAutoScanEnabled", scanEnabled ? "1" : "0"); } catch {}
  }, [scanEnabled]);

  useEffect(() => {
    scanPhaseRef.current = scanPhase;
  }, [scanPhase]);

  useEffect(() => {
    scanRowRef.current = scanRow;
  }, [scanRow]);

  useEffect(() => {
    scanColRef.current = scanCol;
  }, [scanCol]);

  useEffect(() => {
    try { localStorage.setItem("keyboardAutoScanMs", String(scanMs)); } catch {}
  }, [scanMs]);

  const restoreScanEyesOverrides = () => {
    if (!scanEyesOverrideActiveRef.current) return;

    try {
      if (scanEyesPrevSelectionMethodRef.current === null) {
        localStorage.removeItem("eyeSelectionMethod");
      } else {
        localStorage.setItem("eyeSelectionMethod", scanEyesPrevSelectionMethodRef.current);
      }

      if (scanEyesPrevSelectionDwellRef.current === null) {
        localStorage.removeItem("eyeSelectionDwell");
      } else {
        localStorage.setItem("eyeSelectionDwell", scanEyesPrevSelectionDwellRef.current);
      }
    } catch {}

    scanEyesOverrideActiveRef.current = false;
    scanEyesPrevSelectionMethodRef.current = null;
    scanEyesPrevSelectionDwellRef.current = null;
  };

  useEffect(() => {
    const shouldApplyScanEyesOverrides = enabled && scanEnabled && mode === "eyes";

    if (!shouldApplyScanEyesOverrides) {
      restoreScanEyesOverrides();
      return;
    }

    try {
      if (!scanEyesOverrideActiveRef.current) {
        scanEyesPrevSelectionMethodRef.current = localStorage.getItem("eyeSelectionMethod");
        scanEyesPrevSelectionDwellRef.current = localStorage.getItem("eyeSelectionDwell");
        scanEyesOverrideActiveRef.current = true;
      }

      localStorage.setItem("eyeSelectionMethod", SCAN_EYES_SELECTION_METHOD);
      localStorage.setItem("eyeSelectionDwell", String(SCAN_EYES_DWELL_MS));
    } catch {}
  }, [enabled, scanEnabled, mode]);

  useEffect(() => {
    return () => {
      if (scanPulseTimerRef.current) {
        window.clearTimeout(scanPulseTimerRef.current);
      }
      restoreScanEyesOverrides();
    };
  }, []);

  const triggerScanPulse = () => {
    if (scanPulseTimerRef.current) {
      window.clearTimeout(scanPulseTimerRef.current);
    }
    setScanPulse(true);
    scanPulseTimerRef.current = window.setTimeout(() => setScanPulse(false), 140);
  };

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

  function speakCurrentText() {
    const words = currentTextWords();
    if (!words.length) return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(words.join(" ")));
    }

    apiPost("/vocab/sentence", { words }).catch(() => {});
  }

  function pressKey(key) {
    if (key === "DELETE") setText(t => t.slice(0, -1));
    else setText(t => t + key.toLowerCase());
  }

  function activateKey(key) {
    if (!key) return;
    if (key === "DELETE") { setText(t => t.slice(0, -1)); return; }
    if (key === "SPACE") { setText(t => t + " "); return; }
    if (key === "TOGGLE_REPEAT") {
      setEyeHoldRepeatEnabled(!eyeHoldRepeatEnabledRef.current);
      return;
    }
    if (key === "DONE") { speakCurrentText(); return; }
    pressKey(key);
  }

  function activateSelectedKey(navRows) {
    const key = navRows[selRowRef.current]?.[selColRef.current];
    activateKey(key);
  }

  useEffect(() => {
    const lastRowLen = NAV_ROWS[3].length;
    if (selRowRef.current === 3 && selColRef.current > lastRowLen - 1) {
      setSelection(3, lastRowLen - 1);
    }
    if (scanRowRef.current === 3 && scanColRef.current > lastRowLen - 1) {
      setScanCol(lastRowLen - 1);
    }
  }, [mode]);

  useEffect(() => {
    if (!enabled || !scanEnabled) return;
    setScanPhase("row");
    setScanRow(0);
    setScanCol(0);
  }, [enabled, scanEnabled, mode]);

  useEffect(() => {
    if (!enabled || !scanEnabled) return;

    const timer = window.setInterval(() => {
      const rows = [ROWS[0], ROWS[1], ROWS[2], getBottomRow(modeRef.current)];

      if (scanPhaseRef.current === "row") {
        setScanRow(prev => (prev + 1) % rows.length);
        return;
      }

      const rowIdx = scanRowRef.current;
      const len = rows[rowIdx]?.length || 1;
      setScanCol(prev => (prev + 1) % len);
    }, scanMs);

    return () => window.clearInterval(timer);
  }, [enabled, scanEnabled, scanMs, mode]);

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
        if (scanEnabledRef.current && scanPhaseRef.current === "item") {
          triggerScanPulse();
          setScanPhase("row");
          setScanCol(0);
          return;
        }
        void persistAndReturn();
        return;
      }

      if (scanEnabledRef.current) {
        if (cmd === "UP") {
          if (scanPhaseRef.current === "item") {
            triggerScanPulse();
            setScanPhase("row");
            setScanCol(0);
          }
          return;
        }

        if (cmd !== "FORWARD") return;

        triggerScanPulse();

        if (scanPhaseRef.current === "row") {
          setScanRow(scanRowRef.current);
          setScanCol(0);
          setScanPhase("item");
          return;
        }

        const key = navRows[scanRowRef.current]?.[scanColRef.current];
        activateKey(key);
        setScanPhase("row");
        setScanCol(0);
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
        speakCurrentText();
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
  }, [speakCurrentText, persistAndReturn]);

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
          <div style={s.titleSideSlot}>
            {enabled && indicatorDebug && (
              <div style={s.compactIndicatorWrap}>
                <GazeIndicator debug={indicatorDebug}/>
              </div>
            )}
          </div>
          <span style={s.label}>Keyboard</span>
          <div style={s.titleSideSlot} />
        </div>

        {enabled && (
          <div style={s.scanControlsWrap}>
            <button
              style={{ ...s.scanToggleBtn, ...(scanEnabled ? s.scanToggleBtnOn : {}) }}
              onClick={() => setScanEnabled(v => !v)}
            >
              {scanEnabled ? "Scan: ON" : "Scan: OFF"}
            </button>

            {scanEnabled && (
              <div style={s.scanSpeedWrap}>
                <button
                  style={s.scanStepBtn}
                  onClick={() => setScanMs(ms => Math.max(SCAN_MIN_MS, ms - SCAN_STEP_MS))}
                >
                  -
                </button>
                <span style={s.scanSpeedValue}>{scanMs}ms</span>
                <button
                  style={s.scanStepBtn}
                  onClick={() => setScanMs(ms => Math.min(SCAN_MAX_MS, ms + SCAN_STEP_MS))}
                >
                  +
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={s.display}>
        <span style={text ? s.displayText : s.placeholder}>
          {text || "Start typing…"}
        </span>
      </div>

      <div style={s.keysArea}>
        {enabled && scanEnabled && mode === "eyes" && (
          <p style={s.scanGestureHint}>Hold DOWN to select · Hold UP to go back</p>
        )}

        {/*
        {enabled && (
          <div style={{ ...s.statusOverlayRow, ...(scanPulse ? s.statusOverlayPulse : {}) }}>
            <div style={s.headHint}>
              {mode === "head"
                ? <>Head control active - tilt <strong>BACK</strong> to return</>
                : <>Eye control active - look <strong>LEFT</strong> to return</>}
            </div>
            <p style={s.stateIndicator}>{eyeStateLabel()}</p>
          </div>
        )}
        */}

        {ROWS.map((row, ri) => (
          <div
            key={ri}
            style={{
              ...s.row,
              ...s.letterRow,
              ...(enabled && scanEnabled && scanPhase === "row" && scanRow === ri ? s.scanRowActive : {}),
            }}
          >
            {row.map((key, ci) => {
              const keyId = `key-${ri}-${ci}`;
              const isSelected = enabled && !scanEnabled && selRow === ri && selCol === ci;
              const isHovered = !enabled && hoveredKey === keyId;
              const isScanSelected = enabled && scanEnabled && scanPhase === "item" && scanRow === ri && scanCol === ci;
              return (
                <button key={`${ri}-${ci}-${key}`}
                  style={{ ...s.key, ...s.letterKey, ...((isSelected || isHovered || isScanSelected) ? s.selectedKey : s.unselectedKey) }}
                  onMouseEnter={() => setHoveredKey(keyId)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={() => { setSelection(ri, ci); pressKey(key); }}>
                  {key}
                </button>
              );
            })}
          </div>
        ))}

        <div
          style={{
            ...s.row,
            ...s.actionRow,
            ...(enabled && scanEnabled && scanPhase === "row" && scanRow === 3 ? s.scanRowActive : {}),
          }}
        >
          <button
            style={{
              ...s.key,
              ...s.bsKey,
              flex: 0.7,
              ...((enabled && !scanEnabled && selRow === 3 && selCol === 0)
                || (!enabled && hoveredKey === "delete")
                || (enabled && scanEnabled && scanPhase === "item" && scanRow === 3 && scanCol === 0)
                ? s.selectedKey
                : s.unselectedBackspaceKey),
            }}
            onMouseEnter={() => setHoveredKey("delete")}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => { setSelection(3, 0); setText(t => t.slice(0, -1)); }}>
            ⌫
          </button>
          <button style={{
            ...s.key,
            flex: 1,
            ...((enabled && !scanEnabled && selRow === 3 && selCol === 1)
              || (!enabled && hoveredKey === "space")
              || (enabled && scanEnabled && scanPhase === "item" && scanRow === 3 && scanCol === 1)
              ? s.selectedKey
              : s.unselectedKey),
          }}
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
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              ...((!enabled && hoveredKey === "done")
                ? s.doneHoverKey
                : ((enabled && !scanEnabled && selRow === 3 && selCol === 2)
                  || (enabled && scanEnabled && scanPhase === "item" && scanRow === 3 && scanCol === 2)
                  ? s.doneSelectedKey
                  : s.unselectedDoneKey)),
            }}
            onMouseEnter={() => setHoveredKey("done")}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => {
              setSelection(3, 2);
              speakCurrentText();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
            </svg>
            <span>Speak</span>
          </button>
          {(mode === "eyes" || mode === "cnn") && (
            <button style={{
              ...s.key,
              ...(eyeHoldRepeatEnabled ? s.toggleKeyOn : s.toggleKeyOff),
              flex: 1.2,
              ...((enabled && !scanEnabled && selRow === 3 && selCol === 3)
                || (!enabled && hoveredKey === "repeat")
                || (enabled && scanEnabled && scanPhase === "item" && scanRow === 3 && scanCol === 3)
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
    display: "grid",
    gridTemplateColumns: "178px auto 178px",
    alignItems: "center",
    columnGap: 10,
  },
  titleSideSlot: {
    width: "178px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  compactIndicatorWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 178,
    maxWidth: 178,
  },
  scanControlsWrap: {
    position: "absolute",
    top: "50%",
    right: 0,
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    zIndex: 2,
  },
  scanToggleBtn: {
    padding: "8px 18px",
    borderRadius: "20px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.35)",
    fontSize: "13px",
    cursor: "pointer",
    letterSpacing: "0.03em",
  },
  scanToggleBtnOn: {
    borderColor: "rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.35)",
  },
  scanSpeedWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  scanStepBtn: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "rgba(255,255,255,0.65)",
    fontSize: "13px",
    cursor: "pointer",
    lineHeight: 1,
  },
  scanSpeedValue: {
    minWidth: "56px",
    textAlign: "center",
    fontSize: "12px",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.04em",
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
    justifySelf: "center",
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
  scanGestureHint: {
    margin: 0,
    textAlign: "center",
    fontSize: "12px",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    position: "absolute",
    top: "-34px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 4,
    pointerEvents: "none",
    whiteSpace: "nowrap",
  },
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
  statusOverlayPulse: {
    filter: "brightness(1.3)",
  },
  row: { display: "flex", gap: "5px" },
  scanRowActive: {
    outline: "2px solid rgba(255,255,255,0.35)",
    outlineOffset: "2px",
    borderRadius: "12px",
    transform: "scale(1.01)",
  },
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
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.85)", fontSize: "17px", cursor: "pointer", transition: "background 0.1s",
  },
  unselectedKey: {
    borderColor: "rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.85)",
    fontWeight: "400",
    boxShadow: "none",
    transform: "none",
  },
  letterKey: {
    height: "75px",
  },
  bsKey: { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.85)" },
  unselectedBackspaceKey: {
    borderColor: "rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.85)",
    fontWeight: "400",
    boxShadow: "none",
    transform: "none",
  },
  doneKey: {
    background: "rgba(255,255,255,0.11)", border: "1px solid rgba(255,255,255,0.22)", color: "rgba(255,255,255,1)",
    fontWeight: "600", transition: "background 0.1s",
  },
  unselectedDoneKey: {
    borderColor: "rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.11)",
    color: "rgba(255,255,255,1)",
    fontWeight: "600",
    boxShadow: "none",
    transform: "none",
  },
  doneSelectedKey: {
    borderColor: "rgba(255,255,255,0.34)",
    background: "rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,1)",
    fontWeight: "700",
  },
  doneHoverKey: {
    borderColor: "rgba(255,255,255,0.42)",
    background: "rgba(255,255,255,0.24)",
    color: "rgba(255,255,255,1)",
    fontWeight: "700",
  },
  toggleKeyOn: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
    transition: "background 0.15s ease",
  },
  unselectedToggleOnKey: {
    borderColor: "rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
    boxShadow: "none",
    transform: "none",
  },
  toggleKeyOff: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    transition: "background 0.15s ease",
  },
  unselectedToggleOffKey: {
    borderColor: "rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    boxShadow: "none",
    transform: "none",
  },
  selectedKey: {
    borderColor: "rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,1)",
    fontWeight: "600",
  },
};
