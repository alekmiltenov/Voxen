import re
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

MODEL_ID = "distilgpt2"

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model     = AutoModelForCausalLM.from_pretrained(MODEL_ID, dtype=torch.float32)
model.eval()

# Accepts only clean English words (letters + apostrophe for contractions)
_WORD_RE = re.compile(r"^[a-zA-Z][a-zA-Z']*$")


def _clean(raw: str) -> str | None:
    """Decode, strip whitespace/Ġ artifacts, validate. Returns word or None."""
    word = raw.strip()
    if not word or "_" in word:
        return None
    if not _WORD_RE.match(word):
        return None
    return word


def get_next_word_candidates(db, current_text: str, top_k: int = 10) -> list[tuple[str, float]]:
    text = current_text.strip()   # removes trailing spaces that confuse the tokenizer
    if not text:
        return []

    inputs = tokenizer(text, return_tensors="pt")

    with torch.no_grad():
        logits = model(**inputs).logits[0, -1, :]

    # Oversample to have enough valid words after filtering
    pool_size = min(top_k * 8, logits.size(0))
    top       = torch.topk(logits, k=pool_size)

    seen: set[str] = set()
    candidates: list[tuple[str, float]] = []

    for token_id, score in zip(top.indices, top.values):
        word = _clean(tokenizer.decode(token_id))
        if word is None:
            continue
        key = word.lower()
        if key in seen:
            continue
        seen.add(key)
        candidates.append((word, score.item()))
        if len(candidates) >= top_k:
            break

    return candidates


def filter_by_vocab(candidates: list[tuple[str, float]], db: set) -> list[tuple[str, float]]:
    """Keep only words present in the user's personal vocabulary."""
    return [(w, s) for w, s in candidates if w.strip().lower() in db]


if __name__ == "__main__":
    tests = [
        "I need help with",
        "I need help with ",   # trailing space — should behave same as above
        "I need help with  ",  # multiple spaces
        "The doctor said",
    ]
    for text in tests:
        results = get_next_word_candidates(None, text, top_k=5)
        print(f"\nInput: {repr(text)}")
        for word, score in results:
            print(f"  {word:<20}  {score:.2f}")
