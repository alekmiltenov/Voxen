import sys
import os
import json
import asyncio
import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient, DESCENDING

# ── Path setup ────────────────────────────────────────────────────────────────
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ROOT)
sys.path.insert(0, os.path.join(_ROOT, "Suggestion-System"))
sys.path.insert(0, os.path.join(_ROOT, "Action_Space", "actions"))

from Suggestion_System import get_next_word_candidates

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
    from aichat import ai_chat
    _actions["ai_chat"] = ai_chat
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
        if word not in merged:
            merged[word] = (word, ng_score)

    return sorted(merged.values(), key=lambda x: x[1], reverse=True)[:top_k]

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Voxen AAC Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Vocab: starters ───────────────────────────────────────────────────────────
_DEFAULTS = ["I", "I need", "I want", "Help", "Yes", "No", "Please", "Thank you"]

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
