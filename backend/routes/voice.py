"""Voice anti-spoofing and liveness verification routes."""

# Standard library imports
import os
import pathlib
import shutil
from uuid import uuid4

# Disable symlinks for Hugging Face downloads on Windows
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")

# SpeechBrain uses pathlib.Path.symlink_to during model fetch
_original_symlink_to = pathlib.Path.symlink_to


def _safe_symlink_to(self, target, target_is_directory=False):
    try:
        _original_symlink_to(self, target, target_is_directory=target_is_directory)
    except OSError:
        shutil.copy2(target, self)


pathlib.Path.symlink_to = _safe_symlink_to

# Third-party imports
from fastapi import APIRouter, File, UploadFile, HTTPException

# Local application imports
from utils.anti_spoofing import analyze_voice_liveness

# Reference audio path
REFERENCE_AUDIO_PATH = os.path.join("reference_audio", "reference.wav")

_SPEAKER_MODEL = None


def _get_speaker_model():
    global _SPEAKER_MODEL
    if _SPEAKER_MODEL is None:
        try:
            import torchaudio
            if not hasattr(torchaudio, "set_audio_backend"):
                torchaudio.set_audio_backend = lambda _b: None
            from speechbrain.pretrained import EncoderClassifier
            _SPEAKER_MODEL = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                run_opts={"device": "cpu"},
            )
        except Exception:
            _SPEAKER_MODEL = False
    return _SPEAKER_MODEL if _SPEAKER_MODEL is not False else None


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
        # 1. Primary AI Voice Anti-Spoofing & Liveness Analysis
        liveness_res = analyze_voice_liveness(file_path)

        # 2. Speaker similarity comparison if reference audio exists
        similarity = None
        speaker_model = _get_speaker_model()
        if os.path.isfile(REFERENCE_AUDIO_PATH) and speaker_model is not None:
            try:
                import torch
                import torch.nn.functional as torch_nn
                import torchaudio
                import soundfile as sf

                audio_data, sample_rate = sf.read(file_path, dtype="float32")
                if audio_data.ndim > 1:
                    audio_data = audio_data.mean(axis=1)
                waveform = torch.from_numpy(audio_data).unsqueeze(0)

                ref_data, ref_sample_rate = sf.read(REFERENCE_AUDIO_PATH, dtype="float32")
                if ref_data.ndim > 1:
                    ref_data = ref_data.mean(axis=1)
                ref_waveform = torch.from_numpy(ref_data).unsqueeze(0)

                target_rate = 16000
                if sample_rate != target_rate:
                    waveform = torchaudio.functional.resample(
                        waveform, orig_freq=sample_rate, new_freq=target_rate
                    )
                if ref_sample_rate != target_rate:
                    ref_waveform = torchaudio.functional.resample(
                        ref_waveform, orig_freq=ref_sample_rate, new_freq=target_rate
                    )

                with torch.no_grad():
                    emb_live = speaker_model.encode_batch(waveform).squeeze()
                    emb_ref = speaker_model.encode_batch(ref_waveform).squeeze()

                sim_raw = torch_nn.cosine_similarity(emb_live, emb_ref, dim=0)
                sim_val = float(sim_raw.item())
                similarity = round(max(0.0, min(1.0, (sim_val + 1) / 2)), 2)
            except Exception:
                similarity = None

        return {
            "module": "voice_anti_spoofing",
            "voice_liveness_score": liveness_res["voice_liveness_score"],
            "spoof_detected": liveness_res["is_spoof"],
            "spoof_type": liveness_res["spoof_type"],
            "voice_similarity": similarity,
            "details": liveness_res["details"],
            "status": "success",
        }
    finally:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass
