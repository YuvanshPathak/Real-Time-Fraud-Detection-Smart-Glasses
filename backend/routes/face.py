"""Face anti-spoofing, deepfake liveness, and face-to-ID verification routes."""

# Standard library imports
import os
from uuid import uuid4

# Third-party imports
from fastapi import APIRouter, File, UploadFile, HTTPException

# Local application imports
from utils.anti_spoofing import analyze_facial_liveness

# Reference image path
REFERENCE_IMAGE_PATH = os.path.join("reference_faces", "reference.jpg")

# Create a router for face-related endpoints
router = APIRouter()


@router.post("/face-check")
async def face_check(image: UploadFile = File(...)):
    """Handle face liveness and deepfake detection requests."""
    if not image.filename:
        raise HTTPException(status_code=400, detail="No image file provided")

    os.makedirs("uploads", exist_ok=True)

    file_ext = os.path.splitext(image.filename)[1] or ".jpg"
    safe_name = f"face_{uuid4().hex}{file_ext}"
    file_path = os.path.join("uploads", safe_name)

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await image.read())
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to save uploaded image") from exc

    try:
        # 1. Primary Facial Liveness & Deepfake Analysis
        liveness_res = analyze_facial_liveness(file_path)

        # 2. Optional Biometric Face Matching if reference image is present
        similarity_distance = None
        is_same_person = None
        if os.path.isfile(REFERENCE_IMAGE_PATH):
            try:
                from deepface import DeepFace
                verify_res = DeepFace.verify(
                    img1_path=file_path,
                    img2_path=REFERENCE_IMAGE_PATH,
                    detector_backend="opencv",
                    model_name="Facenet",
                    enforce_detection=False,
                )
                is_same_person = verify_res.get("verified")
                similarity_distance = verify_res.get("distance")
            except Exception:
                pass

        return {
            "module": "facial_deepfake_liveness",
            "face_liveness_score": liveness_res["face_liveness_score"],
            "is_deepfake": liveness_res["is_deepfake"],
            "liveness_status": liveness_res["liveness_status"],
            "same_person": is_same_person,
            "distance": similarity_distance,
            "details": liveness_res["details"],
            "status": "success",
        }
    finally:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass


@router.post("/face-to-id-sync")
async def face_to_id_sync(
    live_image: UploadFile = File(...),
    id_document: UploadFile = File(...),
):
    """Match live wearable camera face against scanned ID document portrait photo."""
    os.makedirs("uploads", exist_ok=True)

    live_path = os.path.join("uploads", f"live_{uuid4().hex}.jpg")
    id_path = os.path.join("uploads", f"id_{uuid4().hex}.jpg")

    try:
        with open(live_path, "wb") as buffer:
            buffer.write(await live_image.read())
        with open(id_path, "wb") as buffer:
            buffer.write(await id_document.read())

        # Perform DeepFace matching between live capture and ID document
        try:
            from deepface import DeepFace
            res = DeepFace.verify(
                img1_path=live_path,
                img2_path=id_path,
                detector_backend="opencv",
                model_name="Facenet",
                enforce_detection=False,
            )
            verified = res.get("verified", False)
            distance = res.get("distance", 1.0)
            similarity_score = max(0.0, min(1.0, 1.0 - (distance / 0.8)))
        except Exception:
            verified = False
            similarity_score = 0.30

        return {
            "module": "face_to_id_sync",
            "face_id_match_score": round(similarity_score, 2),
            "verified_identity": verified,
            "status": "success",
        }
    finally:
        for p in (live_path, id_path):
            try:
                if os.path.exists(p):
                    os.remove(p)
            except OSError:
                pass
