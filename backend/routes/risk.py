"""Unified multi-modal risk scoring routes."""

# Standard library imports
from typing import Optional

# Third-party imports
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Local application imports
from utils.scoring import fuse_multi_modal_scores
from utils.session_log import log_session, recent_sessions

# Create a router for risk-related endpoints
router = APIRouter()


class MultiModalRiskRequest(BaseModel):
    """Request model for multi-modal decision fusion.

    A field left unset means that modality was not evaluated for this
    interaction — it is excluded from fusion, not assumed genuine.
    """

    voice_liveness_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    face_liveness_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    face_id_match_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    doc_authenticity_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)


@router.post("/risk-score")
def risk_score(payload: MultiModalRiskRequest):
    """Return a fused fraud risk score based on multi-modal liveness and authenticity signals."""
    try:
        fusion_result = fuse_multi_modal_scores(
            voice_liveness_score=payload.voice_liveness_score,
            face_liveness_score=payload.face_liveness_score,
            face_id_match_score=payload.face_id_match_score,
            doc_authenticity_score=payload.doc_authenticity_score,
        )
        log_session(fusion_result)
        return {
            "module": "decision_fusion_engine",
            "status": "success",
            **fusion_result,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/sessions")
def list_sessions(limit: int = 50):
    """Return the most recent fused-verdict sessions, newest first.

    Metadata only (scores, risk level, which modalities were evaluated) —
    never raw audio/image/document data. See utils/session_log.py.
    """
    return {"module": "session_log", "status": "success", "sessions": recent_sessions(limit)}
