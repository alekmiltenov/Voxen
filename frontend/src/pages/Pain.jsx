import { useNavigate } from "react-router-dom";

const BODY_PARTS = [
  "Head",
  "Neck",
  "Chest",
  "Stomach",
  "Back",
  "Left Arm",
  "Right Arm",
  "Legs",
];

export default function Pain() {
  const navigate = useNavigate();

  function speak(part) {
    const text = `My ${part.toLowerCase()} hurts`;
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  return (
    <div style={styles.container}>
      {/* ✅ FIX */}
      <button style={styles.backBtn} onClick={() => navigate("/")}>
        ← Back
      </button>

      <h2 style={styles.title}>
        Choose the area you feel pain in
      </h2>

      <div style={styles.grid}>
        {BODY_PARTS.map((part) => (
          <button
            key={part}
            style={styles.card}
            onClick={() => speak(part)}
          >
            {part}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    width: "100vw",
    background: "#0a0a0a",
    color: "white",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    position: "absolute",
    top: "40px",
    fontSize: "30px",
    fontWeight: "300",
    color: "rgba(255,255,255,0.6)",
  },

  
  backBtn: {
    position: "absolute",
    top: "20px",
    left: "20px",
    padding: "8px 18px",
    borderRadius: "20px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.4)",
    fontSize: "28px",
    cursor: "pointer",
    width: 130,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 180px)",
    gap: "60px",
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    width: "180px",
    height: "180px",
    borderRadius: "30px",
    background: "transparent",
    border: "3px solid white",
    color: "white",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
};