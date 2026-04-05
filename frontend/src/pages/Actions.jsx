import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useInputControl } from "./InputControlContext";

const ACTIONS = [
  { id: 2, label: "Emergency", sub: "Immediate alert" },
  { id: 1, label: "Call caregiver", sub: "Start a call with your caregiver" },
  //This button is styled as Food & Water but currently routes to AI Chat.
  { id: 3, label: "Food & water (-> AI chat for now)", sub: "Choose what you'd like to drink or eat" },
  { id: 4, label: "Pain & comfort", sub: "Locate pain or comfort need" },
];

const HINTS_HEAD = ["← ↑", "→ ↑", "← ↓", "→ ↓"];
const HINTS_EYES = ["↑←", "↑→", "↓←", "↓→"];

const CARD_THEME = {
  2: {
    border: "#3a1010",
    hoverBorder: "#6b2020",
    hoverBg: "#130a0a",
    title: "#e05555",
  },
  1: {
    border: "#1e1e1e",
    hoverBorder: "#505050",
    hoverBg: "#222222",
    title: "#e0e0e0",
  },
  3: {
    border: "#1e1e1e",
    hoverBorder: "#505050",
    hoverBg: "#222222",
    title: "#e0e0e0",
  },
  4: {
    border: "#1e1e1e",
    hoverBorder: "#505050",
    hoverBg: "#222222",
    title: "#e0e0e0",
  },
};

function ActionIcon({ id }) {
  if (id === 2) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#c0392b"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="36"
        height="36"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }

  if (id === 1) {
    return (
      <svg viewBox="0 0 32 32" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <path d="M23.407 30.394c-2.431 0-8.341-3.109-13.303-9.783-4.641-6.242-6.898-10.751-6.898-13.785 0-2.389 1.65-3.529 2.536-4.142l0.219-0.153c0.979-0.7 2.502-0.927 3.086-0.927 1.024 0 1.455 0.599 1.716 1.121 0.222 0.442 2.061 4.39 2.247 4.881 0.286 0.755 0.192 1.855-0.692 2.488l-0.155 0.108c-0.439 0.304-1.255 0.869-1.368 1.557-0.055 0.334 0.057 0.684 0.342 1.068 1.423 1.918 5.968 7.55 6.787 8.314 0.642 0.6 1.455 0.685 2.009 0.218 0.573-0.483 0.828-0.768 0.83-0.772l0.059-0.057c0.048-0.041 0.496-0.396 1.228-0.396 0.528 0 1.065 0.182 1.596 0.541 1.378 0.931 4.487 3.011 4.487 3.011l0.050 0.038c0.398 0.341 0.973 1.323 0.302 2.601-0.695 1.327-2.85 4.066-5.079 4.066zM9.046 2.672c-0.505 0-1.746 0.213-2.466 0.728l-0.232 0.162c-0.827 0.572-2.076 1.435-2.076 3.265 0 2.797 2.188 7.098 6.687 13.149 4.914 6.609 10.532 9.353 12.447 9.353 1.629 0 3.497-2.276 4.135-3.494 0.392-0.748 0.071-1.17-0.040-1.284-0.36-0.241-3.164-2.117-4.453-2.988-0.351-0.238-0.688-0.358-0.999-0.358-0.283 0-0.469 0.1-0.532 0.14-0.104 0.111-0.39 0.405-0.899 0.833-0.951 0.801-2.398 0.704-3.424-0.254-0.923-0.862-5.585-6.666-6.916-8.459-0.46-0.62-0.641-1.252-0.538-1.877 0.187-1.133 1.245-1.866 1.813-2.26l0.142-0.099c0.508-0.363 0.4-1.020 0.316-1.242-0.157-0.414-1.973-4.322-2.203-4.781-0.188-0.376-0.336-0.533-0.764-0.533z" fill="#888888" />
      </svg>
    );
  }

  if (id === 3) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#888888"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="36"
        height="36"
      >
        <path d="M18 8h1a4 4 0 010 8h-1" />
        <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#888888"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="36"
      height="36"
    >
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

