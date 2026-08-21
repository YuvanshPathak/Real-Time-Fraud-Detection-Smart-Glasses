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
│  /risk-score  →  Weighted Fusion 35 / 35 / 15 / 15             │
│                  → SAFE · SUSPICIOUS · FRAUD verdict           │
└────────────────────────────┬───────────────────────────────────┘
                             │  JSON
                             ▼
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
│                 │               │  [partial — POC]│           │                                              │
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
| 🟡 Partially built | ESP32-S3 mic driver (rest of firmware unwritten) · Analytics (live cards only, nothing persisted) · **TinyML on-device extraction (`ml/`, `firmware/src/tinyml_*.cpp`) — full feature-extraction/quantization/inference pipeline works, but trained only on a fabricated synthetic dataset (see `ml/README.md`), not real audio; wired through the backend as informational-only and not yet retrained on real hardware-captured samples** |
| ⬜ Not yet built | Phone Gateway relay · Bone Conduction Alert feedback |

---

## ⚠️ Known Limitations

Honest gaps identified against the current code, not the proposal — worth reading before treating any verdict as ground truth:

- **Detection logic is heuristic, not learned.** `/face-check`, `/voice-check`, and `/document-check` classify liveness/spoofing/tampering using hand-tuned signal-processing thresholds (FFT ratios, Laplacian blur bands, ELA std-dev cutoffs) rather than models trained on labeled spoof/genuine data. No EER/FAR/FRR evaluation exists yet. Only the identity-*matching* piece (`/face-to-id-sync`, via DeepFace/Facenet) is a validated trained model.
- **Low-weighted modalities can be diluted to SAFE.** `face_id_match` and `doc_authenticity` are each only 15% of the fused score. A document the system itself flags `is_tampered: true`, or a face match it flags `verified: false`, can still land as an overall **SAFE** verdict if the other two modalities score well — e.g. a forged-but-genuine-person interaction computes to `0.20` (SAFE), and someone presenting a real ID that isn't theirs computes to `0.22` (SAFE).
- **Missing modalities default to fully trusted.** `/risk-score` defaults any omitted score field to `1.0` rather than "unknown." A single obvious spoof detected in isolation (e.g. a phone-only cloned-voice call, with face/document unchecked) is diluted from what should be FRAUD down to SUSPICIOUS.
- **No confidence margin at the thresholds.** `0.249` and `0.251` produce entirely different verdicts (SAFE vs. SUSPICIOUS) with no borderline/manual-review tier.
- **`/face-check` has no face-detection gate.** It runs its liveness heuristics on whatever image content it receives, even if no face is present in the frame.
- **TinyML on-device voice model is trained on fabricated data, not real speech.** `ml/generate_synthetic_dataset.py` programmatically synthesizes both the "genuine" and "spoof" training classes (see `ml/README.md`) — there was no real labeled genuine/spoof dataset available to train on (ASVspoof, the mentor-endorsed target, needs registration/licensing; real hardware-captured samples need physical board access neither of which happened this phase). The resulting `tinyml_liveness_score` proves the on-device pipeline (feature extraction → INT8 TFLite Micro inference) works, not that it detects real spoofing — it's wired through as informational-only for exactly this reason and does not affect `fraud_risk_score`/`risk_level`.

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
├── firmware/                       # ESP32-S3 firmware — PlatformIO project, rebuilt from scratch 2026-08-21
│   ├── src/, include/, lib/        # PlatformIO project layout — includes tinyml_model.cpp/tinyml_features.cpp
│   └── platformio.ini              # Voice module only for this phase — see CLAUDE.md for current status
│
├── ml/                              # TinyML training pipeline — see ml/README.md
│   ├── features.py                 # Log-mel feature extraction (source of truth, mirrored in firmware C++)
│   ├── generate_synthetic_dataset.py, train.py  # Synthetic-POC dataset + model training/quantization
│   └── export_*.py                 # Exports trained model / feature config into firmware/include/*.h
│
├── frontend/                       # React Dashboard (Vite + Tailwind CSS) — built & tested
│   ├── src/                        # React components & pages
│   └── public/
│
├── hardware/                       # Reserved for physical build docs / CAD — currently empty
│
├── tools/                          # Report & UML diagram generator scripts (own package.json)
│   └── diagrams/                   # Generated PNGs embedded in the report
│
├── archive/                        # Superseded drafts & reference docs (idea-defence PDF, format template)
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
| PlatformIO (CLI or VS Code extension) | latest _(firmware only)_ |

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

### 3 — Firmware (ESP32-S3 Smart Glasses) ✅ _Voice module verified on hardware_

> **Status:** Rebuilt from scratch as a PlatformIO project 2026-08-21 (previous Arduino-IDE-based attempt intentionally deleted to start clean). The voice-anti-spoofing pipeline — on-device capture, Wi-Fi upload, cloud analysis, fused verdict, LED display — is built and confirmed working end-to-end on real ESP32-S3 hardware, cross-verified against the backend's own request log. Success is Wi-Fi-signal-dependent (a weak/marginal link fails uploads in varying ways; a strong hotspot works reliably) — see `CLAUDE.md`'s "Current build status" for the full detail and caveats, since that file is kept more current than this one during active firmware work. Camera, face/document capture on-device, on-device feature extraction, and the phone Gateway relay are out of scope for this phase — voice only.

```bash
cd firmware
cp include/config.h.example include/config.h   # fill in real Wi-Fi + backend URL, never commit this file
pio run                                          # compile
pio run -t upload -t monitor --upload-port COMx  # flash and watch serial output in one step
```

Uses the `pioarduino` fork of `platform-espressif32` (see `platformio.ini`), not the official PlatformIO registry — the official one is stuck on an ESP-IDF version too old for the PDM microphone driver.

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
| `GET` | `/sessions` | Recent fused-verdict history (metadata only, no biometric data) |

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
