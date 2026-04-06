import sys
import os
import json
import asyncio
import math
import threading
import time
from collections import deque, Counter
import cv2
import numpy as np
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from pymongo import MongoClient, DESCENDING
from dotenv import load_dotenv

# ── Path setup ────────────────────────────────────────────────────────────────
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_ROOT, ".env"))
sys.path.insert(0, _ROOT)
sys.path.insert(0, os.path.join(_ROOT, "Suggestion-System"))
sys.path.insert(0, os.path.join(_ROOT, "Action_Space", "actions"))
sys.path.insert(0, os.path.join(_ROOT, "Action_Space"))
sys.path.insert(0, os.path.join(_ROOT, "eye_tracking"))

from Suggestion_System import get_next_word_candidates
import re
_WORD_RE = re.compile(r"^[a-zA-Z][a-zA-Z']{1,}$")  # at least 2 chars, real word shape

_get_ai_reply = None
try:
    from ai_chat_service import get_ai_reply as _get_ai_reply
    print("[info] AI chat ready")
except Exception as _e:
    import traceback
    print(f"[warn] AI chat unavailable: {_e}")
    traceback.print_exc()

# ── Action imports (each independent) ────────────────────────────────────────
_actions: dict = {}

try:
    from calls import call_caregiver
    _actions["call"] = call_caregiver
except Exception as _e:
    print(f"[warn] 'call' unavailable: {_e}")

try:
    from emergency import emergency_alert
    _actions["emergency"] = emergency_alert
except Exception as _e:
    print(f"[warn] 'emergency' unavailable: {_e}")

try:
    from aichat import chat_with_ai
    _actions["ai_chat"] = chat_with_ai
except Exception as _e:
    print(f"[warn] 'ai_chat' unavailable: {_e}")

try:
    from lights import turn_lights_on
    _actions["lights"] = turn_lights_on
except Exception as _e:
    print(f"[warn] 'lights' unavailable: {_e}")

# ── MongoDB ───────────────────────────────────────────────────────────────────
MONGO_URI  = os.getenv("MONGO_URI", "mongodb://localhost:27017")
_mongo     = MongoClient(MONGO_URI)
_db        = _mongo["voxen"]
vocab_col  = _db["vocabulary"]   # {word, count, last_used}
ngrams_col = _db["ngrams"]       # {context, next_word, count}

vocab_col.create_index("word",   unique=True)
ngrams_col.create_index([("context", 1), ("next_word", 1)], unique=True)

# ── In-memory caches (loaded once at startup) ─────────────────────────────────
_vocab:  set  = set()   # all confirmed words
_ngrams: dict = {}      # {context_str: {next_word: count}}

def _load_caches():
    _vocab.update(e["word"] for e in vocab_col.find({}, {"word": 1}))
    for e in ngrams_col.find({}):
        ctx = e["context"]
        _ngrams.setdefault(ctx, {})[e["next_word"]] = e["count"]

_load_caches()

# ── Ngram suggestion engine ───────────────────────────────────────────────────
NGRAM_WEIGHT = 3.0   # score units added per log(1+count) of ngram match

def _ctx_keys(context_words: list[str]) -> list[str]:
    """Return trigram key then bigram key for the given word list."""
    keys = []
    if len(context_words) >= 2:
        keys.append(f"{context_words[-2]} {context_words[-1]}")
    if len(context_words) >= 1:
        keys.append(context_words[-1])
    return keys

def _ngram_scores(context_words: list[str]) -> dict[str, float]:
    """
    Return {word: ngram_score} for every word that has been seen after
    this context.  Trigram match takes priority over bigram.
    """
    scores: dict[str, float] = {}
    for ctx in _ctx_keys(context_words):
        for word, count in _ngrams.get(ctx, {}).items():
            if word not in scores:                        # trigram wins if seen first
                scores[word] = NGRAM_WEIGHT * math.log(1 + count)
    return scores

