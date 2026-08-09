"""Document verification and tampering detection routes."""

# Standard library imports
import os
from uuid import uuid4

# Third-party imports
from fastapi import APIRouter, File, UploadFile, HTTPException

# Local application imports
from utils.anti_spoofing import analyze_document_authenticity

# Create a router for document-related endpoints
router = APIRouter()


@router.post("/document-check")
async def document_check(document: UploadFile = File(...)):
    """Handle ID card and official document forgery & tampering checks."""
    if not document.filename:
        raise HTTPException(status_code=400, detail="No document image provided")

    os.makedirs("uploads", exist_ok=True)

    file_ext = os.path.splitext(document.filename)[1] or ".jpg"
    safe_name = f"doc_{uuid4().hex}{file_ext}"
    file_path = os.path.join("uploads", safe_name)

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await document.read())
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to save document file") from exc

    try:
        # Perform Error Level Analysis (ELA) and face crop extraction
        doc_res = analyze_document_authenticity(file_path)

        return {
            "module": "document_verification",
            "doc_authenticity_score": doc_res["doc_authenticity_score"],
            "is_tampered": doc_res["is_tampered"],
            "document_type": doc_res["document_type"],
            "has_id_portrait": doc_res["has_id_portrait"],
            "details": doc_res["details"],
            "status": "success",
        }
    finally:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass
