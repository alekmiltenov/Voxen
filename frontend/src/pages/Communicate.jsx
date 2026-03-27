import { phrases } from "../data/phrases";
import { useNavigate } from "react-router-dom";

export default function Communicate() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <h2>Choose phrase</h2>

      {phrases.map((p) => (
        <button
          key={p.id}
          style={styles.button}
          onClick={() => navigate(`/suggest/${p.id}`)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    padding: "40px",
  },
  button: {
    fontSize: "28px",
    padding: "25px",
    borderRadius: "15px",
  },
};