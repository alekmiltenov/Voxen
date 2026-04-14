import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useInputControl } from "./InputControlContextV2";

const BODY_PARTS = [
  { id: "head", label: "Head", speech: "My head hurts", shape: { top: "2%", left: "40%", width: "20%", height: "18%", borderRadius: "999px" } },
  { id: "neck", label: "Neck", speech: "My neck hurts", shape: { top: "20%", left: "45%", width: "10%", height: "4%", borderRadius: "8px 8px 0px 0px" } },
  { id: "left-arm", label: "L arm", speech: "My left arm hurts", shape: { top: "24%", left: "20%", width: "12%", height: "35%", borderRadius: "14px 0px 14px 14px" } },
  { id: "chest", label: "Chest", speech: "My chest hurts", shape: { top: "24%", left: "32%", width: "36%", height: "18%", borderRadius: "0px 0px 14px 14px" } },
  { id: "right-arm", label: "R arm", speech: "My right arm hurts", shape: { top: "24%", left: "68%", width: "12%", height: "35%", borderRadius: "0px 14px 14px 14px" } },
  { id: "stomach", label: "Stomach", speech: "My stomach hurts", shape: { top: "42%", left: "35%", width: "30%", height: "12%", borderRadius: "0px" } },
  { id: "back", label: "Back", speech: "My back hurts", shape: { top: "54%", left: "35%", width: "30%", height: "8%", borderRadius: "0px 0px 0px 0px" } },
  { id: "left-leg", label: "L leg", speech: "My left leg hurts", shape: { top: "62%", left: "35%", width: "12%", height: "34%", borderRadius: "0px 0px 12px 12px" } },
  { id: "right-leg", label: "R leg", speech: "My right leg hurts", shape: { top: "62%", left: "53%", width: "12%", height: "34%", borderRadius: "0px 0px 12px 12px" } },
];

const QUICK_OPTIONS = [
  { id: "medication", label: "Medication", speech: "I need medication", tone: "neutral" },
  { id: "reposition", label: "Reposition", speech: "Please help me reposition", tone: "neutral" },
  { id: "emergency", label: "Emergency", speech: "Emergency. Please help me now", tone: "danger" },
];

const ITEMS = [
  ...BODY_PARTS.map((part) => ({
    id: part.id,
    type: "body",
    label: part.label,
    speech: part.speech,
  })),
  ...QUICK_OPTIONS.map((option) => ({
    id: option.id,
    type: "quick",
    label: option.label,
    speech: option.speech,
    tone: option.tone,
  })),
];

const ITEM_INDEX = Object.fromEntries(ITEMS.map((item, idx) => [item.id, idx]));

