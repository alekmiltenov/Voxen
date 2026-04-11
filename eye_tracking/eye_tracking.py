import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import cv2

# 5 gaze states
NUM_CLASSES = 5
LABELS = {
    1: "LEFT",
    2: "RIGHT",
    3: "UP",
    4: "DOWN",
    5: "CENTER",
}

IMG_H = IMG_W = 64


def preprocess_eye_frame(frame: np.ndarray) -> np.ndarray:
    """
    Shared preprocessing for eye-tracking pipeline.

    Steps (kept identical across collection, training, inference):
      1) grayscale conversion
      2) histogram equalization
      3) resize to model input size
    Returns uint8 image of shape (IMG_H, IMG_W).
    """
    if frame is None:
        raise ValueError("preprocess_eye_frame received None")

    if frame.ndim == 3:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    else:
        gray = frame

    eq = cv2.equalizeHist(gray)
    out = cv2.resize(eq, (IMG_W, IMG_H))
    return out


class EyeTrackCNN(nn.Module):
    """
    Input:  (B, 1, 64, 64)  grayscale eye crop, normalised [0, 1]
    Output: (B, 5)           softmax probabilities over LEFT/RIGHT/UP/DOWN/CENTER
    """

    def __init__(self):
        super().__init__()

        # Block 1  64→32
        self.conv1 = nn.Conv2d(1,   32,  kernel_size=3, padding=1)
        self.bn1   = nn.BatchNorm2d(32)
        # Block 2  32→16
        self.conv2 = nn.Conv2d(32,  64,  kernel_size=3, padding=1)
        self.bn2   = nn.BatchNorm2d(64)
        # Block 3  16→8
        self.conv3 = nn.Conv2d(64,  128, kernel_size=3, padding=1)
        self.bn3   = nn.BatchNorm2d(128)
        # Block 4  8→4
        self.conv4 = nn.Conv2d(128, 128, kernel_size=3, padding=1)
        self.bn4   = nn.BatchNorm2d(128)

        self.pool = nn.MaxPool2d(2, 2)
        self.drop = nn.Dropout(0.4)

        # 128 * 4 * 4 = 2048
        self.fc1 = nn.Linear(2048, 256)
        self.fc2 = nn.Linear(256,  NUM_CLASSES)

    def forward(self, x):
        x = self.pool(F.relu(self.bn1(self.conv1(x))))   # (B, 32,  32, 32)
        x = self.pool(F.relu(self.bn2(self.conv2(x))))   # (B, 64,  16, 16)
        x = self.pool(F.relu(self.bn3(self.conv3(x))))   # (B, 128,  8,  8)
        x = self.pool(F.relu(self.bn4(self.conv4(x))))   # (B, 128,  4,  4)
        x = x.view(x.size(0), -1)                        # (B, 2048)
        x = self.drop(F.relu(self.fc1(x)))               # (B, 256)
        x = self.fc2(x)                                  # (B, 5)
        return F.softmax(x, dim=1)


if __name__ == "__main__":
    model = EyeTrackCNN()
    print(model)
    dummy = torch.zeros(1, 1, IMG_H, IMG_W)
    probs = model(dummy)
    print(f"Output : {probs.shape}")           # (1, 5)
    print(f"Sum    : {probs.sum().item():.4f}") # 1.0
    print(f"Labels : {list(LABELS.values())}")
