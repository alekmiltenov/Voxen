import { useNavigate } from "react-router-dom";
import DwellButton from "../components/DwellButton";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={s.page}>
      <p style={s.title}>Voxen</p>
      <div style={s.grid}>
        <DwellButton style={s.card}
          hoverBg="rgba(255,255,255,0.05)"
          onClick={() => navigate("/communicate")}>
          <span style={s.cardIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span style={s.cardTitle}>Communicate</span>
          <span style={s.cardSub}>Build sentences with suggestions</span>
        </DwellButton>

        <DwellButton style={s.card}
          hoverBg="rgba(255,255,255,0.05)"
          onClick={() => navigate("/actions")}>
          <span style={s.cardIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </span>
          <span style={s.cardTitle}>Actions</span>
          <span style={s.cardSub}>One-tap for common needs</span>
        </DwellButton>
      </div>

      <DwellButton
        style={s.calibrateBtn}
        hoverBg="rgba(255,255,255,0.06)"
        onClick={() => navigate("/eye")}
      >
        👁 Eye Tracking
      </DwellButton>
    </div>
  );
}

const s = {
  page: {
    width:          "100vw",
    height:         "100vh",
    background:     "#111111",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "48px",
  },
  title: {
    fontSize:      "22px",
    fontWeight:    "300",
    color:         "rgba(255,255,255,0.35)",
    margin:        0,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "20px",
    width:               "min(860px, 90vw)",
  },
  card: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "18px",
    padding:        "56px 40px",
    borderRadius:   "20px",
    background:     "transparent",
    border:         "1px solid rgba(255,255,255,0.1)",
    cursor:         "pointer",
    transition:     "background 0.2s",
  },
  cardIcon: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    opacity:        0.6,
  },
  cardTitle: {
    fontSize:      "24px",
    fontWeight:    "400",
    color:         "rgba(255,255,255,0.9)",
    letterSpacing: "-0.2px",
  },
  cardSub: {
    fontSize: "14px",
    color:    "rgba(255,255,255,0.3)",
  },
  calibrateBtn: {
    padding:      "12px 28px",
    borderRadius: "14px",
    background:   "transparent",
    border:       "1px solid rgba(255,255,255,0.1)",
    color:        "rgba(255,255,255,0.35)",
    fontSize:     "14px",
    fontWeight:   "300",
    cursor:       "pointer",
    letterSpacing: "0.04em",
  },
};
