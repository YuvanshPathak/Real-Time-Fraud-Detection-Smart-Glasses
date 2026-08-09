"""FastAPI route verification script."""

import os
import cv2
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_all_routes():
    print("--- 1. Testing Root Endpoint ---")
    res_root = client.get("/")
    print("GET / ->", res_root.status_code, res_root.json())
    assert res_root.status_code == 200

    print("\n--- 2. Testing Multi-Modal Risk Fusion Endpoint ---")
    payload = {
        "voice_liveness_score": 0.88,
        "face_liveness_score": 0.92,
        "face_id_match_score": 0.90,
        "doc_authenticity_score": 0.95
    }
    res_risk = client.post("/risk-score", json=payload)
    print("POST /risk-score ->", res_risk.status_code, res_risk.json())
    assert res_risk.status_code == 200
    assert res_risk.json()["risk_level"] == "SAFE"

    print("\n--- 3. Testing Face Anti-Spoofing & Liveness Endpoint ---")
    dummy_img = np.zeros((300, 300, 3), dtype=np.uint8)
    cv2.circle(dummy_img, (150, 150), 50, (255, 255, 255), -1)
    is_success, buffer = cv2.imencode(".jpg", dummy_img)
    
    files = {"image": ("test_face.jpg", buffer.tobytes(), "image/jpeg")}
    res_face = client.post("/face-check", files=files)
    print("POST /face-check ->", res_face.status_code, res_face.json())
    assert res_face.status_code == 200

    print("\n--- 4. Testing Voice Anti-Spoofing Endpoint ---")
    sr = 16000
    t = np.linspace(0, 1.0, sr)
    audio_data = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    sf.write("dummy_test.wav", audio_data, sr)
    
    try:
        with open("dummy_test.wav", "rb") as f:
            res_voice = client.post("/voice-check", files={"audio": ("dummy_test.wav", f, "audio/wav")})
        print("POST /voice-check ->", res_voice.status_code, res_voice.json())
        assert res_voice.status_code == 200
    finally:
        if os.path.exists("dummy_test.wav"):
            os.remove("dummy_test.wav")

    print("\n--- 5. Testing Document Verification Endpoint ---")
    files_doc = {"document": ("test_doc.jpg", buffer.tobytes(), "image/jpeg")}
    res_doc = client.post("/document-check", files=files_doc)
    print("POST /document-check ->", res_doc.status_code, res_doc.json())
    assert res_doc.status_code == 200

    print("\n[SUCCESS] ALL BACKEND ANTI-SPOOFING & FUSION API TESTS PASSED!")

if __name__ == "__main__":
    test_all_routes()
