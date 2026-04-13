import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInputControl } from "./InputControlContextV2";
import { apiGet, apiPost } from "../api";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;

function antiJitterToBackendSettings(level) {
  const t = clamp(Number(level) || 0, 0, 50) / 50;
  return {
    // Lower level = almost raw predictions. Higher level = smoother / more stable.
    stable_window_size: Math.round(lerp(3, 7, t)),
    min_confidence: Number(lerp(0.30, 0.62, t).toFixed(2)),
    low_conf_reset_frames: Math.round(lerp(1, 8, t)),
    stale_timeout_ms: Math.round(lerp(300, 1500, t)),
  };
}

function backendSettingsToAntiJitter(settings) {
  const w = clamp((Number(settings?.stable_window_size) - 3) / (7 - 3), 0, 1);
  const c = clamp((Number(settings?.min_confidence) - 0.30) / (0.62 - 0.30), 0, 1);
  const r = clamp((Number(settings?.low_conf_reset_frames) - 1) / (8 - 1), 0, 1);
  const s = clamp((Number(settings?.stale_timeout_ms) - 300) / (1500 - 300), 0, 1);
  return Math.round(((w + c + r + s) / 4) * 50);
}

function antiJitterLabel(level) {
  const v = Number(level) || 0;
  if (v < 12.5) return "Raw / ultra fast";
  if (v < 25) return "Responsive";
  if (v < 37.5) return "Balanced";
  return "Very stable";
}

