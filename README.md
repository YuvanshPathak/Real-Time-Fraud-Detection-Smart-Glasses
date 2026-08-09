# 🕶️ Real-Time Fraud Detection Smart Glasses

> **Capstone Project** — An end-to-end AI-powered fraud detection system embedded in smart glasses, combining edge computing (ESP32-S3), a cloud AI backend, and a real-time monitoring dashboard.

---

## 📖 Overview

This system protects against identity fraud and AI-generated spoofing attacks (deepfakes, voice clones, forged documents) by fusing four independent verification modalities in real time:

| Modality | Method | Weight |
|---|---|---|
| 🎙️ Voice Anti-Spoofing | Audio liveness analysis | 35% |
| 👤 Facial Liveness | Deepfake / presentation attack detection | 35% |
| 🪪 Face-to-ID Sync | Live face vs. ID document (DeepFace / Facenet) | 15% |
| 📄 Document Authenticity | Error Level Analysis (ELA) forgery check | 15% |

The fused **Fraud Risk Score** (0.0 – 1.0) is classified into three levels:

- ✅ **SAFE** (`< 0.25`) — Genuine interaction. Emit a confirmation beep.
- ⚠️ **SUSPICIOUS** (`0.25 – 0.65`) — Anomalies detected. Emit a warning chime.
- 🚨 **FRAUD** (`≥ 0.65`) — High spoofing probability. Trigger critical alarm.

---

## 🏗️ Architecture

This project has two distinct pipelines — one for the **current prototype** and one for the **end-product** target.

---

### Fig. 1 — Prototype Pipeline _(built & tested)_

No hardware or gateway exists yet. The browser tab acts as both the Edge capture device and the Gateway, uploading directly to the Cloud engine.

```
┌──────────────────────────────────┐
│     BROWSER (Stand-in)           │
│     Webcam + Mic Capture         │
│  getUserMedia → File             │
│  (plays Edge + Gateway role)     │
└────────────┬─────────────────────┘
             │  multipart/form-data
             ▼
┌────────────────────────────────────────────────────────────────┐
│                   CLOUD — Verification Engine                  │
│                                                                │
│  /face-check       Liveness · FFT + Laplacian                  │
│  /voice-check      Spoof · HF ratio + jitter                   │
│  /document-check   Tamper · Error Level Analysis (ELA)         │
│  /face-to-id-sync  Identity match · DeepFace / Facenet         │
│                                                                │
│  /risk-score  →  Weighted Fusion 35 / 35 / 15 / 15            │
│                  → SAFE · SUSPICIOUS · FRAUD verdict           │
└────────────────────────────┬───────────────────────────────────┘
                             │  JSON
                             ▼
                    ┌─────────────────┐
                    │  FRONTEND       │
                    │  Risk Card      │
                    │  Verdict pill + │
                    │  per-module     │
                    │  readout        │
                    └─────────────────┘
```

---

### Fig. 2 — End-Product Pipeline _(target architecture)_

```
┌─────────────────┐   BLE/Wi-Fi   ┌─────────────────┐   Wi-Fi   ┌──────────────────────────────────────────────┐
│  ESP32-S3 SENSE │ ─────────────▶│  EDGE           │ ─────────▶│  GATEWAY                                     │
│  Camera + Mic   │               │  TinyML         │           │  Phone — Secure Relay                        │
│  Capture        │               │  Extraction     │           │  (today: browser tab stands in for this hop) │
│  [partial]      │               │  on-device      │           │  [partial]                                   │
│                 │               │  feature vectors│           │                                              │
│                 │               │  [not built]    │           │                                              │
└─────────────────┘               └─────────────────┘           └──────────────────┬───────────────────────────┘
                                                                                   │  HTTP
                                                                                   ▼
                                         ┌─────────────────────────────────────────────────────────┐
                                         │  CLOUD — Verification Engine  [built & tested]           │
                                         │  same engine as Fig. 1                                   │
                                         │  /face-check · /voice-check · /document-check            │
                                         │  /face-to-id-sync · /risk-score (35/35/15/15)            │
                                         └────────────────────────┬────────────────────────────────┘
                                                                  │
                                         ┌────────────────────────┴────────────────────────────────┐
                                         │                                                          │
                                         ▼                                                          ▼
                              ┌──────────────────────┐                              ┌───────────────────────┐
                              │  FEEDBACK            │                              │  ANALYTICS            │
                              │  Bone Conduction     │                              │  Reports & Logs       │
                              │  Alert               │                              │  live risk cards only │
                              │  [not built]         │                              │  nothing persisted    │
                              └──────────────────────┘                              │  [partial]            │
                                                                                    └───────────────────────┘
```

**Build status legend:**

| Status | Meaning |
|---|---|
| ✅ Built & tested | Cloud Verification Engine (`/face-check`, `/voice-check`, `/document-check`, `/face-to-id-sync`, `/risk-score`) · Frontend Risk Card |
| 🟡 Partially built | ESP32-S3 mic driver · Phone/Gateway (browser stand-in) · Analytics (live cards, no persistence) |
| ⬜ Not yet built | TinyML on-device feature extraction · Bone Conduction Alert feedback |

