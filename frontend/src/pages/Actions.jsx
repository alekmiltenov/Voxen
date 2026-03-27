import { useState } from "react";
<<<<<<< Updated upstream

export default function Actions() {
  const [lightsOn, setLightsOn] = useState(false);
  const [temperature, setTemperature] = useState(22);
  const [audio, setAudio] = useState(null);

  // 🔊 beep
  const playBeep = () => {
    const beep = new Audio("https://www.soundjay.com/buttons/beep-01a.mp3");
    beep.play();
  };

  const handleEmergency = () => {
    playBeep();
    alert("🚨 Emergency Alert Sent!");
  };

  const handleLights = () => {
    setLightsOn((prev) => !prev);
    speechSynthesis.speak(
      new SpeechSynthesisUtterance(
        lightsOn ? "Lights turned off" : "Lights turned on"
      )
    );
  };

  const handleMusic = () => {
    if (audio) {
      audio.pause();
      setAudio(null);
    } else {
      const newAudio = new Audio(
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
      );
      newAudio.play();
      setAudio(newAudio);
    }
  };

  const handleBell = () => {
    const bell = new Audio(
      "https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3"
    );
    bell.play();
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Actions</h2>

      <div style={styles.grid}>


        <button style={styles.btn}>
          💬 Send Message
        </button>

        <button style={styles.emergency} onClick={handleEmergency}>
          🚨 Emergency Alert
        </button>

        <button style={styles.btn} onClick={handleLights}>
          💡 Lights: {lightsOn ? "ON" : "OFF"}
        </button>

        <button style={styles.tempRow}>
  <div style={styles.tempLeft} >
    🌡Temperature {temperature}°C
  </div>

  <div style={styles.tempRight}>
    <button
      style={styles.tempArrow}
      onClick={(e) => {
        e.stopPropagation();
        setTemperature((t) => Math.min(t + 1, 30));
        speechSynthesis.speak(
          new SpeechSynthesisUtterance("Please set the temperature higher")
        );
      }}
    >
      ⬆
    </button>

    <button
      style={styles.tempArrow}
      onClick={(e) => {
        e.stopPropagation();
        setTemperature((t) => Math.max(t - 1, 16));
        speechSynthesis.speak(
          new SpeechSynthesisUtterance("Please set the temperature lower")
        );
      }}
    >
      ⬇
    </button>
  </div>
</button>
        <button style={styles.btn} onClick={handleMusic}>
          🎵 {audio ? "Stop Music" : "Play Music"}
        </button>

        <button style={styles.btn} onClick={handleBell}>
          🔔 Ring Bell
        </button>
=======
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";

const ACTIONS = [
  { id: 2, label: "Emergency",  sub: "Send alert to caregiver", icon: "🚨" },
  { id: 1, label: "Call",       sub: "Call caregiver",          icon: "📞" },
  { id: 3, label: "AI Chat",    sub: "Open assistant",          icon: "🤖" },
  { id: 4, label: "Lights",     sub: "Toggle smart lights",     icon: "💡" },
];

export default function Actions() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);

  async function runAction(id) {
    setStatus(null);
    try {
      const res = await apiPost("/actions/execute", { action: id });
      setStatus({ msg: res.message ?? "Done", ok: true });
    } catch (e) {
      setStatus({ msg: e.message, ok: false });
    }
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate("/")}>← Back</button>
        <span style={s.title}>Actions</span>
        <div style={{ width: 80 }} />
      </div>

      {status && (
        <div style={{ ...s.toast, opacity: status.ok ? 0.7 : 0.9,
          borderColor: status.ok ? "rgba(255,255,255,0.15)" : "rgba(255,80,80,0.4)" }}>
          {status.msg}
        </div>
      )}

      <div style={s.grid}>
        {ACTIONS.map(a => (
          <button key={a.id} style={s.card}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            onClick={() => runAction(a.id)}>
            <span style={s.icon}>{a.icon}</span>
            <span style={s.label}>{a.label}</span>
            <span style={s.sub}>{a.sub}</span>
          </button>
        ))}
>>>>>>> Stashed changes
      </div>
    </div>
  );
}

<<<<<<< Updated upstream

const styles = {
  container: {
    padding: "40px",
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "white",
    fontFamily: "Arial, sans-serif",
  },
  title: {
    textAlign: "center",
    marginBottom: "30px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },
  btn: {
    padding: "30px",
    fontSize: "20px",
    borderRadius: "20px",
    background: "#111",
    border: "2px solid #00ffc3",
    color: "white",
    cursor: "pointer",
  },
  emergency: {
    padding: "30px",
    fontSize: "20px",
    borderRadius: "20px",
    border: "2px solid red",
    color: "red",
    background: "#111",
    cursor: "pointer",
  },


tempRow: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "30px",
  fontSize: "22px",
  borderRadius: "20px",
  background: "#111",
  border: "2px solid #ffaa00",
  color: "#ffaa00",
  width: "100%",
},

tempLeft: {
  fontSize: "24px",
  fontWeight: "bold",
  paddingLeft: "70px",
},

tempRight: {
  display: "flex",
  gap: "10px",
},

tempArrow: {
  padding: "10px 15px",
  fontSize: "18px",
  borderRadius: "10px",
  border: "2px solid #ffaa00",
  background: "#000",
  color: "#ffaa00",
  cursor: "pointer",
},
};
=======
const s = {
  page: {
    width:         "100vw",
    height:        "100vh",
    background:    "#111111",
    display:       "flex",
    flexDirection: "column",
    padding:       "28px 32px",
    gap:           "28px",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
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
    fontSize:   "18px",
    fontWeight: "300",
    color:      "rgba(255,255,255,0.5)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  toast: {
    padding:      "12px 20px",
    borderRadius: "12px",
    border:       "1px solid",
    color:        "rgba(255,255,255,0.7)",
    fontSize:     "15px",
    textAlign:    "center",
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "16px",
    flex:                1,
  },
  card: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "14px",
    borderRadius:   "18px",
    background:     "transparent",
    border:         "1px solid rgba(255,255,255,0.1)",
    cursor:         "pointer",
    transition:     "background 0.15s",
  },
  icon: {
    fontSize: "44px",
  },
  label: {
    fontSize:   "20px",
    fontWeight: "400",
    color:      "rgba(255,255,255,0.85)",
  },
  sub: {
    fontSize: "13px",
    color:    "rgba(255,255,255,0.3)",
  },
};
>>>>>>> Stashed changes
