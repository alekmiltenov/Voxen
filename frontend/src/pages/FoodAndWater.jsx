import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInputControl } from "./InputControlContextV2";
import { GazeIndicator } from "../components/EyeTrackingDebug";

const FOOD_OPTIONS = [
  { id: "water", label: "Water", icon: "💧", tts: "I would like some water" },
  { id: "coffee", label: "Coffee", icon: "svg", tts: "I would like some coffee" },
  { id: "juice", label: "Juice", icon: "🧃", tts: "I would like some juice" },
  { id: "snack", label: "Snack", icon: "🍪", tts: "I would like a snack" },
  { id: "light-meal", label: "Light meal", icon: "🥗", tts: "I would like a light meal" },
  { id: "full-meal", label: "Full meal", icon: "🍕", tts: "I would like a full meal" },
];

function FoodIcon({ option }) {
  if (option.icon === "svg") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#888888"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="48"
        height="48"
      >
        <path d="M18 8h1a4 4 0 010 8h-1" />
        <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    );
  }
  return <>{option.icon}</>;
}

export default function FoodAndWater() {
  const navigate = useNavigate();
  const { enabled, register, unregister, mode, eyeDebug, cnnDebug, headDebug } = useInputControl();

  const [selIdx, setSelIdx] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const selRef = useRef(0);

  const setSel = useCallback((next) => {
    selRef.current = next;
    setSelIdx(next);
  }, []);

  const handleSelect = useCallback((option) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(option.tts));
    }
  }, []);

  // Build interactive items
  const interactiveItems = useMemo(() => {
    const items = [];
    FOOD_OPTIONS.forEach((option) => {
      items.push({
        id: option.id,
        label: option.label,
        run: () => handleSelect(option),
      });
    });
    items.push({ id: "action-back", run: () => navigate("/actions") });
    return items;
  }, [handleSelect, navigate]);

  // Build ID to index map
  const indexById = useMemo(() => {
    const map = {};
    interactiveItems.forEach((item, idx) => {
      map[item.id] = idx;
    });
    return map;
  }, [interactiveItems]);

  // Build grid navigation (3 columns for food, 1 column centered for back)
  const navRows = useMemo(() => {
    const rows = [];
    const foodIds = FOOD_OPTIONS.map((opt) => opt.id);
    
    // 3x2 grid for food options
    for (let i = 0; i < foodIds.length; i += 3) {
      rows.push(foodIds.slice(i, i + 3));
    }
    
    // Back button row
    rows.push(["action-back"]);
    return rows;
  }, []);

  // Build position map
  const positionById = useMemo(() => {
    const map = {};
    navRows.forEach((row, rowIdx) => {
      row.forEach((id, colIdx) => {
        map[id] = { row: rowIdx, col: colIdx };
      });
    });
    return map;
  }, [navRows]);

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
        navigate("/actions");
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
        if (currentPos.col > 0) {
          moveTo(currentPos.row, currentPos.col - 1);
        }
        return;
      }

      if (cmd === "RIGHT") {
        const rowItems = navRows[currentPos.row];
        if (!rowItems?.length) return;
        if (currentPos.col < rowItems.length - 1) {
          moveTo(currentPos.row, currentPos.col + 1);
        }
        return;
      }

      if (cmd === "UP") {
        const nextRow = Math.max(0, currentPos.row - 1);
        if (nextRow !== currentPos.row) {
          moveTo(nextRow, currentPos.col);
        }
        return;
      }

      if (cmd === "DOWN") {
        const nextRow = Math.min(navRows.length - 1, currentPos.row + 1);
        if (nextRow !== currentPos.row) {
          moveTo(nextRow, currentPos.col);
        }
      }
    });

    return () => unregister();
  }, [indexById, interactiveItems, navRows, navigate, positionById, register, setSel, unregister]);

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <span style={s.title}>FOOD & WATER</span>
      </div>

      <div style={s.gridContainer}>
        {FOOD_OPTIONS.map((option, idx) => {
          const isSelected = enabled && selIdx === idx;
          const isHovered = hoveredId === option.id;

          return (
            <button
              key={option.id}
              style={{
                ...s.foodCard,
                ...(isSelected || isHovered ? s.foodCardActive : {}),
              }}
              onMouseEnter={() => setHoveredId(option.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => {
                setSel(idx);
                handleSelect(option);
              }}
            >
              <div style={s.cardIcon}>
                <FoodIcon option={option} />
              </div>
              <div style={s.cardLabel}>{option.label}</div>
            </button>
          );
        })}
      </div>

      <div style={s.actionRow}>
        <button
          style={{
            ...s.backBtn,
            ...((enabled && indexById["action-back"] === selIdx) || hoveredId === "action-back"
              ? s.actionBtnActive
              : {}),
          }}
          onMouseEnter={() => setHoveredId("action-back")}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => navigate("/actions")}
        >
          ← Back
        </button>
      </div>

      {mode === "eyes" && eyeDebug && <GazeIndicator debug={eyeDebug} />}
      {mode === "cnn" && cnnDebug && <GazeIndicator debug={cnnDebug} />}
      {mode === "head" && headDebug && <GazeIndicator debug={headDebug} />}
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    width: "100vw",
    boxSizing: "border-box",
    background: "#111111",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "34px",
    marginTop: "12px",
  },
  title: {
    fontSize: "18px",
    fontWeight: "300",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    padding: "20px 30px",
    flex: 1,
  },
  foodCard: {
    padding: "20px",
    borderRadius: "14px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#ffffff",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    transition: "border-color 0.12s ease-out, background 0.12s ease-out",
    minHeight: "140px",
  },
  foodCardActive: {
    borderColor: "rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.08)",
  },
  cardIcon: {
    fontSize: "48px",
    lineHeight: 1,
  },
  cardLabel: {
    fontSize: "18px",
    fontWeight: 400,
    textAlign: "center",
  },
  actionRow: {
    display: "flex",
    justifyContent: "center",
    padding: "0 30px 8px 30px",
    marginTop: "auto",
  },
  backBtn: {
    background: "rgba(255,255,255,0.03)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 400,
    padding: "0",
    height: "68px",
    minWidth: "250px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    transition: "border-color 0.12s ease-out, background 0.12s ease-out, color 0.12s ease-out",
  },
  actionBtnActive: {
    borderColor: "rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.08)",
  },
};
