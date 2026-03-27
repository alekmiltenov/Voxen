import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useHeadControl } from "./HeadControlContext";

export default function Settings() {
  const navigate = useNavigate();
  const {
    enabled, register, unregister,
    holdDuration, setHoldDuration,
    sensorSettings, updateSensorSettings,
  } = useHeadControl();

  // ── Head control: only BACK is relevant here ─────────────────────────────
  useEffect(() => {
    register((cmd) => {
      if (cmd === "BACK") navigate("/");
    });
    return () => unregister();
  }, []);

  const handleSensor = (key, value) =>
    updateSensorSettings({ ...sensorSettings, [key]: value });

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate("/")}>← Back</button>
        <span style={s.title}>Settings</span>
        <div style={{ width: 80 }} />
      </div>

      {/* ── Scrollable content ── */}
      <div style={s.content}>

        {/* ── Section 1: Interaction ── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionIcon}>⏱</span>
            <div>
              <p style={s.sectionTitle}>Interaction</p>
              <p style={s.sectionSub}>Controls how the head input feels</p>
            </div>
          </div>

          <SliderRow
            label="Hold Duration"
            hint="How long to hold FORWARD or BACK before it triggers"
            value={holdDuration}
            display={`${holdDuration} ms`}
            min={200} max={1200} step={50}
            accent="#a78bfa"
            onChange={setHoldDuration}
          />
        </section>

        {/* ── Section 2: Sensor ── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionIcon}>📡</span>
            <div>
              <p style={s.sectionTitle}>Sensor</p>
              <p style={s.sectionSub}>Tune the MPU6050 signal processing</p>
            </div>
          </div>

          <SliderRow
            label="Responsiveness (alpha)"
            hint="Higher = faster reaction, less smoothing"
            value={sensorSettings.alpha}
            display={sensorSettings.alpha.toFixed(2)}
            min={0.1} max={1.0} step={0.05}
            accent="#38bdf8"
            onChange={(v) => handleSensor("alpha", v)}
          />

          <Divider />

          <SliderRow
            label="Sensitivity (threshold)"
            hint="Lower = triggers on smaller tilts"
            value={sensorSettings.threshold}
            display={sensorSettings.threshold.toFixed(1)}
            min={0.5} max={5.0} step={0.1}
            accent="#38bdf8"
            onChange={(v) => handleSensor("threshold", v)}
          />

          <Divider />

          <SliderRow
            label="Deadzone"
            hint="Ignore micro-movements below this value"
            value={sensorSettings.deadzone}
            display={sensorSettings.deadzone.toFixed(1)}
            min={0.1} max={2.0} step={0.1}
            accent="#38bdf8"
            onChange={(v) => handleSensor("deadzone", v)}
          />
        </section>

        {/* ── Quick presets ── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionIcon}>⚡</span>
            <div>
              <p style={s.sectionTitle}>Quick Presets</p>
              <p style={s.sectionSub}>Recommended starting points</p>
            </div>
          </div>

          <div style={s.presets}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                style={s.presetBtn}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                onClick={() => {
                  setHoldDuration(p.hold);
                  updateSensorSettings({
                    alpha:     p.alpha,
                    threshold: p.threshold,
                    deadzone:  p.deadzone,
                  });
                }}
              >
                <span style={s.presetIcon}>{p.icon}</span>
                <span style={s.presetLabel}>{p.label}</span>
                <span style={s.presetDesc}>{p.desc}</span>
              </button>
            ))}
          </div>
        </section>

      </div>

      {enabled && (
        <p style={s.legend}>BACK &nbsp;·&nbsp; return home</p>
      )}
    </div>
  );
}

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = [
  {
    label:     "Careful",
    icon:      "🐢",
    desc:      "Slow & deliberate — best for new users",
    hold: 700,
    alpha: 0.4, threshold: 2.0, deadzone: 1.2,
  },
  {
    label:     "Balanced",
    icon:      "⚖️",
    desc:      "Recommended default",
    hold: 500,
    alpha: 0.5, threshold: 1.5, deadzone: 1.0,
  },
  {
    label:     "Responsive",
    icon:      "⚡",
    desc:      "Fast — for experienced users",
    hold: 300,
    alpha: 0.7, threshold: 1.0, deadzone: 0.6,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function SliderRow({ label, hint, value, display, min, max, step, accent, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={s.sliderRow}>
      <div style={s.sliderMeta}>
        <span style={s.sliderLabel}>{label}</span>
        <span style={{ ...s.sliderValue, color: accent }}>{display}</span>
      </div>
      <p style={s.sliderHint}>{hint}</p>

      {/* Custom track with fill */}
      <div style={s.trackWrap}>
        <div style={{ ...s.trackFill, width: `${pct}%`, background: accent }} />
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ ...s.slider, accentColor: accent }}
        />
      </div>

      <div style={s.sliderScale}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{
    height:     1,
    background: "rgba(255,255,255,0.05)",
    margin:     "4px 0",
  }} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: {
    width:         "100vw",
    minHeight:     "100vh",
    background:    "#111111",
    display:       "flex",
    flexDirection: "column",
    padding:       "28px 32px 60px",
    gap:           "28px",
    boxSizing:     "border-box",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    flexShrink:     0,
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
    fontSize:      "18px",
    fontWeight:    "300",
    color:         "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  content: {
    display:       "flex",
    flexDirection: "column",
    gap:           "16px",
    maxWidth:      600,
    width:         "100%",
    margin:        "0 auto",
  },
  section: {
    background:   "rgba(255,255,255,0.03)",
    border:       "1px solid rgba(255,255,255,0.07)",
    borderRadius: "18px",
    padding:      "24px 24px 20px",
    display:      "flex",
    flexDirection:"column",
    gap:          "20px",
  },
  sectionHeader: {
    display:    "flex",
    alignItems: "flex-start",
    gap:        "14px",
  },
  sectionIcon: {
    fontSize:     "20px",
    marginTop:    "1px",
    flexShrink:   0,
  },
  sectionTitle: {
    fontSize:      "14px",
    fontWeight:    "500",
    color:         "rgba(255,255,255,0.7)",
    letterSpacing: "0.06em",
    margin:        0,
    textTransform: "uppercase",
  },
  sectionSub: {
    fontSize: "12px",
    color:    "rgba(255,255,255,0.25)",
    margin:   "4px 0 0",
  },
  sliderRow: {
    display:       "flex",
    flexDirection: "column",
    gap:           "6px",
  },
  sliderMeta: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "baseline",
  },
  sliderLabel: {
    fontSize:   "13px",
    fontWeight: "500",
    color:      "rgba(255,255,255,0.65)",
  },
  sliderValue: {
    fontSize:           "13px",
    fontWeight:         "600",
    fontVariantNumeric: "tabular-nums",
  },
  sliderHint: {
    fontSize: "11px",
    color:    "rgba(255,255,255,0.22)",
    margin:   0,
  },
  trackWrap: {
    position: "relative",
    height:   20,
    display:  "flex",
    alignItems: "center",
  },
  trackFill: {
    position:     "absolute",
    left:         0,
    height:       2,
    borderRadius: 2,
    pointerEvents:"none",
    opacity:      0.5,
    zIndex:       0,
  },
  slider: {
    width:    "100%",
    cursor:   "pointer",
    position: "relative",
    zIndex:   1,
    background: "transparent",
  },
  sliderScale: {
    display:        "flex",
    justifyContent: "space-between",
    fontSize:       "10px",
    color:          "rgba(255,255,255,0.18)",
  },
  presets: {
    display: "flex",
    gap:     "10px",
  },
  presetBtn: {
    flex:          1,
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           "6px",
    padding:       "16px 12px",
    borderRadius:  "14px",
    border:        "1px solid rgba(255,255,255,0.09)",
    background:    "transparent",
    cursor:        "pointer",
    transition:    "background 0.15s ease",
  },
  presetIcon: {
    fontSize: "22px",
  },
  presetLabel: {
    fontSize:   "13px",
    fontWeight: "500",
    color:      "rgba(255,255,255,0.7)",
  },
  presetDesc: {
    fontSize:  "10px",
    color:     "rgba(255,255,255,0.25)",
    textAlign: "center",
    lineHeight: 1.4,
  },
  legend: {
    position:      "fixed",
    bottom:        28,
    left:          0,
    right:         0,
    textAlign:     "center",
    fontSize:      12,
    color:         "rgba(255,255,255,0.18)",
    letterSpacing: "0.06em",
    margin:        0,
    textTransform: "uppercase",
  },
};
