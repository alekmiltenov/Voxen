# Voxen – AI-powered adaptive communication system for people with motor and speech impairments

---

## 🧠 Description

Voxen is an adaptive communication system designed for people with severe motor and speech disabilities who cannot use traditional interfaces like keyboards, mice, or touchscreens.

The project solves a critical problem:  
**enabling fast, intuitive, and independent communication using minimal physical input.**

Voxen allows users to control a full communication interface using:

- eye movement
- head movement (via sensors)
- or a combination of both

Instead of forcing users to adapt to technology, Voxen adapts to the user.

### How it works (high-level):

1. Capture minimal physical signals (eye movement or sensor input)
2. Translate them into navigation commands (LEFT, RIGHT, SELECT, etc.)
3. Provide AI-powered phrase suggestions
4. Convert selected phrases into speech in real time

The result is a system that restores **communication, independence, and dignity**.

---

## 🎯 Features

- 👁️ **Eye Tracking Input**
  - Laptop camera-based tracking
  - Raspberry Pi camera (high-precision single-eye tracking)

- 🧠 **Sensor-Based Control**
  - ESP32 + accelerometer
  - Head movement mapped to navigation commands

- 🔀 **Multi-Input System**
  - Switch seamlessly between input methods
  - Fully adaptive to user capabilities

- 🤖 **AI Phrase Suggestions**
  - Powered by DistilGPT logits
  - Personalized using MongoDB n-grams
  - Real-time suggestions via WebSocket

- 💬 **AI Assistant Chat**
  - Integrated conversational assistant (Groq API)

- 🔊 **Text-to-Speech Output**
  - Instant speech feedback for words and full sentences

- 🧩 **Adaptive Communication UI**
  - Starter phrases → dynamic suggestions → sentence building

- ❤️ **Pain Communication System**
  - Select body area → system verbalizes pain location

- 🚨 **Emergency System**
  - Trigger alert to caregiver (SMS integration)

---

## 🏗️ How It Works (Architecture)

### Frontend
- React + Vite
- Real-time UI updates
- WebSocket integration

### Backend
- FastAPI
- REST + WebSocket endpoints
- Handles:
  - AI suggestions
  - action execution
  - vocabulary learning

### AI System
- DistilGPT (logits-based next-word prediction)
- Combined with MongoDB n-gram personalization
- Hybrid approach: AI + user behavior learning

### Hardware Layer
- ESP32 + accelerometer → movement input
- Raspberry Pi 4B + Camera Module 3 → precise eye tracking
- Laptop camera → fallback eye tracking

### Communication Layer
- WebSockets for:
  - real-time suggestions
  - input control signals

---

## ⚙️ Installation

### Clone the repository
```bash
git clone <your-repo-url>
cd Voxen



Backend setup
cd backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

Run server:

python -m uvicorn server:app --reload
Frontend setup
cd frontend
npm install
npm run dev