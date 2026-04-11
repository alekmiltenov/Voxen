"""
Training data collector.

Controls:
  1  LEFT
  2  RIGHT
  3  UP
  4  DOWN
    5  CENTER  (neutral gaze)
  d  undo last saved sample
  q  quit

Run:
    python collect.py

Sources:
    esp32 (default):    ESP32-S3 WebSocket stream at ws://localhost:8000/ws/esp32/camera
    backend (fallback): FastAPI MJPEG stream at http://localhost:8000/camera/stream
    pi (legacy):        Raspberry Pi TCP stream_client
"""

import argparse
import os
import sqlite3
import time
import threading
import queue
import cv2
import numpy as np
try:
    import websocket
except ImportError:
    websocket = None
from eye_tracking import LABELS, preprocess_eye_frame

DB     = os.path.join(os.path.dirname(__file__), "training_data.db")
TARGET = 80   # samples per class before label turns green
JPEG_QUALITY = 70  # JPEG compression quality (0-100)
BATCH_COMMIT_INTERVAL = 1.0  # seconds
BATCH_COMMIT_SIZE = 20  # inserts per batch
ESP32_WS_URL = "ws://localhost:8000/ws/esp32/preview"  # ESP32 preview endpoint
BACKEND_MJPEG_URL = "http://localhost:8000/camera/stream"  # FastAPI MJPEG fallback


# ── frame sources ─────────────────────────────────────────────────────────────
def frames_from_esp32(ws_url: str = ESP32_WS_URL):
    """Yield frames from ESP32 via WebSocket with latest-frame-only pattern.
    
    - Receives JPEG binary data from WebSocket
    - Decodes with cv2.imdecode (no CPU-heavy OpenCV buffering)
    - Drops old frames if processing lags (low-latency priority)
    """
    if websocket is None:
        raise ImportError("websocket-client required for ESP32 source. Install: pip install websocket-client")
    
    frame_queue = queue.Queue(maxsize=1)  # Keep only the latest frame
    
    def ws_receiver():
        """Background thread: receive JPEG frames from ESP32 WebSocket."""
        while True:
            try:
                def on_message(ws, message):
                    """Handle incoming JPEG frame (latest-frame-only).
                    
                    Only enqueue binary frames (ignore text messages).
                    """
                    # Only process binary frames
                    if isinstance(message, bytes) and len(message) > 0:
                        try:
                            frame_queue.put_nowait(message)
                        except queue.Full:
                            # Drop oldest frame, insert new one (latest-frame-only)
                            try:
                                frame_queue.get_nowait()
                            except queue.Empty:
                                pass
                            frame_queue.put_nowait(message)
                
                ws = websocket.WebSocketApp(
                    ws_url,
                    on_message=on_message,
                    on_error=lambda ws, err: print(f"[collect] WebSocket error: {err}"),
                    on_close=lambda ws, c, m: print("[collect] ESP32 WebSocket closed (retry in 2s)")
                )
                print(f"[collect] connected to ESP32: {ws_url}")
                ws.run_forever()
            except Exception as e:
                print(f"[collect] cannot connect to ESP32: {ws_url} (retry in 2s)")
                print(f"  Error: {e}")
            time.sleep(2)
    
    # Start background receiver thread (daemon: exits with main)
    receiver_thread = threading.Thread(target=ws_receiver, daemon=True)
    receiver_thread.start()
    
    # Main frame generator loop
    while True:
        try:
            jpeg_bytes = frame_queue.get(timeout=1.0)
            # Decode JPEG to BGR (safety: ensure buffer is valid)
            if isinstance(jpeg_bytes, bytes) and len(jpeg_bytes) > 0:
                frame_array = np.frombuffer(jpeg_bytes, dtype=np.uint8)
                bgr = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
                if bgr is not None and bgr.size > 0:
                    yield bgr
        except queue.Empty:
            continue


def frames_from_backend(url: str = BACKEND_MJPEG_URL):
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
    if source == "esp32":
        return frames_from_esp32()
    elif source == "pi":
        from stream_client import frames as pi_frames
        return pi_frames()
    else:  # backend (default fallback)
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
    """Queue frame for saving (batch commit handled in main)."""
    _, jpg = cv2.imencode(".jpg", gray_64, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    conn.execute("INSERT INTO frames (label, image) VALUES (?, ?)",
                 (label, jpg.tobytes()))


def delete_last(conn):
    """Delete last frame and commit immediately."""
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
        choices=["esp32", "backend", "pi"],
        default="esp32",
        help="Frame source: esp32 (default) uses WebSocket, backend uses MJPEG HTTP, pi uses legacy TCP stream_client",
    )
    args = parser.parse_args()

    conn      = init_db()
    print(f"[collect] writing to DB: {DB}")
    banner    = ""
    banner_ts = 0.0

    # Batch commit tracking
    last_commit_time = time.time()
    pending_inserts = 0

    # Cached frame counts (refreshed at most once per second)
    cnt = {}
    last_count_refresh = time.time()

    for bgr in get_frames(args.source):
        current_time = time.time()

        # Refresh counts cache at most once per second
        if (current_time - last_count_refresh) >= 1.0:
            cnt = get_counts(conn)
            last_count_refresh = current_time

        cv2.imshow("Voxen — collect", draw(bgr, cnt, banner, banner_ts))
        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break

        elif key in [ord('1'), ord('2'), ord('3'), ord('4'), ord('5')]:
            label  = key - ord('0')  # Convert key code to label (1-5)
            gray64 = preprocess_eye_frame(bgr)
            save_frame(conn, label, gray64)
            pending_inserts += 1
            banner    = f"saved  {LABELS[label]}"
            banner_ts = time.time()

            # Batch commit: every N inserts or every M seconds
            if pending_inserts >= BATCH_COMMIT_SIZE or \
               (time.time() - last_commit_time) >= BATCH_COMMIT_INTERVAL:
                conn.commit()
                pending_inserts = 0
                last_commit_time = current_time

        elif key == ord("d"):
            delete_last(conn)
            banner    = "deleted last"
            banner_ts = time.time()
            # Refresh counts cache after deletion
            cnt = get_counts(conn)
            last_count_refresh = current_time

    # Final commit on exit to ensure no data loss
    if pending_inserts > 0:
        conn.commit()

    conn.close()
    cv2.destroyAllWindows()
    print(f"Done — {DB}")


if __name__ == "__main__":
    main()
