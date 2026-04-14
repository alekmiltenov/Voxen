"""
Connects to the Pi TCP stream (stream.py on the Pi).
Protocol: 4-byte big-endian length prefix + raw JPEG bytes, repeated.

Usage as a library:
    from stream_client import frames
    for bgr in frames():
        process(bgr)

Usage standalone (live preview):
    python stream_client.py
"""

import socket
import struct
import time
import cv2
import numpy as np

RPI_HOST    = "10.237.97.250"
PORT        = 5000
TIMEOUT_SEC = 10


def _recv_exact(sock, n):
    """Read exactly n bytes from sock, raise ConnectionError on close."""
    buf = bytearray(n)
    view = memoryview(buf)
    pos  = 0
    while pos < n:
        got = sock.recv_into(view[pos:], n - pos)
        if not got:
            raise ConnectionError("Socket closed by Pi")
        pos += got
    return bytes(buf)


def frames(host=RPI_HOST, port=PORT):
    """
    Generator — yields decoded BGR frames (numpy arrays) from the Pi stream.
    Reconnects automatically if the connection drops.
    """
    while True:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sock.settimeout(TIMEOUT_SEC)
        try:
            sock.connect((host, port))
            print(f"[stream_client] connected to {host}:{port}")
            while True:
                raw_len    = _recv_exact(sock, 4)
                frame_len  = struct.unpack(">I", raw_len)[0]
                frame_data = _recv_exact(sock, frame_len)
                frame = cv2.imdecode(
                    np.frombuffer(frame_data, dtype=np.uint8),
                    cv2.IMREAD_COLOR
                )
                if frame is not None:
                    yield cv2.rotate(frame, cv2.ROTATE_180)
        except (ConnectionError, OSError, TimeoutError) as e:
            print(f"[stream_client] disconnected ({e}), retrying in 2 s…")
            time.sleep(2)
        finally:
            sock.close()


# ── standalone preview ────────────────────────────────────────────────────────
def main():
    fps_count = 0
    fps_t     = time.time()

    for frame in frames():
        fps_count += 1
        now = time.time()
        if now - fps_t >= 1.0:
            print(f"FPS: {fps_count}")
            fps_count = 0
            fps_t     = now

        cv2.imshow("ESP-32 camera stream", frame)
        if cv2.waitKey(1) == ord("q"):
            break

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
