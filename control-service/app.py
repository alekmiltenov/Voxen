from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
import logging

logging.getLogger('werkzeug').setLevel(logging.ERROR)
print("STARTING SERVER...")
app = Flask(__name__)
CORS(app, cors_allowed_origins="*")
socketio = SocketIO(app, cors_allowed_origins="*")


# -------- SETTINGS --------

alpha     = 0.5   # EMA smoothing
threshold = 1.5   # tilt magnitude to trigger a command
deadzone  = 1.0   # ignore movements below this value


# -------- STATE --------

filtered_x = 0.0
filtered_y = 0.0
filtered_z = 0.0


# -------- COMMAND LOGIC --------

def detect_command(x, y):
    """
    Returns the active command for the current filtered position,
    or None if the head is in the neutral zone.
    No deduplication here — that is entirely the frontend's job.
    """
    if abs(x) < deadzone and abs(y) < deadzone:
        return None

    # Dominant axis wins
    if abs(y) >= abs(x):
        if y >  threshold: return "RIGHT"
        if y < -threshold: return "LEFT"
    else:
        if x >  threshold: return "BACK"
        if x < -threshold: return "FORWARD"

    return None


# -------- RECEIVE DATA FROM ESP32 --------

@app.route('/data', methods=['POST'])
def receive_data():
    global filtered_x, filtered_y, filtered_z
    
    body = request.json
    x, y, z = body['x'], body['y'], body['z']

    # EMA filter
    filtered_x = alpha * x + (1 - alpha) * filtered_x
    filtered_y = alpha * y + (1 - alpha) * filtered_y
    filtered_z = alpha * z + (1 - alpha) * filtered_z

    cmd = detect_command(filtered_x, filtered_y)

    # Always emit — None means "neutral", frontend needs that to reset hold timers.
    # LEFT/RIGHT: frontend fires on first cmd change, ignores repeats.
    # FORWARD/BACK: frontend measures hold duration from the repeated stream.
    socketio.emit('command', {'cmd': cmd})

    if cmd:
        print(f"CMD={cmd:8s} | x={filtered_x:+.2f}  y={filtered_y:+.2f}")

    return jsonify({"status": "ok"})


# -------- SETTINGS --------

@app.route('/settings', methods=['GET'])
def get_settings():
    return jsonify({"alpha": alpha, "threshold": threshold, "deadzone": deadzone})

@app.route('/settings', methods=['POST'])
def update_settings():
    global alpha, threshold, deadzone

    body = request.json
    if 'alpha'     in body: alpha     = float(body['alpha'])
    if 'threshold' in body: threshold = float(body['threshold'])
    if 'deadzone'  in body: deadzone  = float(body['deadzone'])

    print(f"SETTINGS — alpha={alpha:.2f}  threshold={threshold:.2f}  deadzone={deadzone:.2f}")
    return jsonify({"alpha": alpha, "threshold": threshold, "deadzone": deadzone})


# -------- RUN --------

if __name__ == "__main__":
    socketio.run(app, host='0.0.0.0', port=5000)