"""
Trains EyeTrackCNN on data collected by collect.py.

Usage:
    python train.py

Reads:  eye_tracking/training_data.db
Saves:  eye_tracking/model.pt
"""

import os
import sqlite3
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split
from torchvision import transforms
import cv2

from eye_tracking import EyeTrackCNN, IMG_H, IMG_W

DB         = os.path.join(os.path.dirname(__file__), "training_data.db")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pt")
EPOCHS     = 40
BATCH      = 32
LR         = 1e-3
VAL_SPLIT  = 0.15
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"


# ── dataset ───────────────────────────────────────────────────────────────────
class EyeDataset(Dataset):
    def __init__(self, db_path, transform=None):
        conn = sqlite3.connect(db_path)
        rows = conn.execute("SELECT label, image FROM frames").fetchall()
        conn.close()

        self.transform = transform
        self.samples   = []
        for label, blob in rows:
            img = cv2.imdecode(np.frombuffer(blob, np.uint8), cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue
            img = cv2.resize(img, (IMG_W, IMG_H))
            # labels stored as 1–5, convert to 0–4 for CrossEntropyLoss
            self.samples.append((img, label - 1))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img, label = self.samples[idx]
        t = torch.tensor(img / 255.0, dtype=torch.float32).unsqueeze(0)  # (1, H, W)
        if self.transform:
            t = self.transform(t)
        return t, label


# ── augmentation ──────────────────────────────────────────────────────────────
train_tf = transforms.Compose([
    transforms.RandomHorizontalFlip(),
    transforms.RandomAffine(degrees=8, translate=(0.05, 0.05)),
])


# ── training ──────────────────────────────────────────────────────────────────
def train():
    if not os.path.exists(DB):
        print(f"No database found at {DB}. Run collect.py first.")
        return

    full_ds = EyeDataset(DB)
    if len(full_ds) == 0:
        print("Database is empty. Collect some data first.")
        return

    print(f"Loaded {len(full_ds)} samples from {DB}")

    n_val   = max(1, int(len(full_ds) * VAL_SPLIT))
    n_train = len(full_ds) - n_val
    train_ds, val_ds = random_split(full_ds, [n_train, n_val])

    # val split gets no augmentation
    val_ds_clean = EyeDataset(DB, transform=None)
    val_indices  = val_ds.indices
    val_ds       = torch.utils.data.Subset(val_ds_clean, val_indices)

    train_ds_aug        = EyeDataset(DB, transform=train_tf)
    train_ds_aug        = torch.utils.data.Subset(train_ds_aug, train_ds.indices)

    train_dl = DataLoader(train_ds_aug, batch_size=BATCH, shuffle=True,  num_workers=0)
    val_dl   = DataLoader(val_ds,       batch_size=BATCH, shuffle=False, num_workers=0)

    model     = EyeTrackCNN().to(DEVICE)
    # Model outputs softmax probs → use NLLLoss with log(probs).
    # CrossEntropyLoss would double-apply softmax and give wrong gradients.
    criterion = nn.NLLLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    best_val_acc = 0.0

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

    print(f"\nBest val acc: {best_val_acc:.3f} → {MODEL_PATH}")


if __name__ == "__main__":
    train()