export default function Settings() {
  const navigate = useNavigate();
  const {
    mode, enabled, register, unregister,
    holdDuration, setHoldDuration,
    sensorSettings, updateSensorSettings,
    eyeReady, eyeCentered,
    recenterEyes, setYBias, setCenterBuffer, setCommandDelay,
    eyeHoldRepeatEnabled, setEyeHoldRepeatEnabled,
    eyeHoldRepeatDelay, setEyeHoldRepeatDelay,
    cnnReady, gazeLabel,
    centerSelectMinConfidence, setCenterSelectMinConfidence,
    centerSelectNoiseDelta, setCenterSelectNoiseDelta,
  } = useInputControl();

  const [localYBias, setLocalYBias] = useState(() => {
    try {
      const saved = localStorage.getItem("eyeYBias");
      return saved ? parseFloat(saved) : 0;
    } catch { return 0; }
  });
  const [localCenterBuffer, setLocalCenterBuffer] = useState(() => {
    try {
      const saved = localStorage.getItem("centerBuffer");
      return saved ? parseFloat(saved) : 0.05;
    } catch { return 0.05; }
  });
  const [localCommandDelay, setLocalCommandDelay] = useState(() => {
    try {
      const saved = localStorage.getItem("eyeCommandDelay");
      return saved ? parseFloat(saved) : 350;
    } catch { return 350; }
  });
  const [selectionMethod, setSelectionMethod] = useState(() => {
    try {
      const saved = (localStorage.getItem("eyeSelectionMethod") || "right").toLowerCase();
      if (saved === "closed") return "center";
      return ["left", "right", "up", "down", "center"].includes(saved) ? saved : "right";
    } catch { return "right"; }
  });
  const [selectionDwell, setSelectionDwell] = useState(() => {
    try {
      const saved = localStorage.getItem("eyeSelectionDwell");
      return saved ? parseInt(saved) : 1500;
    } catch { return 1500; }
  });
  const [mediapiaCenterMode, setMediapiaCenterMode] = useState(() => 
    localStorage.getItem("mediapiapeCenterMode") || "disabled"
  );
  const [headSelectionMethod, setHeadSelectionMethod] = useState(() => {
    try {
      const saved = localStorage.getItem("headSelectionMethod");
      return saved || "forward";
    } catch { return "forward"; }
  });
  const [cnnAntiJitterLevel, setCnnAntiJitterLevel] = useState(() => {
    try {
      const saved = localStorage.getItem("cnnAntiJitterLevel");
      return saved ? clamp(parseInt(saved, 10), 0, 50) : 20;
    } catch { return 20; }
  });
  const [cnnSettingsStatus, setCnnSettingsStatus] = useState("");
  const [cnnSettingsLoaded, setCnnSettingsLoaded] = useState(false);

  // Persist Y-bias to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("eyeYBias", localYBias.toString());
    } catch {}
  }, [localYBias]);

  // Persist center buffer to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("centerBuffer", localCenterBuffer.toString());
    } catch {}
  }, [localCenterBuffer]);

  // Persist command delay to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("eyeCommandDelay", localCommandDelay.toString());
    } catch {}
  }, [localCommandDelay]);

  // Persist selection method
  useEffect(() => {
    try {
      localStorage.setItem("eyeSelectionMethod", selectionMethod);
    } catch {}
  }, [selectionMethod]);

  // Persist selection dwell
  useEffect(() => {
    try {
      localStorage.setItem("eyeSelectionDwell", selectionDwell.toString());
    } catch {}
  }, [selectionDwell]);

  // Persist HEAD selection method
  useEffect(() => {
    try {
      localStorage.setItem("headSelectionMethod", headSelectionMethod);
    } catch {}
  }, [headSelectionMethod]);

  // Persist unified anti-jitter level
  useEffect(() => {
    try {
      localStorage.setItem("cnnAntiJitterLevel", String(Math.round(cnnAntiJitterLevel)));
    } catch {}
  }, [cnnAntiJitterLevel]);

  useEffect(() => {
    register((cmd) => {
      if (cmd === "BACK") navigate("/");
    });
    return () => unregister();
  }, [mode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet("/cnn/stabilization-settings");
        if (!alive) return;
        setCnnAntiJitterLevel(backendSettingsToAntiJitter(data));
        setCnnSettingsLoaded(true);
      } catch {
        if (!alive) return;
        setCnnSettingsStatus("Failed to load backend anti-jitter settings");
        setCnnSettingsLoaded(true);
      }
    })();

    return () => { alive = false; };
  }, []);

  const handleSensor = (key, value) =>
    updateSensorSettings({ ...sensorSettings, [key]: value });

  const handleMediapiaCenterModeChange = (value) => {
    setMediapiaCenterMode(value);
    localStorage.setItem("mediapiapeCenterMode", value);
  };

  useEffect(() => {
    if (!cnnSettingsLoaded || mode !== "cnn") return;

    setCnnSettingsStatus("Saving…");
    const t = setTimeout(async () => {
      try {
        const payload = antiJitterToBackendSettings(cnnAntiJitterLevel);
        await apiPost("/cnn/stabilization-settings", payload);
        setCnnSettingsStatus("Saved");
        setTimeout(() => setCnnSettingsStatus(""), 800);
      } catch (e) {
        setCnnSettingsStatus(e?.message || "Failed to save");
      }
    }, 300);

    return () => clearTimeout(t);
  }, [cnnAntiJitterLevel, cnnSettingsLoaded, mode]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate("/")}>← Back</button>
        <span style={s.title}>Settings</span>
        <div style={{ width: 80 }} />
      </div>

      <div style={s.content}>

        {/* ── Current mode display ── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionIcon}>🎮</span>
            <div>
              <p style={s.sectionTitle}>Control Mode</p>
              <p style={s.sectionSub}>
                Currently: <strong style={{ color: "rgba(255,255,255,0.7)" }}>
                  {mode === "off" ? "Off" : mode === "head" ? "Head Control" : "Eye Control"}
                </strong>
                &nbsp;— change on home screen
              </p>
            </div>
          </div>
        </section>

        {/* ── Head mode: Interaction + Sensor ── */}
        {mode === "head" && (
          <>
            <section style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionIcon}>⏱</span>
                <div>
                  <p style={s.sectionTitle}>Interaction</p>
                  <p style={s.sectionSub}>Controls how the head input feels</p>
                </div>
              </div>
              <div style={s.row}>
                <ControlLabel text="Selection Command" help="Choose which head movement performs confirm/select." />
                <select 
                  value={headSelectionMethod} 
                  onChange={(e) => setHeadSelectionMethod(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1.5px solid rgba(255,255,255,0.15)",
                    backgroundColor: "rgba(17,24,39,0.8)",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  <option value="forward">FORWARD · confirm/select</option>
                  <option value="back">BACK · confirm/select</option>
                </select>
              </div>
              <p style={s.hint}>Which head motion triggers selection</p>
              <Divider />
              <SliderRow label="Hold Duration" hint="How long to hold selection command"
                value={holdDuration} display={`${holdDuration} ms`}
                help="Longer hold reduces accidental selects but feels slower."
                min={200} max={1200} step={50} accent="#a78bfa" onChange={setHoldDuration} />
            </section>

            <section style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionIcon}>📡</span>
                <div>
                  <p style={s.sectionTitle}>Sensor</p>
                  <p style={s.sectionSub}>Tune the MPU6050 signal processing</p>
                </div>
              </div>
              <SliderRow label="Responsiveness (alpha)" hint="Higher = faster reaction"
                value={sensorSettings.alpha} display={sensorSettings.alpha.toFixed(2)}
                help="How quickly head-control reacts to movement changes."
                min={0.1} max={1.0} step={0.05} accent="#38bdf8"
                onChange={v => handleSensor("alpha", v)} />
              <Divider />
              <SliderRow label="Sensitivity (threshold)" hint="Lower = triggers on smaller tilts"
                value={sensorSettings.threshold} display={sensorSettings.threshold.toFixed(1)}
                help="Minimum tilt strength needed before a command is recognized."
                min={0.5} max={5.0} step={0.1} accent="#38bdf8"
                onChange={v => handleSensor("threshold", v)} />
              <Divider />
              <SliderRow label="Deadzone" hint="Ignore micro-movements below this"
                value={sensorSettings.deadzone} display={sensorSettings.deadzone.toFixed(1)}
                help="Ignores tiny involuntary movements around neutral position."
                min={0.1} max={2.0} step={0.1} accent="#38bdf8"
                onChange={v => handleSensor("deadzone", v)} />
            </section>

            <section style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionIcon}>⚡</span>
                <div>
                  <p style={s.sectionTitle}>Quick Presets</p>
                  <p style={s.sectionSub}>Recommended starting points</p>
                </div>
              </div>
              <div style={s.presets}>
                {PRESETS.map(p => (
                  <button key={p.label} style={s.presetBtn}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    onClick={() => {
                      setHoldDuration(p.hold);
                      updateSensorSettings({ alpha: p.alpha, threshold: p.threshold, deadzone: p.deadzone });
                    }}>
                    <span style={s.presetIcon}>{p.icon}</span>
                    <span style={s.presetLabel}>{p.label}</span>
                    <span style={s.presetDesc}>{p.desc}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── Eyes mode (MediaPipe, webcam) ── */}
        {mode === "eyes" && (
          <>
            <section style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionIcon}>👁️</span>
                <div>
                  <p style={s.sectionTitle}>Eye Tracking</p>
                  <p style={s.sectionSub}>
                    {eyeCentered ? "Centred and tracking" : eyeReady ? "Centering…" : "Initialising camera…"}
                  </p>
                </div>
              </div>

              <SliderRow label="Y-axis bias" hint="If stuck on DOWN drag left · if stuck on UP drag right"
                value={localYBias} display={localYBias.toFixed(2)}
                help="Offsets vertical gaze center to correct camera angle or posture."
                min={-2.0} max={2.0} step={0.05} accent="#22c55e"
                onChange={v => { setLocalYBias(v); setYBias(v); }} />

              <Divider />

              <SliderRow label="Center stability buffer" hint="Higher = smoother center, lower = more responsive"
                value={localCenterBuffer} display={localCenterBuffer.toFixed(2)}
                help="Expands neutral zone near center to reduce jitter and accidental moves."
                min={0.0} max={1.5} step={0.01} accent="#22c55e"
                onChange={v => { setLocalCenterBuffer(v); setCenterBuffer(v); }} />

              <Divider />

              <SliderRow label="Command delay" hint="Milliseconds between commands (higher = slower navigation)"
                value={localCommandDelay} display={`${Math.round(localCommandDelay)} ms`}
                help="Minimum time between repeated commands. Increase for easier control."
                min={100} max={1200} step={50} accent="#22c55e"
                onChange={v => { setLocalCommandDelay(v); setCommandDelay(v); }} />

              <Divider />

              <div style={s.toggleRow}>
                <span style={s.selectLabelRow}>
                  <span style={s.selectLabel}>Hold-to-repeat navigation</span>
                  <HelpIcon text="When enabled, keeping gaze on a navigation direction repeats jumps with fixed delay." />
                </span>
                <button
                  type="button"
                  onClick={() => setEyeHoldRepeatEnabled(!eyeHoldRepeatEnabled)}
                  style={{
                    ...s.toggleBtn,
                    ...(eyeHoldRepeatEnabled ? s.toggleBtnOn : s.toggleBtnOff),
                  }}
                >
                  {eyeHoldRepeatEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {eyeHoldRepeatEnabled && (
                <>
                  <SliderRow label="Repeat delay" hint="Delay between repeated jumps while holding gaze"
                    value={eyeHoldRepeatDelay} display={`${Math.round(eyeHoldRepeatDelay)} ms`}
                    help="Lower values move faster on long holds."
                    min={60} max={1200} step={20} accent="#22c55e"
                    onChange={setEyeHoldRepeatDelay} />
                </>
              )}

              <Divider />

              <button style={s.recenterBtn}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(34,197,94,0.12)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                onClick={recenterEyes}>
                Re-centre eye tracking
              </button>

              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", margin: 0 }}>
                Hold gaze RIGHT for ~1.5 s to confirm · UP/DOWN navigate · LEFT goes back
              </p>
            </section>

            <section style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionIcon}>⚙️</span>
                <div>
                  <p style={s.sectionTitle}>Selection Method</p>
                  <p style={s.sectionSub}>How to confirm and select items</p>
                </div>
              </div>
              <div style={s.selectRow}>
                <ControlLabel text="Select using" help="Choose which gaze direction acts as confirm/select after dwell." />
                <select value={selectionMethod} onChange={e => setSelectionMethod(e.target.value)}
                  style={s.selectInput}>
                  <option value="right">RIGHT (hold right)</option>
                  <option value="left">LEFT (hold left)</option>
                  <option value="up">UP (hold up)</option>
                  <option value="down">DOWN (hold down)</option>
                  <option value="center">CENTER (hold center)</option>
                </select>
              </div>

              <Divider />

              <SliderRow label="Selection dwell time" hint="How long to hold the gaze direction to select"
                value={selectionDwell} display={`${selectionDwell} ms`}
                help="How long to keep looking at selection direction before confirm fires."
                min={500} max={3000} step={100} accent="#22c55e"
                onChange={v => setSelectionDwell(v)} />

              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", margin: "8px 0 0 0" }}>
                Hold your gaze in the selected direction for the specified duration to confirm
              </p>
            </section>
          </>
        )}

        {/* ── CNN mode (Pi camera + PyTorch model) ── */}
        {mode === "cnn" && (
          <>
            <section style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionIcon}>🧠</span>
                <div>
                  <p style={s.sectionTitle}>CNN Eye Tracking</p>
                  <p style={s.sectionSub}>
                    {cnnReady ? "Connected to nn_server.py" : "Waiting for nn_server.py on :5001…"}
                  </p>
                </div>
              </div>

              {/* camera preview */}
              <img
                src="http://localhost:8000/camera/stream"
                alt="Pi camera"
                style={{
                  width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
                  background: "#000", aspectRatio: "4/3", objectFit: "cover",
                  display: cnnReady ? "block" : "none",
                }}
              />
              {!cnnReady && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "20px 0" }}>
                  Camera preview will appear once connected
                </div>
              )}

              {/* live gaze badge */}
              <div style={s.gazeRow}>
                <span style={s.gazeLabel}>Current gaze</span>
                <span style={{
                  ...s.gazeBadge,
                  background:  cnnReady ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                  color:       cnnReady ? "#86efac"              : "rgba(255,255,255,0.25)",
                  borderColor: cnnReady ? "rgba(34,197,94,0.3)"  : "rgba(255,255,255,0.08)",
                }}>
                  {cnnReady ? gazeLabel : "—"}
                </span>
              </div>

            </section>

            <section style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionIcon}>⚙️</span>
                <div>
                  <p style={s.sectionTitle}>CNN Selection Method</p>
                  <p style={s.sectionSub}>How to confirm and select items</p>
                </div>
              </div>
              <div style={s.selectRow}>
                <ControlLabel text="Select using" help="Choose which CNN direction acts as confirm/select after dwell." />
                <select value={selectionMethod} onChange={e => setSelectionMethod(e.target.value)}
                  style={{
                    ...s.selectInput,
                    borderColor: selectionMethod === "center" ? "rgba(167,139,250,0.7)" : "rgba(34,197,94,0.4)",
                    boxShadow: selectionMethod === "center"
                      ? "0 0 0 1px rgba(167,139,250,0.35), 0 6px 16px rgba(167,139,250,0.2)"
                      : s.selectInput.boxShadow,
                    background: selectionMethod === "center"
                      ? "linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0.08) 100%)"
                      : s.selectInput.background,
                  }}>
                  <option value="right">RIGHT (hold right)</option>
                  <option value="left">LEFT (hold left)</option>
                  <option value="up">UP (hold up)</option>
                  <option value="down">DOWN (hold down)</option>
                  <option value="center">CENTER (hold center)</option>
                </select>
              </div>

              {selectionMethod === "center" && (
                <>
                  <Divider />
                  <div style={s.centerGroupBox}>
                    <div style={s.centerGroupHeader}>CENTER selection tuning</div>
                    <SliderRow
                      label="Center min confidence"
                      hint="Required confidence for CENTER hold to keep counting"
                      help="If confidence drops below this, CENTER selection timer resets immediately."
                      value={centerSelectMinConfidence}
                      display={centerSelectMinConfidence.toFixed(2)}
                      min={0.55}
                      max={0.99}
                      step={0.01}
                      accent="#a78bfa"
                      onChange={setCenterSelectMinConfidence}
                    />

                    <Divider />
                    <SliderRow
                      label="Center noise delta"
                      hint="Allowed confidence jitter (max-min) while holding CENTER"
                      help="Lower values require steadier confidence; higher values are more tolerant to noise."
                      value={centerSelectNoiseDelta}
                      display={centerSelectNoiseDelta.toFixed(3)}
                      min={0.01}
                      max={0.2}
                      step={0.005}
                      accent="#a78bfa"
                      onChange={setCenterSelectNoiseDelta}
                    />
                  </div>
                </>
              )}

              <Divider />
              <SliderRow label="Selection dwell time" hint="How long to hold the gaze direction to select"
                value={selectionDwell} display={`${selectionDwell} ms`}
                help="How long to keep CNN gaze on selection direction before confirm fires."
                min={500} max={3000} step={100} accent="#22c55e"
                onChange={v => setSelectionDwell(v)} />

              <Divider />

              <SliderRow label="Command delay" hint="Milliseconds between commands (higher = slower navigation)"
                value={localCommandDelay} display={`${Math.round(localCommandDelay)} ms`}
                help="Minimum time between repeated CNN navigation commands."
                min={100} max={1200} step={50} accent="#22c55e"
                onChange={v => { setLocalCommandDelay(v); setCommandDelay(v); }} />

              <Divider />

              <div style={s.toggleRow}>
                <span style={s.selectLabelRow}>
                  <span style={s.selectLabel}>Fast hold navigation</span>
                  <HelpIcon text="When enabled, keeping CNN gaze on a navigation direction repeats jumps with fixed delay." />
                </span>
                <button
                  type="button"
                  onClick={() => setEyeHoldRepeatEnabled(!eyeHoldRepeatEnabled)}
                  style={{
                    ...s.toggleBtn,
                    ...(eyeHoldRepeatEnabled ? s.toggleBtnOn : s.toggleBtnOff),
                  }}
                >
                  {eyeHoldRepeatEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {eyeHoldRepeatEnabled && (
                <SliderRow label="Fast repeat delay" hint="Delay between repeated CNN jumps while holding gaze"
                  value={eyeHoldRepeatDelay} display={`${Math.round(eyeHoldRepeatDelay)} ms`}
                  help="Lower values move faster on long holds in Keyboard and other pages."
                  min={60} max={1200} step={20} accent="#22c55e"
                  onChange={setEyeHoldRepeatDelay} />
              )}

              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", margin: "8px 0 0 0" }}>
                CNN smoothing comes mainly from backend stabilization; use command delay and selection dwell for feel.
              </p>
            </section>

            <section style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionIcon}>🧩</span>
                <div>
                  <p style={s.sectionTitle}>Backend Anti-jitter</p>
                  <p style={s.sectionSub}>One control for smoothness vs responsiveness</p>
                </div>
              </div>

              <SliderRow label="Anti-jitter strength" hint="Left = faster reaction · Right = smoother output"
                value={cnnAntiJitterLevel} display={`${Math.round(cnnAntiJitterLevel)} · ${antiJitterLabel(cnnAntiJitterLevel)}`}
                help="Unified control for CNN smoothing. Increase if direction flickers. Decrease if it feels delayed."
                min={0} max={50} step={1} accent="#22c55e"
                onChange={v => setCnnAntiJitterLevel(v)} />

              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "8px 0 0 0" }}>{cnnSettingsStatus || "Auto-saves"}</p>
            </section>
          </>
        )}
      </div>

      {enabled && (
        <p style={s.legend}>
          {mode === "head" ? "BACK · return home" : "BACK · return home"}
        </p>
      )}
    </div>
  );
}