---

## 📁 Repository Structure

```
Real-Time-Fraud-Detection-Smart-Glasses/
│
├── backend/                        # FastAPI Cloud AI Engine
│   ├── app.py                      # Application entry point & router registration
│   ├── routes/
│   │   ├── face.py                 # /face-check & /face-to-id-sync endpoints
│   │   ├── voice.py                # /voice-check endpoint
│   │   ├── document.py             # /document-check endpoint
│   │   └── risk.py                 # /risk-score fusion endpoint
│   ├── utils/
│   │   ├── scoring.py              # Multi-modal fusion formula & thresholds
│   │   └── anti_spoofing.py        # Liveness / deepfake detection helpers
│   ├── requirements.txt
│   └── README.md
│
├── firmware/                       # ESP32-S3 Arduino Firmware
│   └── smartglasses/
│       ├── smart_glasses.ino       # Main Arduino sketch
│       ├── camera.cpp / .h         # OV2640 camera capture
│       ├── microphone.cpp / .h     # PDM microphone recording (16 kHz, 5 s)
│       ├── wifi.cpp / .h           # Wi-Fi connection & HTTP client
│       ├── api.cpp / .h            # Backend API request helpers
│       ├── storage.cpp             # Local file / buffer management
│       └── config.h                # Pin assignments & sampling constants
│
├── frontend/                       # React Dashboard (Vite + Tailwind CSS)
│   ├── src/                        # React components & pages
│   ├── public/
│   ├── package.json
│   └── README.md
│
└── README.md                       # ← You are here
```

---

## 🚀 Quick Start

> **Note:** Running the prototype only requires the **Backend** and **Frontend**. The firmware section applies to the end-product hardware target.

### Prerequisites

| Tool | Version |
|---|---|
| Python | ≥ 3.10 |
| Node.js | ≥ 18 |
| Arduino IDE / arduino-cli | ≥ 2.x |
| ESP32 board package | `esp32` by Espressif ≥ 3.x |

---

### 1 — Backend

```bash
cd backend

# Create & activate virtual environment
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API server (hot-reload)
uvicorn app:app --reload
```

API available at **`http://127.0.0.1:8000`**  
Interactive docs at **`http://127.0.0.1:8000/docs`**

---

### 2 — Frontend

```bash
cd frontend

npm install
npm run dev
```

Dashboard available at **`http://127.0.0.1:5173`**

> ⚠️ Ensure the backend is running before opening the dashboard.

---

### 3 — Firmware (ESP32-S3 Smart Glasses) 🟡 _Partially built_

> **Status:** The PDM microphone driver is implemented. Camera capture, Wi-Fi HTTP upload, and the main sketch loop are stubbed but not yet complete. TinyML on-device feature extraction is not yet built.

1. Open `firmware/smartglasses/smart_glasses.ino` in **Arduino IDE 2**.
2. Install the **esp32** board package via Board Manager.
3. Edit `config.h` to set your Wi-Fi credentials and backend URL (GPIO 41 = MIC_DATA, GPIO 42 = MIC_CLK, 16 kHz / 5 s recording).
4. Select your **ESP32-S3** board and COM port.
5. **Upload** the sketch.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/face-check` | Face liveness / deepfake detection |
| `POST` | `/face-to-id-sync` | Live face vs. uploaded ID document |
| `POST` | `/voice-check` | Voice liveness / spoof detection |
| `POST` | `/document-check` | ID document authenticity (ELA) |
| `POST` | `/risk-score` | Multi-modal fraud risk fusion |

### Example — `/risk-score`

```bash
curl -X POST "http://127.0.0.1:8000/risk-score" \
  -H "Content-Type: application/json" \
  -d '{
    "face_liveness_score": 0.92,
    "voice_liveness_score": 0.88,
    "face_id_match_score": 0.95,
    "doc_authenticity_score": 0.80
  }'
```

Response:

```json
{
  "fraud_risk_score": 0.08,
  "liveness_index": 0.92,
  "risk_level": "SAFE",
  "recommendation": "Genuine interaction verified. Safe to proceed.",
  "audio_alert_tone": "CONFIRMATION_BEEP",
  "modalities": {
    "voice_liveness": 0.88,
    "face_liveness": 0.92,
    "face_id_match": 0.95,
    "doc_authenticity": 0.80
  }
}
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Edge Hardware** | ESP32-S3, OV2640 camera, PDM microphone |
| **Firmware** | Arduino C++ |
| **Backend** | Python · FastAPI · DeepFace · OpenCV · TF-Keras · SoundFile |
| **Frontend** | React 19 · Vite · Tailwind CSS · Axios · react-webcam |
| **AI Models** | Facenet (face matching) · Custom anti-spoofing heuristics |

---

## 📜 License

This project is developed as a university capstone and is intended for academic and research purposes.