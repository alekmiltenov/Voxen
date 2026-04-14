import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInputControl } from "./InputControlContextV2";
import { apiGet, apiPost } from "../api";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const normalizeHeadThreshold = (value) => clamp(Number(value) || 0.35, 0.1, 1.0);
const normalizeHeadDeadzone = (value, threshold) => {
  let dz = clamp(Number(value) || 0.1, 0.01, 0.5);
  if (dz >= threshold) {
    dz = clamp(Number((threshold * 0.5).toFixed(3)), 0.01, 0.5);
  }
  return dz;
};

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
    controlConfig,
    mode, enabled, register, unregister,
    updateEyesConfig, updateCnnConfig, updateHeadConfig,
    sensorSettings,
    eyeReady, eyeCentered,
    recenterEyes,
    cnnReady, gazeLabel,
  } = useInputControl();
  const [activeTab, setActiveTab] = useState(() => {
    if (mode === "head" || mode === "cnn" || mode === "eyes") return mode;
    return "eyes";
  });
  const [advancedOpen, setAdvancedOpen] = useState({ eyes: false, head: false, cnn: false });
  const [cnnAntiJitterLevel, setCnnAntiJitterLevel] = useState(() => {
    try {
      const saved = localStorage.getItem("cnnAntiJitterLevel");
      return saved ? clamp(parseInt(saved, 10), 0, 50) : 20;
    } catch { return 20; }
  });
  const [cnnSettingsStatus, setCnnSettingsStatus] = useState("");
  const [cnnSettingsLoaded, setCnnSettingsLoaded] = useState(false);

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

  const eyesSelectionMethod = String(controlConfig?.eyes?.selectionMethod || "right").toLowerCase();
  const eyesSelectionDwell = Number(controlConfig?.eyes?.selectionDwell ?? 650);
  const eyesCommandDelay = Number(controlConfig?.eyes?.commandDelay ?? 120);
  const eyesYBias = Number(controlConfig?.eyes?.yBias ?? 0);
  const eyesCenterBuffer = Number(controlConfig?.eyes?.centerBuffer ?? 0.05);
  const eyesRepeatEnabled = !!controlConfig?.eyes?.repeatEnabled;
  const eyesRepeatDelay = Number(controlConfig?.eyes?.repeatDelay ?? 180);

  const headSelectionDwell = Number(controlConfig?.head?.selectionDwell ?? 650);
  const headCommandDelay = Number(controlConfig?.head?.commandDelay ?? 120);
  const headSensitivityRaw = Number(controlConfig?.head?.sensitivity ?? sensorSettings?.threshold ?? 0.35);
  const headSensitivity = normalizeHeadThreshold(headSensitivityRaw);
  const headSmoothing = Number(controlConfig?.head?.smoothing ?? sensorSettings?.alpha ?? 0.5);
  const headDeadzoneRaw = Number(controlConfig?.head?.deadzone ?? sensorSettings?.deadzone ?? 0.1);
  const headDeadzone = normalizeHeadDeadzone(headDeadzoneRaw, headSensitivity);

  const cnnSelectionMethod = String(controlConfig?.cnn?.selectionMethod || "DOWN").toLowerCase();
  const cnnSelectionDwell = Number(controlConfig?.cnn?.selectionDwell ?? 650);
  const cnnCommandDelay = Number(controlConfig?.cnn?.commandDelay ?? 120);
  const cnnMinConfidence = Number(controlConfig?.cnn?.cnnMinConfidence ?? 0.45);
  const cnnStableFrames = Number(controlConfig?.cnn?.stableFrames ?? 4);
  const cnnRepeatEnabled = !!controlConfig?.cnn?.repeatEnabled;
  const cnnRepeatDelay = Number(controlConfig?.cnn?.repeatDelay ?? 180);
  const centerSelectMinConfidence = Number(controlConfig?.cnn?.centerSelectMinConfidence ?? 0.85);
  const headSelectionMethod = String(controlConfig?.head?.selectionMethod || "RIGHT").toLowerCase();

  useEffect(() => {
    const thresholdChanged = Math.abs(headSensitivityRaw - headSensitivity) > 1e-6;
    const deadzoneChanged = Math.abs(headDeadzoneRaw - headDeadzone) > 1e-6;
    if (thresholdChanged || deadzoneChanged) {
      updateHeadConfig({ sensitivity: headSensitivity, deadzone: headDeadzone });
    }

    const t = setTimeout(() => {
      apiPost("/head/settings", {
        alpha: headSmoothing,
        threshold: headSensitivity,
        deadzone: headDeadzone,
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [headSmoothing, headSensitivity, headDeadzone, headSensitivityRaw, headDeadzoneRaw, updateHeadConfig]);

  useEffect(() => {
    if (!cnnSettingsLoaded) return;

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
  }, [cnnAntiJitterLevel, cnnSettingsLoaded]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate("/")}>← Back</button>
        <span style={s.title}>Settings</span>
        <div style={{ width: 80 }} />
      </div>

      <div style={s.content}>
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionIcon}>🎛️</span>
            <div>
              <p style={s.sectionTitle}>Control Panel</p>
              <p style={s.sectionSub}>Current mode: <strong style={{ color: "rgba(255,255,255,0.72)" }}>{mode.toUpperCase()}</strong></p>
            </div>
          </div>

          <div style={s.tabsRow}>
            {[
              { id: "eyes", label: "Eyes" },
              { id: "head", label: "Head" },
              { id: "cnn", label: "CNN" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{ ...s.tabBtn, ...(activeTab === tab.id ? s.tabBtnActive : {}) }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === "eyes" && (
          <>
            <SectionHeader title="Basic" subtitle="Core interaction settings" onReset={() => updateEyesConfig({ selectionMethod: "right", selectionDwell: 650, commandDelay: 120 })} />
            <section style={s.section}>
              <div style={s.selectRow}>
                <ControlLabel text="Selection method" help="Which direction confirms/selects after dwell." />
                <select value={eyesSelectionMethod} onChange={e => updateEyesConfig({ selectionMethod: e.target.value })} style={s.selectInput}>
                  <option value="right">RIGHT (hold right)</option>
                  <option value="left">LEFT (hold left)</option>
                  <option value="up">UP (hold up)</option>
                  <option value="down">DOWN (hold down)</option>
                  <option value="center">CENTER (hold center)</option>
                </select>
              </div>
              <Divider />
              <SliderRow label="Selection dwell" hint="How long to hold the selected direction" value={eyesSelectionDwell} display={`${Math.round(eyesSelectionDwell)} ms`} min={500} max={3000} step={100} accent="#22c55e" onChange={v => updateEyesConfig({ selectionDwell: v })} />
              <Divider />
              <SliderRow label="Command delay" hint="Time between commands" value={eyesCommandDelay} display={`${Math.round(eyesCommandDelay)} ms`} min={100} max={1200} step={50} accent="#22c55e" onChange={v => updateEyesConfig({ commandDelay: v })} />
            </section>

            <SectionHeader title="Tuning" subtitle="Eye tracking behavior" onReset={() => updateEyesConfig({ yBias: 0, centerBuffer: 0.05 })} />
            <section style={s.section}>
              <SliderRow label="Y bias" hint="Fix vertical drift" value={eyesYBias} display={eyesYBias.toFixed(2)} min={-2.0} max={2.0} step={0.05} accent="#22c55e" onChange={v => updateEyesConfig({ yBias: v })} />
              <Divider />
              <SliderRow label="Center buffer" hint="Higher = calmer center" value={eyesCenterBuffer} display={eyesCenterBuffer.toFixed(2)} min={0.0} max={1.5} step={0.01} accent="#22c55e" onChange={v => updateEyesConfig({ centerBuffer: v })} />
              <Divider />
              <div style={s.toggleRow}>
                <span style={s.selectLabelRow}><span style={s.selectLabel}>Hold-to-repeat navigation</span><HelpIcon text="Repeat movement while gaze is held in one direction." /></span>
                <button type="button" onClick={() => updateEyesConfig({ repeatEnabled: !eyesRepeatEnabled })} style={{ ...s.toggleBtn, ...(eyesRepeatEnabled ? s.toggleBtnOn : s.toggleBtnOff) }}>{eyesRepeatEnabled ? "ON" : "OFF"}</button>
              </div>
              {eyesRepeatEnabled && <SliderRow label="Repeat delay" hint="Delay between repeated jumps" value={eyesRepeatDelay} display={`${Math.round(eyesRepeatDelay)} ms`} min={60} max={1200} step={20} accent="#22c55e" onChange={v => updateEyesConfig({ repeatDelay: v })} />}
              <Divider />
              <button style={s.recenterBtn} onClick={recenterEyes}>Re-center eye tracking</button>
              <p style={s.metaText}>{eyeCentered ? "Centered and tracking" : eyeReady ? "Centering…" : "Initializing camera…"}</p>
            </section>

            <SectionHeader title="Advanced" subtitle="Fine control" collapsible open={advancedOpen.eyes} onToggle={() => setAdvancedOpen(p => ({ ...p, eyes: !p.eyes }))} onReset={() => updateEyesConfig({ debounceMs: 200, minStableFrames: 2, directionDebounceMs: 80, selectionReleaseMin: 80 })} />
            {advancedOpen.eyes && (
              <section style={s.section}>
                <SliderRow label="Reaction delay" hint="Direction must stay stable before it counts" value={Number(controlConfig?.eyes?.debounceMs ?? 200)} display={`${Math.round(Number(controlConfig?.eyes?.debounceMs ?? 200))} ms`} min={0} max={800} step={20} accent="#22c55e" onChange={v => updateEyesConfig({ debounceMs: v })} />
                <Divider />
                <SliderRow label="Stability frames" hint="How many stable frames are required" value={Number(controlConfig?.eyes?.minStableFrames ?? 2)} display={`${Math.round(Number(controlConfig?.eyes?.minStableFrames ?? 2))}`} min={1} max={10} step={1} accent="#22c55e" onChange={v => updateEyesConfig({ minStableFrames: v })} />
                <Divider />
                <SliderRow label="Direction debounce" hint="Delay before direction switch is accepted" value={Number(controlConfig?.eyes?.directionDebounceMs ?? 80)} display={`${Math.round(Number(controlConfig?.eyes?.directionDebounceMs ?? 80))} ms`} min={0} max={300} step={10} accent="#22c55e" onChange={v => updateEyesConfig({ directionDebounceMs: v })} />
                <Divider />
                <SliderRow label="Selection release minimum" hint="Minimum hold before release-to-move can trigger" value={Number(controlConfig?.eyes?.selectionReleaseMin ?? 80)} display={`${Math.round(Number(controlConfig?.eyes?.selectionReleaseMin ?? 80))} ms`} min={0} max={500} step={10} accent="#22c55e" onChange={v => updateEyesConfig({ selectionReleaseMin: v })} />
              </section>
            )}
          </>
        )}

        {activeTab === "head" && (
          <>
            <SectionHeader title="Basic" subtitle="Core interaction settings" onReset={() => updateHeadConfig({ selectionMethod: "RIGHT", selectionDwell: 650, commandDelay: 120 })} />
            <section style={s.section}>
              <div style={s.selectRow}>
                <ControlLabel text="Selection method" help="Which direction confirms/selects after dwell." />
                <select value={headSelectionMethod} onChange={(e) => updateHeadConfig({ selectionMethod: String(e.target.value).toUpperCase() })} style={s.selectInput}>
                  <option value="right">RIGHT (hold right)</option>
                  <option value="left">LEFT (hold left)</option>
                  <option value="up">UP (hold up)</option>
                  <option value="down">DOWN (hold down)</option>
                  <option value="center">CENTER (hold center)</option>
                </select>
              </div>
              <Divider />
              <SliderRow label="Selection dwell" hint="How long to hold selection direction" value={headSelectionDwell} display={`${Math.round(headSelectionDwell)} ms`} min={500} max={3000} step={100} accent="#38bdf8" onChange={v => updateHeadConfig({ selectionDwell: v })} />
              <Divider />
              <SliderRow label="Command delay" hint="Time between commands" value={headCommandDelay} display={`${Math.round(headCommandDelay)} ms`} min={100} max={1200} step={50} accent="#38bdf8" onChange={v => updateHeadConfig({ commandDelay: v })} />
            </section>

            <SectionHeader title="Tuning" subtitle="Head signal processing" onReset={() => updateHeadConfig({ sensitivity: 0.35, smoothing: 0.5, deadzone: 0.1 })} />
            <section style={s.section}>
              <SliderRow label="Sensitivity (threshold)" hint="Lower = triggers on smaller tilts" value={headSensitivity} display={headSensitivity.toFixed(2)} min={0.1} max={1.0} step={0.01} accent="#38bdf8" onChange={v => updateHeadConfig({ sensitivity: v })} />
              <Divider />
              <SliderRow label="Smoothing (alpha)" hint="Higher = faster reaction" value={headSmoothing} display={headSmoothing.toFixed(2)} min={0.1} max={1.0} step={0.05} accent="#38bdf8" onChange={v => updateHeadConfig({ smoothing: v })} />
              <Divider />
              <SliderRow label="Deadzone" hint="Ignore micro-movements" value={headDeadzone} display={headDeadzone.toFixed(2)} min={0.01} max={0.5} step={0.01} accent="#38bdf8" onChange={v => updateHeadConfig({ deadzone: v })} />
              <Divider />
              <div style={s.presets}>
                {PRESETS.map(p => (
                  <button key={p.label} style={s.presetBtn} onClick={() => updateHeadConfig({ smoothing: p.alpha, sensitivity: p.threshold, deadzone: p.deadzone })}>
                    <span style={s.presetIcon}>{p.icon}</span>
                    <span style={s.presetLabel}>{p.label}</span>
                    <span style={s.presetDesc}>{p.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <SectionHeader title="Advanced" subtitle="Fine control" collapsible open={advancedOpen.head} onToggle={() => setAdvancedOpen(p => ({ ...p, head: !p.head }))} onReset={() => updateHeadConfig({ debounceMs: 200, minStableFrames: 2, directionDebounceMs: 80, selectionReleaseMin: 80 })} />
            {advancedOpen.head && (
              <section style={s.section}>
                <SliderRow label="Reaction delay" hint="Direction must stay stable before it counts" value={Number(controlConfig?.head?.debounceMs ?? 200)} display={`${Math.round(Number(controlConfig?.head?.debounceMs ?? 200))} ms`} min={0} max={800} step={20} accent="#38bdf8" onChange={v => updateHeadConfig({ debounceMs: v })} />
                <Divider />
                <SliderRow label="Stability frames" hint="How many stable frames are required" value={Number(controlConfig?.head?.minStableFrames ?? 2)} display={`${Math.round(Number(controlConfig?.head?.minStableFrames ?? 2))}`} min={1} max={10} step={1} accent="#38bdf8" onChange={v => updateHeadConfig({ minStableFrames: v })} />
                <Divider />
                <SliderRow label="Direction debounce" hint="Delay before direction switch is accepted" value={Number(controlConfig?.head?.directionDebounceMs ?? 80)} display={`${Math.round(Number(controlConfig?.head?.directionDebounceMs ?? 80))} ms`} min={0} max={300} step={10} accent="#38bdf8" onChange={v => updateHeadConfig({ directionDebounceMs: v })} />
                <Divider />
                <SliderRow label="Selection release minimum" hint="Minimum hold before release-to-move can trigger" value={Number(controlConfig?.head?.selectionReleaseMin ?? 80)} display={`${Math.round(Number(controlConfig?.head?.selectionReleaseMin ?? 80))} ms`} min={0} max={500} step={10} accent="#38bdf8" onChange={v => updateHeadConfig({ selectionReleaseMin: v })} />
              </section>
            )}
          </>
        )}

        {activeTab === "cnn" && (
          <>
            <SectionHeader title="Status" subtitle="CNN stream and current label" />
            <section style={s.section}>
              {cnnReady ? (
                <img src="http://localhost:8000/camera/stream" alt="Pi camera" style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#000", aspectRatio: "4/3", objectFit: "cover" }} />
              ) : (
                <div style={s.metaText}>Waiting for nn_server.py on :5001…</div>
              )}
              <div style={s.gazeRow}>
                <span style={s.gazeLabel}>Current gaze</span>
                <span style={{ ...s.gazeBadge, background: cnnReady ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)", color: cnnReady ? "#86efac" : "rgba(255,255,255,0.25)", borderColor: cnnReady ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)" }}>{cnnReady ? gazeLabel : "—"}</span>
              </div>
            </section>

            <SectionHeader title="Basic" subtitle="Core interaction settings" onReset={() => updateCnnConfig({ selectionMethod: "DOWN", selectionDwell: 650, commandDelay: 120 })} />
            <section style={s.section}>
              <div style={s.selectRow}>
                <ControlLabel text="Selection method" help="Which direction confirms/selects after dwell." />
                <select value={cnnSelectionMethod} onChange={e => updateCnnConfig({ selectionMethod: String(e.target.value).toUpperCase() })} style={s.selectInput}>
                  <option value="right">RIGHT (hold right)</option>
                  <option value="left">LEFT (hold left)</option>
                  <option value="up">UP (hold up)</option>
                  <option value="down">DOWN (hold down)</option>
                  <option value="center">CENTER (hold center)</option>
                </select>
              </div>
              <Divider />
              <SliderRow label="Selection dwell" hint="How long to hold the selected direction" value={cnnSelectionDwell} display={`${Math.round(cnnSelectionDwell)} ms`} min={500} max={3000} step={100} accent="#22c55e" onChange={v => updateCnnConfig({ selectionDwell: v })} />
              <Divider />
              <SliderRow label="Command delay" hint="Time between commands" value={cnnCommandDelay} display={`${Math.round(cnnCommandDelay)} ms`} min={100} max={1200} step={50} accent="#22c55e" onChange={v => updateCnnConfig({ commandDelay: v })} />
            </section>

            <SectionHeader title="Tuning" subtitle="Prediction confidence and stability" onReset={() => { updateCnnConfig({ cnnMinConfidence: 0.45, stableFrames: 4 }); setCnnAntiJitterLevel(20); }} />
            <section style={s.section}>
              <SliderRow label="Min confidence" hint="Predictions below this are ignored" value={cnnMinConfidence} display={cnnMinConfidence.toFixed(2)} min={0.2} max={0.99} step={0.01} accent="#22c55e" onChange={v => updateCnnConfig({ cnnMinConfidence: v })} />
              <Divider />
              <SliderRow label="Stable frames" hint="How many matching frames are preferred before acting" value={cnnStableFrames} display={`${Math.round(cnnStableFrames)}`} min={1} max={10} step={1} accent="#22c55e" onChange={v => updateCnnConfig({ stableFrames: Math.round(v) })} />
              <Divider />
              <SliderRow label="Anti-jitter strength" hint="Left = faster reaction · Right = smoother output" value={cnnAntiJitterLevel} display={`${Math.round(cnnAntiJitterLevel)} · ${antiJitterLabel(cnnAntiJitterLevel)}`} min={0} max={50} step={1} accent="#22c55e" onChange={v => setCnnAntiJitterLevel(v)} />
              <Divider />
              <div style={s.toggleRow}>
                <span style={s.selectLabelRow}><span style={s.selectLabel}>Fast hold navigation</span><HelpIcon text="Repeat movement while CNN gaze is held in one direction." /></span>
                <button type="button" onClick={() => updateCnnConfig({ repeatEnabled: !cnnRepeatEnabled })} style={{ ...s.toggleBtn, ...(cnnRepeatEnabled ? s.toggleBtnOn : s.toggleBtnOff) }}>{cnnRepeatEnabled ? "ON" : "OFF"}</button>
              </div>
              {cnnRepeatEnabled && <SliderRow label="Fast repeat delay" hint="Delay between repeated jumps" value={cnnRepeatDelay} display={`${Math.round(cnnRepeatDelay)} ms`} min={60} max={1200} step={20} accent="#22c55e" onChange={v => updateCnnConfig({ repeatDelay: v })} />}
              {cnnSelectionMethod === "center" && <><Divider /><SliderRow label="Center min confidence" hint="Required confidence for CENTER hold" value={centerSelectMinConfidence} display={centerSelectMinConfidence.toFixed(2)} min={0.55} max={0.99} step={0.01} accent="#a78bfa" onChange={v => updateCnnConfig({ centerSelectMinConfidence: v })} /></>}
              <p style={s.metaText}>{cnnSettingsStatus || "Auto-saves backend anti-jitter"}</p>
            </section>

            <SectionHeader title="Advanced" subtitle="Fine control" collapsible open={advancedOpen.cnn} onToggle={() => setAdvancedOpen(p => ({ ...p, cnn: !p.cnn }))} onReset={() => updateCnnConfig({ debounceMs: 200, minStableFrames: 2, directionDebounceMs: 80, selectionReleaseMin: 80 })} />
            {advancedOpen.cnn && (
              <section style={s.section}>
                <SliderRow label="Reaction delay" hint="Direction must stay stable before it counts" value={Number(controlConfig?.cnn?.debounceMs ?? 200)} display={`${Math.round(Number(controlConfig?.cnn?.debounceMs ?? 200))} ms`} min={0} max={800} step={20} accent="#22c55e" onChange={v => updateCnnConfig({ debounceMs: v })} />
                <Divider />
                <SliderRow label="Stability frames" hint="How many stable frames are required" value={Number(controlConfig?.cnn?.minStableFrames ?? 2)} display={`${Math.round(Number(controlConfig?.cnn?.minStableFrames ?? 2))}`} min={1} max={10} step={1} accent="#22c55e" onChange={v => updateCnnConfig({ minStableFrames: v })} />
                <Divider />
                <SliderRow label="Direction debounce" hint="Delay before direction switch is accepted" value={Number(controlConfig?.cnn?.directionDebounceMs ?? 80)} display={`${Math.round(Number(controlConfig?.cnn?.directionDebounceMs ?? 80))} ms`} min={0} max={300} step={10} accent="#22c55e" onChange={v => updateCnnConfig({ directionDebounceMs: v })} />
                <Divider />
                <SliderRow label="Selection release minimum" hint="Minimum hold before release-to-move can trigger" value={Number(controlConfig?.cnn?.selectionReleaseMin ?? 80)} display={`${Math.round(Number(controlConfig?.cnn?.selectionReleaseMin ?? 80))} ms`} min={0} max={500} step={10} accent="#22c55e" onChange={v => updateCnnConfig({ selectionReleaseMin: v })} />
              </section>
            )}
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

function SectionHeader({ title, subtitle, onReset, collapsible = false, open = false, onToggle }) {
  return (
    <section style={s.section}>
      <div style={s.groupHeader}>
        {collapsible ? (
          <button type="button" style={s.advancedToggle} onClick={onToggle}>
            <span>{open ? "▾" : "▸"}</span>
            <span style={s.sectionTitle}>{title}</span>
          </button>
        ) : (
          <p style={s.sectionTitle}>{title}</p>
        )}
        {onReset && <button type="button" style={s.resetBtn} onClick={onReset}>Reset to defaults</button>}
      </div>
      <p style={s.sectionSub}>{subtitle}</p>
    </section>
  );
}

const PRESETS = [
  { label: "Careful", icon: "🐢", desc: "Slow & deliberate", alpha: 0.4, threshold: 0.55, deadzone: 0.18 },
  { label: "Balanced", icon: "⚖️", desc: "Recommended", alpha: 0.5, threshold: 0.35, deadzone: 0.1 },
  { label: "Responsive", icon: "⚡", desc: "Fast", alpha: 0.7, threshold: 0.25, deadzone: 0.08 },
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
    padding: "8px 18px",
    borderRadius: "20px",
    background: "transparent",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.35)",
    fontSize: "13px",
    cursor: "pointer",
    fontWeight: 400,
  },
  title: {
    fontSize: "18px", fontWeight: "300", color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em", textTransform: "uppercase",
  },
  content: { display: "flex", flexDirection: "column", gap: "16px", maxWidth: 680, width: "100%", margin: "0 auto" },
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
  tabsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  tabBtn: {
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.7)",
    borderRadius: 12,
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: "pointer",
  },
  tabBtnActive: {
    borderColor: "rgba(34,197,94,0.5)",
    color: "#86efac",
    background: "rgba(34,197,94,0.12)",
  },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resetBtn: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  advancedToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    padding: 0,
  },
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
  metaText: { fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 },
  legend: {
    position: "fixed", bottom: 28, left: 0, right: 0, textAlign: "center",
    fontSize: 12, color: "rgba(255,255,255,0.18)", letterSpacing: "0.06em",
    margin: 0, textTransform: "uppercase",
  },
};
