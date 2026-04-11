"""
Trains EyeTrackCNN on data collected by collect.py.

Usage:
    python train.py

Reads:  eye_tracking/training_data.db
Saves:  eye_tracking/model.pt
"""

import os
import argparse
import sqlite3
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, Subset
import cv2

from eye_tracking import EyeTrackCNN, preprocess_eye_frame

DB         = os.path.join(os.path.dirname(__file__), "training_data.db")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pt")
EPOCHS     = 12
BATCH      = 32
LR         = 1e-3
VAL_SPLIT  = 0.20
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"
SEED       = 42
EARLY_STOP_PATIENCE = 3
DEFAULT_DOWNSAMPLE_EVERY = 4


# ── dataset ───────────────────────────────────────────────────────────────────
class EyeDataset(Dataset):
    def __init__(self, db_path, augment=False, rng=None, downsample_every=DEFAULT_DOWNSAMPLE_EVERY):
        conn = sqlite3.connect(db_path)
        rows = conn.execute("SELECT id, label, image FROM frames ORDER BY id ASC").fetchall()
        conn.close()

        self.augment = augment
        self.rng = rng or np.random.default_rng(SEED)
        self.downsample_every = max(1, int(downsample_every))
        self.samples   = []
        self.labels    = []
        per_class_seen = {}
        for _id, label, blob in rows:
            # Per-class temporal downsampling to reduce near-duplicate neighbors.
            # Keep every N-th sample inside each class stream.
            seen = per_class_seen.get(label, 0)
            per_class_seen[label] = seen + 1
            if self.downsample_every > 1 and (seen % self.downsample_every) != 0:
                continue

            img = cv2.imdecode(np.frombuffer(blob, np.uint8), cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue
            img = preprocess_eye_frame(img)
            # labels stored as 1–5, convert to 0–4 for CrossEntropyLoss
            y = label - 1
            self.samples.append((img, y))
            self.labels.append(y)

    def _augment_brightness(self, img):
        """Lightweight brightness augmentation: alpha∈[0.8,1.2], beta∈[-15,15]."""
        alpha = float(self.rng.uniform(0.8, 1.2))
        beta = float(self.rng.uniform(-15.0, 15.0))
        return cv2.convertScaleAbs(img, alpha=alpha, beta=beta)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img, label = self.samples[idx]
        if self.augment:
            img = self._augment_brightness(img)
        t = torch.tensor(img / 255.0, dtype=torch.float32).unsqueeze(0)  # (1, H, W)
        return t, label


# ── training ──────────────────────────────────────────────────────────────────
def train(downsample_every=DEFAULT_DOWNSAMPLE_EVERY):
    if not os.path.exists(DB):
        print(f"No database found at {DB}. Run collect.py first.")
        return

    rng = np.random.default_rng(SEED)
    torch.manual_seed(SEED)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(SEED)

    full_ds = EyeDataset(DB, augment=False, rng=rng, downsample_every=downsample_every)
    if len(full_ds) == 0:
        print("Database is empty. Collect some data first.")
        return

    print(f"Loaded {len(full_ds)} samples from {DB}  (per-class downsample every {max(1, int(downsample_every))})")

    # Stratified random split (80/20), with fixed seed and full shuffle.
    labels = np.array(full_ds.labels)
    train_indices = []
    val_indices = []
    for cls in sorted(np.unique(labels)):
        cls_idx = np.where(labels == cls)[0]
        rng.shuffle(cls_idx)
        if len(cls_idx) < 2:
            train_indices.extend(cls_idx.tolist())
            continue
        n_val_cls = max(1, int(round(len(cls_idx) * VAL_SPLIT)))
        if n_val_cls >= len(cls_idx):
            n_val_cls = max(1, len(cls_idx) - 1)
        val_indices.extend(cls_idx[:n_val_cls].tolist())
        train_indices.extend(cls_idx[n_val_cls:].tolist())

    rng.shuffle(train_indices)
    rng.shuffle(val_indices)

    train_base = EyeDataset(DB, augment=True, rng=rng, downsample_every=downsample_every)
    val_base   = EyeDataset(DB, augment=False, rng=rng, downsample_every=downsample_every)
    train_ds_aug = Subset(train_base, train_indices)
    val_ds       = Subset(val_base, val_indices)

    print(f"Stratified split: train={len(train_indices)}  val={len(val_indices)}")

    train_dl = DataLoader(train_ds_aug, batch_size=BATCH, shuffle=True,  num_workers=0)
    val_dl   = DataLoader(val_ds,       batch_size=BATCH, shuffle=False, num_workers=0)

    model     = EyeTrackCNN().to(DEVICE)
    # Model outputs softmax probs → use NLLLoss with log(probs).
    # CrossEntropyLoss would double-apply softmax and give wrong gradients.
    criterion = nn.NLLLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    best_val_acc = 0.0
    epochs_without_improve = 0

    for epoch in range(1, EPOCHS + 1):
        model.train()
        total_loss, correct, total = 0.0, 0, 0
        for imgs, labels in train_dl:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            out  = model(imgs)
            loss = criterion(torch.log(out + 1e-9), labels)  # NLLLoss expects log-probs
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(labels)
            correct    += (out.argmax(1) == labels).sum().item()
            total      += len(labels)

        model.eval()
        v_correct, v_total = 0, 0
        with torch.no_grad():
            for imgs, labels in val_dl:
                imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
                v_correct += (model(imgs).argmax(1) == labels).sum().item()
                v_total   += len(labels)

        val_acc = v_correct / v_total
        scheduler.step()

        print(f"epoch {epoch:3d}/{EPOCHS}  "
              f"loss={total_loss/total:.4f}  "
              f"train={correct/total:.3f}  "
              f"val={val_acc:.3f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), MODEL_PATH)
            print(f"  ✓ model saved  (val={val_acc:.3f})")
            epochs_without_improve = 0
        else:
            epochs_without_improve += 1

        if epochs_without_improve >= EARLY_STOP_PATIENCE:
            print(f"  early stopping (no val improvement for {EARLY_STOP_PATIENCE} epochs)")
            break

    print(f"\nBest val acc: {best_val_acc:.3f} → {MODEL_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train EyeTrackCNN")
    parser.add_argument(
        "--downsample-every",
        type=int,
        default=DEFAULT_DOWNSAMPLE_EVERY,
        help="Keep every N-th frame per class to reduce temporal duplicates (default: 4)",
    )
    args = parser.parse_args()
    train(downsample_every=args.downsample_every)
