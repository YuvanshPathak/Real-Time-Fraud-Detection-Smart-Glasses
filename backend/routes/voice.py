"""Voice anti-spoofing and liveness verification routes."""

# Standard library imports
import os
import time
from uuid import uuid4

# Third-party imports
import lameenc
import soundfile as sf
from fastapi import APIRouter, File, UploadFile, HTTPException

# Local application imports
from utils.anti_spoofing import analyze_voice_liveness

# Create a router for voice-related endpoints
router = APIRouter()

# TEMPORARY DEBUG — remove once the firmware's mic capture is confirmed
# reliable. Saves a copy of each recording as an MP3 for manual listen-back,
# separate from the real request-scoped upload (which is still deleted in
# the finally block below, unchanged). This is intentionally NOT part of the
# fresh-analysis identity-check path — see CLAUDE.md "The one rule that must
# never regress": this must not turn into a permanent stored-reference
# mechanism. DEBUG_RECORDINGS_DIR is gitignored.
DEBUG_RECORDINGS_DIR = "debug_recordings"


def _save_debug_mp3(wav_path: str) -> None:
    try:
        os.makedirs(DEBUG_RECORDINGS_DIR, exist_ok=True)
        data, sample_rate = sf.read(wav_path, dtype="int16")
        if data.ndim > 1:
            data = data[:, 0]

        encoder = lameenc.Encoder()
        encoder.set_bit_rate(128)
        encoder.set_in_sample_rate(int(sample_rate))
        encoder.set_channels(1)
        encoder.set_quality(2)
        mp3_bytes = encoder.encode(data.tobytes())
        mp3_bytes += encoder.flush()

        out_name = f"voice_{time.strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}.mp3"
        with open(os.path.join(DEBUG_RECORDINGS_DIR, out_name), "wb") as f:
            f.write(mp3_bytes)
    except Exception as exc:
        # Debug-only convenience — never let this break the real endpoint.
        print(f"[debug] failed to save debug MP3: {exc}")


@router.post("/voice-check")
async def voice_check(audio: UploadFile = File(...)):
    """Handle voice anti-spoofing and audio liveness verification requests."""
    # Validate file presence
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")

    # Ensure uploads directory exists
    os.makedirs("uploads", exist_ok=True)

    # Create a unique filename to avoid collisions
    file_ext = os.path.splitext(audio.filename)[1] or ".audio"
    safe_name = f"voice_{uuid4().hex}{file_ext}"
    file_path = os.path.join("uploads", safe_name)

    # Save uploaded audio to disk
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await audio.read())
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to save audio file") from exc

    try:
        # AI Voice Anti-Spoofing & Liveness Analysis (no stored reference — analyzes the live capture itself)
        liveness_res = analyze_voice_liveness(file_path)

        _save_debug_mp3(file_path)  # TEMPORARY DEBUG — see note above

        return {
            "module": "voice_anti_spoofing",
            "voice_liveness_score": liveness_res["voice_liveness_score"],
            "spoof_detected": liveness_res["is_spoof"],
            "spoof_type": liveness_res["spoof_type"],
            "details": liveness_res["details"],
            "status": "success",
        }
    finally:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass
