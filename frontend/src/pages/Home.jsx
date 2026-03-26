import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <h1>Voxen</h1>
        
      <button style={styles.big} onClick={() => navigate("/communicate")}>
        Communicate
      </button>

      <button style={styles.big} onClick={() => navigate("/actions")}>
        Actions
      </button>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "40px",
    marginTop: "100px",
  },
  big: {
    fontSize: "32px",
    padding: "40px 80px",
    borderRadius: "20px",
  },
};