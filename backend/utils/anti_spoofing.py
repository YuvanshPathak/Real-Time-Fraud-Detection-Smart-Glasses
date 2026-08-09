"""Anti-spoofing and liveness detection utility module.

Provides algorithmic and signal-analysis models for:
1. Voice Anti-Spoofing (AI Voice Clone, TTS, and Replay Detection)
2. Facial Liveness & Deepfake Detection (Spatial-frequency, FFT, Chromaticity, and Edge blending analysis)
3. Document Forgery & Tampering Verification (Error Level Analysis, ID Face Extraction)
"""

import os
import cv2
import numpy as np
import scipy.signal
import soundfile as sf
from PIL import Image, ImageChops, ImageEnhance


def analyze_voice_liveness(audio_path: str) -> dict:
    """Analyze audio file for AI voice cloning, TTS synthesis, and replay attack indicators.

    Returns dict with voice_liveness_score (0..1), is_spoof, spoof_type, and details.
    """
    try:
        data, sample_rate = sf.read(audio_path, dtype="float32")
        if data.ndim > 1:
            data = data.mean(axis=1)

        if len(data) == 0:
            raise ValueError("Empty audio signal")

        # 1. High-Frequency Harmonic Ratio Analysis
        # Synthetic TTS voice clones often attenuate or artifact frequencies above 7kHz
        nyquist = sample_rate / 2.0
        cutoff_hf = min(7000.0, nyquist - 100.0)
        
        b_hf, a_hf = scipy.signal.butter(4, cutoff_hf / nyquist, btype="highpass")
        hf_signal = scipy.signal.filtfilt(b_hf, a_hf, data)
        
        total_energy = np.sum(data ** 2) + 1e-9
        hf_energy = np.sum(hf_signal ** 2)
        hf_ratio = hf_energy / total_energy

        # 2. Spectral Centroid and Spectral Rolloff Consistency
        frequencies, times, spec = scipy.signal.spectrogram(data, fs=sample_rate, nperseg=512)
        spec_energy = np.sum(spec, axis=0) + 1e-9
        
        # Spectral Centroid (mean frequency weighted by energy)
        spectral_centroid = np.sum(frequencies[:, np.newaxis] * spec, axis=0) / spec_energy
        centroid_std = float(np.std(spectral_centroid))

        # 3. Short-Time Energy Variance (Micro-jitter/shimmer check)
        frame_energy = np.sum(spec ** 2, axis=0)
        energy_variance = float(np.var(frame_energy / (np.max(frame_energy) + 1e-9)))

        # 4. Score Calculation based on acoustic cues
        # Natural human speech has rich micro-variations (jitter/shimmer) and high-frequency harmonics
        # Artificial voice clones display unnaturally uniform spectral roll-offs or suppressed high frequencies
        liveness_score = 0.5

        # Heuristic scoring calibration
        if hf_ratio > 0.005 and centroid_std > 300:
            liveness_score += 0.35
        elif hf_ratio > 0.001:
            liveness_score += 0.20
        else:
            liveness_score -= 0.25

        if energy_variance > 0.01:
            liveness_score += 0.15
        else:
            liveness_score -= 0.20

        liveness_score = float(np.clip(liveness_score, 0.05, 0.98))

        is_spoof = liveness_score < 0.65
        spoof_type = "GENUINE_HUMAN_VOICE"
        if is_spoof:
            if hf_ratio < 0.001:
                spoof_type = "AI_SYNTHETIC_VOICE_CLONE"
            else:
                spoof_type = "REPLAY_ATTACK"

        return {
            "voice_liveness_score": round(liveness_score, 2),
            "is_spoof": is_spoof,
            "spoof_type": spoof_type,
            "details": {
                "high_frequency_ratio": round(float(hf_ratio), 5),
                "spectral_centroid_std": round(centroid_std, 2),
                "energy_variance": round(energy_variance, 4),
            },
        }
    except Exception as exc:
        # Fallback for unexpected format errors
        return {
            "voice_liveness_score": 0.50,
            "is_spoof": True,
            "spoof_type": "ANALYSIS_ERROR",
            "details": {"error": str(exc)},
        }


