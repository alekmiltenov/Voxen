from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
import logging

# Suppress Flask access logs
logging.getLogger('werkzeug').setLevel(logging.ERROR)

app = Flask(__name__)
CORS(app, cors_allowed_origins="*")
socketio = SocketIO(app, cors_allowed_origins="*")


# -------- SETTINGS (tunable via /settings) --------

alpha     = 0.6   # EMA smoothing — higher = more responsive, lower = smoother
threshold = 2.0   # tilt magnitude required to trigger a command
deadzone  = 0.8   # ignore small movements below this value


# -------- STATE --------

filtered_x = 0.0
filtered_y = 0.0
filtered_z = 0.0
last_command = None   # tracks previous command to avoid repeats


# -------- COMMAND LOGIC --------

def detect_command(x, y):
    if abs(x) < deadzone and abs(y) < deadzone:
        return None

    # Prefer the dominant axis
    if abs(y) >= abs(x):
        if y >  threshold: return "RIGHT"
        if y < -threshold: return "LEFT"
    else:
        if x >  threshold: return "BACK"
        if x < -threshold: return "FORWARD"

    return None


# -------- RECEIVE RAW DATA FROM ESP32 --------

@app.route('/data', methods=['POST'])
def receive_data():
    global filtered_x, filtered_y, filtered_z, last_command

    body = request.json
    x, y, z = body['x'], body['y'], body['z']

    # Exponential moving average filter
    filtered_x = alpha * x + (1 - alpha) * filtered_x
    filtered_y = alpha * y + (1 - alpha) * filtered_y
    filtered_z = alpha * z + (1 - alpha) * filtered_z

    cmd = detect_command(filtered_x, filtered_y)

    if cmd is not None and cmd != last_command:
        # New distinct command — push immediately to all connected frontends
        last_command = cmd
        print(f"COMMAND: {cmd} | x={filtered_x:.2f}, y={filtered_y:.2f}")
        socketio.emit('command', {'cmd': cmd})

    elif cmd is None:
        # Head returned to neutral — allow the same command to fire again next tilt
        last_command = None

    return jsonify({"status": "ok"})


# -------- SETTINGS ENDPOINTS --------

@app.route('/settings', methods=['GET'])
def get_settings():
    return jsonify({
        "alpha":     alpha,
        "threshold": threshold,
        "deadzone":  deadzone
    })

@app.route('/settings', methods=['POST'])
def update_settings():
    global alpha, threshold, deadzone

    body = request.json
    if 'alpha'     in body: alpha     = float(body['alpha'])
    if 'threshold' in body: threshold = float(body['threshold'])
    if 'deadzone'  in body: deadzone  = float(body['deadzone'])

    print(f"SETTINGS updated — alpha={alpha:.2f}, threshold={threshold:.2f}, deadzone={deadzone:.2f}")
    return jsonify({"alpha": alpha, "threshold": threshold, "deadzone": deadzone})


# -------- RUN --------

if __name__ == "__main__":
    # Use socketio.run() instead of app.run() to enable WebSocket support
    socketio.run(app, host='0.0.0.0', port=5000)