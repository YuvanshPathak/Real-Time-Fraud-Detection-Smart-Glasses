"""Voice anti-spoofing and liveness verification routes."""

# Standard library imports
import os
from uuid import uuid4

# Third-party imports
from fastapi import APIRouter, File, UploadFile, HTTPException

# Local application imports
from utils.anti_spoofing import analyze_voice_liveness

# Create a router for voice-related endpoints
router = APIRouter()


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
