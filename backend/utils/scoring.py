"""Utility functions for Multi-Modal AI Fraud Fusion & Decision Engine."""


def _round_score(value: float) -> float:
    """Round scores to two decimal places for clean output."""
    return round(float(value), 2)


def _validate_score(value: float, label: str) -> float:
    """Validate and clamp score to range 0..1."""
    if value is None:
        return 1.0
    return max(0.0, min(1.0, float(value)))


def fuse_multi_modal_scores(
    voice_liveness_score: float = 1.0,
    face_liveness_score: float = 1.0,
    face_id_match_score: float = 1.0,
    doc_authenticity_score: float = 1.0,
) -> dict:
    """Combine multi-modal verification signals into a unified Fraud Risk Score.

    Weights:
    - Voice Anti-Spoofing: 35%
    - Facial Liveness (Deepfake Check): 35%
    - Face-to-ID Sync Match: 15%
    - Document Authenticity (ELA Check): 15%
    """
    v_score = _validate_score(voice_liveness_score, "voice_liveness_score")
    f_score = _validate_score(face_liveness_score, "face_liveness_score")
    id_score = _validate_score(face_id_match_score, "face_id_match_score")
    doc_score = _validate_score(doc_authenticity_score, "doc_authenticity_score")

    # Combined liveness index (1.0 = 100% genuine)
    liveness_index = (
        (v_score * 0.35)
        + (f_score * 0.35)
        + (id_score * 0.15)
        + (doc_score * 0.15)
    )

    # Fraud Risk Score (0.0 = safe, 1.0 = definite fraud/spoof)
    fraud_risk_score = _round_score(1.0 - liveness_index)

    # Risk level classification
    if fraud_risk_score < 0.25:
        risk_level = "SAFE"
        recommendation = "Genuine interaction verified. Safe to proceed."
        audio_alert_tone = "CONFIRMATION_BEEP"
    elif fraud_risk_score < 0.65:
        risk_level = "SUSPICIOUS"
        recommendation = "Suspicious anomalies detected. Manual identity verification advised."
        audio_alert_tone = "WARNING_CHIME"
    else:
        risk_level = "FRAUD"
        recommendation = "High AI Fraud / Spoofing probability detected! Alert triggered."
        audio_alert_tone = "CRITICAL_ALARM"

    return {
        "fraud_risk_score": fraud_risk_score,
        "liveness_index": _round_score(liveness_index),
        "risk_level": risk_level,
        "recommendation": recommendation,
        "audio_alert_tone": audio_alert_tone,
        "modalities": {
            "voice_liveness": v_score,
            "face_liveness": f_score,
            "face_id_match": id_score,
            "doc_authenticity": doc_score,
        },
    }