def _merge(model_candidates: list, context_words: list[str], top_k: int) -> list:
    """
    Merge model predictions with personal ngram history.

    - Model word that also has ngram history  → model_score + ngram_boost
    - Model word with no ngram history        → model_score  (unchanged)
    - Ngram word not in model top candidates  → injected with ngram_score only

    This ensures frequently-used personal words always surface even if the
    language model has never ranked them highly.
    """
    ng = _ngram_scores(context_words)

    # Start with all model candidates, boosted where ngrams agree
    merged: dict[str, tuple[str, float]] = {}
    for word, score in model_candidates:
        key = word.lower()
        merged[key] = (word, score + ng.get(key, 0.0))

    # Inject ngram words that didn't make the model's shortlist
    for word, ng_score in ng.items():
        if word not in merged and _WORD_RE.match(word):
            merged[word] = (word, ng_score)

    return sorted(merged.values(), key=lambda x: x[1], reverse=True)[:top_k]

# ── CNN eye tracking ──────────────────────────────────────────────────────────
_cnn_lock       = threading.Lock()
_cnn_prediction = {"label": 0, "name": "NONE", "confidence": 0.0, "ready": False}
_cnn_raw_prediction = {"label": 0, "name": "NONE", "confidence": 0.0, "ready": False}
_latest_frame   = None
_ws_loop        = None
_ws_clients: set = set()   # asyncio.Queue per connected /ws/predict client

_STABLE_WINDOW_SIZE = 5
_STABLE_MIN_CONF = 0.6
_stable_hist = deque(maxlen=_STABLE_WINDOW_SIZE)
_low_conf_streak = 0
_STABLE_LOW_CONF_RESET = 5
_STABLE_STALE_MS = 1200
_last_stable_update_ms = 0

CAMERA_ROTATE = os.getenv("ESP32_CAMERA_ROTATE", "none").strip().lower()


class _LatestFrameBuffer:
    """Thread-safe latest-frame slot (overwrite old frame, keep newest only)."""

    def __init__(self):
        self._lock = threading.Lock()
        self._cond = threading.Condition(self._lock)
        self._version = 0
        self._jpeg: Optional[bytes] = None
        self._meta: dict = {}
        self._rx_ms = 0

    def put(self, jpeg: bytes, meta: Optional[dict], rx_ms: int):
        with self._cond:
            self._jpeg = jpeg
            self._meta = dict(meta or {})
            self._rx_ms = int(rx_ms)
            self._version += 1
            self._cond.notify()

    def wait_next(self, last_version: int, timeout: float = 1.0):
        with self._cond:
            ok = self._cond.wait_for(lambda: self._version != last_version, timeout=timeout)
            if not ok or self._jpeg is None:
                return None
            return self._version, self._jpeg, dict(self._meta), self._rx_ms


_esp32_frames = _LatestFrameBuffer()
_esp32_camera_state = {
    "connected": False,
    "last_rx_ms": 0,
}
_esp32_state_lock = threading.Lock()