const PRESETS = [
  { label: "Careful", icon: "🐢", desc: "Slow & deliberate", hold: 700, alpha: 0.4, threshold: 2.0, deadzone: 1.2 },
  { label: "Balanced", icon: "⚖️", desc: "Recommended", hold: 500, alpha: 0.5, threshold: 1.5, deadzone: 1.0 },
  { label: "Responsive", icon: "⚡", desc: "Fast", hold: 300, alpha: 0.7, threshold: 1.0, deadzone: 0.6 },
];

function SliderRow({ label, hint, help, value, display, min, max, step, accent, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={s.sliderRow}>
      <div style={s.sliderMeta}>
        <span style={s.sliderLabelRow}>
          <span style={s.sliderLabel}>{label}</span>
          <HelpIcon text={help || hint} />
        </span>
        <span style={{ ...s.sliderValue, color: accent }}>{display}</span>
      </div>
      <p style={s.sliderHint}>{hint}</p>
      <div style={s.trackWrap}>
        <div style={{ ...s.trackFill, width: `${pct}%`, background: accent }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ ...s.slider, accentColor: accent }} />
      </div>
      <div style={s.sliderScale}><span>{min}</span><span>{max}</span></div>
    </div>
  );
}

<style>{`
  select option {
    background: #1a1a1a;
    color: #fff;
    padding: 10px;
  }
  select option:checked {
    background: linear-gradient(#22c55e, #22c55e);
    color: #1a1a1a;
  }
`}</style>

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "4px 0" }} />;
}

