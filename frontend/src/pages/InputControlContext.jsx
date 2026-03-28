import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { getClosedMs } from "../utils/settings";

// ── Server addresses ──────────────────────────────────────────────────────────
const HEAD_SERVER = "http://10.237.97.128:5000";
const NN_SERVER   = "http://localhost:8000";

// ── MediaPipe constants ───────────────────────────────────────────────────────
const MODEL_URL          = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const AUTO_CENTER_FRAMES = 90;
const DWELL_CONFIRM_MS   = 1500;

// ── Shared timing constants ───────────────────────────────────────────────────
const AUTO_REPEAT_MS  = 1200;  // repeat while holding direction

// ── CNN constants ─────────────────────────────────────────────────────────────
const CONF_THRESHOLD = 0.65;   // higher = less noise
const DEBOUNCE_MS    = 500;    // direction must hold for 500 ms before firing

// ── Context ───────────────────────────────────────────────────────────────────
const InputControlContext = createContext(null);

export function InputControlProvider({ children }) {
  // "off" | "head" | "eyes" | "cnn"
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem("controlMode") || "off"; } catch { return "off"; }
  });

  const enabled = mode !== "off";

  // ── Head settings ────────────────────────────────────────────────────────
  const [holdDuration, setHoldDuration] = useState(500);
  const [sensorSettings, setSensorSettings] = useState({
    alpha: 0.5, threshold: 1.5, deadzone: 1.0,
  });

  // ── MediaPipe eye states ─────────────────────────────────────────────────
  const [eyeReady,    setEyeReady]    = useState(false);
  const [eyeCentered, setEyeCentered] = useState(false);
  const [eyeTracking, setEyeTracking] = useState(false);

  // ── CNN eye states ───────────────────────────────────────────────────────
  const [cnnReady,  setCnnReady]  = useState(false);
  const [gazeLabel, setGazeLabel] = useState("—");

  // ── Shared refs ──────────────────────────────────────────────────────────
  const modeRef         = useRef(mode);
  const handlerRef      = useRef(null);
  const holdRef         = useRef({ cmd: null, start: 0 });
  const holdDurationRef = useRef(500);
  const socketRef       = useRef(null);

  // ── MediaPipe refs ───────────────────────────────────────────────────────
  const videoRef          = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const streamRef         = useRef(null);
  const rafRef            = useRef(null);
  const lastVideoTimeRef  = useRef(-1);
  const noFaceFramesRef   = useRef(0);
  const autoCenterBuf     = useRef([]);
  const autoCenterDone    = useRef(false);
  const centerRef         = useRef({ x: 0, y: 0 });
  const yBiasRef          = useRef(0.0);
  const lastEyeCmdRef     = useRef(null);
  const lastEyeCmdTimeRef = useRef(0);
  const dwellDirRef       = useRef(null);
  const dwellStartRef     = useRef(null);
  const dwellFiredRef     = useRef(false);
  const lastRepeatRef     = useRef(0);

  // keep refs in sync
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { holdDurationRef.current = holdDuration; }, [holdDuration]);
  useEffect(() => { try { localStorage.setItem("controlMode", mode); } catch {} }, [mode]);

  // ── Register / unregister page handlers ──────────────────────────────────
  const register   = useCallback((fn) => { handlerRef.current = fn; }, []);
  const unregister = useCallback(()   => { handlerRef.current = null; }, []);
  const dispatch   = useCallback((cmd) => { if (handlerRef.current && cmd) handlerRef.current(cmd); }, []);

  // ════════════════════════════════════════════════════════════════════════
  // HEAD CONTROL (ESP32 via socket.io)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (mode !== "head") {
      if (socketRef.current) {
        socketRef.current.off("command");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(HEAD_SERVER, { transports: ["websocket"] });
    socketRef.current = socket;

    fetch(`${HEAD_SERVER}/settings`)
      .then(r => r.json())
      .then(s => setSensorSettings({
        alpha:     s.alpha     ?? 0.5,
        threshold: s.threshold ?? 1.5,
        deadzone:  s.deadzone  ?? 1.0,
      }))
      .catch(() => {});

    socket.on("command", ({ cmd }) => {
      if (modeRef.current !== "head" || !handlerRef.current) return;
      const now  = Date.now();
      const prev = holdRef.current.cmd;
      if (!cmd) { holdRef.current = { cmd: null, start: 0 }; return; }
      if (prev !== cmd) {
        holdRef.current = { cmd, start: now };
        if (cmd === "LEFT" || cmd === "RIGHT") handlerRef.current(cmd);
        return;
      }
      if ((cmd === "FORWARD" || cmd === "BACK") && now - holdRef.current.start >= holdDurationRef.current) {
        handlerRef.current(cmd);
        holdRef.current = { cmd: null, start: 0 };
      }
    });

    return () => { socket.off("command"); socket.disconnect(); socketRef.current = null; };
  }, [mode]);

  const updateSensorSettings = useCallback((newSettings) => {
    setSensorSettings(newSettings);
    fetch(`${HEAD_SERVER}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSettings),
    }).catch(() => {});
  }, []);

  // ════════════════════════════════════════════════════════════════════════
  // EYES MODE — MediaPipe iris gaze (webcam, browser-based)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (mode !== "eyes") {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (faceLandmarkerRef.current) { faceLandmarkerRef.current.close(); faceLandmarkerRef.current = null; }
      streamRef.current = null;
      setEyeReady(false); setEyeCentered(false); setEyeTracking(false);
      autoCenterDone.current = false; autoCenterBuf.current = [];
      window.__irisHistory = []; window.__irisSmooth = null;
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        if (cancelled) return;
        const fl = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO", numFaces: 1,
          outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
        });
        if (cancelled) return;
        faceLandmarkerRef.current = fl;

        let video = videoRef.current;
        if (!video) {
          video = document.createElement("video");
          video.setAttribute("playsinline", ""); video.muted = true; video.style.display = "none";
          document.body.appendChild(video); videoRef.current = video;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream; video.srcObject = stream;
        await video.play(); if (cancelled) return;
        setEyeReady(true);
        startLoop(video, fl);
      } catch (err) { console.error("MediaPipe eye init failed:", err); }
    }

    function startLoop(video, fl) {
      const loop = () => {
        if (modeRef.current !== "eyes" || !video || !fl) return;
        if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          const result    = fl.detectForVideo(video, performance.now());
          const landmarks = result?.faceLandmarks?.[0];

          if (landmarks) {
            noFaceFramesRef.current = 0; setEyeTracking(true);
            const gaze = estimateIrisGaze(landmarks);

            if (!autoCenterDone.current) {
              autoCenterBuf.current.push({ x: gaze.x, y: gaze.y });
              if (autoCenterBuf.current.length >= AUTO_CENTER_FRAMES) {
                const xs = autoCenterBuf.current.map(p => p.x);
                const ys = autoCenterBuf.current.map(p => p.y);
                centerRef.current = { x: median(xs), y: median(ys) };
                autoCenterDone.current = true; setEyeCentered(true);
              }
            }

            if (autoCenterDone.current) {
              const direction = classifyGaze(gaze.x, gaze.y, centerRef.current, yBiasRef.current);
              const now = Date.now();
              if (direction !== "CENTER") {
                if (dwellDirRef.current === direction) {
                  if (direction === "RIGHT") {
                    if (!dwellFiredRef.current && dwellStartRef.current &&
                        (now - dwellStartRef.current) >= DWELL_CONFIRM_MS) {
                      dwellFiredRef.current = true; dispatch("FORWARD");
                    }
                  } else {
                    if ((now - lastRepeatRef.current) >= AUTO_REPEAT_MS) {
                      lastRepeatRef.current = now; dispatch(direction);
                    }
                  }
                } else {
                  dwellDirRef.current  = direction; dwellStartRef.current = now;
                  dwellFiredRef.current = false;    lastRepeatRef.current = now;
                  lastEyeCmdRef.current = direction; lastEyeCmdTimeRef.current = now;
                  dispatch(direction);
                }
              } else {
                lastEyeCmdRef.current = null; dwellDirRef.current  = null;
                dwellStartRef.current = null; dwellFiredRef.current = false;
                lastRepeatRef.current = 0;
              }
            }
          } else {
            noFaceFramesRef.current++;
            if (noFaceFramesRef.current > 4) {
              setEyeTracking(false); lastEyeCmdRef.current = null;
              window.__irisHistory = []; window.__irisSmooth = null;
            }
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    }

    init();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (faceLandmarkerRef.current) { faceLandmarkerRef.current.close(); faceLandmarkerRef.current = null; }
      if (videoRef.current && videoRef.current.parentNode) {
        videoRef.current.parentNode.removeChild(videoRef.current); videoRef.current = null;
      }
      streamRef.current = null;
      setEyeReady(false); setEyeCentered(false); setEyeTracking(false);
    };
  }, [mode, dispatch]);

  const recenterEyes = useCallback(() => {
    autoCenterBuf.current = []; autoCenterDone.current = false;
    centerRef.current = { x: 0, y: 0 };
    window.__irisHistory = []; window.__irisSmooth = null;
    setEyeCentered(false);
  }, []);

  const setYBias = useCallback((v) => { yBiasRef.current = v; }, []);

  // ════════════════════════════════════════════════════════════════════════
  // CNN MODE — polls nn_server.py (Pi camera + PyTorch model)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (mode !== "cnn") { setCnnReady(false); setGazeLabel("—"); return; }

    console.log(`[CNN] starting — polling ${NN_SERVER}/predict every 100 ms`);

    let rawDir      = null;
    let rawStart    = 0;
    let stableDir   = null;
    let lastRepeat  = 0;
    let closedStart = null;
    let closedFired = false;

    function handlePrediction(data) {
      if (!data.ready) return;
      setCnnReady(true);
      setGazeLabel(data.name);

      const now = Date.now();
      const dir = data.confidence >= CONF_THRESHOLD ? data.name : null;

      if (dir !== rawDir) {
        rawDir   = dir;
        rawStart = now;
        if (dir !== "CLOSED") { closedStart = null; closedFired = false; }
      }

      const isStable = dir !== null && (now - rawStart) >= DEBOUNCE_MS;
      if (!isStable) { stableDir = null; return; }

      if (dir === "CLOSED") {
        if (!closedStart) closedStart = now;
        if (!closedFired && (now - closedStart) >= getClosedMs()) {
          console.log("[CNN] CLOSED held → dispatching FORWARD");
          closedFired = true; dispatch("FORWARD");
        }
        stableDir = null; return;
      }

      closedStart = null; closedFired = false;
      if (stableDir !== dir) {
        console.log(`[CNN] dispatch ${dir}  (conf=${data.confidence.toFixed(2)})`);
        stableDir = dir; lastRepeat = now; dispatch(dir);
      } else if (now - lastRepeat >= AUTO_REPEAT_MS) {
        lastRepeat = now; dispatch(dir);
      }
    }

    let ws;
    function connect() {
      console.log("[CNN] connecting to ws://localhost:8000/ws/predict");
      ws = new WebSocket("ws://localhost:8000/ws/predict");
      ws.onopen    = () => console.log("[CNN] WebSocket connected");
      ws.onmessage = (e) => handlePrediction(JSON.parse(e.data));
      ws.onerror   = () => console.warn("[CNN] WebSocket error — is the backend running?");
      ws.onclose   = () => {
        setCnnReady(false);
        setGazeLabel("—");
        console.warn("[CNN] WebSocket closed, retrying in 2s…");
        setTimeout(() => { if (modeRef.current === "cnn") connect(); }, 2000);
      };
    }

    connect();
    return () => { ws && ws.close(); };
  }, [mode, dispatch]);

  // ── Toggle / set mode ────────────────────────────────────────────────────
  const setControlMode = useCallback((newMode) => setMode(newMode), []);

  // ── Status pill label ────────────────────────────────────────────────────
  const statusLabel = () => {
    if (mode === "head") return "Head Control";
    if (mode === "eyes") {
      if (!eyeReady)    return "Eye Control · init…";
      if (!eyeCentered) return "Eye Control · centering…";
      return "Eye Control · tracking";
    }
    if (mode === "cnn") return cnnReady ? `CNN Eyes · ${gazeLabel}` : "CNN Eyes · connecting…";
    return "";
  };

  return (
    <InputControlContext.Provider
      value={{
        mode, setControlMode, enabled,
        register, unregister,
        // head
        holdDuration, setHoldDuration,
        sensorSettings, updateSensorSettings,
        // mediapipe eyes
        eyeReady, eyeCentered, eyeTracking, recenterEyes, setYBias,
        // cnn eyes
        cnnReady, gazeLabel,
      }}
    >
      {children}

      {/* ── Global status pill ── */}
      <div style={{
        position: "fixed", bottom: 24, right: 24,
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 14px 6px 10px", borderRadius: 99,
        background: enabled ? "rgba(255,255,255,0.06)" : "transparent",
        border: `1px solid ${enabled ? "rgba(255,255,255,0.15)" : "transparent"}`,
        zIndex: 9999, transition: "all 0.25s ease", pointerEvents: "none",
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: enabled ? "#22c55e" : "rgba(255,255,255,0.15)",
          boxShadow:  enabled ? "0 0 8px #22c55e" : "none",
          transition: "all 0.3s",
        }} />
        {enabled && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>
            {statusLabel()}
          </span>
        )}
      </div>
    </InputControlContext.Provider>
  );
}

export const useInputControl = () => useContext(InputControlContext);

export const useHeadControl = () => {
  const ctx = useContext(InputControlContext);
  return {
    enabled:              ctx.enabled,
    register:             ctx.register,
    unregister:           ctx.unregister,
    toggle:               () => ctx.setControlMode(ctx.mode === "off" ? "head" : "off"),
    holdDuration:         ctx.holdDuration,
    setHoldDuration:      ctx.setHoldDuration,
    sensorSettings:       ctx.sensorSettings,
    updateSensorSettings: ctx.updateSensorSettings,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// IRIS GAZE MATH (MediaPipe)
// ════════════════════════════════════════════════════════════════════════════
function estimateIrisGaze(landmarks) {
  const raw  = estimateRawIrisGaze(landmarks);
  irisHistoryPush(raw);
  const hist = irisHistorySafe();
  const medX = median(hist.map(p => p.x));
  const medY = median(hist.map(p => p.y));
  const a    = 0.5;
  const prev = window.__irisSmooth || { x: 0, y: 0 };
  const smooth = { x: a * medX + (1 - a) * prev.x, y: a * medY + (1 - a) * prev.y };
  window.__irisSmooth = smooth;
  return smooth;
}
function irisHistorySafe() { if (!window.__irisHistory) window.__irisHistory = []; return window.__irisHistory; }
function irisHistoryPush(point) { const arr = irisHistorySafe(); arr.push(point); while (arr.length > 5) arr.shift(); }
function estimateRawIrisGaze(lm) {
  const leftIris  = avgPts(lm, [468, 469, 470, 471, 472]);
  const rightIris = avgPts(lm, [473, 474, 475, 476, 477]);
  const lO = lm[33], lI = lm[133], rI = lm[362], rO = lm[263];
  const leftX  = normSigned(leftIris.x,  lO.x, lI.x);
  const rightX = normSigned(rightIris.x, rI.x, rO.x);
  const eyeX   = (leftX + rightX) / 2;
  const lMid = mid(lO, lI), rMid = mid(rI, rO);
  const lW   = Math.max(Math.abs(lI.x - lO.x), 1e-6);
  const rW   = Math.max(Math.abs(rO.x - rI.x), 1e-6);
  const irisYOff = ((leftIris.y - lMid.y) / lW + (rightIris.y - rMid.y) / rW) / 2;
  const both = mid(lMid, rMid);
  const nose = lm[1], fL = lm[234], fR = lm[454], fT = lm[10], fB = lm[152];
  const fW   = Math.max(Math.abs(fR.x - fL.x), 1e-6);
  const fH   = Math.max(Math.abs(fB.y - fT.y), 1e-6);
  const yaw   = (nose.x - both.x) / fW;
  const pitch = (nose.y - both.y) / fH;
  const cx = eyeX - yaw * 0.7;
  const cy = irisYOff * 4.0 + pitch * 2.5;
  return { x: clamp(-cx * 6.0, -4, 4), y: clamp(cy * 5.0, -4, 4) };
}
function classifyGaze(x, y, center, yBias) {
  const dx  = x - center.x;
  const dy  = (y + yBias) - center.y;
  const str = Math.hypot(dx, dy);
  if (str < 0.04) return "CENTER";
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle >= -45  && angle <  45)  return "RIGHT";
  if (angle >=  45  && angle < 135)  return "DOWN";
  if (angle >= 135  || angle < -135) return "LEFT";
  return "UP";
}
function avgPts(lm, idx) { let x = 0, y = 0; for (const i of idx) { x += lm[i].x; y += lm[i].y; } return { x: x / idx.length, y: y / idx.length }; }
function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function normSigned(v, s, e) { const lo = Math.min(s, e), hi = Math.max(s, e); return ((v - lo) / Math.max(hi - lo, 1e-6) - 0.5) * 2; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function median(vals) {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
