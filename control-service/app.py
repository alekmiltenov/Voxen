from flask import Flask, request, jsonify
import logging
from flask_cors import CORS
# махаме Flask spam логове
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)
CORS(app)

# -------- SETTINGS --------

mode = "MID"

# filtering (EMA)
filtered_x = 0
filtered_y = 0
filtered_z = 0
alpha = 0.2

# state
last_command = None
last_command_global = None


# -------- THRESHOLDS --------

def get_threshold():
    if mode == "LOW":
        return 3.0
    elif mode == "MID":
        return 2.0
    else:  # HIGH
        return 1.2


def get_deadzone():
    return 0.8


# -------- COMMAND LOGIC --------

def detect_command(x, y):
    threshold = get_threshold()
    deadzone = get_deadzone()

    # dead zone → нищо
    if abs(x) < deadzone and abs(y) < deadzone:
        return None

    # LEFT / RIGHT
    if y > threshold:
        return "RIGHT"
    elif y < -threshold:
        return "LEFT"

    # FORWARD / BACK
    if x > threshold:
        return "BACK"
    elif x < -threshold:
        return "FORWARD"

    return None


# -------- RECEIVE RAW --------

@app.route('/data', methods=['POST'])
def data():
    global filtered_x, filtered_y, filtered_z
    global last_command, last_command_global

    data = request.json

    x = data['x']
    y = data['y']
    z = data['z']

    # -------- FILTERING --------
    filtered_x = alpha * x + (1 - alpha) * filtered_x
    filtered_y = alpha * y + (1 - alpha) * filtered_y
    filtered_z = alpha * z + (1 - alpha) * filtered_z

    # -------- DETECT --------
    cmd = detect_command(filtered_x, filtered_y)

    # -------- UPDATE GLOBAL COMMAND --------
    if cmd != last_command and cmd is not None:
        print(f"COMMAND: {cmd} | x={filtered_x:.2f}, y={filtered_y:.2f}")
        last_command = cmd
        last_command_global = cmd

    return jsonify({"cmd": cmd})


# -------- FRONTEND FETCH --------

@app.route('/command', methods=['GET'])
def get_command():
    return jsonify({"cmd": last_command_global})


# -------- MODE CONTROL --------

@app.route('/mode', methods=['POST'])
def set_mode():
    global mode

    data = request.json
    mode = data["mode"].upper()

    print("MODE:", mode)

    return jsonify({"mode": mode})


@app.route('/mode', methods=['GET'])
def get_mode():
    return jsonify({"mode": mode})


# -------- RUN --------

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)