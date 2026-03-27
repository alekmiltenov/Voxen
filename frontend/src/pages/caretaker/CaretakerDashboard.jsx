import { useState } from "react";

export default function CaretakerDashboard() {
  const [showSettings, setShowSettings] = useState(false);
  const [cursorSpeed, setCursorSpeed] = useState(50);
  const [textSize, setTextSize] = useState(16);
  const [confirmDelay, setConfirmDelay] = useState(50);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.appName}>CarePanel</span>
        </div>
        <div style={s.headerRight}>
          <button style={s.iconBtn} title="Profile">👤</button>
          <button style={s.iconBtn} onClick={() => setShowSettings(!showSettings)} title="Settings">⚙️</button>
        </div>
      </div>

      {/* Settings Sheet */}
      {showSettings && (
        <div style={s.settingsOverlay} onClick={() => setShowSettings(false)}>
          <div style={s.settingsSheet} onClick={e => e.stopPropagation()}>
            <h3 style={s.settingsTitle}>Accessibility Settings</h3>
            <p style={s.settingsDesc}>Calibrate the communication experience</p>

            {/* Cursor Speed */}
            <div style={s.settingRow}>
              <div style={s.settingLeft}>
                <div style={s.settingIcon}>🎯</div>
                <div>
                  <div style={s.settingLabel}>Cursor Speed</div>
                  <div style={s.settingDesc}>Adjust pointer speed</div>
                </div>
              </div>
              <div style={s.settingValue}>{(cursorSpeed / 50 * 0.5 + 0.5).toFixed(1)}x</div>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={cursorSpeed}
              onChange={(e) => setCursorSpeed(Number(e.target.value))}
              style={s.slider}
            />

            {/* Text Size */}
            <div style={s.settingRow}>
              <div style={s.settingLeft}>
                <div style={s.settingIcon}>📋</div>
                <div>
                  <div style={s.settingLabel}>Text Size</div>
                  <div style={s.settingDesc}>Font size for app</div>
                </div>
              </div>
              <div style={s.settingValue}>{Math.round(textSize / 16 * 100)}%</div>
            </div>
            <input
              type="range"
              min="12"
              max="32"
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              style={s.slider}
            />

            {/* Confirm Delay */}
            <div style={s.settingRow}>
              <div style={s.settingLeft}>
                <div style={s.settingIcon}>⏱️</div>
                <div>
                  <div style={s.settingLabel}>Confirm Delay</div>
                  <div style={s.settingDesc}>Dwell time before activate</div>
                </div>
              </div>
              <div style={s.settingValue}>{(confirmDelay / 50 * 2.8 + 0.2).toFixed(1)}s</div>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={confirmDelay}
              onChange={(e) => setConfirmDelay(Number(e.target.value))}
              style={s.slider}
            />

            <button style={s.closeSettingsBtn} onClick={() => setShowSettings(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={s.contentArea}>
        <div style={s.contentCenter}>
          <h1 style={s.welcomeHeading}>Welcome back</h1>
          <p style={s.welcomeSubtitle}>Manage presets and calibrate the communication experience.</p>

          <div style={s.cardsContainer}>
            <button style={s.card} onMouseEnter={e => e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,200,200,0.15), 0 1px 3px rgba(0,0,0,0.12)"} onMouseLeave={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)"}>
              <div style={s.cardIconContainer}>📋</div>
              <div style={s.cardText}>
                <div style={s.cardLabel}>View Presets</div>
                <div style={s.cardDesc}>See all configured phrases</div>
              </div>
            </button>

            <button style={s.card} onMouseEnter={e => e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,200,200,0.15), 0 1px 3px rgba(0,0,0,0.12)"} onMouseLeave={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)"}>
              <div style={s.cardIconContainer}>✏️</div>
              <div style={s.cardText}>
                <div style={s.cardLabel}>Edit Layout</div>
                <div style={s.cardDesc}>Customize and reorder presets</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    width: "100vw",
    height: "100vh",
    background: "#0f1419",
    color: "#e8eef2",
    fontFamily: "system-ui, -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "60px",
    padding: "0 32px",
    background: "#0f1419",
    borderBottom: "1px solid rgba(0,200,200,0.1)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 100,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  appName: {
    fontSize: "18px",
    fontWeight: "600",
    letterSpacing: "-0.3px",
    color: "#e8eef2",
  },
  headerRight: {
    display: "flex",
    gap: "8px",
  },
  iconBtn: {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#888e99",
    fontSize: "16px",
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    filter: "saturate(0)",
  },
  contentArea: {
    flex: 1,
    marginTop: "60px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 32px 80px 32px",
  },
  contentCenter: {
    width: "100%",
    maxWidth: "448px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  welcomeHeading: {
    margin: "0 0 8px 0",
    fontSize: "36px",
    fontWeight: "700",
    color: "#e8eef2",
    letterSpacing: "-0.5px",
  },
  welcomeSubtitle: {
    margin: "0 0 32px 0",
    fontSize: "14px",
    color: "#888e99",
    lineHeight: "1.5",
  },
  cardsContainer: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    width: "100%",
    padding: "20px",
    borderRadius: "0.75rem",
    background: "#151b24",
    border: "1px solid rgba(0,200,200,0.1)",
    display: "flex",
    gap: "16px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
    textAlign: "left",
  },
  cardIconContainer: {
    width: "48px",
    height: "48px",
    minWidth: "48px",
    borderRadius: "0.5rem",
    background: "#00c8c8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    transition: "all 0.3s ease",
    filter: "saturate(0) brightness(1.2)",
  },
  cardText: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#e8eef2",
    marginBottom: "4px",
  },
  cardDesc: {
    fontSize: "13px",
    color: "#888e99",
  },
  settingsOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "flex-end",
    zIndex: 200,
  },
  settingsSheet: {
    width: "400px",
    background: "#0f1419",
    borderLeft: "1px solid rgba(0,200,200,0.1)",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    overflowY: "auto",
  },
  settingsTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "600",
    color: "#e8eef2",
  },
  settingsDesc: {
    margin: 0,
    fontSize: "13px",
    color: "#888e99",
  },
  settingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  settingLeft: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    flex: 1,
  },
  settingIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "0.5rem",
    background: "rgba(0,200,200,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    flexShrink: 0,
    filter: "saturate(0) brightness(1.2)",
  },
  settingLabel: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#e8eef2",
  },
  settingDesc: {
    fontSize: "12px",
    color: "#888e99",
    marginTop: "2px",
  },
  settingValue: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#00c8c8",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    minWidth: "40px",
  },
  slider: {
    width: "100%",
    height: "6px",
    borderRadius: "3px",
    background: "rgba(255,255,255,0.08)",
    border: "none",
    outline: "none",
    cursor: "pointer",
    accentColor: "#00c8c8",
  },
  closeSettingsBtn: {
    padding: "10px 16px",
    borderRadius: "6px",
    background: "rgba(0,200,200,0.15)",
    border: "1px solid rgba(0,200,200,0.3)",
    color: "#00c8c8",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
    marginTop: "12px",
  },
};