def _apply_camera_rotation(bgr: np.ndarray) -> np.ndarray:
    if CAMERA_ROTATE in ("180", "rotate180"):
        return cv2.rotate(bgr, cv2.ROTATE_180)
    if CAMERA_ROTATE in ("90", "90cw", "rotate90", "rotate90cw"):
        return cv2.rotate(bgr, cv2.ROTATE_90_CLOCKWISE)
    if CAMERA_ROTATE in ("90ccw", "rotate90ccw"):
        return cv2.rotate(bgr, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return bgr

def _push_prediction(pred: dict):
    """Push latest prediction to all connected WebSocket clients (thread-safe)."""
    if _ws_loop is None:
        return
    for q in list(_ws_clients):
        try:
            _ws_loop.call_soon_threadsafe(q.put_nowait, pred)
        except Exception:
            pass


def _update_stable_prediction(raw_pred: dict) -> Optional[dict]:
    """
    Update smoothing window with raw predictions and return stable output.
    Rules:
      - Ignore low-confidence predictions (< _STABLE_MIN_CONF)
      - Sliding window size = 5
      - Final output by majority vote over window labels
    """
    global _low_conf_streak

    conf = float(raw_pred.get("confidence", 0.0) or 0.0)
    if conf < _STABLE_MIN_CONF:
        _low_conf_streak += 1
        if _low_conf_streak >= _STABLE_LOW_CONF_RESET:
            _stable_hist.clear()
            return {
                "label": 0,
                "name": "NONE",
                "confidence": 0.0,
                "ready": False,
                "source": raw_pred.get("source"),
                "timing": raw_pred.get("timing"),
            }
        return None

    _low_conf_streak = 0

    label = int(raw_pred.get("label", 0) or 0)
    name = str(raw_pred.get("name", "NONE"))
    _stable_hist.append({"label": label, "name": name, "confidence": conf})
    if not _stable_hist:
        return None

    counts = Counter(x["label"] for x in _stable_hist)
    majority_label, _ = counts.most_common(1)[0]

    votes = [x for x in _stable_hist if x["label"] == majority_label]
    avg_conf = sum(x["confidence"] for x in votes) / len(votes)
    stable_name = votes[-1]["name"]

    stable_pred = {
        "label": majority_label,
        "name": stable_name,
        "confidence": round(avg_conf, 4),
        "ready": True,
    }

    # carry diagnostics/source fields forward when present
    if "source" in raw_pred:
        stable_pred["source"] = raw_pred["source"]
    if "timing" in raw_pred and isinstance(raw_pred["timing"], dict):
        stable_pred["timing"] = raw_pred["timing"]

    return stable_pred


def _publish_cnn_prediction(raw_pred: dict):
    """Store raw prediction internally, expose only stabilized prediction externally."""
    global _last_stable_update_ms

    stable = None
    stale_flip = None
    now_ms = int(time.time() * 1000)

    with _cnn_lock:
        _cnn_raw_prediction.update(raw_pred)
        stable = _update_stable_prediction(raw_pred)
        if stable is not None:
            _cnn_prediction.update(stable)
            _last_stable_update_ms = now_ms
        else:
            if _cnn_prediction.get("ready") and _last_stable_update_ms and (now_ms - _last_stable_update_ms) > _STABLE_STALE_MS:
                stale_flip = {
                    "label": 0,
                    "name": "NONE",
                    "confidence": 0.0,
                    "ready": False,
                    "source": raw_pred.get("source"),
                    "timing": raw_pred.get("timing"),
                }
                _cnn_prediction.update(stale_flip)
                _last_stable_update_ms = now_ms

    if stable is not None:
        _push_prediction(stable)
    elif stale_flip is not None:
        _push_prediction(stale_flip)

def _cnn_inference_loop():
    global _latest_frame
    try:
        import torch
        from eye_tracking import EyeTrackCNN, LABELS, IMG_H, IMG_W
        from stream_client import frames

        model_path = os.path.join(_ROOT, "eye_tracking", "model.pt")
        if not os.path.exists(model_path):
            print("[CNN] model.pt not found — run train.py first")
            return

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model  = EyeTrackCNN().to(device)
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.eval()
        print(f"[CNN] model loaded ({device}), connecting to Pi stream…")

        for bgr in frames():
            _, jpg = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 60])
            _latest_frame = jpg.tobytes()

            gray   = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
            gray64 = cv2.resize(gray, (IMG_W, IMG_H))
            t = (torch.tensor(gray64 / 255.0, dtype=torch.float32)
                      .unsqueeze(0).unsqueeze(0).to(device))
            with torch.no_grad():
                probs = model(t)[0]
            idx  = probs.argmax().item()
            pred = {
                "label":      idx + 1,
                "name":       LABELS[idx + 1],
                "confidence": round(probs[idx].item(), 4),
                "ready":      True,
            }
            _publish_cnn_prediction(pred)

    except Exception as e:
        print(f"[CNN] inference thread error: {e}")


