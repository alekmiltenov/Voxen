"""
Training data collector.

Controls:
  1  LEFT
  2  RIGHT
  3  UP
  4  DOWN
  5  CLOSED  (eyes shut)
  d  undo last saved sample
  q  quit

Run:
    python collect.py

Default source:
    FastAPI MJPEG stream at http://localhost:8000/camera/stream

Optional (legacy Pi TCP stream):
    python collect.py --source pi
"""

import argparse
import os
import sqlite3
import time
import cv2
from eye_tracking import LABELS, IMG_H, IMG_W

DB     = os.path.join(os.path.dirname(__file__), "training_data.db")
TARGET = 80   # samples per class before label turns green


# ── frame sources ─────────────────────────────────────────────────────────────
def frames_from_backend(url: str = "http://localhost:8000/camera/stream"):
    """Yield frames from FastAPI MJPEG endpoint with auto-reconnect."""
    while True:
        cap = cv2.VideoCapture(url)
        if not cap.isOpened():
            print(f"[collect] cannot open backend stream: {url} (retry in 2s)")
            time.sleep(2)
            continue

        print(f"[collect] connected to backend stream: {url}")
        try:
            while True:
                ok, frame = cap.read()
                if not ok or frame is None:
                    print("[collect] backend stream lost (retry in 2s)")
                    break
                yield frame
        finally:
            cap.release()
            time.sleep(2)


def get_frames(source: str):
    if source == "pi":
        from stream_client import frames as pi_frames
        return pi_frames()
    return frames_from_backend()


# ── DB ────────────────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS frames (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            label INTEGER NOT NULL,
            image BLOB    NOT NULL,
            ts    TEXT    DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    return conn


def save_frame(conn, label: int, gray_64):
    _, png = cv2.imencode(".png", gray_64)
    conn.execute("INSERT INTO frames (label, image) VALUES (?, ?)",
                 (label, png.tobytes()))
    conn.commit()


def delete_last(conn):
    conn.execute("DELETE FROM frames WHERE id = (SELECT MAX(id) FROM frames)")
    conn.commit()


def get_counts(conn) -> dict:
    rows = conn.execute(
        "SELECT label, COUNT(*) FROM frames GROUP BY label"
    ).fetchall()
    return {r[0]: r[1] for r in rows}


# ── overlay ───────────────────────────────────────────────────────────────────
def draw(bgr, cnt, banner, banner_ts):
    h, w  = bgr.shape[:2]
    out   = bgr.copy()

    # label buttons — bottom
    for label, name in LABELS.items():
        c     = cnt.get(label, 0)
        color = (0, 210, 80) if c >= TARGET else (200, 200, 200)
        x     = 12 + (label - 1) * 130
        cv2.putText(out, f"[{label}] {name}: {c}",
                    (x, h - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.48, color, 1)

    # banner
    if banner and (time.time() - banner_ts) < 1.5:
        cv2.putText(out, banner, (12, 36),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 210, 80), 2)

    cv2.putText(out, "1-5: save label   d: undo   q: quit",
                (12, h - 36), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (90, 90, 90), 1)
    return out


# ── main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Collect eye-tracking training data")
    parser.add_argument(
        "--source",
        choices=["backend", "pi"],
        default="backend",
        help="Frame source: backend (default) uses /camera/stream, pi uses legacy TCP stream_client",
    )
    args = parser.parse_args()

    conn      = init_db()
    print(f"[collect] writing to DB: {DB}")
    banner    = ""
    banner_ts = 0.0

    for bgr in get_frames(args.source):
        cnt = get_counts(conn)

        cv2.imshow("Voxen — collect", draw(bgr, cnt, banner, banner_ts))
        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break

        elif chr(key) in "12345":
            label  = int(chr(key))
            gray64 = cv2.resize(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), (IMG_W, IMG_H))
            save_frame(conn, label, gray64)
            banner    = f"saved  {LABELS[label]}"
            banner_ts = time.time()

        elif key == ord("d"):
            delete_last(conn)
            banner    = "deleted last"
            banner_ts = time.time()

    conn.close()
    cv2.destroyAllWindows()
    print(f"Done — {DB}")


if __name__ == "__main__":
    main()
