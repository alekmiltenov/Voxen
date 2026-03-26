from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

MODEL_ID = "distilgpt2"

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    dtype=torch.float32
)
model.eval()


def get_next_word_candidates(db , current_text: str, top_k: int = 10):
    inputs = tokenizer(current_text, return_tensors="pt")

    with torch.no_grad():
        outputs = model(**inputs)

    logits = outputs.logits[0, -1, :]
    top = torch.topk(logits, k=top_k)

    candidates = [
        (tokenizer.decode(token_id), score.item())
        for token_id, score in zip(top.indices, top.values)
    ]
    candidates = filter_candidates(candidates, db)
    return candidates


def filter_candidates(candidates, db):
    return [
        (word, score)
        for word, score in candidates
        if word.strip().lower() in db
    ]



if __name__ == "__main__":

    text = "I want to go to the"
    sample_db = {"hospital", "park", "store", "doctor", "bathroom"}
    results = get_next_word_candidates(sample_db, text, top_k=10)

    print(f"Input: '{text}'")
    print("\nAll top tokens:")
    for word, score in results:
        print(f"  {repr(word):20s}  logit: {score:.2f}")


