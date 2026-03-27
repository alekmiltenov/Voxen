import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHeadControl } from "./HeadControlContext";

const CARDS = [
  {
    route: "/communicate",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: "Communicate",
    sub:   "Build sentences with suggestions",
  },
  {
    route: "/actions",
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    title: "Actions",
    sub:   "One-tap for common needs",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { enabled, toggle, register, unregister } = useHeadControl();

  const [selIdx, setSelIdx] = useState(0);
  const selRef = useRef(0);

  const setSel = (v) => { selRef.current = v; setSelIdx(v); };

  // ── Head-control handler ─────────────────────────────────────────────────
  useEffect(() => {
    register((cmd) => {
      if (cmd === "LEFT")    setSel(0);
      if (cmd === "RIGHT")   setSel(1);
      if (cmd === "FORWARD") navigate(CARDS[selRef.current].route);
      // BACK has nowhere to go from home
    });
    return () => unregister();
  }, []);

  return (
    <div style={s.page}>

      {/* ── Top bar ── */}
      <div style={s.topBar}>

        {/* Settings gear — left side */}
        <button
          style={s.settingsBtn}
          onClick={() => navigate("/settings")}
          title="Settings"
          onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33
              1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33
              l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3
              a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06
              a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3
              a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06
              a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1
              H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* Wordmark — centre */}
        <p style={s.wordmark}>Voxen</p>

        {/* Head control toggle — right side */}
        <button
          onClick={toggle}
          style={{
            ...s.toggleBtn,
            background:  enabled ? "rgba(34,197,94,0.12)"  : "rgba(255,255,255,0.04)",
            borderColor: enabled ? "rgba(34,197,94,0.35)"  : "rgba(255,255,255,0.1)",
            color:       enabled ? "#86efac"               : "rgba(255,255,255,0.3)",
          }}
        >
          <div style={{
            width:        7,
            height:       7,
            borderRadius: "50%",
            background:   enabled ? "#22c55e" : "rgba(255,255,255,0.2)",
            boxShadow:    enabled ? "0 0 8px #22c55e" : "none",
            transition:   "all 0.3s",
          }} />
          {enabled ? "Head Control ON" : "Head Control OFF"}
        </button>
      </div>

      {/* ── Cards ── */}
      <div style={s.grid}>
        {CARDS.map((card, i) => {
          const isSelected = enabled && selIdx === i;
          return (
            <button
              key={i}
              style={{
                ...s.card,
                borderColor: isSelected ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.1)",
                background:  isSelected ? "rgba(255,255,255,0.05)" : "transparent",
                color:       isSelected ? "rgba(255,255,255,0.9)"  : "rgba(255,255,255,0.7)",
                transform:   isSelected ? "scale(1.02)" : "scale(1)",
              }}
              onMouseEnter={e => !isSelected && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={e => !isSelected && (e.currentTarget.style.background = "transparent")}
              onClick={() => navigate(card.route)}
            >
              {isSelected && <div style={s.selectionRing} />}

              <span style={{
                ...s.cardIcon,
                color: isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.7)",
              }}>
                {card.icon}
              </span>
              <span style={s.cardTitle}>{card.title}</span>
              <span style={s.cardSub}>{card.sub}</span>

              {enabled && (
                <span style={s.hint}>{i === 0 ? "← LEFT" : "RIGHT →"}</span>
              )}
            </button>
          );
        })}
      </div>

      {enabled && (
        <p style={s.legend}>
          LEFT / RIGHT &nbsp;·&nbsp; select &nbsp;&nbsp;&nbsp;
          FORWARD &nbsp;·&nbsp; confirm
        </p>
      )}
    </div>
  );
}

const s = {
  page: {
    width:          "100vw",
    height:         "100vh",
    background:     "#111111",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "40px",
  },
  topBar: {
    position:       "absolute",
    top:            28,
    left:           32,
    right:          32,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  settingsBtn: {
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    width:        36,
    height:       36,
    borderRadius: "50%",
    background:   "transparent",
    border:       "none",
    color:        "rgba(255,255,255,0.2)",
    cursor:       "pointer",
    padding:      0,
    transition:   "color 0.2s ease",
  },
  wordmark: {
    fontSize:      "22px",
    fontWeight:    "300",
    color:         "rgba(255,255,255,0.35)",
    margin:        0,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  toggleBtn: {
    display:      "flex",
    alignItems:   "center",
    gap:          8,
    padding:      "7px 16px",
    borderRadius: 99,
    border:       "1px solid",
    fontSize:     13,
    fontWeight:   500,
    cursor:       "pointer",
    letterSpacing:"0.04em",
    transition:   "all 0.25s ease",
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "20px",
    width:               "min(860px, 90vw)",
  },
  card: {
    position:       "relative",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "18px",
    padding:        "56px 40px 44px",
    borderRadius:   "20px",
    border:         "1px solid",
    cursor:         "pointer",
    transition:     "all 0.18s ease",
    overflow:       "hidden",
  },
  selectionRing: {
    position:     "absolute",
    inset:        -1,
    borderRadius: 20,
    border:       "2px solid rgba(255,255,255,0.35)",
    pointerEvents:"none",
  },
  cardIcon: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    transition:     "color 0.18s",
  },
  cardTitle: {
    fontSize:      "24px",
    fontWeight:    "400",
    color:         "inherit",
    letterSpacing: "-0.2px",
  },
  cardSub: {
    fontSize: "14px",
    color:    "rgba(255,255,255,0.3)",
  },
  hint: {
    marginTop:     4,
    fontSize:      11,
    color:         "rgba(255,255,255,0.2)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  legend: {
    position:      "absolute",
    bottom:        28,
    fontSize:      12,
    color:         "rgba(255,255,255,0.18)",
    letterSpacing: "0.06em",
    margin:        0,
    textTransform: "uppercase",
  },
};