def _cnn_esp32_inference_loop():
    """CNN inference worker fed by /ws/esp32/camera (latest-frame buffer)."""
    global _latest_frame
    try:
        import torch
        from eye_tracking import EyeTrackCNN, LABELS, IMG_H, IMG_W

        model_path = os.path.join(_ROOT, "eye_tracking", "model.pt")
        if not os.path.exists(model_path):
            print("[CNN][ESP32] model.pt not found — run train.py first")
            return

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model  = EyeTrackCNN().to(device)
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.eval()
        print(f"[CNN][ESP32] model loaded ({device}), waiting for /ws/esp32/camera…")

        last_version = 0
        while True:
            item = _esp32_frames.wait_next(last_version, timeout=1.0)
            if item is None:
                continue

            version, jpeg_bytes, meta, server_rx_ms = item
            last_version = version

            bgr = cv2.imdecode(np.frombuffer(jpeg_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
            if bgr is None:
                continue  # bad frame, ignore

            bgr = _apply_camera_rotation(bgr)

            _, jpg = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 60])
            _latest_frame = jpg.tobytes()

            gray   = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
            gray64 = cv2.resize(gray, (IMG_W, IMG_H))

            t0 = time.perf_counter()
            t = (torch.tensor(gray64 / 255.0, dtype=torch.float32)
                      .unsqueeze(0).unsqueeze(0).to(device))
            with torch.no_grad():
                probs = model(t)[0]
            infer_done_ms = int(time.time() * 1000)
            infer_ms = (time.perf_counter() - t0) * 1000.0

            idx = probs.argmax().item()
            capture_ms = None
            if isinstance(meta, dict):
                capture_ms = meta.get("t_capture_ms") or meta.get("timestamp_ms")

            pred = {
                "label":      idx + 1,
                "name":       LABELS[idx + 1],
                "confidence": round(probs[idx].item(), 4),
                "ready":      True,
                "source":     "esp32_camera",
                "timing": {
                    "capture_ms": int(capture_ms) if capture_ms is not None else None,
                    "server_rx_ms": int(server_rx_ms),
                    "infer_done_ms": infer_done_ms,
                    "infer_ms": round(infer_ms, 2),
                },
            }
            _publish_cnn_prediction(pred)

    except Exception as e:
        print(f"[CNN][ESP32] inference thread error: {e}")

#threading.Thread(target=_cnn_inference_loop, daemon=True).start()
threading.Thread(target=_cnn_esp32_inference_loop, daemon=True).start()

# ── App ───────────────────────────────────────────────────────────────────────
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    global _ws_loop
    _ws_loop = asyncio.get_event_loop()
    yield

