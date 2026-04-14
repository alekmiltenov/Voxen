export default function RecenterOverlay() {
  return (
    <>
      <style>
        {`@keyframes recenterPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.75; }
        }`}
      </style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 10050,
          opacity: 1,
          transition: "opacity 200ms ease",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "9999px",
              backgroundColor: "#ffffff",
              boxShadow: "0 0 14px rgba(255, 255, 255, 0.75)",
              animation: "recenterPulse 1s ease-in-out infinite",
            }}
          />

          <div
            style={{
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: 600,
              letterSpacing: "0.01em",
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
            }}
          >
            Look here
          </div>
        </div>
      </div>
    </>
  );
}