function ControlLabel({ text, help }) {
  return (
    <span style={s.selectLabelRow}>
      <span style={s.selectLabel}>{text}:</span>
      <HelpIcon text={help} />
    </span>
  );
}

function HelpIcon({ text }) {
  return (
    <span title={text} style={s.helpIcon} aria-label={text}>?</span>
  );
}

const s = {
  page: {
    width: "100vw", height: "100vh", background: "#111111",
    display: "flex", flexDirection: "column", padding: "28px 32px 60px", gap: "28px",
    boxSizing: "border-box", overflowY: "auto",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  backBtn: {
    padding: "8px 18px", borderRadius: "20px", background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)",
    fontSize: "14px", cursor: "pointer", width: 80,
  },
  title: {
    fontSize: "18px", fontWeight: "300", color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em", textTransform: "uppercase",
  },
  content: { display: "flex", flexDirection: "column", gap: "16px", maxWidth: 600, width: "100%", margin: "0 auto" },
  section: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "18px", padding: "24px 24px 20px", display: "flex", flexDirection: "column", gap: "20px",
  },
  sectionHeader: { display: "flex", alignItems: "flex-start", gap: "14px" },
  sectionIcon: { fontSize: "20px", marginTop: "1px", flexShrink: 0 },
  sectionTitle: {
    fontSize: "14px", fontWeight: "500", color: "rgba(255,255,255,0.7)",
    letterSpacing: "0.06em", margin: 0, textTransform: "uppercase",
  },
  sectionSub: { fontSize: "12px", color: "rgba(255,255,255,0.25)", margin: "4px 0 0" },
  sliderRow: { display: "flex", flexDirection: "column", gap: "6px" },
  sliderMeta: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  sliderLabelRow: { display: "flex", alignItems: "center", gap: 8 },
  sliderLabel: { fontSize: "13px", fontWeight: "500", color: "rgba(255,255,255,0.65)" },
  sliderValue: { fontSize: "13px", fontWeight: "600", fontVariantNumeric: "tabular-nums" },
  sliderHint: { fontSize: "11px", color: "rgba(255,255,255,0.22)", margin: 0 },
  trackWrap: { position: "relative", height: 20, display: "flex", alignItems: "center" },
  trackFill: {
    position: "absolute", left: 0, height: 2, borderRadius: 2,
    pointerEvents: "none", opacity: 0.5, zIndex: 0,
  },
  slider: { width: "100%", cursor: "pointer", position: "relative", zIndex: 1, background: "transparent" },
  sliderScale: { display: "flex", justifyContent: "space-between", fontSize: "10px", color: "rgba(255,255,255,0.18)" },
  presets: { display: "flex", gap: "10px" },
  presetBtn: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
    padding: "16px 12px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.09)",
    background: "transparent", cursor: "pointer", transition: "background 0.15s ease",
  },
  presetIcon: { fontSize: "22px" },
  presetLabel: { fontSize: "13px", fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  presetDesc: { fontSize: "10px", color: "rgba(255,255,255,0.25)", textAlign: "center", lineHeight: 1.4 },
  recenterBtn: {
    padding: "14px 20px", borderRadius: "14px", background: "transparent",
    border: "1px solid rgba(34,197,94,0.3)", color: "#86efac",
    fontSize: "14px", fontWeight: "500", cursor: "pointer", transition: "background 0.15s",
    textAlign: "center",
  },
  gazeRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  gazeLabel: { fontSize: "13px", fontWeight: "500", color: "rgba(255,255,255,0.65)" },
  gazeBadge: {
    padding: "4px 14px", borderRadius: 99,
    border: "1px solid", fontSize: "13px", fontWeight: "600",
    letterSpacing: "0.08em", transition: "all 0.2s",
  },
  selectRow: { display: "flex", flexDirection: "column", gap: "10px" },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleBtn: {
    minWidth: 72,
    height: 34,
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    cursor: "pointer",
  },
  toggleBtnOn: {
    borderColor: "rgba(34,197,94,0.6)",
    color: "#86efac",
    background: "rgba(34,197,94,0.12)",
  },
  toggleBtnOff: {
    borderColor: "rgba(255,255,255,0.2)",
    color: "rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.04)",
  },
  selectLabelRow: { display: "flex", alignItems: "center", gap: 8 },
  selectLabel: { fontSize: "13px", fontWeight: "500", color: "rgba(255,255,255,0.65)" },
  helpIcon: {
    width: 16, height: 16, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(255,255,255,0.25)", cursor: "help", userSelect: "none",
  },
  selectInput: {
    padding: "12px 16px", borderRadius: "12px", background: "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.08) 100%)",
    border: "1.5px solid rgba(34,197,94,0.4)", color: "#fff",
    fontSize: "13px", fontWeight: "500", cursor: "pointer", 
    transition: "all 0.2s ease",
    boxShadow: "0 4px 12px rgba(34,197,94,0.1)",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386efac' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    backgroundSize: "18px",
    paddingRight: "40px",
  },
  centerGroupBox: {
    border: "1px solid rgba(167,139,250,0.45)",
    borderRadius: "12px",
    padding: "12px 12px 8px",
    background: "linear-gradient(135deg, rgba(167,139,250,0.14) 0%, rgba(167,139,250,0.06) 100%)",
    boxShadow: "inset 0 0 0 1px rgba(167,139,250,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  centerGroupHeader: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#c4b5fd",
  },
  legend: {
    position: "fixed", bottom: 28, left: 0, right: 0, textAlign: "center",
    fontSize: 12, color: "rgba(255,255,255,0.18)", letterSpacing: "0.06em",
    margin: 0, textTransform: "uppercase",
  },
};
