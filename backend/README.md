# Real-Time Fraud Detection Smart Glasses - Phase A (Backend)

This backend provides face verification, voice verification, and unified risk scoring APIs.

## Project Structure

```
backend/
│
├── app.py
├── routes/
│   ├── face.py
│   ├── voice.py
│   └── risk.py
│
├── utils/
│   └── scoring.py
│
├── uploads/
│   └── .gitkeep
│
├── requirements.txt
│
└── README.md
```

## Setup Instructions

1. Open a terminal in the `backend` folder.
2. Create and activate a virtual environment (recommended):

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

## Run the Server

```bash
uvicorn app:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

## API Testing Instructions

### Root Check

```
GET /
```

Response:

```json
{
  "message": "Fraud Detection Backend Running"
}
```

### Face Verification

```
POST /face-check
```

- Upload a file with the form field name `image`.
- Analyzes the uploaded image itself for liveness/deepfake artifacts — no stored reference is used. Identity matching against a presented ID happens via `/face-to-id-sync`, using the ID document uploaded in that same request.

Example curl:

```bash
curl -X POST "http://127.0.0.1:8000/face-check" \
  -F "image=@/path/to/image.jpg"
```

### Voice Verification

```
POST /voice-check
```

- Upload a file with the form field name `audio`.
- Analyzes the uploaded audio itself for spoof/liveness artifacts — no stored reference is used.

Example curl:

```bash
curl -X POST "http://127.0.0.1:8000/voice-check" \
  -F "audio=@/path/to/audio.wav"
```

### Unified Risk Score

```
POST /risk-score
```

Request body:

```json
{
  "face_score": 0.89,
  "voice_score": 0.42
}
```

Example curl:

```bash
curl -X POST "http://127.0.0.1:8000/risk-score" \
  -H "Content-Type: application/json" \
  -d "{\"face_score\": 0.89, \"voice_score\": 0.42}"
```

## Notes

- Face/voice liveness checks analyze only the freshly uploaded capture — no personal reference file or database is stored or compared against.
- Identity matching (`/face-to-id-sync`) uses DeepFace with the Facenet model, comparing the live capture against the ID document uploaded in that same request.
- Uploaded files are saved temporarily in the `uploads/` folder and deleted immediately after each request.

## Risk Fusion

See [utils/scoring.py](utils/scoring.py) for the current weighted fusion formula and SAFE/SUSPICIOUS/FRAUD thresholds.