export default function Pain() {
  const navigate = useNavigate();
  const { mode, enabled, register, unregister } = useInputControl();

  const [selIdx, setSelIdx] = useState(0);
  const [status, setStatus] = useState(null);
  const selRef = useRef(0);
  const dwellRef = useRef({ idx: null, start: 0, fired: false });

  const setSel = (next) => {
    selRef.current = next;
    setSelIdx(next);
  };

  const speak = useCallback((text) => {
    if (!text) return;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }, []);

  const fireSelection = useCallback(async (item) => {
    if (!item) return;

    setStatus(null);
    speak(item.speech);

    if (item.id === "emergency") {
      try {
        const res = await apiPost("/actions/execute", { action: 2 });
        setStatus({ ok: true, msg: res.message ?? "Emergency alert sent" });
      } catch (e) {
        setStatus({ ok: false, msg: e.message ?? "Emergency alert failed" });
      }
    } else {
      setStatus({ ok: true, msg: item.type === "body" ? `${item.label} selected` : `${item.label} requested` });
    }

    setTimeout(() => setStatus(null), 2500);
  }, [speak]);

  useEffect(() => {
    register((cmd) => {
      const total = ITEMS.length;
      const current = selRef.current;

      if (mode === "head") {
        if (cmd === "LEFT") setSel((current - 1 + total) % total);
        if (cmd === "RIGHT") setSel((current + 1) % total);
        if (cmd === "FORWARD") fireSelection(ITEMS[current]);
        if (cmd === "BACK") navigate(-1);
        return;
      }

      let next = current;
      if (cmd === "UP" || cmd === "LEFT") next = (current - 1 + total) % total;
      if (cmd === "DOWN" || cmd === "RIGHT") next = (current + 1) % total;

      if (next !== current) setSel(next);

      const dwell = dwellRef.current;
      if (dwell.idx === next && !dwell.fired) {
        if (Date.now() - dwell.start >= 1800) {
          dwell.fired = true;
          fireSelection(ITEMS[next]);
        }
      } else if (dwell.idx !== next) {
        dwellRef.current = { idx: next, start: Date.now(), fired: false };
      }

      if (cmd === "FORWARD") fireSelection(ITEMS[current]);
      if (cmd === "BACK") navigate(-1);
    });

    return () => unregister();
  }, [fireSelection, mode, navigate, register, unregister]);

  const isEyeLike = mode === "eyes" || mode === "cnn";

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.title}>Pain & comfort</span>
        {status && (
          <div
            style={{
              ...s.toast,
              position: "absolute",
              top: "50%",
              right: 0,
              transform: "translateY(-50%)",
              borderColor: status.ok ? "rgba(255,255,255,0.18)" : "rgba(255,90,90,0.45)",
              color: status.ok ? "rgba(255,255,255,0.75)" : "rgba(255,120,120,0.9)",
            }}
          >
            {status.msg}
          </div>
        )}
      </div>

      <div style={s.content}>
        <div style={s.bodyCanvas}>
          {BODY_PARTS.map((part) => {
              const idx = ITEM_INDEX[part.id];
              const isSelected = enabled && selIdx === idx;

              return (
                <button
                  key={part.id}
                  style={{
                    ...s.hotspot,
                    ...part.shape,
                    fontSize: part.id === "neck" ? "clamp(11px, 1.1vw, 15px)" : s.hotspot.fontSize,
                    border: "none",
                    background: isSelected ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.45)",
                    boxShadow: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                      const span = e.currentTarget.querySelector('span');
                      if (span) span.style.opacity = "1";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                      const span = e.currentTarget.querySelector('span');
                      if (span) span.style.opacity = "0";
                    }
                  }}
                  onClick={() => fireSelection(ITEMS[idx])}
                >
                  <span style={{ opacity: isSelected ? 1 : 0, transition: 'opacity 0.2s' }}>
                    {part.label}
                  </span>
                </button>
              );
            })}
          </div>

        <div style={s.quickCol}>
          {QUICK_OPTIONS.map((option) => {
            const idx = ITEM_INDEX[option.id];
            const isSelected = enabled && selIdx === idx;
            const isDanger = option.tone === "danger";

            return (
              <button
                key={option.id}
                style={{
                  ...s.quickBtn,
                  borderColor: isSelected
                    ? isDanger ? "rgba(210,70,70,0.9)" : "rgba(255,255,255,0.58)"
                    : isDanger ? "rgba(125,45,45,0.8)" : "rgba(255,255,255,0.12)",
                  background: isSelected
                    ? isDanger ? "rgba(90,20,20,0.62)" : "rgba(255,255,255,0.14)"
                    : isDanger ? "rgba(40,12,12,0.92)" : "rgba(255,255,255,0.04)",
                  color: isSelected
                    ? isDanger ? "rgba(255,150,150,1)" : "rgba(255,255,255,0.95)"
                    : isDanger ? "rgba(240,120,120,0.92)" : "rgba(255,255,255,0.8)",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isDanger ? "rgba(70,18,18,0.95)" : "rgba(255,255,255,0.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isDanger ? "rgba(40,12,12,0.92)" : "rgba(255,255,255,0.04)";
                  }
                }}
                onClick={() => fireSelection(ITEMS[idx])}
              >
                {option.label}
              </button>
            );
          })}
          <button
            style={{
              ...s.quickBtn,
              borderColor: "rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.8)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
        </div>
      </div>

      {enabled && (
        <p style={s.legend}>
          {mode === "head"
            ? "LEFT / RIGHT navigate · FORWARD select · BACK home"
            : isEyeLike
              ? "UP / DOWN / LEFT / RIGHT navigate · FORWARD or dwell to select"
              : "Input control enabled"}
        </p>
      )}
    </div>
  );
}

const s = {
  page: {
    width: "100vw",
    height: "100vh",
    background: "#0c0c0c",
    color: "white",
    display: "flex",
    flexDirection: "column",
    padding: "24px 30px",
    gap: "16px",
    overflow: "hidden",
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
    borderRadius: "20px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.35)",
    fontSize: "13px",
    cursor: "pointer",
  },
  title: {
    fontSize: "18px",
    fontWeight: 300,
    color: "rgba(255,255,255,0.58)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  toast: {
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px solid",
    background: "rgba(255,255,255,0.04)",
    fontSize: "14px",
    textAlign: "center",
  },
  content: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "28px",
  },
  bodyCard: {
    width: "min(52vw, 380px)",
    height: "min(78vh, 620px)",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.02)",
    padding: "18px",
  },
  bodyCanvas: {
    position: "relative",
    width: "min(52vw, 380px)",
    height: "min(78vh, 620px)",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  labelsSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  },
  hotspot: {
    position: "absolute",
    border: "1px solid",
    fontSize: "clamp(12px, 1.4vw, 18px)",
    fontWeight: 300,
    letterSpacing: "0.01em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textTransform: "lowercase",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s, color 0.15s",
  },
  quickCol: {
    width: "min(37vw, 267px)",
    marginleft: "1.5vw",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  quickBtn: {
    minHeight: "70px",
    borderRadius: "14px",
    border: "1px solid",
    fontSize: "22px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    textAlign: "left",
    padding: "0 20px",
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s, color 0.15s",
  },
  legend: {
    margin: 0,
    textAlign: "center",
    fontSize: "12px",
    color: "rgba(255,255,255,0.2)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
};