import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiPost, createSuggestSocket } from "../api";
import { useInputControl } from "./InputControlContextV2";

const DEFAULT_FEEDBACK_TEXT = "";

const splitWords = (text) =>
  String(text || "")
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

export default function Compose() {
  const navigate = useNavigate();
  const location = useLocation();
  const { enabled, register, unregister } = useInputControl();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const starterParam = searchParams.get("start");
  const starterPhrase = String(starterParam || "").trim().replace(/\s+/g, " ");

  const starterWords = useMemo(() => splitWords(starterPhrase), [starterPhrase]);

  const [appendedWords, setAppendedWords] = useState([]);
  const [modelSuggestions, setModelSuggestions] = useState([]);
  const [selIdx, setSelIdx] = useState(0);
  const selRef = useRef(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [feedbackState, setFeedbackState] = useState("idle");
  const [feedbackText, setFeedbackText] = useState(DEFAULT_FEEDBACK_TEXT);
  const feedbackTimerRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const fullWordsRef = useRef([]);

  const fullWords = useMemo(() => [...starterWords, ...appendedWords], [starterWords, appendedWords]);
  const fullText = fullWords.join(" ");

  useEffect(() => {
    fullWordsRef.current = fullWords;
  }, [fullWords]);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  const setTimedFeedback = useCallback((state, text, timeoutMs) => {
    clearFeedbackTimer();
    setFeedbackState(state);
    setFeedbackText(text);

    if (timeoutMs > 0) {
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedbackState("idle");
        setFeedbackText(DEFAULT_FEEDBACK_TEXT);
      }, timeoutMs);
    }
  }, [clearFeedbackTimer]);

  useEffect(() => {
    return () => clearFeedbackTimer();
  }, [clearFeedbackTimer]);

  useEffect(() => {
    if (!starterWords.length) {
      navigate("/communicate", { replace: true });
    }
  }, [navigate, starterWords.length]);

  useEffect(() => {
    setAppendedWords([]);
    setModelSuggestions([]);
    setSelIdx(0);
    selRef.current = 0;
    setFeedbackState("idle");
    setFeedbackText(DEFAULT_FEEDBACK_TEXT);
  }, [starterPhrase]);

  useEffect(() => {
    const incoming = Array.isArray(location.state?.words)
      ? location.state.words.map((w) => String(w).trim()).filter(Boolean)
      : null;

    if (!starterWords.length || !incoming) return;

    const starterLower = starterWords.map((w) => w.toLowerCase());
    const incomingLower = incoming.map((w) => w.toLowerCase());

    const startsWithStarter =
      incomingLower.length >= starterLower.length
      && starterLower.every((w, idx) => incomingLower[idx] === w);

    const nextAppended = startsWithStarter ? incoming.slice(starterWords.length) : incoming;
    setAppendedWords(nextAppended);
  }, [location.key, location.state, starterWords, starterWords.length]);

  useEffect(() => {
    if (!starterWords.length) return;

    let closedByCleanup = false;

    const sendCurrentWords = () => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const words = fullWordsRef.current;
      ws.send(JSON.stringify({
        text: words.join(" "),
        words,
        top_k: 8,
      }));
    };

    const connect = () => {
      const ws = createSuggestSocket();
      wsRef.current = ws;

      ws.onopen = () => {
        sendCurrentWords();
      };

      ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data || "{}");
          const incomingSuggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
          const next = incomingSuggestions
            .map((item) => {
              if (item && typeof item === "object") {
                return String(item.word ?? item.text ?? "").trim();
              }
              return String(item ?? "").trim();
            })
            .filter(Boolean)
            .slice(0, 8);

          setModelSuggestions(next);
        } catch {
          setModelSuggestions([]);
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (closedByCleanup) return;
        reconnectTimerRef.current = window.setTimeout(connect, 1200);
      };
    };

    connect();

    return () => {
      closedByCleanup = true;

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [starterWords.length]);

  useEffect(() => {
    if (!starterWords.length) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      text: fullWords.join(" "),
      words: fullWords,
      top_k: 8,
    }));
  }, [fullWords, starterWords.length]);

  const addPhrase = useCallback((phrase) => {
    const wordsToAdd = splitWords(phrase);
    if (!wordsToAdd.length) return;

    setAppendedWords((prev) => [...prev, ...wordsToAdd]);
  }, []);

  const deleteBackspace = useCallback(() => {
    setAppendedWords((prev) => {
      if (!prev.length) return prev;
      const nextText = prev.join(" ").slice(0, -1).trimEnd();
      return splitWords(nextText);
    });
  }, []);

  const speakText = useCallback(() => {
    if (!fullText) return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(fullText));
    }

    apiPost("/vocab/sentence", { words: fullWords }).catch(() => {});
  }, [fullText, fullWords]);

  const openKeyboard = useCallback(() => {
    navigate("/keyboard", {
      state: {
        words: fullWords,
        returnTo: `/compose?start=${encodeURIComponent(starterPhrase)}`,
      },
    });
  }, [fullWords, navigate, starterPhrase]);

  const suggestions = useMemo(() => {
    return modelSuggestions
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .slice(0, 8);
  }, [modelSuggestions]);

  const interactiveItems = useMemo(() => {
    const items = [];

    suggestions.forEach((entry, idx) => {
      const phrase = String(entry || "").trim();
      if (phrase) {
        items.push({
          id: `sugg-${idx}`,
          run: () => addPhrase(phrase),
        });
      }
    });

    items.push({ id: "action-speak", run: speakText });
    items.push({ id: "action-keyboard", run: openKeyboard });
    items.push({ id: "action-delete", run: deleteBackspace });

    return items;
  }, [addPhrase, deleteBackspace, openKeyboard, speakText, suggestions]);

  const indexById = useMemo(() => {
    const map = {};
    interactiveItems.forEach((item, idx) => {
      map[item.id] = idx;
    });
    return map;
  }, [interactiveItems]);

  const navRows = useMemo(() => {
    const rows = [];
    const suggestionIds = suggestions.map((_, idx) => `sugg-${idx}`);

    for (let i = 0; i < suggestionIds.length; i += 4) {
      rows.push(suggestionIds.slice(i, i + 4));
    }

    rows.push(["action-speak", "action-keyboard", "action-delete"]);
    return rows;
  }, [suggestions]);

  const positionById = useMemo(() => {
    const map = {};
    navRows.forEach((row, rowIdx) => {
      row.forEach((id, colIdx) => {
        map[id] = { row: rowIdx, col: colIdx };
      });
    });
    return map;
  }, [navRows]);

  const setSel = useCallback((next) => {
    selRef.current = next;
    setSelIdx(next);
  }, []);

  useEffect(() => {
    if (!interactiveItems.length) return;
    if (selRef.current > interactiveItems.length - 1) {
      setSel(0);
    }
  }, [interactiveItems.length, setSel]);

  useEffect(() => {
    register((cmd) => {
      const total = interactiveItems.length;
      if (!total) return;

      const current = selRef.current;
      const currentId = interactiveItems[current]?.id;
      const currentPos = currentId ? positionById[currentId] : null;

      if (cmd === "BACK") {
        navigate("/communicate");
        return;
      }

      if (cmd === "FORWARD") {
        interactiveItems[current]?.run?.();
        return;
      }

      if (!currentPos) return;

      const moveTo = (rowIdx, colIdx) => {
        const rowItems = navRows[rowIdx];
        if (!rowItems?.length) return;

        const targetCol = Math.max(0, Math.min(colIdx, rowItems.length - 1));
        const targetId = rowItems[targetCol];
        const targetIdx = indexById[targetId];
        if (Number.isInteger(targetIdx)) {
          setSel(targetIdx);
        }
      };

      if (cmd === "LEFT") {
        const rowItems = navRows[currentPos.row];
        if (!rowItems?.length) return;
        const nextCol = (currentPos.col - 1 + rowItems.length) % rowItems.length;
        moveTo(currentPos.row, nextCol);
        return;
      }

      if (cmd === "RIGHT") {
        const rowItems = navRows[currentPos.row];
        if (!rowItems?.length) return;
        const nextCol = (currentPos.col + 1) % rowItems.length;
        moveTo(currentPos.row, nextCol);
        return;
      }

      if (cmd === "UP") {
        const nextRow = Math.max(0, currentPos.row - 1);
        moveTo(nextRow, currentPos.col);
        return;
      }

      if (cmd === "DOWN") {
        const nextRow = Math.min(navRows.length - 1, currentPos.row + 1);
        moveTo(nextRow, currentPos.col);
      }
    });

    return () => unregister();
  }, [indexById, interactiveItems, navRows, navigate, positionById, register, setSel, unregister]);

  if (!starterWords.length) return null;

  const getDotColor = () => {
    if (feedbackState === "listening") return "#3a6b9a";
    if (feedbackState === "recognized") return "#3d6b4f";
    return "#2a2a2a";
  };

  return (
    <>
      <style>{"@keyframes composeCursorBlink { 50% { opacity: 0; } }"}</style>

      <div style={s.page}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => navigate("/communicate")}>← Back</button>
          <span style={s.title}>COMPOSE</span>
        </div>

        <div style={s.display}>
          <span style={s.displayText}>
            {fullText}
            <span style={s.cursor} />
          </span>
        </div>

        <div style={s.sectionLabel}>SUGGESTIONS:</div>
        {suggestions.length > 0 ? (
          <div style={s.suggestionGrid}>
            {suggestions.map((phrase, idx) => {
              const id = `sugg-${idx}`;
              const isSelected = enabled && indexById[id] === selIdx;
              const isHovered = hoveredId === id;

              return (
                <button
                  key={id}
                  style={{
                    ...s.suggestionBtn,
                    ...(isSelected || isHovered ? s.suggestionBtnActive : {}),
                  }}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    setSel(indexById[id]);
                    addPhrase(phrase);
                  }}
                >
                  {phrase}
                </button>
              );
            })}
          </div>
        ) : null}

        {feedbackText ? (
          <div style={s.feedbackBar}>
            <span style={{ ...s.feedbackDot, background: getDotColor() }} />
            <span style={s.feedbackText}>{feedbackText}</span>
          </div>
        ) : null}

        <div style={s.actionRow}>
          <button
            style={{
              ...s.speakBtn,
              ...((enabled && indexById["action-speak"] === selIdx) || hoveredId === "action-speak" ? s.actionBtnActive : {}),
            }}
            onMouseEnter={() => setHoveredId("action-speak")}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => {
              setSel(indexById["action-speak"]);
              speakText();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
            </svg>
            <span>Speak</span>
          </button>

          <button
            style={{
              ...s.iconActionBtn,
              ...((enabled && indexById["action-keyboard"] === selIdx) || hoveredId === "action-keyboard" ? s.actionBtnActive : {}),
            }}
            onMouseEnter={() => setHoveredId("action-keyboard")}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => {
              setSel(indexById["action-keyboard"]);
              openKeyboard();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
            </svg>
            <span>Keyboard</span>
          </button>

          <button
            style={{
              ...s.iconActionBtn,
              ...((enabled && indexById["action-delete"] === selIdx) || hoveredId === "action-delete" ? s.actionBtnActive : {}),
            }}
            onMouseEnter={() => setHoveredId("action-delete")}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => {
              setSel(indexById["action-delete"]);
              deleteBackspace();
            }}
          >
            <span style={s.deleteEmoji} aria-hidden="true">⌫</span>
          </button>
        </div>
      </div>
    </>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    width: "100vw",
    boxSizing: "border-box",
    background: "#111111",
    borderRadius: "0px",
    padding: "24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  topBar: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "34px",
    flexShrink: 0,
  },
  backBtn: {
    position: "absolute",
    left: 0,
    padding: "8px 18px",
    borderRadius: "20px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.35)",
    fontSize: "13px",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 400,
  },
  title: {
    fontSize: "18px",
    fontWeight: "300",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  display: {
    background: "rgba(255,255,255,0.03)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: "12px",
    padding: "20px 22px",
    minHeight: "80px",
    display: "flex",
    alignItems: "center",
  },
  displayText: {
    fontSize: "28px",
    color: "#e0e0e0",
    fontWeight: 400,
    lineHeight: 1.3,
    wordBreak: "break-word",
    flex: 1,
  },
  cursor: {
    display: "inline-block",
    width: "2px",
    height: "30px",
    background: "#555555",
    marginLeft: "3px",
    verticalAlign: "middle",
    animation: "composeCursorBlink 1.1s step-end infinite",
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: "10px",
    letterSpacing: "0.12em",
    color: "rgba(255,255,255,0.25)",
    textTransform: "uppercase",
    marginBottom: "-6px",
    fontWeight: 400,
  },
  suggestionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
  },
  suggestionBtn: {
    padding: "12px 8px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 400,
    cursor: "pointer",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: "border-color 0.12s, background 0.12s, color 0.12s",
  },
  suggestionBtnActive: {
    borderColor: "rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
  },
  actionRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
    marginTop: "auto",
    marginBottom: "6px",
  },
  speakBtn: {
    background: "rgba(255,255,255,0.03)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: "11px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 400,
    padding: "14px 8px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    transition: "border-color 0.12s, background 0.12s, color 0.12s",
  },
  iconActionBtn: {
    background: "rgba(255,255,255,0.03)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: "11px",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 400,
    padding: "14px 8px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    transition: "border-color 0.12s, background 0.12s, color 0.12s",
  },
  deleteEmoji: {
    fontSize: "18px",
    lineHeight: 1,
  },
  actionBtnActive: {
    borderColor: "rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
  },
  feedbackBar: {
    padding: "10px 14px",
    borderRadius: "10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "42px",
    marginTop: "8px",
  },
  feedbackDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    transition: "background 0.2s",
    flexShrink: 0,
  },
  feedbackText: {
    fontSize: "12px",
    color: "#555555",
    fontWeight: 400,
  },
};
