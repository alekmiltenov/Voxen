"""
CNN inference server — serves latest gaze prediction over HTTP.

Run:
    python nn_server.py

Endpoints:
    GET /predict  →  { label, name, confidence }
    GET /health   →  { status }

Runs on port 5001.  Frontend polls /predict every ~100 ms.
"""

import os
import sys
import threading
import cv2
import torch
import numpy as np
from flask import Flask, jsonify
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(__file__))
from stream_client import frames
from eye_tracking import EyeTrackCNN, LABELS, IMG_H, IMG_W

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pt")
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"

app = Flask(__name__)
CORS(app)

# ── shared prediction state ────────────────────────────────────────────────
_lock       = threading.Lock()
_prediction = {"label": 0, "name": "NONE", "confidence": 0.0, "ready": False}


# ── inference loop (background thread) ────────────────────────────────────
def inference_loop():
    if not os.path.exists(MODEL_PATH):
        print(f"[nn_server] model not found at {MODEL_PATH} — run train.py first")
        return

    model = EyeTrackCNN().to(DEVICE)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
    model.eval()
    print(f"[nn_server] model loaded ({DEVICE})")

    for bgr in frames():
        gray   = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        gray64 = cv2.resize(gray, (IMG_W, IMG_H))
        t = (torch.tensor(gray64 / 255.0, dtype=torch.float32)
                  .unsqueeze(0).unsqueeze(0).to(DEVICE))

        with torch.no_grad():
            probs = model(t)[0]          # (5,)

        idx   = probs.argmax().item()
        label = idx + 1                  # model 0-4 → labels 1-5
        conf  = probs[idx].item()

        with _lock:
            _prediction["label"]      = label
            _prediction["name"]       = LABELS[label]
            _prediction["confidence"] = round(conf, 4)
            _prediction["ready"]      = True


# ── routes ────────────────────────────────────────────────────────────────
@app.route("/predict")
def predict():
    with _lock:
        return jsonify(dict(_prediction))


@app.route("/health")
def health():
    with _lock:
        return jsonify({"status": "ok", "ready": _prediction["ready"]})


# ── entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    t = threading.Thread(target=inference_loop, daemon=True)
    t.start()
    print("[nn_server] inference thread started, listening on :5001")
    app.run(host="0.0.0.0", port=5001)
