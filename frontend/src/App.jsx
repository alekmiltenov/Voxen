import { useEffect, useState } from "react";

const SERVER = "http://10.159.169.128:5000";

export default function App() {
  const [command, setCommand] = useState(null);
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState("MID");

  const boxes = ["LEFT", "RIGHT", "FORWARD", "BACK"];

  // -------- FETCH COMMAND --------
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER}/command`);
        const data = await res.json();

        if (data.cmd) {
          handleCommand(data.cmd);
        }
      } catch (e) {}
    }, 100); // refresh rate

    return () => clearInterval(interval);
  }, []);

  // -------- HANDLE COMMAND --------
  const handleCommand = (cmd) => {
    setCommand(cmd);

    if (cmd === "LEFT") {
      setSelected(0);
    } else if (cmd === "RIGHT") {
      setSelected(1);
    } else if (cmd === "FORWARD") {
      alert(`Кутия ${selected + 1} е избрана`);
    } else if (cmd === "BACK") {
      setSelected(3);
    }
  };

  // -------- CHANGE MODE --------
  const changeMode = async (newMode) => {
    setMode(newMode);

    await fetch(`${SERVER}/mode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: newMode }),
    });
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Head Control UI</h1>

      {/* DROPDOWN */}
      <select
        value={mode}
        onChange={(e) => changeMode(e.target.value)}
      >
        <option value="LOW">LOW</option>
        <option value="MID">MID</option>
        <option value="HIGH">HIGH</option>
      </select>

      {/* BOXES */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 150px)",
          gap: 20,
          marginTop: 40,
        }}
      >
        {boxes.map((box, index) => (
          <div
            key={index}
            style={{
              height: 150,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid black",
              background: selected === index ? "#4caf50" : "#eee",
              fontSize: 18,
              fontWeight: "bold",
            }}
          >
            {box}
          </div>
        ))}
      </div>

      {/* DEBUG */}
      <p style={{ marginTop: 20 }}>Command: {command}</p>
    </div>
  );
}