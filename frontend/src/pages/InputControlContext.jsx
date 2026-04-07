import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { getClosedMs } from "../utils/settings";

// ── Server addresses ──────────────────────────────────────────────────────────
const BACKEND_SERVER = "http://localhost:8000";
const HEAD_SERVER = BACKEND_SERVER;
const NN_SERVER   = BACKEND_SERVER;

// ── MediaPipe constants ───────────────────────────────────────────────────────
const MODEL_URL          = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const AUTO_CENTER_FRAMES = 90;
const DWELL_CONFIRM_MS   = 1500;
const DIRECTION_DEBOUNCE_MS = 80;  // Reduced from 200ms - too restrictive
const HYSTERESIS_THRESHOLD  = 0.06; // Reduced from 0.15 - easier direction changes
const getInitialCenterBuffer = () => {
  try {
    const saved = localStorage.getItem("centerBuffer");
    return saved ? parseFloat(saved) : 0.05;
  } catch { return 0.05; }
};

const getInitialCommandDelay = () => {
  try {
    const saved = localStorage.getItem("eyeCommandDelay");
    return saved ? parseFloat(saved) : 200;
  } catch { return 200; }
};

// ── Shared timing constants ───────────────────────────────────────────────────
const AUTO_REPEAT_MS  = 600;

// ── CNN constants ─────────────────────────────────────────────────────────────
const CONF_THRESHOLD = 0.55;
const DEBOUNCE_MS    = 80;

// ── Gesture customization (read from localStorage) ───────────────────────────
const getSelectionMethod = () => {
  try { return localStorage.getItem("eyeSelectionMethod") || "right"; } catch { return "right"; }
};

const getHeadSelectionMethod = () => {
  try { return localStorage.getItem("headSelectionMethod") || "forward"; } catch { return "forward"; }
};

