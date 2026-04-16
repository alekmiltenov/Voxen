import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInputControl } from "./InputControlContextV2";
import { GazeIndicator } from "../components/EyeTrackingDebug";

const FOOD_OPTIONS = [
  { id: "water", label: "Water", icon: "svg-water", tts: "I would like some water" },
  { id: "coffee", label: "Coffee", icon: "svg-coffee", tts: "I would like some coffee" },
  { id: "juice", label: "Juice", icon: "svg-juice", tts: "I would like some juice" },
  { id: "snack", label: "Snack", icon: "svg-snack", tts: "I would like a snack" },
  { id: "light-meal", label: "Light meal", icon: "svg-light-meal", tts: "I would like a light meal" },
  { id: "full-meal", label: "Full meal", icon: "svg-full-meal", tts: "I would like a full meal" },
];

function FoodIcon({ option }) {
  if (option.icon === "svg-water") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" width="45" height="45">
        <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>
      </svg>
    );
  }
  if (option.icon === "svg-coffee") {
    return (
      <span style={{ display: "inline-block", marginLeft: 10 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" width="48" height="48">
          <path d="M18 8h1a4 4 0 010 8h-1"/>
          <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
        </svg>
      </span>
    );
  }
  if (option.icon === "svg-juice") {
    return (
      <span style={{ display: "inline-block", transform: 'translateY(12px)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" width="50" height="50">
          <line x1="8" y1="2" x2="8" y2="4"/>
          <line x1="12" y1="2" x2="12" y2="4"/>
          <line x1="16" y1="2" x2="16" y2="4"/>
          <path d="M5 4h14l-1.68 10.39a2 2 0 01-1.98 1.61H8.66a2 2 0 01-1.98-1.61L5 4z"/>
        </svg>
      </span>
    );
  }
  if (option.icon === "svg-snack") {
    return (
      <svg viewBox="-60 -60 610 610" fill="none" stroke="#ffffff" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" width="48" height="48">
        <polygon points="0.044,311.55 35.844,311.55 35.844,347.35 71.644,347.35 71.644,382.75 107.344,382.75 107.344,418.45 142.744,418.45 142.744,454.25 178.544,454.25 178.544,490.05 350.444,318.15 171.944,139.65" />
        <path strokeLinejoin="miter" d="M484.244,131.15l-125.3-125.3c-7.8-7.8-21-7.8-28.8,0l-131.8,131.9l154,154l131.8-131.8C491.944,152.15,491.944,138.85,484.244,131.15z" />
      </svg>
    );
  }
  if (option.icon === "svg-light-meal") {
    return (
      <svg viewBox="0 0 416.976 416.976" version="1.1" xmlns="http://www.w3.org/2000/svg" width="45" height="45">
        <path fill="#ffffff" d="M416.976,171.847v-65.496c0-4.142-3.358-7.5-7.5-7.5H7.5c-4.142,0-7.5,3.358-7.5,7.5v65.496c0,4.142,3.358,7.5,7.5,7.5h5.02c-0.87,2.406-1.347,4.999-1.347,7.701c0,6.494,2.745,12.355,7.13,16.496v30.735H7.5c-4.142,0-7.5,3.358-7.5,7.5v68.845c0,4.142,3.358,7.5,7.5,7.5h401.976c4.142,0,7.5-3.358,7.5-7.5V241.78c0-4.142-3.358-7.5-7.5-7.5h-10.792v-30.735c4.385-4.142,7.13-10.003,7.13-16.496c0-2.703-0.477-5.295-1.347-7.701h5.009C413.618,179.347,416.976,175.989,416.976,171.847z M15,113.851h386.976v50.496H15V113.851z M33.303,209.75h0.571h52.278l53.741,24.53H33.303V209.75z M271.003,277.636L122.276,209.75h179.713L271.003,277.636z M401.976,303.125H15V249.28h157.755l98.842,45.116c1.01,0.461,2.068,0.679,3.11,0.679c2.846,0,5.568-1.629,6.827-4.387l18.9-41.409h101.542V303.125z M383.684,209.75v24.53h-76.403l11.196-24.53h64.636H383.684z M390.814,187.048c0,4.247-3.455,7.702-7.701,7.702H33.874c-4.247,0-7.701-3.455-7.701-7.702s3.455-7.701,7.701-7.701h349.239C387.359,179.347,390.814,182.802,390.814,187.048z"/>
      </svg>
    );
  }
  if (option.icon === "svg-full-meal") {
    return (
      <span style={{ display: "inline-flex", transform: "scale(1.42)", transformOrigin: "center center" }}>
        <svg viewBox="-50 0 612 512" fill="none" stroke="#ffffff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" width="48" height="48">
          <path d="M249.705,108.488c-81.462,0-147.512,66.05-147.512,147.512c0,81.462,66.05,147.512,147.512,147.512c81.472,0,147.512-66.05,147.512-147.512C397.217,174.538,331.177,108.488,249.705,108.488z M249.705,373.677c-64.884,0-117.677-52.793-117.677-117.677s52.793-117.677,117.677-117.677S367.382,191.116,367.382,256S314.589,373.677,249.705,373.677z"/>
          <path d="M21.915,172.576C4.075,234.032,0.307,272.782,0.307,272.782s-1.942,23.58,3.943,23.58c5.875,0,20.442,0,20.442,0v85.464c0,9.216,7.489,16.704,16.704,16.704h12.946c9.216,0,16.704-7.488,16.704-16.704V139.148C71.048,115.568,39.6,111.655,21.915,172.576z"/>
          <path d="M497.908,126.057h-0.039c-5.604,0-6.166,4.545-6.166,10.149v64.69h-16.248v-64.69c0-5.604-4.545-10.149-10.149-10.149c-5.604,0-10.149,4.545-10.149,10.149v64.69h-19.074v-64.69c0-5.604-0.563-10.149-6.167-10.149h-0.039c-7.779,0-14.092,6.313-14.092,14.092v60.747c0,26.105,6.808,33.117,13.674,39.983c7.459,7.459,11.256,9.945,11.256,18.646c0,8.702,0,36.837,0,36.837v85.464c0,9.216,7.488,16.704,16.704,16.704h12.946c9.216,0,16.704-7.488,16.704-16.704V259.525c0-8.702,3.797-11.188,11.256-18.646c6.866-6.866,13.674-13.878,13.674-39.983v-60.747C512,132.37,505.687,126.057,497.908,126.057z"/>
        </svg>
      </span>
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
    fontSize: "clamp(16px, 1.8vw, 18px)",
    fontWeight: 400,
    letterSpacing: "-0.2px",
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
