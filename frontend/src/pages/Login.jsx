import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiPost, setToken } from "../auth";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiPost("/auth/login", { email, password });
      setToken(data.token);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Voxen</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          style={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Log In"}
        </button>
      </form>
      <p style={styles.footer}>
        No account?{" "}
        <Link to="/signup" style={styles.link}>
          Sign up
        </Link>
      </p>
    </div>
  );
}

const styles = {
  container: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    minHeight:      "100vh",
    gap:            "24px",
  },
  title: {
    fontSize: "48px",
    margin:   0,
  },
  form: {
    display:       "flex",
    flexDirection: "column",
    gap:           "16px",
    width:         "100%",
    maxWidth:      "420px",
  },
  input: {
    fontSize:     "22px",
    padding:      "18px 20px",
    borderRadius: "12px",
    border:       "2px solid #ccc",
    outline:      "none",
  },
  button: {
    fontSize:     "24px",
    padding:      "20px",
    borderRadius: "12px",
    border:       "none",
    background:   "#1a1a1a",
    color:        "#fff",
    cursor:       "pointer",
    marginTop:    "8px",
  },
  error: {
    color:     "#c00",
    margin:    0,
    fontSize:  "18px",
    textAlign: "center",
  },
  footer: {
    fontSize: "18px",
  },
  link: {
    color:          "#1a1a1a",
    fontWeight:     "bold",
    textDecoration: "none",
  },
};
