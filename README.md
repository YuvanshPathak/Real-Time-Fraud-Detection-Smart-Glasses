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

## 🔒 Design Principle: Always Fresh, Never Stored

Every identity check compares the live capture against **the credential presented in that specific interaction** — e.g. the ID document uploaded in the same `/face-to-id-sync` request — and never against a pre-stored personal reference. There is no database, cache, or persisted biometric template anywhere in this codebase; every uploaded file is deleted immediately after the request that used it. This matters because the product exists to verify *arbitrary strangers* against whatever they present in the moment (a bank teller checking a walk-in customer, an officer checking a traveler) — a pre-enrolled "known faces" list would turn this into a different product (access control), not a fraud detector.

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
│  Capture        │               │  Extraction     │           │  (today: browser tab bypasses this hop        │
│  [partial —     │               │  on-device      │           │   entirely, calling Cloud directly)          │
│   mic only]     │               │  feature vectors│           │  [not built]                                 │
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
| 🟡 Partially built | ESP32-S3 mic driver (rest of firmware unwritten) · Analytics (live cards only, nothing persisted) |
| ⬜ Not yet built | TinyML on-device feature extraction · Phone Gateway relay · Bone Conduction Alert feedback |

---

## ⚠️ Known Limitations

Honest gaps identified against the current code, not the proposal — worth reading before treating any verdict as ground truth:

- **Detection logic is heuristic, not learned.** `/face-check`, `/voice-check`, and `/document-check` classify liveness/spoofing/tampering using hand-tuned signal-processing thresholds (FFT ratios, Laplacian blur bands, ELA std-dev cutoffs) rather than models trained on labeled spoof/genuine data. No EER/FAR/FRR evaluation exists yet. Only the identity-*matching* piece (`/face-to-id-sync`, via DeepFace/Facenet) is a validated trained model.
- **Low-weighted modalities can be diluted to SAFE.** `face_id_match` and `doc_authenticity` are each only 15% of the fused score. A document the system itself flags `is_tampered: true`, or a face match it flags `verified: false`, can still land as an overall **SAFE** verdict if the other two modalities score well — e.g. a forged-but-genuine-person interaction computes to `0.20` (SAFE), and someone presenting a real ID that isn't theirs computes to `0.22` (SAFE).
- **Missing modalities default to fully trusted.** `/risk-score` defaults any omitted score field to `1.0` rather than "unknown." A single obvious spoof detected in isolation (e.g. a phone-only cloned-voice call, with face/document unchecked) is diluted from what should be FRAUD down to SUSPICIOUS.
- **No confidence margin at the thresholds.** `0.249` and `0.251` produce entirely different verdicts (SAFE vs. SUSPICIOUS) with no borderline/manual-review tier.
- **`/face-check` has no face-detection gate.** It runs its liveness heuristics on whatever image content it receives, even if no face is present in the frame.

## 📁 Repository Structure

```
Real-Time-Fraud-Detection-Smart-Glasses/
│
├── backend/                        # FastAPI Cloud AI Engine — built & tested
│   ├── app.py                      # Application entry point & router registration
│   ├── routes/
│   │   ├── face.py                 # /face-check & /face-to-id-sync endpoints
│   │   ├── voice.py                # /voice-check endpoint
│   │   ├── document.py             # /document-check endpoint
│   │   └── risk.py                 # /risk-score fusion endpoint
│   ├── utils/
│   │   ├── scoring.py              # Multi-modal fusion formula & thresholds
│   │   └── anti_spoofing.py        # Liveness / deepfake / tamper detection heuristics
│   ├── test_api.py                 # End-to-end route smoke test
│   ├── requirements.txt
│   └── uploads/                    # Ephemeral only — files deleted after each request
│
├── firmware/                       # ESP32-S3 Arduino Firmware — mostly unwritten
│   └── smartglasses/
│       ├── smart_glasses.ino       # Main Arduino sketch — EMPTY, not yet written
│       ├── microphone.cpp / .h     # PDM microphone recording (16 kHz, 5 s) — implemented
│       ├── config.h                # Pin assignments & sampling constants — implemented
│       ├── camera.cpp / .h         # OV2640 camera capture — EMPTY (stub only)
│       ├── wifi.cpp / .h           # Wi-Fi connection & HTTP client — EMPTY (stub only)
│       ├── api.cpp / .h            # Backend API request helpers — EMPTY (stub only)
│       └── storage.cpp             # Local file / buffer management — EMPTY (stub only)
│
├── frontend/                       # React Dashboard (Vite + Tailwind CSS) — built & tested
│   ├── src/                        # React components & pages
│   └── public/
│
├── hardware/                       # Reserved for physical build docs / CAD — currently empty
│
├── Capstone Report (Idea Defence) Final.pdf   # Original project proposal
│
└── README.md                       # ← You are here
```

---

## 🚀 Quick Start

> **Note:** Running the prototype only requires the **Backend** and **Frontend**. The firmware section below applies to the end-product hardware target and is not yet runnable.

### Prerequisites

| Tool | Version |
|---|---|
| Python | ≥ 3.10 |
| Node.js | ≥ 18 |
| Arduino IDE / arduino-cli | ≥ 2.x _(firmware only, not yet usable — see below)_ |

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

Run the smoke test suite with the server stopped (it spins up its own `TestClient`):

```bash
python test_api.py
```

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

### 3 — Firmware (ESP32-S3 Smart Glasses) ⬜ _Not yet runnable_

> **Status:** Only the PDM microphone driver (`microphone.cpp/.h`) and pin/sampling constants (`config.h`) are implemented. The main sketch (`smart_glasses.ino`) is empty, and `camera.cpp`, `wifi.cpp`, `api.cpp`, and `storage.cpp` are all empty stub files. There is nothing to compile or upload yet — this section is a placeholder for when that firmware is written.

Once the sketch and stubs are filled in: open `firmware/smartglasses/smart_glasses.ino` in Arduino IDE 2, install the **esp32** board package, set Wi-Fi credentials and the backend URL, select the ESP32-S3 board/port, and upload. `config.h` currently defines `MIC_DATA_PIN` (GPIO 41), `MIC_CLK_PIN` (GPIO 42), a 16 kHz sample rate, and a 5-second recording window.

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
  "fraud_risk_score": 0.11,
  "liveness_index": 0.89,
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
| **AI Models** | Facenet (face matching, trained) · Custom anti-spoofing heuristics (untrained — see Known Limitations) |

---

## 📜 License

This project is developed as a university capstone and is intended for academic and research purposes.