export default function Actions() {
  const navigate = useNavigate();
  const { mode, enabled, register, unregister } = useInputControl();

  const [status,  setStatus]  = useState(null);
  const [selIdx,  setSelIdx]  = useState(0);
  const selRef = useRef(0);
  const setSel = (v) => { selRef.current = v; setSelIdx(v); };

  const runAction = async (id) => {
    setStatus(null);
    if (id === 3) { navigate("/ai-chat"); return; }
    if (id === 4) { navigate("/pain"); return; }
    try {
      const res = await apiPost("/actions/execute", { action: id });
      setStatus({ msg: res.message ?? "Done", ok: true });
    } catch (e) {
      setStatus({ msg: e.message, ok: false });
    }
    setTimeout(() => setStatus(null), 3000);
  };

  const dwellRef = useRef({ idx: null, start: 0, fired: false });

  useEffect(() => {
    register((cmd) => {
      if (mode === "head") {
        if (cmd === "LEFT")    setSel(Math.max(0, selRef.current - 1));
        if (cmd === "RIGHT")   setSel(Math.min(ACTIONS.length - 1, selRef.current + 1));
        if (cmd === "FORWARD") runAction(ACTIONS[selRef.current].id);
        if (cmd === "BACK")    navigate("/");
      } else {
        // eyes: 2D grid nav with dwell-to-confirm
        const cur = selRef.current;
        let newIdx = cur;

        if (cmd === "UP")    newIdx = cur >= 2 ? cur - 2 : cur;
        if (cmd === "DOWN")  newIdx = cur < 2 ? cur + 2 : cur;
        if (cmd === "LEFT")  newIdx = cur % 2 === 1 ? cur - 1 : cur;
        if (cmd === "RIGHT") newIdx = cur % 2 === 0 && cur + 1 < ACTIONS.length ? cur + 1 : cur;

        setSel(newIdx);

        // dwell: if same item stays selected for 2s, confirm it
        const d = dwellRef.current;
        if (d.idx === newIdx && !d.fired) {
          if (Date.now() - d.start >= 2000) {
            d.fired = true;
            runAction(ACTIONS[newIdx].id);
          }
        } else if (d.idx !== newIdx) {
          dwellRef.current = { idx: newIdx, start: Date.now(), fired: false };
        }

        if (cmd === "FORWARD") runAction(ACTIONS[selRef.current].id);
      }
    });
    return () => unregister();
  }, [mode]);

  const isEyes = mode === "eyes";

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate("/")}>← Back</button>
        <span style={s.title}>Actions</span>
      </div>

      {status && (
        <div style={{
          ...s.toast,
          borderColor: status.ok ? "rgba(255,255,255,0.15)" : "rgba(255,80,80,0.4)",
          opacity: status.ok ? 0.7 : 0.9,
        }}>
          {status.msg}
        </div>
      )}

      <div style={s.grid}>
        {ACTIONS.map((a, i) => {
          const isSelected = enabled && selIdx === i;
          const theme = CARD_THEME[a.id] ?? CARD_THEME[3];
          return (
            <button
              key={a.id}
              style={{
                ...s.card,
                borderColor: isSelected ? theme.hoverBorder : theme.border,
                background: isSelected ? theme.hoverBg : "#0f0f0f",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = theme.hoverBorder;
                  e.currentTarget.style.background = theme.hoverBg;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = theme.border;
                  e.currentTarget.style.background = "#0f0f0f";
                }
              }}
              onClick={() => runAction(a.id)}
            >
              <div style={s.iconBox}><ActionIcon id={a.id} /></div>
              <span style={{ ...s.label, color: theme.title }}>{a.label}</span>
              <span style={s.sub}>{a.sub}</span>
              {enabled && <span style={s.hint}>{isEyes ? HINTS_EYES[i] : HINTS_HEAD[i]}</span>}
            </button>
          );
        })}
      </div>

      {enabled && (
        <p style={s.legend}>
          {isEyes
            ? "UP / DOWN / LEFT / RIGHT · navigate     HOLD to confirm"
            : "LEFT / RIGHT · navigate     FORWARD · run     BACK · home"}
        </p>
      )}
    </div>
  );
}

const s = {
  page: {
    width: "100vw", height: "100vh", background: "#111111",
    display: "flex", flexDirection: "column", padding: "28px 32px", gap: "21px",
  },
  header: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    minHeight: "34px",
  },
  backBtn: {
    position: "absolute",
    top: "50%",
    left: 0,
    transform: "translateY(-50%)",
    padding: "8px 18px", borderRadius: "20px", background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)",
    fontSize: "13px", cursor: "pointer",
    zIndex: 2,
  },
  title: {
    fontSize: "18px", fontWeight: "300", color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em", textTransform: "uppercase",
  },
  toast: {
    padding: "12px 20px", borderRadius: "12px", border: "1px solid",
    color: "rgba(255,255,255,0.7)", fontSize: "15px", textAlign: "center",
  },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", flex: 1 },
  card: {
    position: "relative", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: "14px",
    borderRadius: "14px", border: "1px solid", cursor: "pointer",
    padding: "28px 20px", minHeight: "140px", background: "#0f0f0f",
    transition: "border-color 0.15s, background 0.15s", overflow: "hidden",
  },
  iconBox: {
    width: "44px", height: "44px", display: "flex",
    alignItems: "center", justifyContent: "center",
  },
  label: { fontSize: "20px", fontWeight: "400" },
  sub: { fontSize: "12px", color: "#555555", textAlign: "center" },
  hint: { fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" },
  legend: {
    textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.18)",
    letterSpacing: "0.06em", margin: 0, textTransform: "uppercase",
  },
};
