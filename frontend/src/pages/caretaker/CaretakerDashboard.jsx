import { useState } from "react";
import presetsIcon from "../../assets/presets-icon.png";
import settingsIcon from "../../assets/settings-icon.png";

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
          <button style={s.iconBtn} title="Profile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(136, 142, 153)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
          <button style={s.iconBtn} onClick={() => setShowSettings(!showSettings)} title="Settings">
            <img 
              src={settingsIcon} 
              alt="Settings" 
              width="20" 
              //style={{ filter: "invert(61%) sepia(7%) saturate(595%) hue-rotate(182deg) brightness(91%) contrast(85%)" }}
            />
          </button>
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
          <h1 style={s.welcomeHeading}>VOXEN</h1>
          <p style={s.welcomeSubtitle}>Manage presets and calibrate the communication experience.</p>

          <div style={s.cardsContainer}>
            <button style={s.card} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={s.cardIconContainer}>
                <img 
                  src={presetsIcon} 
                  alt="Presets" 
                  width="44" 
                  //style={{ filter: "invert(61%) sepia(7%) saturate(595%) hue-rotate(182deg) brightness(91%) contrast(85%)" }} 
                />
              </div>
              <div style={s.cardText}>
                <div style={s.cardLabel}>View Presets</div>
                <div style={s.cardDesc}>See all configured phrases</div>
              </div>
            </button>

            <button style={s.card} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={s.cardIconContainer}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgb(136, 142, 153)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
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
    background: "#111111",
    color: "#e8eef2",
    fontFamily: "system-ui, -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "48px",
  },
  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "60px",
    padding: "0 32px",
    background: "#111111",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
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
    fontWeight: "400",
    letterSpacing: "0.03em",
    color: "rgba(255,255,255,0.6)",
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
    color: "rgb(136, 142, 153)",
    fontSize: "16px",
    cursor: "pointer",
    transition: "background 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: "18px",
    fontWeight: "300",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  welcomeSubtitle: {
    margin: "0 0 32px 0",
    fontSize: "14px",
    color: "rgba(255,255,255,0.3)",
    lineHeight: "1.5",
  },
  cardsContainer: {
    width: "100%",
    display: "flex",
    flexDirection: "row",
    gap: "20px",
    justifyContent: "center",
  },
  card: {
    flex: 1,
    maxWidth: "200px",
    padding: "32px 24px",
    borderRadius: "20px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "18px",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  cardIconContainer: {
    width: "48px",
    height: "48px",
    minWidth: "48px",
    borderRadius: "0.5rem",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  cardLabel: {
    fontSize: "24px",
    fontWeight: "400",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: "-0.2px",
  },
  cardDesc: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.3)",
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
    height: "100vh",
    boxSizing: "border-box",
    background: "#0d0d0d",
    borderLeft: "1px solid rgba(255,255,255,0.08)",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    overflow: "hidden",
  },
  settingsTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "300",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  settingsDesc: {
    margin: 0,
    fontSize: "13px",
    color: "rgba(255,255,255,0.3)",
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
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    opacity: 0.6,
  },
  settingLabel: {
    fontSize: "14px",
    fontWeight: "400",
    color: "rgba(255,255,255,0.9)",
  },
  settingDesc: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.3)",
    marginTop: "2px",
  },
  settingValue: {
    fontSize: "14px",
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
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
    accentColor: "rgba(255,255,255,0.3)",
  },
  closeSettingsBtn: {
    padding: "10px 16px",
    borderRadius: "6px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.6)",
    fontSize: "14px",
    fontWeight: "400",
    cursor: "pointer",
    transition: "background 0.2s",
    marginTop: "12px",
  },
};
