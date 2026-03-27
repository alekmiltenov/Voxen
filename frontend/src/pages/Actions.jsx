import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import DwellButton from "../components/DwellButton";

const ACTIONS = [
  { id: 2, label: "Emergency",  sub: "Send alert to caregiver", icon: "🚨" },
  { id: 1, label: "Call",       sub: "Call caregiver",          icon: "📞" },
  { id: 3, label: "AI Chat",    sub: "Open assistant",          icon: "🤖" },
  { id: 4, label: "Lights",     sub: "Toggle smart lights",     icon: "💡" },
];

export default function Actions() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);

  async function runAction(id) {
    setStatus(null);
    try {
      const res = await apiPost("/actions/execute", { action: id });
      setStatus({ msg: res.message ?? "Done", ok: true });
    } catch (e) {
      setStatus({ msg: e.message, ok: false });
    }
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <DwellButton style={s.backBtn} onClick={() => navigate("/")}>← Back</DwellButton>
        <span style={s.title}>Actions</span>
        <div style={{ width: 80 }} />
      </div>

      {status && (
        <div style={{ ...s.toast, opacity: status.ok ? 0.7 : 0.9,
          borderColor: status.ok ? "rgba(255,255,255,0.15)" : "rgba(255,80,80,0.4)" }}>
          {status.msg}
        </div>
      )}

      <div style={s.grid}>
        {ACTIONS.map(a => (
          <DwellButton key={a.id} style={s.card}
            hoverBg="rgba(255,255,255,0.05)"
            onClick={() => a.id === 3 ? navigate("/ai-chat") : runAction(a.id)}>
            <span style={s.icon}>{a.icon}</span>
            <span style={s.label}>{a.label}</span>
            <span style={s.sub}>{a.sub}</span>
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
    fontSize:     "14px",
    cursor:       "pointer",
    width:        80,
  },
  title: {
    fontSize:   "18px",
    fontWeight: "300",
    color:      "rgba(255,255,255,0.5)",
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
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "14px",
    borderRadius:   "18px",
    background:     "transparent",
    border:         "1px solid rgba(255,255,255,0.1)",
    cursor:         "pointer",
    transition:     "background 0.15s",
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
};
