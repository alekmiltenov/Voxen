import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// ─── constants ───────────────────────────────────────────────────────────────
const CAL_KEY      = "voxen_cal_v2";  // bumped so old broken data is ignored
const ALPHA        = 0.15;   // EMA — faster response
const CAL_SECS     = 4;      // seconds to record per point
const ZONE_FRAMES  = 6;      // consecutive frames needed to confirm a zone change

// Push dots to true screen edges for maximum calibration range
const CAL_PTS = [
  { id: "center", label: "CENTER", x: 50, y: 50 },
  { id: "left",   label: "LEFT",   x: 3,  y: 50 },
  { id: "right",  label: "RIGHT",  x: 97, y: 50 },
  { id: "top",    label: "TOP",    x: 50, y: 3  },
  { id: "bottom", label: "BOTTOM", x: 50, y: 97 },
];

const ZONE_META = {
  LEFT:   { arrow: "←", color: "#a78bfa" },
  RIGHT:  { arrow: "→", color: "#4ade80" },
  TOP:    { arrow: "↑", color: "#5bc8ff" },
  BOTTOM: { arrow: "↓", color: "#ff8c5b" },
  CENTER: { arrow: "·", color: "#facc15" },
};

// ─── iris landmark indices (MediaPipe Face Mesh, refineLandmarks=true) ────────
// left eye (subject's left)
const LI = 468, LO = 33,  LN = 133, LT = 159, LB = 145;
// right eye
const RI = 473, RO = 263, RN = 362, RT = 386, RB = 374;