def analyze_facial_liveness(image_path: str) -> dict:
    """Analyze face image for AI Deepfake (GAN/Diffusion), screen replay, or print presentation attack.

    Returns dict with face_liveness_score (0..1), is_deepfake, liveness_status, and details.
    """
    img = cv2.imread(image_path)
    if img is None:
        return {
            "face_liveness_score": 0.0,
            "is_deepfake": True,
            "liveness_status": "INVALID_IMAGE",
            "details": {"error": "Could not read image file"},
        }

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. Laplacian Variance (Blur & Focus check for Screen Replay / Print Attack)
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # 2. Fast Fourier Transform (FFT) High-Frequency Decay
    # Generative AI (GANs/Deepfakes) often leave high-frequency grid artifacts or over-smoothed spectrum
    f = np.fft.fft2(gray)
    fshift = np.fft.fftshift(f)
    magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1e-9)

    h, w = gray.shape
    cy, cx = h // 2, w // 2
    # Radius for high frequency
    r = min(h, w) // 4
    mask = np.ones((h, w), np.uint8)
    cv2.circle(mask, (cx, cy), r, 0, -1)
    
    high_freq_energy = np.mean(magnitude_spectrum[mask == 1])
    low_freq_energy = np.mean(magnitude_spectrum[mask == 0]) + 1e-9
    freq_ratio = float(high_freq_energy / low_freq_energy)

    # 3. YCrCb Chromaticity Variance (Skin Reflectance Liveness Check)
    ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
    cr_var = float(np.var(ycrcb[:, :, 1]))
    cb_var = float(np.var(ycrcb[:, :, 2]))
    chroma_var = cr_var + cb_var

    # 4. Score Calculation
    liveness_score = 0.50

    # Screen replay check (extreme high or low blur)
    if laplacian_var > 100 and laplacian_var < 1500:
        liveness_score += 0.25
    elif laplacian_var <= 50:
        # Heavily blurred / screen capture artifact
        liveness_score -= 0.30
    else:
        liveness_score += 0.10

    # FFT frequency check
    if freq_ratio > 0.40 and freq_ratio < 0.85:
        liveness_score += 0.20
    else:
        # Deepfake / GAN frequency anomaly
        liveness_score -= 0.20

    # Chromatic skin reflectance check
    if chroma_var > 30 and chroma_var < 500:
        liveness_score += 0.15
    else:
        liveness_score -= 0.15

    liveness_score = float(np.clip(liveness_score, 0.05, 0.98))

    is_deepfake = liveness_score < 0.65
    liveness_status = "REAL_HUMAN"
    if is_deepfake:
        if laplacian_var < 60:
            liveness_status = "SCREEN_REPLAY_ATTACK"
        else:
            liveness_status = "AI_DEEPFAKE_DETECTED"

    return {
        "face_liveness_score": round(liveness_score, 2),
        "is_deepfake": is_deepfake,
        "liveness_status": liveness_status,
        "details": {
            "laplacian_variance": round(laplacian_var, 2),
            "fft_frequency_ratio": round(freq_ratio, 3),
            "chroma_variance": round(chroma_var, 2),
        },
    }


def analyze_document_authenticity(image_path: str) -> dict:
    """Analyze official document / ID card for digital tampering and forgery using Error Level Analysis (ELA).

    Returns dict with doc_authenticity_score (0..1), is_tampered, document_type, and detected face crop.
    """
    img = cv2.imread(image_path)
    if img is None:
        return {
            "doc_authenticity_score": 0.0,
            "is_tampered": True,
            "document_type": "UNKNOWN",
            "details": {"error": "Invalid image file"},
        }

    # 1. Error Level Analysis (ELA) for JPEG Compression Grid Disparity
    ela_temp_path = image_path + ".ela.tmp.jpg"
    try:
        # Save compressed version at 90% quality
        cv2.imwrite(ela_temp_path, img, [int(cv2.IMWRITE_JPEG_QUALITY), 90])

        orig_pil = Image.open(image_path).convert("RGB")
        compressed_pil = Image.open(ela_temp_path).convert("RGB")

        # Compute difference
        ela_img = ImageChops.difference(orig_pil, compressed_pil)

        # Scale difference
        extrema = ela_img.getextrema()
        max_diff = max([ex[1] for ex in extrema]) or 1
        scale = 255.0 / max_diff
        ela_img = ImageEnhance.Brightness(ela_img).enhance(scale)

        ela_arr = np.array(ela_img)
        ela_std = float(np.std(ela_arr))
        ela_mean = float(np.mean(ela_arr))
    finally:
        if os.path.exists(ela_temp_path):
            os.remove(ela_temp_path)

    # 2. ID Document Detection (portrait presence check only — nothing is saved to disk)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4)

    has_id_portrait = len(faces) > 0

    # 3. Authenticity Score Calculation
    # Un-edited physical ID photos have uniform ELA variance across the card.
    # Digital copy-paste / text editing creates localized high ELA std dev (> 65.0).
    authenticity_score = 0.85

    if ela_std > 65.0 or ela_mean > 45.0:
        authenticity_score -= 0.40  # High tampering suspicion
    elif ela_std > 50.0:
        authenticity_score -= 0.15

    if not has_id_portrait:
        authenticity_score -= 0.10  # Missing standard ID portrait

    authenticity_score = float(np.clip(authenticity_score, 0.10, 0.99))
    is_tampered = authenticity_score < 0.65

    return {
        "doc_authenticity_score": round(authenticity_score, 2),
        "is_tampered": is_tampered,
        "document_type": "IDENTITY_CARD" if has_id_portrait else "OFFICIAL_DOCUMENT",
        "has_id_portrait": has_id_portrait,
        "details": {
            "ela_std": round(ela_std, 2),
            "ela_mean": round(ela_mean, 2),
            "faces_found": len(faces),
        },
    }