const getSelectionDwell = () => {
  try { const saved = localStorage.getItem("eyeSelectionDwell"); return saved ? parseInt(saved) : 1500; } catch { return 1500; }
};

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
  const [eyeDebug,    setEyeDebug]    = useState(null); // NEW: Debug data for visualization

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
  // Initialize yBias from localStorage
  const getInitialYBias = () => {
    try {
      const saved = localStorage.getItem("eyeYBias");
      return saved ? parseFloat(saved) : 0.0;
    } catch { return 0.0; }
  };

  const centerRef         = useRef({ x: 0, y: 0 });
  const centerBufferRef   = useRef(getInitialCenterBuffer());
  const commandDelayRef   = useRef(getInitialCommandDelay());
  const yBiasRef          = useRef(getInitialYBias());
  const lastEyeCmdRef     = useRef(null);
  const lastEyeCmdTimeRef = useRef(0);
  const dwellDirRef       = useRef(null);
  const dwellStartRef     = useRef(null);
  const dwellFiredRef     = useRef(false);
  const selectionDwellStartRef = useRef(null); // Track dwell for configured selection method
  const selectionDwellFiredRef = useRef(false); // Track if selection dwell fired
  const cnnClosedStartRef = useRef(null);     // Track closed eyes dwell for CNN
  const cnnClosedFiredRef = useRef(false);    // Track if CNN closed eyes fired
  const cnnSelectionDwellStartRef = useRef(null); // Track direction dwell for CNN
  const cnnSelectionDwellFiredRef = useRef(false); // Track if CNN direction dwell fired
  const cnnLastCmdTimeRef = useRef(0);        // Track CNN command delay (CRITICAL FIX)
  const headLastCmdTimeRef = useRef(0);       // Track HEAD command delay (CRITICAL FIX)
  const lastRepeatRef     = useRef(0);  const lastDirectionRef  = useRef(null);     // NEW: Track last direction
  const lastDirectionTimeRef = useRef(0);     // NEW: Track when last direction changed
  const lastGazePointRef  = useRef({ x: 0, y: 0 }); // NEW: For hysteresis
  // keep refs in sync
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { holdDurationRef.current = holdDuration; }, [holdDuration]);
  useEffect(() => { try { localStorage.setItem("controlMode", mode); } catch {} }, [mode]);

  // ── Register / unregister page handlers ──────────────────────────────────
  const register   = useCallback((fn) => { handlerRef.current = fn; }, []);
  const unregister = useCallback(()   => { handlerRef.current = null; }, []);
  const dispatch   = useCallback((cmd) => { if (handlerRef.current && cmd) handlerRef.current(cmd); }, []);

  // ════════════════════════════════════════════════════════════════════════
  // HEAD CONTROL (ESP32 via native WebSocket)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (mode !== "head") return;

    // Fetch settings from backend (skip in dev mode - localhost only has test server)
    if (window.location.hostname !== "localhost") {
      fetch(`${HEAD_SERVER}/settings`)
        .then(r => r.json())
        .then(s => setSensorSettings({
          alpha:     s.alpha     ?? 0.5,
          threshold: s.threshold ?? 1.5,
          deadzone:  s.deadzone  ?? 1.0,
        }))
        .catch(() => {});
    } else {
      // Dev mode - use defaults
      setSensorSettings({
        alpha: 0.5,
        threshold: 1.5,
        deadzone: 1.0,
      });
    }

    // Connect to WebSocket
    let ws;
    let currentWsUrl = null;
    const commandDelay = commandDelayRef.current;

    function connect() {
      // Try test server first (localhost:8002), then fallback to real backend
      const testWsUrl = "ws://localhost:8002/ws/head";
      const backendWsUrl = HEAD_SERVER.replace("http", "ws") + "/ws/head";
      
      // Use test server if available (development), else use backend
      const wsUrl = window.location.hostname === "localhost" ? testWsUrl : backendWsUrl;
      currentWsUrl = wsUrl;
      
      console.log("[HEAD] connecting to " + wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        isConnected = true;
        console.log("[HEAD] WebSocket connected to " + wsUrl);
      };

      ws.onmessage = (e) => {
        if (modeRef.current !== "head" || !handlerRef.current) return;
        const data = JSON.parse(e.data);
        const cmd = data.cmd; // null or LEFT/RIGHT/FORWARD/BACK
        const now = Date.now();
        const selectionCmd = getHeadSelectionMethod().toUpperCase(); // FORWARD or BACK
        const navigationCmd = selectionCmd === "FORWARD" ? "BACK" : "FORWARD"; // The other one for navigation

        // Reset hold state on neutral
        if (!cmd) {
          holdRef.current = { cmd: null, start: 0 };
          return;
        }

        const prev = holdRef.current.cmd;

        // New command received
        if (prev !== cmd) {
          holdRef.current = { cmd, start: now };
          // LEFT/RIGHT: immediate navigation with command delay throttling
          if (cmd === "LEFT" || cmd === "RIGHT") {
            if ((now - headLastCmdTimeRef.current) >= commandDelay) {
              console.log(`[HEAD] dispatch ${cmd}`);
              dispatch(cmd);
              headLastCmdTimeRef.current = now;
            }
          }
          return;
        }

        // Same command held
        if (cmd === selectionCmd && now - holdRef.current.start >= holdDurationRef.current) {
          dispatch("FORWARD"); // Always dispatch FORWARD for selection
          holdRef.current = { cmd: null, start: 0 };
        }
      };

      ws.onerror = () => console.warn("[HEAD] WebSocket error");
      ws.onclose = () => {
        isConnected = false;
        console.warn("[HEAD] WebSocket closed, retrying in 2s…");
        setTimeout(() => { if (modeRef.current === "head") connect(); }, 2000);
      };
    }

    connect();
    return () => { ws && ws.close(); };
  }, [mode, dispatch]);

  const updateSensorSettings = useCallback((newSettings) => {
    setSensorSettings(newSettings);
    // Only send to backend in production (not localhost test mode)
    if (window.location.hostname !== "localhost") {
      fetch(`${HEAD_SERVER}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      }).catch(() => {});
    }
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
      lastDirectionRef.current = null;
      lastDirectionTimeRef.current = 0;
      lastGazePointRef.current = { x: 0, y: 0 };
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
              const newDirection = classifyGazeWithHysteresis(gaze.x, gaze.y, centerRef.current, yBiasRef.current, lastDirectionRef.current, lastGazePointRef.current, centerBufferRef.current);
              lastGazePointRef.current = { x: gaze.x, y: gaze.y };
              const now = Date.now();

              // ── DEBOUNCE: Only accept direction changes after 200ms ──
              let direction = lastDirectionRef.current || newDirection;
              if (newDirection !== lastDirectionRef.current) {
                if (now - lastDirectionTimeRef.current >= DIRECTION_DEBOUNCE_MS) {
                  direction = newDirection;
                  lastDirectionRef.current = newDirection;
                  lastDirectionTimeRef.current = now;
                } else {
                  // Still debouncing, use last direction
                  direction = lastDirectionRef.current || newDirection;
                }
              } else {
                direction = newDirection;
              }

              // NEW: Update debug visualization
              try {
                setEyeDebug({
                  gazeX: gaze.x.toFixed(3),
                  gazeY: gaze.y.toFixed(3),
                  centerX: centerRef.current.x.toFixed(3),
                  centerY: centerRef.current.y.toFixed(3),
                  direction: direction,
                  newDirection: newDirection,
                  distance: Math.hypot(gaze.x - centerRef.current.x, gaze.y - centerRef.current.y).toFixed(3),
                  yBias: yBiasRef.current.toFixed(2),
                  centerBuffer: centerBufferRef.current.toFixed(2),
                });
              } catch (e) {
                console.warn("[Eyes] Debug update error:", e);
              }

              // ── CONFIGURABLE SELECTION METHOD WITH ADJUSTABLE DWELL ──
              const selectionMethod = getSelectionMethod(); // center/right/left/up/down
              const selectionDwell = getSelectionDwell();   // 500-3000ms
              const delayMs = commandDelayRef.current || 200;

              // Check if current direction matches the configured selection method
              if (direction === selectionMethod.toUpperCase()) {
                // This is the selection direction - apply dwell timer
                if (!selectionDwellStartRef.current) {
                  selectionDwellStartRef.current = now;
                  selectionDwellFiredRef.current = false;
                } else if (!selectionDwellFiredRef.current && (now - selectionDwellStartRef.current) >= selectionDwell) {
                  // Dwell time reached - fire FORWARD (select)
                  selectionDwellFiredRef.current = true;
                  console.log(`[Eyes] ${selectionMethod.toUpperCase()} dwell ${selectionDwell}ms → dispatching SELECT`);
                  dispatch("FORWARD");
                  lastEyeCmdTimeRef.current = now;
                }
              } else {
                // Not the selection direction - reset dwell
                selectionDwellStartRef.current = null;
                selectionDwellFiredRef.current = false;
              }

              // ── OTHER DIRECTIONS (navigate without dwell) ──
              if (direction !== selectionMethod.toUpperCase()) {
                // This is a navigation direction (not the selection gesture)
                if (dwellDirRef.current === direction) {
                  // Already holding this direction - repeat with command delay
                  if ((now - lastRepeatRef.current) >= delayMs) {
                    lastRepeatRef.current = now;
                    dispatch(direction);
                    lastEyeCmdTimeRef.current = now;
                  }
                } else {
                  // New direction - fire once and start repeat timer
                  if ((now - lastEyeCmdTimeRef.current) >= delayMs) {
                    dwellDirRef.current = direction;
                    lastRepeatRef.current = now;
                    lastEyeCmdRef.current = direction;
                    lastEyeCmdTimeRef.current = now;
                    dispatch(direction);
                  }
                }
              } else {
                // Currently holding selection direction - don't dispatch as navigation
                dwellDirRef.current = null;
                lastRepeatRef.current = now;
              }
            }
          } else {
            noFaceFramesRef.current++;
            if (noFaceFramesRef.current > 30) { // Increased from 4 - more tolerant of frame drops
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
    lastDirectionRef.current = null;
    lastDirectionTimeRef.current = 0;
    lastGazePointRef.current = { x: 0, y: 0 };
    setEyeCentered(false);
  }, []);

  const setYBias = useCallback((v) => { yBiasRef.current = v; }, []);
  const setCenterBuffer = useCallback((v) => { centerBufferRef.current = v; }, []);
  const setCommandDelay = useCallback((v) => { commandDelayRef.current = v; }, []);

  // ════════════════════════════════════════════════════════════════════════
  // CNN MODE — reads predictions from backend /ws/predict
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (mode !== "cnn") { setCnnReady(false); setGazeLabel("—"); return; }

    console.log(`[CNN] starting — backend source ${NN_SERVER}/predict`);

    let rawDir      = null;
    let rawStart    = 0;
    let stableDir   = null;

    function handlePrediction(data) {
      if (!data.ready) return;
      setCnnReady(true);
      setGazeLabel(data.name);

      const now = Date.now();
      const dir = data.confidence >= CONF_THRESHOLD ? data.name : null;
      const selectionMethod = getSelectionMethod(); // "closed"/right/left/up/down
      const selectionDwell = getSelectionDwell();   // 500-3000ms
      const commandDelay = commandDelayRef.current || 200;

      // ── CLOSED or direction-based selection ──────────────────────────────
      if (selectionMethod.toUpperCase() === "CLOSED") {
        // CLOSED eyes for selection
        if (dir === "CLOSED") {
          if (!cnnClosedStartRef.current) {
            cnnClosedStartRef.current = now;
            cnnClosedFiredRef.current = false;
          } else if (!cnnClosedFiredRef.current && (now - cnnClosedStartRef.current) >= getClosedMs()) {
            console.log("[CNN] CLOSED held → dispatching FORWARD");
            cnnClosedFiredRef.current = true;
            dispatch("FORWARD");
          }
          rawDir = null; stableDir = null;
          return;
        }
        cnnClosedStartRef.current = null;
        cnnClosedFiredRef.current = false;
      } else if (dir === selectionMethod.toUpperCase()) {
        // Direction-based selection with dwell
        if (!cnnSelectionDwellStartRef.current) {
          cnnSelectionDwellStartRef.current = now;
          cnnSelectionDwellFiredRef.current = false;
        } else if (!cnnSelectionDwellFiredRef.current && (now - cnnSelectionDwellStartRef.current) >= selectionDwell) {
          cnnSelectionDwellFiredRef.current = true;
          console.log(`[CNN] ${selectionMethod.toUpperCase()} dwell ${selectionDwell}ms → dispatching FORWARD`);
          dispatch("FORWARD");
        }
        rawDir = null; stableDir = null;
        return;
      } else {
        // Not the selection direction - reset dwell
        cnnSelectionDwellStartRef.current = null;
        cnnSelectionDwellFiredRef.current = false;
      }

      // ── navigation directions: small debounce + command delay ──────────────
      if (dir !== rawDir) { rawDir = dir; rawStart = now; }

      const isStable = dir !== null && (now - rawStart) >= DEBOUNCE_MS;
      if (!isStable) { stableDir = null; return; }

      if (stableDir !== dir) {
        // Apply command delay before dispatching navigation
        if ((now - cnnLastCmdTimeRef.current) >= commandDelay) {
          console.log(`[CNN] dispatch ${dir}  (conf=${data.confidence.toFixed(2)})`);
          stableDir = dir;
          dispatch(dir);
          cnnLastCmdTimeRef.current = now;
        }
      }
      // no auto-repeat — user must look away and back to fire again
    }

    let ws;
    let isConnected = false;
    function connect() {
      if (isConnected) return;

      const testWsUrl = "ws://localhost:8001/ws/predict";
      const backendWsUrl = NN_SERVER.replace("http", "ws") + "/ws/predict";
      const wsUrl = window.location.hostname === "localhost" ? testWsUrl : backendWsUrl;

      console.log("[CNN] connecting to " + wsUrl);
      ws = new WebSocket(wsUrl);
      ws.onopen    = () => {
        isConnected = true;
        console.log("[CNN] WebSocket connected");
      };
      ws.onmessage = (e) => handlePrediction(JSON.parse(e.data));
      ws.onerror   = () => console.warn("[CNN] WebSocket error — is the backend running?");
      ws.onclose   = () => {
        isConnected = false;
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
        eyeReady, eyeCentered, eyeTracking, recenterEyes, setYBias, setCenterBuffer, setCommandDelay, eyeDebug,
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
function classifyGazeWithHysteresis(x, y, center, yBias, lastDir, lastPoint, centerBuffer = 0) {
  const dx  = x - center.x;
  const dy  = (y + yBias) - center.y;
  const str = Math.hypot(dx, dy);
  
  // CENTER detection with buffer dead zone
  const centerThreshold = 0.08 + (centerBuffer || 0);
  if (str < centerThreshold) return "CENTER";
  
  // Require minimum distance from center to trigger any direction (prevents accidental triggers)
  const minDirectionDistance = 0.15 + (centerBuffer * 0.5);
  if (str < minDirectionDistance) return "CENTER";
  
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  let newDir = null;
  if (angle >= -45  && angle <  45)  newDir = "RIGHT";
  else if (angle >=  45  && angle < 135)  newDir = "DOWN";
  else if (angle >= 135  || angle < -135) newDir = "LEFT";
  else newDir = "UP";
  
  // Hysteresis: if we had a direction, don't switch unless we've moved significantly away
  if (lastDir && lastDir !== newDir) {
    const lastDx = lastPoint.x - center.x;
    const lastDy = (lastPoint.y + yBias) - center.y;
    const distance = Math.hypot(dx - lastDx, dy - lastDy);
    // Only switch if we've moved at least HYSTERESIS_THRESHOLD away
    if (distance < HYSTERESIS_THRESHOLD) {
      return lastDir;
    }
  }
  
  return newDir;
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
