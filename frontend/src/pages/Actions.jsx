import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";
<<<<<<< Updated upstream
import DwellButton from "../components/DwellButton";
=======
import { useHeadControl } from "./HeadControlContext";
>>>>>>> Stashed changes

const ACTIONS = [
  { id: 2, label: "Emergency",  sub: "Send alert to caregiver", icon: "🚨" },
  { id: 1, label: "Call",       sub: "Call caregiver",          icon: "📞" },
  { id: 3, label: "AI Chat",    sub: "Open assistant",          icon: "🤖" },
  { id: 4, label: "Pain",     sub: "Choose the hurting body part",     icon: "❤️" },
];

// Direction hints for each position in the 2×2 grid
const HINTS = ["← ↑", "→ ↑", "← ↓", "→ ↓"];

export default function Actions() {
  const navigate = useNavigate();
  const { enabled, register, unregister } = useHeadControl();

  const [status,  setStatus]  = useState(null);
  const [selIdx,  setSelIdx]  = useState(0);
  const selRef = useRef(0);

  const setSel = (v) => { selRef.current = v; setSelIdx(v); };

  // ── run action (stable — only uses setStatus) ────────────────────────────
  const runAction = async (id) => {
    setStatus(null);
    if (id === 4) {
  navigate("/pain");
  return;
}
    try {
      const res = await apiPost("/actions/execute", { action: id });
      setStatus({ msg: res.message ?? "Done", ok: true });
    } catch (e) {
      setStatus({ msg: e.message, ok: false });
    }
    setTimeout(() => setStatus(null), 3000);
  };

  // ── head-control handler ─────────────────────────────────────────────────
  useEffect(() => {
    register((cmd) => {
      if (cmd === "LEFT")    setSel(Math.max(0, selRef.current - 1));
      if (cmd === "RIGHT")   setSel(Math.min(ACTIONS.length - 1, selRef.current + 1));
      if (cmd === "FORWARD") runAction(ACTIONS[selRef.current].id);
      if (cmd === "BACK")    navigate("/");
    });
    return () => unregister();
  }, []);

  return (
    <div style={s.page}>

      {/* ── header ── */}
      <div style={s.header}>
        <DwellButton style={s.backBtn} onClick={() => navigate("/")}>← Back</DwellButton>
        <span style={s.title}>Actions</span>
        <div style={{ width: 80 }} />
      </div>

      {/* ── status toast ── */}
      {status && (
        <div style={{
          ...s.toast,
          borderColor: status.ok ? "rgba(255,255,255,0.15)" : "rgba(255,80,80,0.4)",
          opacity:     status.ok ? 0.7 : 0.9,
        }}>
          {status.msg}
        </div>
      )}

      {/* ── 2×2 grid ── */}
      <div style={s.grid}>
<<<<<<< Updated upstream
        {ACTIONS.map(a => (
          <DwellButton key={a.id} style={s.card}
            hoverBg="rgba(255,255,255,0.05)"
            onClick={() => a.id === 3 ? navigate("/ai-chat") : runAction(a.id)}>
            <span style={s.icon}>{a.icon}</span>
            <span style={s.label}>{a.label}</span>
            <span style={s.sub}>{a.sub}</span>
          </DwellButton>
        ))}
=======
        {ACTIONS.map((a, i) => {
          const isSelected = enabled && selIdx === i;
          return (
            <button
              key={a.id}
              style={{
                ...s.card,
                borderColor: isSelected ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.1)",
                background:  isSelected ? "rgba(255,255,255,0.06)" : "transparent",
                transform:   isSelected ? "scale(1.03)" : "scale(1)",
              }}
              onMouseEnter={e => !isSelected && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={e => !isSelected && (e.currentTarget.style.background = "transparent")}
              onClick={() => runAction(a.id)}
            >
              {isSelected && <div style={s.selRing} />}

              <span style={s.icon}>{a.icon}</span>
              <span style={s.label}>{a.label}</span>
              <span style={s.sub}>{a.sub}</span>

              {enabled && (
                <span style={s.hint}>{HINTS[i]}</span>
              )}
            </button>
          );
        })}
>>>>>>> Stashed changes
      </div>

      {/* legend */}
      {enabled && (
        <p style={s.legend}>
          LEFT / RIGHT &nbsp;·&nbsp; navigate &nbsp;&nbsp;&nbsp;
          FORWARD &nbsp;·&nbsp; run &nbsp;&nbsp;&nbsp;
          BACK &nbsp;·&nbsp; home
        </p>
      )}
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
    padding:       "28px 32px",
    gap:           "28px",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  backBtn: {
    padding:      "8px 18px",
    borderRadius: "20px",
    background:   "transparent",
    border:       "1px solid rgba(255,255,255,0.12)",
    color:        "rgba(255,255,255,0.4)",
    fontSize:     "28px",
    cursor:       "pointer",
    width:        130,
  },
  title: {
    fontSize:      "18px",
    fontWeight:    "300",
    color:         "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  toast: {
    padding:      "12px 20px",
    borderRadius: "12px",
    border:       "1px solid",
    color:        "rgba(255,255,255,0.7)",
    fontSize:     "15px",
    textAlign:    "center",
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "16px",
    flex:                1,
  },
  card: {
    position:       "relative",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "14px",
    borderRadius:   "18px",
    border:         "1px solid",
    cursor:         "pointer",
    transition:     "all 0.15s ease",
    overflow:       "hidden",
  },
  selRing: {
    position:     "absolute",
    inset:        -1,
    borderRadius: 18,
    border:       "2px solid rgba(255,255,255,0.4)",
    pointerEvents:"none",
  },
  icon: {
    fontSize: "44px",
  },
  label: {
    fontSize:   "20px",
    fontWeight: "400",
    color:      "rgba(255,255,255,0.85)",
  },
  sub: {
    fontSize: "13px",
    color:    "rgba(255,255,255,0.3)",
  },
  hint: {
    fontSize:      11,
    color:         "rgba(255,255,255,0.2)",
    letterSpacing: "0.08em",
  },
  legend: {
    textAlign:     "center",
    fontSize:      12,
    color:         "rgba(255,255,255,0.18)",
    letterSpacing: "0.06em",
    margin:        0,
    textTransform: "uppercase",
  },
};