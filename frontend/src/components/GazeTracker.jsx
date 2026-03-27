import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getDwellMs, getGazeStability } from "../utils/settings";

const STORAGE_KEY = "voxen_eye_enabled";
const ALPHA = 0.25; // EMA smoothing — lower = smoother but more lag
const getTimestamp = () => Date.now();

export default function GazeTracker() {
  const navigate = useNavigate();

  const [enabled,       setEnabled]       = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [status,        setStatus]        = useState("idle");
  const [gazePos,       setGazePos]       = useState(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [gazedRect,     setGazedRect]     = useState(null);  // bounding rect of hovered btn
  const [gazedRadius,   setGazedRadius]   = useState("0px");

  // refs — used inside WebGazer listener / rAF (no stale-closure issues)
  const smoothRef    = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const enabledRef   = useRef(enabled);
  const gazedBtnRef  = useRef(null);   // button currently being dwelled
  const stableRef    = useRef({ btn: null, frames: 0 }); // stability counter
  const dwellRafRef  = useRef(null);
  const dwellStartRef = useRef(null);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // ── dwell animation loop ─────────────────────────────────────────────────
  const stopDwell = useCallback(() => {
    cancelAnimationFrame(dwellRafRef.current);
    gazedBtnRef.current  = null;
    dwellStartRef.current = null;
    setDwellProgress(0);
    setGazedRect(null);
  }, []);

  const startDwell = useCallback((btn) => {
    if (gazedBtnRef.current === btn) return; // already running for this button
    stopDwell();
    gazedBtnRef.current = btn;
    dwellStartRef.current = getTimestamp();

    const r      = btn.getBoundingClientRect();
    const radius = window.getComputedStyle(btn).borderRadius;
    setGazedRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setGazedRadius(radius || "0px");

    function tick() {
      if (!gazedBtnRef.current) return;
      const elapsed = getTimestamp() - dwellStartRef.current;
      const prog    = Math.min(elapsed / getDwellMs(), 1);

      // Update overlay rect in case layout shifted
      const rr = gazedBtnRef.current.getBoundingClientRect();
      setGazedRect({ top: rr.top, left: rr.left, width: rr.width, height: rr.height });
      setDwellProgress(prog);

      if (prog < 1) {
        dwellRafRef.current = requestAnimationFrame(tick);
      } else {
        const btn = gazedBtnRef.current;
        stopDwell();
        btn?.click();
      }
    }
    dwellRafRef.current = requestAnimationFrame(tick);
  }, [stopDwell]);

  function tryEnd() {
    if (window.webgazer) try { window.webgazer.end(); } catch (_){ void _; }
  }

  function injectHideCSS() {
    if (document.getElementById("voxen-hide-webgazer")) return;
    const style = document.createElement("style");
    style.id    = "voxen-hide-webgazer";
    style.textContent = `
      #webgazerVideoContainer, #webgazerFaceOverlay,
      #webgazerFaceFeedbackBox, #webgazerVideoFeed,
      #webgazerFaceOverlayCanvas { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  // ── WebGazer lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      tryEnd();
      queueMicrotask(() => {
        stopDwell();
        setGazePos(null);
        setStatus("idle");
      });
      return;
    }

    queueMicrotask(() => setStatus("loading"));
    injectHideCSS();

    function startGazer() {
      try {
        window.webgazer
          .setRegression("ridge")
          .saveDataAcrossSessions(true)
          .setGazeListener((data) => {
            if (!data || !enabledRef.current) return;
            const s = smoothRef.current;
            s.x = ALPHA * data.x + (1 - ALPHA) * s.x;
            s.y = ALPHA * data.y + (1 - ALPHA) * s.y;
            setGazePos({ x: Math.round(s.x), y: Math.round(s.y) });
            const el  = document.elementFromPoint(s.x, s.y);
            const btn = el?.closest("button") ?? null;
            const target = (btn && !btn.disabled && !btn.dataset.gazeControl) ? btn : null;
            const stable = stableRef.current;
            if (target === stable.btn) {
              stable.frames++;
            } else {
              stable.btn    = target;
              stable.frames = 1;
              stopDwell();
            }
            if (target && stable.frames >= getGazeStability()) {
              startDwell(target);
            }
          });

        const result = window.webgazer.begin();
        const afterBegin = () => {
          try { window.webgazer.showVideoPreview(false); }     catch (_){ void _; }
          try { window.webgazer.showPredictionPoints(false); } catch (_){ void _; }
          try { window.webgazer.addMouseEventListeners(); }    catch (_){ void _; }
          injectHideCSS();
          setStatus("active");
        };
        if (result?.then) result.then(afterBegin).catch(() => setStatus("error"));
        else              setTimeout(afterBegin, 800);
      } catch (err) {
        console.error("WebGazer:", err);
        setStatus("error");
      }
    }

    if (window.webgazer) {
      startGazer();
    } else {
      const script   = document.createElement("script");
      script.src     = "https://webgazer.cs.brown.edu/webgazer.js";
      script.async   = true;
      script.onload  = startGazer;
      script.onerror = () => setStatus("error");
      document.head.appendChild(script);
    }

    return () => { tryEnd(); stopDwell(); };
  }, [enabled, stopDwell, startDwell]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  const isActive = enabled && status === "active";
  const BG = { idle:"rgba(255,255,255,0.04)", loading:"rgba(255,200,50,0.14)",
               active:"rgba(80,220,120,0.14)", error:"rgba(255,80,80,0.14)" };
  const BD = { idle:"rgba(255,255,255,0.1)",  loading:"rgba(255,200,50,0.5)",
               active:"rgba(80,220,120,0.55)", error:"rgba(255,80,80,0.5)" };

  return (
    <>
      {/* ── gaze dot ── */}
      {isActive && gazePos && (
        <div style={{
          position: "fixed", pointerEvents: "none", zIndex: 9999,
          left: gazePos.x - 8, top: gazePos.y - 8,
          width: 16, height: 16, borderRadius: "50%",
          background: "rgba(255,255,255,0.6)",
          boxShadow: "0 0 8px rgba(255,255,255,0.4)",
        }} />
      )}

      {/* ── dwell overlay on top of the hovered button ── */}
      {isActive && gazedRect && (
        <div style={{
          position:      "fixed",
          left:          gazedRect.left,
          top:           gazedRect.top,
          width:         gazedRect.width,
          height:        gazedRect.height,
          borderRadius:  gazedRadius,
          border:        "2px solid rgba(255,255,255,0.85)",
          pointerEvents: "none",
          zIndex:        9998,
          overflow:      "hidden",
        }}>
          {/* brightening overlay */}
          <div style={{
            position:   "absolute", inset: 0,
            background: `rgba(255,255,255,${dwellProgress * 0.18})`,
            borderRadius: "inherit",
          }} />
          {/* fill bar sweeping from bottom */}
          <div style={{
            position:   "absolute",
            bottom: 0, left: 0,
            width:  "100%",
            height: `${dwellProgress * 100}%`,
            background: `rgba(255,255,255,${0.08 + dwellProgress * 0.12})`,
          }} />
          {/* bottom edge progress line */}
          <div style={{
            position:   "absolute",
            bottom: 0, left: 0,
            height: "3px",
            width:  `${dwellProgress * 100}%`,
            background: "rgba(255,255,255,0.95)",
            transition: "none",
          }} />
        </div>
      )}

      {/* ── 👁 toggle ── */}
      <button
        data-gaze-control="true"
        onClick={toggle}
        title={enabled ? "Disable eye tracking" : "Enable eye tracking"}
        style={{
          position: "fixed", bottom: 20, right: 20,
          width: 48, height: 48, borderRadius: "50%",
          background: BG[status], border: `1.5px solid ${BD[status]}`,
          cursor: "pointer", zIndex: 10000, fontSize: "20px",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.25s, border-color 0.25s",
        }}
      >
        👁
      </button>

      {/* ── calibrate / settings ── */}
      {isActive && (
        <div style={{
          position: "fixed", bottom: 74, right: 12, zIndex: 10000,
          display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end",
        }}>
          <button data-gaze-control="true" onClick={() => navigate("/calibrate")} style={ctrlBtn}>calibrate</button>
          <button data-gaze-control="true" onClick={() => navigate("/settings")}   style={ctrlBtn}>settings</button>
        </div>
      )}
    </>
  );
}

const ctrlBtn = {
  padding: "4px 10px", borderRadius: "10px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.4)", fontSize: "11px",
  cursor: "pointer", letterSpacing: "0.05em",
};
