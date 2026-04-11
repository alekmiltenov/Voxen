"""
Live prediction from Pi stream.

Run:
    python predict.py

Shows live feed with predicted gaze label + confidence overlaid.
Press q to quit.
"""

import os
import cv2
import torch
import numpy as np
from stream_client import frames
from eye_tracking import EyeTrackCNN, LABELS, preprocess_eye_frame

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pt")
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"

LABEL_COLORS = {
    1: (0,   140, 255),  # LEFT   — orange
    2: (255, 200,   0),  # RIGHT  — cyan-ish
    3: (0,   255, 120),  # UP     — green
    4: (0,    80, 255),  # DOWN   — red
    5: (180,   0, 255),  # CENTER — purple
}


def load_model():
    model = EyeTrackCNN().to(DEVICE)
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
    model.eval()
    return model


def predict(model, bgr):
    gray64 = preprocess_eye_frame(bgr)
    t = torch.tensor(gray64 / 255.0, dtype=torch.float32).unsqueeze(0).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        probs = model(t)[0]  # (5,)
    idx        = probs.argmax().item()
    label      = idx + 1          # model outputs 0–4, labels are 1–5
    confidence = probs[idx].item()
    return label, confidence


def draw(bgr, label, confidence):
    out   = bgr.copy()
    h, w  = out.shape[:2]
    name  = LABELS[label]
    color = LABEL_COLORS[label]
    text  = f"{name}  {confidence*100:.1f}%"

    # big label top-left
    cv2.putText(out, text, (16, 52),
                cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 0, 0), 5)
    cv2.putText(out, text, (16, 52),
                cv2.FONT_HERSHEY_SIMPLEX, 1.4, color, 3)

    # confidence bar at bottom
    bar_w = int(w * confidence)
    cv2.rectangle(out, (0, h - 8), (bar_w, h), color, -1)

    cv2.putText(out, "q: quit", (12, h - 16),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, (90, 90, 90), 1)
    return out


def main():
    if not os.path.exists(MODEL_PATH):
        print(f"No model found at {MODEL_PATH}. Run train.py first.")
        return

    print(f"Loaded model from {MODEL_PATH}  [{DEVICE}]")
    model = load_model()

    for bgr in frames():
        label, conf = predict(model, bgr)
        cv2.imshow("Voxen — predict", draw(bgr, label, conf))
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