app = FastAPI(title="Voxen AAC Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Vocab: starters ───────────────────────────────────────────────────────────
_DEFAULTS = ["I", "I need", "I want", "Help", "Yes", "No", "Please", "Thank you"]

@app.get("/predict")
def get_prediction():
    with _cnn_lock:
        return dict(_cnn_prediction)


@app.get("/predict/raw")
def get_prediction_raw():
        with _cnn_lock:
                return dict(_cnn_raw_prediction)


@app.get("/debug/cnn", response_class=HTMLResponse)
def debug_cnn_page():
        return """
<!doctype html>
<html>
<head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
    <title>Voxen CNN Debug</title>
    <style>
        body{font-family:Inter,Segoe UI,Arial,sans-serif;background:#0b1020;color:#e6eefc;margin:0;padding:20px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .card{background:#121a33;border:1px solid #243157;border-radius:12px;padding:14px}
        .k{color:#8da2d0;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
        .v{font-size:26px;font-weight:700;margin-top:6px}
        pre{white-space:pre-wrap;word-break:break-word;background:#0a1226;border-radius:10px;padding:12px;font-size:12px}
        img{width:100%;border-radius:10px;border:1px solid #2a3a66;background:#000}
        .ok{color:#5ee09b}.bad{color:#ff7b7b}
    </style>
</head>
<body>
    <h2 style=\"margin-top:0\">CNN Live Debug</h2>
    <div class=\"grid\">
        <div class=\"card\">
            <div class=\"k\">Stable (/ws/predict)</div>
            <div id=\"stableName\" class=\"v\">—</div>
            <div id=\"stableMeta\"></div>
            <pre id=\"stableJson\">{}</pre>
        </div>
        <div class=\"card\">
            <div class=\"k\">Raw (/predict/raw)</div>
            <div id=\"rawName\" class=\"v\">—</div>
            <div id=\"rawMeta\"></div>
            <pre id=\"rawJson\">{}</pre>
        </div>
    </div>

    <div class=\"card\" style=\"margin-top:16px\">
        <div class=\"k\">Camera Preview</div>
        <img src=\"/camera/stream\" alt=\"camera\" />
    </div>

    <script>
        const stableName = document.getElementById('stableName');
        const stableMeta = document.getElementById('stableMeta');
        const stableJson = document.getElementById('stableJson');
        const rawName = document.getElementById('rawName');
        const rawMeta = document.getElementById('rawMeta');
        const rawJson = document.getElementById('rawJson');

        function setMeta(el, d){
            const ready = d?.ready ? '<span class="ok">ready</span>' : '<span class="bad">not-ready</span>';
            const conf = (typeof d?.confidence === 'number') ? d.confidence.toFixed(3) : '—';
            el.innerHTML = `conf=${conf} · ${ready} · source=${d?.source ?? '—'}`;
        }

        function connectStable(){
            const proto = location.protocol === 'https:' ? 'wss' : 'ws';
            const ws = new WebSocket(`${proto}://${location.host}/ws/predict`);
            ws.onmessage = (e) => {
                const d = JSON.parse(e.data);
                stableName.textContent = d?.name ?? '—';
                setMeta(stableMeta, d);
                stableJson.textContent = JSON.stringify(d, null, 2);
            };
            ws.onclose = () => setTimeout(connectStable, 1200);
        }

        async function pollRaw(){
            try{
                const r = await fetch('/predict/raw', {cache:'no-store'});
                const d = await r.json();
                rawName.textContent = d?.name ?? '—';
                setMeta(rawMeta, d);
                rawJson.textContent = JSON.stringify(d, null, 2);
            }catch{}
        }

        connectStable();
        pollRaw();
        setInterval(pollRaw, 250);
    </script>
</body>
</html>
"""


# ── Head control (merged from control-service) ───────────────────────────────
_head_lock = threading.Lock()
_head_alpha = 0.5
_head_threshold = 1.5
_head_deadzone = 1.0
_head_filtered_x = 0.0
_head_filtered_y = 0.0
_head_filtered_z = 0.0
_head_ws_clients: set = set()


def _head_detect_command(x: float, y: float) -> Optional[str]:
    if abs(x) < _head_deadzone and abs(y) < _head_deadzone:
        return None

    if abs(y) >= abs(x):
        if y > _head_threshold:
            return "RIGHT"
        if y < -_head_threshold:
            return "LEFT"
    else:
        if x > _head_threshold:
            return "BACK"
        if x < -_head_threshold:
            return "FORWARD"
    return None


def _head_push_command(payload: dict):
    if _ws_loop is None:
        return
    for q in list(_head_ws_clients):
        try:
            _ws_loop.call_soon_threadsafe(q.put_nowait, payload)
        except Exception:
            pass


class HeadDataRequest(BaseModel):
    x: float
    y: float
    z: float = 0.0


class HeadSettingsRequest(BaseModel):
    alpha: Optional[float] = None
    threshold: Optional[float] = None
    deadzone: Optional[float] = None

@app.websocket("/ws/predict")
async def predict_ws(websocket: WebSocket):
    await websocket.accept()
    q: asyncio.Queue = asyncio.Queue(maxsize=2)
    _ws_clients.add(q)
    try:
        while True:
            pred = await q.get()
            await websocket.send_json(pred)
    except WebSocketDisconnect:
        pass
    finally:
        _ws_clients.discard(q)


@app.websocket("/ws/head")
async def head_ws(websocket: WebSocket):
    await websocket.accept()
    q: asyncio.Queue = asyncio.Queue(maxsize=4)
    _head_ws_clients.add(q)
    try:
        while True:
            payload = await q.get()
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        pass
    finally:
        _head_ws_clients.discard(q)


@app.websocket("/ws/esp32/camera")
async def esp32_camera_ws(websocket: WebSocket):
    """
    ESP32 camera ingest:
      - binary message: raw JPEG bytes
      - text message: small JSON metadata for next frame (optional)
    """
    global _latest_frame
    await websocket.accept()
    pending_meta: dict = {}

    with _esp32_state_lock:
        _esp32_camera_state["connected"] = True
        _esp32_camera_state["last_rx_ms"] = int(time.time() * 1000)

    try:
        while True:
            msg = await asyncio.wait_for(websocket.receive(), timeout=10.0)
            if msg.get("type") == "websocket.disconnect":
                break

            text = msg.get("text")
            if text is not None:
                try:
                    meta = json.loads(text)
                    if isinstance(meta, dict):
                        pending_meta = meta
                except json.JSONDecodeError:
                    pass
                continue

            data = msg.get("bytes")
            if data is None:
                continue

            rx_ms = int(time.time() * 1000)
            # Keep preview quality high and latency low by forwarding original JPEG bytes.
            _latest_frame = data
            _esp32_frames.put(data, pending_meta, rx_ms)
            pending_meta = {}

            with _esp32_state_lock:
                _esp32_camera_state["last_rx_ms"] = rx_ms

    except WebSocketDisconnect:
        pass
    finally:
        with _esp32_state_lock:
            _esp32_camera_state["connected"] = False


@app.post("/head/data")
def head_receive_data(body: HeadDataRequest):
    global _head_filtered_x, _head_filtered_y, _head_filtered_z

    with _head_lock:
        x, y, z = body.x, body.y, body.z
        _head_filtered_x = _head_alpha * x + (1 - _head_alpha) * _head_filtered_x
        _head_filtered_y = _head_alpha * y + (1 - _head_alpha) * _head_filtered_y
        _head_filtered_z = _head_alpha * z + (1 - _head_alpha) * _head_filtered_z
        cmd = _head_detect_command(_head_filtered_x, _head_filtered_y)

    _head_push_command({"cmd": cmd})

    return {
        "status": "ok",
        "cmd": cmd,
        "x": round(_head_filtered_x, 4),
        "y": round(_head_filtered_y, 4),
        "z": round(_head_filtered_z, 4),
    }


@app.get("/head/settings")
def head_get_settings():
    with _head_lock:
        return {
            "alpha": _head_alpha,
            "threshold": _head_threshold,
            "deadzone": _head_deadzone,
        }


@app.post("/head/settings")
def head_update_settings(body: HeadSettingsRequest):
    global _head_alpha, _head_threshold, _head_deadzone

    with _head_lock:
        if body.alpha is not None:
            _head_alpha = float(body.alpha)
        if body.threshold is not None:
            _head_threshold = float(body.threshold)
        if body.deadzone is not None:
            _head_deadzone = float(body.deadzone)

        return {
            "alpha": _head_alpha,
            "threshold": _head_threshold,
            "deadzone": _head_deadzone,
        }

@app.get("/camera/stream")
async def camera_stream():
    from fastapi.responses import StreamingResponse
    import asyncio

    async def gen():
        while True:
            frame = _latest_frame
            if frame:
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
            await asyncio.sleep(0.02)   # lower display latency

    return StreamingResponse(gen(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/vocab/starters")
def get_starters(limit: int = 8):
    entries = list(
        vocab_col.find({}, {"word": 1, "count": 1})
        .sort("count", DESCENDING)
        .limit(limit)
    )
    if entries:
        return {"starters": [{"word": e["word"], "count": e.get("count", 0)} for e in entries]}
    return {"starters": [{"word": w, "count": 0} for w in _DEFAULTS[:limit]]}

# ── Vocab: store a completed sentence as ngrams ───────────────────────────────
class SentenceRequest(BaseModel):
    words: list[str]   # full confirmed sentence, e.g. ["I", "need", "hospital", "help"]

@app.post("/vocab/sentence")
def store_sentence(body: SentenceRequest):
    """
    Mine all unigrams, bigrams and trigrams from the confirmed sentence
    and persist them. Called once when the user speaks a complete sentence.

    Example — "I need hospital help":
      unigrams : I, need, hospital, help
      bigrams  : (I → need), (need → hospital), (hospital → help)
      trigrams : (I need → hospital), (need hospital → help)
    """
    words = [w.strip().lower() for w in body.words if w.strip()]
    if not words:
        return {"status": "ok", "stored": 0}

    now = datetime.now(timezone.utc)

    def _upsert_ngram(ctx: str, next_word: str):
        ngrams_col.update_one(
            {"context": ctx, "next_word": next_word},
            {"$inc": {"count": 1}},
            upsert=True,
        )
        _ngrams.setdefault(ctx, {})[next_word] = (
            _ngrams.get(ctx, {}).get(next_word, 0) + 1
        )

    for i, word in enumerate(words):
        # unigram
        vocab_col.update_one(
            {"word": word},
            {"$inc": {"count": 1}, "$set": {"last_used": now}},
            upsert=True,
        )
        _vocab.add(word)

        # bigram:  words[i-1] → word
        if i >= 1:
            _upsert_ngram(words[i - 1], word)

        # trigram: words[i-2] words[i-1] → word
        if i >= 2:
            _upsert_ngram(f"{words[i - 2]} {words[i - 1]}", word)

    return {"status": "ok", "stored": len(words)}

# ── Actions ───────────────────────────────────────────────────────────────────
class ActionRequest(BaseModel):
    action:  int
    payload: Optional[dict] = None

@app.post("/actions/execute")
def execute_action(body: ActionRequest):
    key = {1: "call", 2: "emergency", 3: "ai_chat", 4: "lights"}.get(body.action)
    if not key:
        raise HTTPException(status_code=400, detail="Unknown action")
    fn = _actions.get(key)
    if not fn:
        raise HTTPException(status_code=503, detail=f"Action '{key}' unavailable")
    try:
        return fn(body.payload) if body.payload else fn()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── AI Chat ───────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str

@app.post("/ai/chat")
def ai_chat_endpoint(body: ChatRequest):
    if not _get_ai_reply:
        raise HTTPException(status_code=503, detail="AI chat unavailable")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Empty message")
    try:
        reply = _get_ai_reply(body.message.strip())
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"reply": reply}

# ── WebSocket: suggestions ────────────────────────────────────────────────────
@app.websocket("/ws/suggest")
async def suggest_ws(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_event_loop()

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                payload = json.loads(raw)
                text    = payload.get("text", "")
                top_k   = int(payload.get("top_k", 5))
                words   = payload.get("words", [])   # confirmed words for ngram context
            except (json.JSONDecodeError, ValueError):
                text, top_k, words = raw, 5, []

            if not text.strip():
                await websocket.send_json({"suggestions": []})
                continue

            # Get model candidates (oversample for reranking)
            candidates = await loop.run_in_executor(
                None, get_next_word_candidates, _vocab or None, text, top_k * 3
            )

            # Rerank with ngram history
            reranked = _merge(candidates, [w.lower() for w in words], top_k)

            await websocket.send_json({
                "suggestions": [
                    {"word": w.strip(), "score": round(s, 4)} for w, s in reranked
                ]
            })

    except WebSocketDisconnect:
        pass
