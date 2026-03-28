import uvicorn
import math
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import socketio

# ------------------------------------------------------------------
# SOCKET.IO + FASTAPI
# ------------------------------------------------------------------
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
socket_app = socketio.ASGIApp(sio, other_app=app)

# ------------------------------------------------------------------
# SETTINGS
# ------------------------------------------------------------------
alpha = 0.55
min_strength = 0.04
direction_margin = 0.01
cooldown_ms = 700

# ------------------------------------------------------------------
# STATE
# ------------------------------------------------------------------
filtered_x = 0.0
filtered_y = 0.0
last_command = None
last_emit_ms = 0

# center is set by frontend auto-center, pushed via /settings
calibration = {
    "center": {"x": 0.0, "y": 0.0},
    "left":   {"x": -0.2, "y": 0.0},
    "right":  {"x":  0.2, "y": 0.0},
    "up":     {"x": 0.0, "y": -0.2},
    "down":   {"x": 0.0, "y":  0.2},
}

# ------------------------------------------------------------------
# HELPERS
# ------------------------------------------------------------------
def now_ms() -> int:
    return int(time.time() * 1000)

def ema(new_value: float, old_value: float, a: float) -> float:
    return a * new_value + (1.0 - a) * old_value

def detect_command(x: float, y: float):
    cx = calibration["center"]["x"]
    cy = calibration["center"]["y"]
    dx = x - cx
    dy = y - cy
    strength = math.hypot(dx, dy)

    if strength < min_strength:
        return None, strength

    angle = math.degrees(math.atan2(dy, dx))

    if -45 <= angle < 45:
        cmd = "RIGHT"
    elif 45 <= angle < 135:
        cmd = "DOWN"
    elif angle >= 135 or angle < -135:
        cmd = "LEFT"
    else:
        cmd = "UP"

    return cmd, strength


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


# ------------------------------------------------------------------
# API
# ------------------------------------------------------------------
@app.post("/data")
async def receive_data(request: Request):
    global filtered_x, filtered_y, last_command, last_emit_ms

    body = await request.json()
    x = float(body.get("x", 0.0))
    y = float(body.get("y", 0.0))

    filtered_x = ema(x, filtered_x, alpha)
    filtered_y = ema(y, filtered_y, alpha)

    cmd, strength = detect_command(filtered_x, filtered_y)
    current_ms = now_ms()

    if cmd is None:
        last_command = None
        return JSONResponse({
            "status": "ok", "command": None,
            "x": filtered_x, "y": filtered_y, "strength": strength,
        })

    if cmd != last_command and (current_ms - last_emit_ms) >= cooldown_ms:
        last_command = cmd
        last_emit_ms = current_ms
        payload = {
            "cmd": cmd,
            "x": round(filtered_x, 4),
            "y": round(filtered_y, 4),
            "strength": round(strength, 4),
        }
        print(f"COMMAND: {cmd} | x={filtered_x:.3f}, y={filtered_y:.3f}, str={strength:.3f}")
        await sio.emit("command", payload)

    return JSONResponse({
        "status": "ok", "command": cmd,
        "x": filtered_x, "y": filtered_y, "strength": strength,
    })


@app.get("/settings")
async def get_settings():
    return JSONResponse({
        "alpha": alpha, "min_strength": min_strength,
        "direction_margin": direction_margin, "cooldown_ms": cooldown_ms,
        "calibration": calibration,
    })


@app.post("/settings")
async def update_settings(request: Request):
    global alpha, min_strength, direction_margin, cooldown_ms, calibration

    body = await request.json()
    if "alpha" in body:            alpha = float(body["alpha"])
    if "min_strength" in body:     min_strength = float(body["min_strength"])
    if "direction_margin" in body: direction_margin = float(body["direction_margin"])
    if "cooldown_ms" in body:      cooldown_ms = int(body["cooldown_ms"])

    if "calibration" in body and isinstance(body["calibration"], dict):
        incoming = body["calibration"]
        merged = {}
        for key in ["center", "left", "right", "up", "down"]:
            point = incoming.get(key, calibration.get(key, {"x": 0.0, "y": 0.0}))
            merged[key] = {"x": float(point.get("x", 0.0)), "y": float(point.get("y", 0.0))}
        calibration = merged

    print(f"SETTINGS updated — center=({calibration['center']['x']:.3f}, {calibration['center']['y']:.3f}), min_str={min_strength:.3f}")
    return JSONResponse({
        "alpha": alpha, "min_strength": min_strength,
        "direction_margin": direction_margin, "cooldown_ms": cooldown_ms,
        "calibration": calibration,
    })


@app.get("/health")
async def health():
    return JSONResponse({"ok": True})


if __name__ == "__main__":
    uvicorn.run(socket_app, host="0.0.0.0", port=5001)
