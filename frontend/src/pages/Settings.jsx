import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDwellMs, saveSettings, DEFAULTS } from "../utils/settings";
import DwellButton from "../components/DwellButton";

export default function Settings() {
  const navigate = useNavigate();
  const [dwellMs, setDwellMs] = useState(getDwellMs);
  const [saved,   setSaved]   = useState(false);

  function save() {
    saveSettings({ dwellMs });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function reset() {
    setDwellMs(DEFAULTS.dwellMs);
  }

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <DwellButton style={s.pill} onClick={() => navigate(-1)}>← Back</DwellButton>
        <span style={s.title}>Settings</span>
        <div style={{ width: 80 }} />
      </div>

      <div style={s.body}>

        {/* ── Dwell Time ── */}
        <div style={s.group}>
          <div style={s.groupHeader}>
            <span style={s.groupLabel}>Dwell Time</span>
            <span style={s.groupValue}>{dwellMs} ms</span>
          </div>
          <p style={s.groupDesc}>
            How long you must look at a button before it clicks.
            Lower = faster but more accidental clicks.
          </p>
          <input
            type="range"
            min={400}
            max={3000}
            step={100}
            value={dwellMs}
            onChange={e => setDwellMs(Number(e.target.value))}
            style={s.slider}
          />
          <div style={s.sliderTicks}>
            <span>0.4 s</span>
            <span>1.0 s</span>
            <span>1.5 s</span>
            <span>2.0 s</span>
            <span>3.0 s</span>
          </div>

          {/* live preview button */}
          <div style={s.previewRow}>
            <span style={s.previewLabel}>Test it:</span>
            <DwellButton
              dwellMs={dwellMs}
              style={s.previewBtn}
              onClick={() => {}}
            >
              hover me
            </DwellButton>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={s.actions}>
          <DwellButton style={s.saveBtn} onClick={save}>
            {saved ? "Saved ✓" : "Save Settings"}
          </DwellButton>
          <DwellButton style={s.resetBtn} onClick={reset}>
            Reset to defaults
          </DwellButton>
        </div>

      </div>
    </div>
  );
}

const s = {
  page: {
    width:         "100vw",
    height:        "100vh",
    background:    "#111111",
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
  },
  topBar: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "24px 32px 0",
    flexShrink:     0,
  },
  pill: {
    padding:      "8px 18px",
    borderRadius: "20px",
    background:   "transparent",
    border:       "1px solid rgba(255,255,255,0.1)",
    color:        "rgba(255,255,255,0.35)",
    fontSize:     "13px",
    cursor:       "pointer",
    width:        80,
  },
  title: {
    fontSize:      "13px",
    color:         "rgba(255,255,255,0.25)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  body: {
    flex:          1,
    overflowY:     "auto",
    padding:       "40px 48px",
    display:       "flex",
    flexDirection: "column",
    gap:           "48px",
    maxWidth:      "680px",
    margin:        "0 auto",
    width:         "100%",
  },
  group: {
    display:       "flex",
    flexDirection: "column",
    gap:           "14px",
  },
  groupHeader: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "baseline",
  },
  groupLabel: {
    fontSize:   "20px",
    fontWeight: "400",
    color:      "rgba(255,255,255,0.85)",
  },
  groupValue: {
    fontSize:   "20px",
    fontWeight: "300",
    color:      "rgba(255,255,255,0.55)",
    fontVariantNumeric: "tabular-nums",
  },
  groupDesc: {
    margin:     0,
    fontSize:   "14px",
    color:      "rgba(255,255,255,0.3)",
    lineHeight: "1.5",
  },
  slider: {
    width:  "100%",
    cursor: "pointer",
    accentColor: "rgba(255,255,255,0.8)",
  },
  sliderTicks: {
    display:        "flex",
    justifyContent: "space-between",
    fontSize:       "11px",
    color:          "rgba(255,255,255,0.2)",
    marginTop:      "-6px",
  },
  previewRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "16px",
    marginTop:  "4px",
  },
  previewLabel: {
    fontSize: "13px",
    color:    "rgba(255,255,255,0.3)",
  },
  previewBtn: {
    padding:      "12px 28px",
    borderRadius: "12px",
    background:   "rgba(255,255,255,0.05)",
    border:       "1px solid rgba(255,255,255,0.12)",
    color:        "rgba(255,255,255,0.7)",
    fontSize:     "16px",
    fontWeight:   "300",
    cursor:       "pointer",
  },
  actions: {
    display:    "flex",
    gap:        "16px",
    flexWrap:   "wrap",
  },
  saveBtn: {
    padding:      "18px 44px",
    borderRadius: "14px",
    background:   "rgba(255,255,255,0.9)",
    border:       "none",
    color:        "#111111",
    fontSize:     "18px",
    fontWeight:   "600",
    cursor:       "pointer",
  },
  resetBtn: {
    padding:      "18px 32px",
    borderRadius: "14px",
    background:   "transparent",
    border:       "1px solid rgba(255,255,255,0.12)",
    color:        "rgba(255,255,255,0.35)",
    fontSize:     "16px",
    fontWeight:   "300",
    cursor:       "pointer",
  },
};
