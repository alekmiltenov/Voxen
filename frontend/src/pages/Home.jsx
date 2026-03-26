export default function Home() {
  return (
    <div style={styles.container}>
      <h1>Voxen</h1>

      <div style={styles.grid}>
        <button style={styles.button}>Basic Needs</button>
        <button style={styles.button}>Health</button>
        <button style={styles.button}>Emotions</button>
        <button style={styles.button}>Pain</button>
      </div>

      <button style={styles.emergency}>EMERGENCY</button>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    padding: "20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },
  button: {
    fontSize: "24px",
    padding: "30px",
    borderRadius: "12px",
  },
  emergency: {
    marginTop: "30px",
    background: "red",
    color: "white",
    fontSize: "28px",
    padding: "20px 40px",
    borderRadius: "20px",
  },
};