// ─────────────────────────────────────────────────────────────────────────────
export default function EyeTracking() {
  const navigate = useNavigate();

  const [status,    setStatus]    = useState("loading");  // loading|cal|tracking|error
  const [errMsg,    setErrMsg]    = useState("");
  const [calStep,   setCalStep]   = useState(0);
  const [countdown, setCountdown] = useState(CAL_SECS);
  const [calData,   setCalData]   = useState(() => loadCal());
  const [zone,      setZone]      = useState(null);
  const [ratios,    setRatios]    = useState(null);
  const [faceFound, setFaceFound] = useState(false);
  const [dbg,       setDbg]       = useState("init");

  const videoRef      = useRef(null);
  const faceMeshRef   = useRef(null);
  const smoothRef     = useRef({ h: 0.5, v: 0.5 });
  const calBufRef     = useRef([]);     // collecting samples
  const calDataRef    = useRef(loadCal());
  const collectingRef  = useRef(false);
  const frameCountRef  = useRef(0);
  const zoneHistRef    = useRef([]);   // last N zone readings for stability

  // keep calDataRef in sync
  useEffect(() => { calDataRef.current = calData; }, [calData]);

  // ── init MediaPipe ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.FaceMesh) {
      setErrMsg("MediaPipe FaceMesh not loaded. Check index.html.");
      setStatus("error");
      return;
    }

    let running = true;
    let rafId   = null;
    let stream  = null;

    // video element for the camera preview
    const video = document.createElement("video");
    video.playsInline = true;
    video.muted       = true;
    video.style.cssText = "position:fixed;bottom:10px;right:10px;width:160px;opacity:0.35;border-radius:8px;z-index:999";
    document.body.appendChild(video);
    videoRef.current = video;

    // FaceMesh setup
    const fm = new window.FaceMesh({
      locateFile: (f) => `/face-mesh/${f}`,
    });
    fm.setOptions({
      maxNumFaces:            1,
      refineLandmarks:        true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence:  0.5,
    });
    fm.onResults(onResults);
    faceMeshRef.current = fm;

    // Frame loop using rAF — no Camera utility dependency
    const loop = async () => {
      if (!running) return;
      frameCountRef.current++;
      if (frameCountRef.current % 15 === 0)
        setDbg(`f:${frameCountRef.current}`);
      if (video.readyState >= 2) {
        try { await fm.send({ image: video }); }
        catch (e) { setDbg(`err:${e?.message ?? e}`); }
      }
      rafId = requestAnimationFrame(loop);
    };

    // Start camera via getUserMedia
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then((s) => {
        if (!running) { s.getTracks().forEach(t => t.stop()); return; }
        stream         = s;
        video.srcObject = s;
        return video.play();
      })
      .then(() => {
        if (!running) return;
        setDbg("cam-ok");
        const c = calDataRef.current;
        const complete = c && c.center && c.left && c.right && c.top && c.bottom;
        setStatus(complete ? "tracking" : "cal");
        loop();
      })
      .catch((err) => {
        console.error("Camera failed:", err);
        setErrMsg("Camera failed: " + (err?.message ?? err));
        setStatus("error");
      });

    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach(t => t.stop());
      try { fm.close(); }   catch (_) {}
      try { document.body.removeChild(video); } catch (_) {}
      faceMeshRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── process face mesh results ─────────────────────────────────────────────
  function onResults(results) {
    const faces = results.multiFaceLandmarks;
    if (!faces || faces.length === 0) {
      setFaceFound(false);
      setDbg(prev => prev + " |noface");
      return;
    }
    setDbg(prev => prev.includes("face!") ? prev : prev + " |face!");
    setFaceFound(true);
    const lm = faces[0];

    // Compute iris ratio for each eye: 0 = iris at corner A, 1 = iris at corner B
    const hL = horiz(lm, LI, LO, LN);
    const vL = vert (lm, LI, LT, LB);
    const hR = horiz(lm, RI, RO, RN);
    const vR = vert (lm, RI, RT, RB);

    // Average both eyes
    const rawH = (hL + hR) / 2;
    const rawV = (vL + vR) / 2;

    // EMA smoothing
    const s = smoothRef.current;
    s.h = ALPHA * rawH + (1 - ALPHA) * s.h;
    s.v = ALPHA * rawV + (1 - ALPHA) * s.v;

    setRatios({ h: s.h.toFixed(3), v: s.v.toFixed(3) });

    // Collect RAW (unsmoothed) calibration samples for accuracy
    if (collectingRef.current) {
      calBufRef.current.push({ h: rawH, v: rawV });
    }

    // Zone classification (only if fully calibrated)
    const cal = calDataRef.current;
    const calOk = cal && cal.center && cal.left && cal.right && cal.top && cal.bottom;
    if (calOk) {
      const z = classify(s.h, s.v, cal);

      // Stability filter: only commit to a zone after ZONE_FRAMES consecutive matches
      const hist = zoneHistRef.current;
      hist.push(z);
      if (hist.length > ZONE_FRAMES) hist.shift();
      if (hist.length === ZONE_FRAMES && hist.every(x => x === z)) {
        setZone(z);
      }

      setDbg(`h:${s.h.toFixed(3)} v:${s.v.toFixed(3)} | ${z}`);
    } else {
      setDbg(`h:${s.h.toFixed(3)} v:${s.v.toFixed(3)} | NEEDS CAL`);
    }
  }

  function horiz(lm, iris, a, b) {
    const d = lm[b].x - lm[a].x;
    return Math.abs(d) < 1e-4 ? 0.5 : (lm[iris].x - lm[a].x) / d;
  }
  function vert(lm, iris, a, b) {
    const d = lm[b].y - lm[a].y;
    return Math.abs(d) < 1e-4 ? 0.5 : (lm[iris].y - lm[a].y) / d;
  }

  // ── zone classification ───────────────────────────────────────────────────
  // Does NOT depend on center accuracy — uses midpoint between edge points.
  // Also handles inverted calibration (user had head turned during cal).
  function classify(h, v, cal) {
    const hMid  = (cal.left.h  + cal.right.h)  / 2;
    const vMid  = (cal.top.v   + cal.bottom.v)  / 2;
    const hHalf = Math.abs(cal.right.h - cal.left.h) / 2;
    const vHalf = Math.abs(cal.bottom.v - cal.top.v)  / 2;

    if (hHalf < 0.005 || vHalf < 0.005) return "CENTER";  // bad cal

    // Signed deviation from midpoint, normalised to roughly [-1, +1]
    const hDev = (h - hMid) / hHalf;
    const vDev = (v - vMid) / vHalf;

    const THRESHOLD = 0.35;

    // Direction flags — handle inverted calibration gracefully
    const leftIsLow = cal.left.h <= cal.right.h;
    const topIsLow  = cal.top.v  <= cal.bottom.v;

    // Pick the axis with the stronger signal
    if (Math.abs(hDev) >= Math.abs(vDev)) {
      if (hDev < -THRESHOLD) return leftIsLow ? "LEFT"   : "RIGHT";
      if (hDev >  THRESHOLD) return leftIsLow ? "RIGHT"  : "LEFT";
    } else {
      if (vDev < -THRESHOLD) return topIsLow  ? "TOP"    : "BOTTOM";
      if (vDev >  THRESHOLD) return topIsLow  ? "BOTTOM" : "TOP";
    }
    return "CENTER";
  }

  // ── calibration step logic ────────────────────────────────────────────────
  // Called when we enter "cal" status or advance to the next step
  useEffect(() => {
    if (status !== "cal") return;

    // countdown → record → advance
    setCountdown(CAL_SECS);
    calBufRef.current = [];
    collectingRef.current = false;

    const startDelay = setTimeout(() => {
      // start recording
      collectingRef.current = true;
      calBufRef.current = [];

      let remaining = CAL_SECS;
      const tick = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(tick);
          collectingRef.current = false;

          // median of collected raw samples — robust against blinks/drift
          const buf = calBufRef.current;
          if (buf.length > 0) {
            const sortedH = [...buf.map(d => d.h)].sort((a,b) => a-b);
            const sortedV = [...buf.map(d => d.v)].sort((a,b) => a-b);
            const mid = Math.floor(sortedH.length / 2);
            const avgH = sortedH[mid];
            const avgV = sortedV[mid];
            const id   = CAL_PTS[calStep].id;

            setCalData(prev => {
              const next = { ...prev, [id]: { h: avgH, v: avgV } };
              calDataRef.current = next;
              // if last step, save and go to tracking
              if (calStep === CAL_PTS.length - 1) {
                saveCal(next);
              }
              return next;
            });
          }

          if (calStep < CAL_PTS.length - 1) {
            setCalStep(s => s + 1);
          } else {
            setStatus("tracking");
          }
        }
      }, 1000);

      return () => clearInterval(tick);
    }, 800); // brief pause before recording starts

    return () => clearTimeout(startDelay);
  }, [status, calStep]); // eslint-disable-line react-hooks/exhaustive-deps

  function recalibrate() {
    localStorage.removeItem(CAL_KEY);
    setCalData({});
    calDataRef.current = {};
    setCalStep(0);
    setStatus("cal");
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (status === "loading") return (
    <div style={p.page}>
      <p style={p.big}>Starting camera…</p>
      <p style={p.sub}>Allow camera access in the browser.</p>
    </div>
  );

  if (status === "error") return (
    <div style={p.page}>
      <p style={p.big}>Camera error</p>
      <p style={p.sub}>{errMsg}</p>
      <button onClick={() => navigate("/")} style={p.back}>← Back</button>
    </div>
  );

  // ── CALIBRATION ───────────────────────────────────────────────────────────
  if (status === "cal") {
    const pt = CAL_PTS[calStep];
    const recording = countdown < CAL_SECS && countdown >= 0;
    return (
      <div style={p.page}>
        {/* Only show top bar BEFORE recording starts — hide it during recording so eyes stay on dot */}
        {!recording && (
          <div style={p.calBar}>
            <span style={p.calTitle}>{calStep + 1} / {CAL_PTS.length}</span>
            <span style={p.calSub}>Keep eyes on the dot until it turns yellow</span>
            {!faceFound && <span style={p.noFace}>⚠ No face detected</span>}
          </div>
        )}

        {/* calibration dot — label and countdown are ON the dot so eyes stay there */}
        <div style={{
          ...p.calDot,
          left:       `calc(${pt.x}% - 40px)`,
          top:        `calc(${pt.y}% - 40px)`,
          width: 80, height: 80,
          background: recording ? "rgba(255,255,100,0.25)" : "rgba(255,255,255,0.08)",
          border:     `3px solid ${recording ? "#facc15" : "rgba(255,255,255,0.5)"}`,
          boxShadow:  recording ? "0 0 40px rgba(250,204,21,0.6)" : "0 0 16px rgba(255,255,255,0.15)",
          flexDirection: "column", gap: 2,
        }}>
          <span style={{ fontSize: recording ? 26 : 11, fontWeight: 600,
            color: recording ? "#facc15" : "rgba(255,255,255,0.6)" }}>
            {recording ? countdown : pt.label}
          </span>
          {!recording && (
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>
              LOOK HERE
            </span>
          )}
        </div>

        {/* progress pills */}
        <div style={p.pills}>
          {CAL_PTS.map((cp, i) => (
            <div key={cp.id} style={{
              ...p.pill,
              background: i < calStep  ? "rgba(74,222,128,0.3)"
                        : i === calStep ? "rgba(250,204,21,0.3)"
                        : "rgba(255,255,255,0.05)",
              border: `1px solid ${i < calStep ? "#4ade80" : i === calStep ? "#facc15" : "rgba(255,255,255,0.15)"}`,
              color:  i < calStep ? "#4ade80" : i === calStep ? "#facc15" : "rgba(255,255,255,0.3)",
            }}>
              {cp.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── TRACKING ──────────────────────────────────────────────────────────────
  const zm = zone ? ZONE_META[zone] : null;
  return (
    <div style={{ ...p.page, background: zm ? `${zm.color}10` : "#111111" }}>
      <button onClick={() => navigate("/")} style={p.back}>← Back</button>
      <button onClick={recalibrate} style={p.recal}>↺ Recalibrate</button>

      {!faceFound && <div style={p.warn}>⚠ No face detected</div>}

      {/* big zone display */}
      <div style={p.zoneBox}>
        <span style={{ ...p.arrow, color: zm?.color ?? "rgba(255,255,255,0.12)" }}>
          {zm?.arrow ?? "·"}
        </span>
        <span style={{ ...p.zoneLabel, color: zm?.color ?? "rgba(255,255,255,0.15)" }}>
          {zone ?? "…"}
        </span>
      </div>

      {/* 3×3 map */}
      <div style={p.map}>
        {[
          [null,   "TOP",    null   ],
          ["LEFT", "CENTER", "RIGHT"],
          [null,   "BOTTOM", null   ],
        ].flat().map((name, i) => (
          <div key={i} style={{
            ...p.cell,
            background: name && zone === name ? `${ZONE_META[name].color}28` : "rgba(255,255,255,0.03)",
            border:     `1px solid ${name && zone === name ? ZONE_META[name].color : "rgba(255,255,255,0.07)"}`,
            color:      name && zone === name ? ZONE_META[name].color : "rgba(255,255,255,0.15)",
          }}>
            {name ?? ""}
          </div>
        ))}
      </div>

      <p style={p.debug}>
        {ratios ? `h: ${ratios.h}  v: ${ratios.v}  |  ` : ""}{dbg}
      </p>
    </div>
  );
}

// ── persistence ───────────────────────────────────────────────────────────────
function loadCal() {
  try {
    const d = JSON.parse(localStorage.getItem(CAL_KEY));
    if (!d) return {};
    // Validate all 5 points exist with h/v values
    const ok = ["center","left","right","top","bottom"].every(
      k => d[k] && typeof d[k].h === "number" && typeof d[k].v === "number"
    );
    if (!ok) { localStorage.removeItem(CAL_KEY); return {}; }
    return d;
  } catch { return {}; }
}
function saveCal(data) {
  localStorage.setItem(CAL_KEY, JSON.stringify(data));
}

// ── styles ────────────────────────────────────────────────────────────────────
const p = {
  page: {
    width: "100vw", height: "100vh", background: "#111111",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden", transition: "background 0.25s",
  },
  big:  { fontSize: "22px", fontWeight: 300, color: "rgba(255,255,255,0.7)", margin: 0 },
  sub:  { fontSize: "14px", color: "rgba(255,255,255,0.3)", marginTop: 10 },
  back: {
    position: "fixed", top: 20, left: 20,
    padding: "8px 18px", borderRadius: "20px", background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.35)",
    fontSize: "13px", cursor: "pointer",
  },
  recal: {
    position: "fixed", top: 20, right: 20,
    padding: "8px 18px", borderRadius: "20px", background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.35)",
    fontSize: "13px", cursor: "pointer",
  },
  warn: {
    position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)",
    padding: "6px 14px", borderRadius: "8px",
    background: "rgba(255,150,0,0.15)", border: "1px solid rgba(255,150,0,0.4)",
    color: "rgba(255,180,0,0.9)", fontSize: "13px",
  },
  // calibration
  calBar: {
    position: "fixed", top: 0, left: 0, right: 0,
    padding: "20px 32px", display: "flex", alignItems: "center", gap: 20,
    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
  },
  calTitle: { fontSize: "14px", color: "rgba(255,255,255,0.6)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" },
  calSub:   { fontSize: "14px", color: "rgba(255,255,255,0.3)" },
  noFace:   { marginLeft: "auto", fontSize: "13px", color: "rgba(255,150,0,0.8)" },
  calDot: {
    position: "fixed", width: 64, height: 64, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.3s", pointerEvents: "none",
  },
  pills: {
    position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
    display: "flex", gap: 8,
  },
  pill: {
    padding: "6px 14px", borderRadius: "20px",
    fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
  },
  // tracking
  zoneBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 6, marginBottom: 36,
  },
  arrow:     { fontSize: "90px", lineHeight: 1, transition: "color 0.1s" },
  zoneLabel: { fontSize: "54px", fontWeight: 200, letterSpacing: "0.18em", transition: "color 0.1s" },
  map: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 96px)",
    gridTemplateRows:    "repeat(3, 56px)",
    gap: 6,
  },
  cell: {
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "8px", fontSize: "11px",
    letterSpacing: "0.1em", fontWeight: 500, transition: "all 0.1s",
  },
  debug: {
    position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
    margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.15)", fontVariantNumeric: "tabular-nums",
  },
};
