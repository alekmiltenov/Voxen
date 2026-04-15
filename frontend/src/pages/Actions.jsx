import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useInputControl } from "./InputControlContextV2";

const ACTIONS = [
  { id: 2, label: "Emergency", sub: "Immediate alert" },
  { id: 4, label: "Pain & comfort", sub: "Locate pain or comfort need" },
  { id: 1, label: "Food & water", sub: "Choose what you'd like to drink or eat" },
  { id: 3, label: "AI chat", sub: "Ask anything, talk freely" },
];

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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
    if (id === 1) return;  // Call caregiver disabled
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
        if (cmd === "FORWARD" && ACTIONS[selRef.current].id !== 1) runAction(ACTIONS[selRef.current].id);
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
            if (ACTIONS[newIdx].id !== 1) runAction(ACTIONS[newIdx].id);
          }
        } else if (d.idx !== newIdx) {
          dwellRef.current = { idx: newIdx, start: Date.now(), fired: false };
        }

        if (cmd === "FORWARD" && ACTIONS[selRef.current].id !== 1) runAction(ACTIONS[selRef.current].id);
      }
    });
    return () => unregister();
  }, [mode]);

  const isEyes = mode === "eyes";

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button
          style={{
            ...s.backBtn,
            borderColor: "#1e1e1e",
            background: "#0f0f0f",
            color: "rgb(224 224 224)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#505050";
            e.currentTarget.style.background = "#222222";
            e.currentTarget.style.color = "rgb(224 224 224)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#1e1e1e";
            e.currentTarget.style.background = "#0f0f0f";
            e.currentTarget.style.color = "rgb(224 224 224)";
          }}
          onClick={() => navigate("/")}
        >
          ← Back
        </button>
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
              onClick={() => a.id !== 1 && runAction(a.id)}
            >
              <div style={s.iconBox}><ActionIcon id={a.id} /></div>
              <span style={{ ...s.label, color: theme.title }}>{a.label}</span>
              <span style={s.sub}>{a.sub}</span>
            </button>
          );
        })}
      </div>

      {/*
      {enabled && (
        <p style={s.legend}>
          Navigation controls enabled
        </p>
      )}
      */}
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
    padding: "8px 18px",
    borderRadius: "10px",
    border: "1px solid",
    fontSize: "17px",
    fontWeight: 400,
    cursor: "pointer",
    zIndex: 2,
    transition: "background 0.15s, border-color 0.15s, color 0.15s",
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
