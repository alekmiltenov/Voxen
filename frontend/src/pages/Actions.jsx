import { useState } from "react";

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
      </div>
    </div>
  );
}


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