from flask import Flask, request, jsonify
import logging

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)

# sensitivity режим
mode = "LOW"  # LOW, MID, HIGH

# последна команда (за да не спамим)
last_command = "NONE"

def get_threshold():
    if mode == "LOW":
        return 3.0   # трудно trigger-ва
    elif mode == "MID":
        return 2.0
    else:  # HIGH
        return 1.0   # много чувствително


def detect_command(x, y, z):
    global last_command

    threshold = get_threshold()

    cmd = "OVER"

    # LEFT / RIGHT (Y ос)
    if y > threshold:
        cmd = "RIGHT"
    elif y < -threshold:
        cmd = "LEFT"

    # FORWARD / BACK (X ос)
    elif x > threshold:
        cmd = "BACK"
    elif x < -threshold:
        cmd = "FORWARD"

    # НЕ спамим една и съща команда
    if cmd == last_command:
        return None

    last_command = cmd
    return cmd


# -------- RECEIVE RAW --------
@app.route('/data', methods=['POST'])
def data():
    data = request.json

    x = data['x']
    y = data['y']
    z = data['z']

    cmd = detect_command(x, y, z)

    if cmd:
        print("COMMAND:", cmd)

    return jsonify({"cmd": cmd})


# -------- SET MODE --------
@app.route('/mode', methods=['POST'])
def set_mode():
    global mode

    data = request.json
    mode = data["mode"].upper()

    print("MODE:", mode)

    return jsonify({"mode": mode})


# -------- GET MODE --------
@app.route('/mode', methods=['GET'])
def get_mode():
    return jsonify({"mode": mode})


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)