"""Utility functions for Multi-Modal AI Fraud Fusion & Decision Engine."""

from typing import Dict, List, Optional, Tuple

# Relative weight of each modality when all four are evaluated. When a modality
# is skipped, its weight is redistributed proportionally among the ones that
# were actually checked, rather than defaulting the missing modality to "genuine".
MODALITY_WEIGHTS: Dict[str, float] = {
    "voice_liveness": 0.35,
    "face_liveness": 0.35,
    "face_id_match": 0.15,
    "doc_authenticity": 0.15,
}

# Below this, a module has already called the result a failure on its own terms
# (mirrors is_spoof / is_deepfake / is_tampered in anti_spoofing.py, all cut at 0.65).
# A single flagged modality can't be averaged back down to SAFE.
MODULE_FLAG_THRESHOLD = 0.65

# Below this, a modality isn't just flagged — it's confidently bad. One hard
# failure (or two ordinary flags) puts a floor of FRAUD under the verdict.
HARD_FAIL_THRESHOLD = 0.35

# Fused scores within this margin of a classification boundary are reported as
# borderline, so a hard cliff doesn't silently swallow a close call.
BORDERLINE_MARGIN = 0.03

_SEVERITY_RANK = {"SAFE": 0, "SUSPICIOUS": 1, "FRAUD": 2}


def _round_score(value: float) -> float:
    """Round scores to two decimal places for clean output."""
    return round(float(value), 2)


def _clamp_score(value: float) -> float:
    """Clamp a provided score to the valid 0..1 range."""
    return max(0.0, min(1.0, float(value)))


def _classify(fraud_risk_score: float) -> str:
    if fraud_risk_score < 0.25:
        return "SAFE"
    if fraud_risk_score < 0.65:
        return "SUSPICIOUS"
    return "FRAUD"


def _escalation_floor(evaluated: Dict[str, float]) -> str:
    """A verdict floor driven by individual modality flags, independent of the average."""
    flagged = [k for k, v in evaluated.items() if v < MODULE_FLAG_THRESHOLD]
    hard_failed = [k for k in flagged if evaluated[k] < HARD_FAIL_THRESHOLD]

    if hard_failed or len(flagged) >= 2:
        return "FRAUD"
    if flagged:
        return "SUSPICIOUS"
    return "SAFE"


def _recommendation_for(risk_level: str, escalated: bool, borderline: bool) -> Tuple[str, str]:
    if risk_level == "SAFE":
        text = "Genuine interaction verified. Safe to proceed."
        tone = "CONFIRMATION_BEEP"
    elif risk_level == "SUSPICIOUS":
        text = "Suspicious anomalies detected. Manual identity verification advised."
        tone = "WARNING_CHIME"
    else:
        text = "High AI Fraud / Spoofing probability detected! Alert triggered."
        tone = "CRITICAL_ALARM"

    if escalated:
        text += " Escalated: a single modality failed outright despite a stronger blended average."
    if borderline:
        text += " Score sits at the classification boundary — recommend a manual re-check."

    return text, tone


def fuse_multi_modal_scores(
    voice_liveness_score: Optional[float] = None,
    face_liveness_score: Optional[float] = None,
    face_id_match_score: Optional[float] = None,
    doc_authenticity_score: Optional[float] = None,
) -> dict:
    """Combine multi-modal verification signals into a unified Fraud Risk Score.

    Full weights when every modality is checked:
    - Voice Anti-Spoofing: 35%
    - Facial Liveness (Deepfake Check): 35%
    - Face-to-ID Sync Match: 15%
    - Document Authenticity (ELA Check): 15%

    A modality left as ``None`` was not evaluated for this interaction and is
    excluded from the fusion entirely (its weight is redistributed among the
    modalities that were checked) rather than assumed genuine. Regardless of
    the resulting weighted average, any modality that individually crosses its
    own failure threshold puts a floor under the final verdict — see
    ``_escalation_floor``.
    """
    raw_scores = {
        "voice_liveness": voice_liveness_score,
        "face_liveness": face_liveness_score,
        "face_id_match": face_id_match_score,
        "doc_authenticity": doc_authenticity_score,
    }

    evaluated: Dict[str, float] = {
        key: _clamp_score(value) for key, value in raw_scores.items() if value is not None
    }
    unchecked: List[str] = [key for key, value in raw_scores.items() if value is None]

    if not evaluated:
        raise ValueError("At least one modality score must be provided.")

    weight_total = sum(MODALITY_WEIGHTS[key] for key in evaluated)
    liveness_index = sum(evaluated[key] * MODALITY_WEIGHTS[key] for key in evaluated) / weight_total

    fraud_risk_score = _round_score(1.0 - liveness_index)
    risk_level = _classify(fraud_risk_score)

    floor_level = _escalation_floor(evaluated)
    escalated = _SEVERITY_RANK[floor_level] > _SEVERITY_RANK[risk_level]
    if escalated:
        risk_level = floor_level

    borderline = (
        abs(fraud_risk_score - 0.25) <= BORDERLINE_MARGIN
        or abs(fraud_risk_score - 0.65) <= BORDERLINE_MARGIN
    )

    recommendation, audio_alert_tone = _recommendation_for(risk_level, escalated, borderline)

    return {
        "fraud_risk_score": fraud_risk_score,
        "liveness_index": _round_score(liveness_index),
        "risk_level": risk_level,
        "recommendation": recommendation,
        "audio_alert_tone": audio_alert_tone,
        "borderline": borderline,
        "escalated": escalated,
        "evaluated_modalities": sorted(evaluated.keys()),
        "unchecked_modalities": unchecked,
        "modalities": {key: evaluated.get(key) for key in MODALITY_WEIGHTS},
    }
