"""FastAPI application entry point."""

# Standard library imports
import os

# Third-party imports
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Local application imports
from routes.face import router as face_router
from routes.voice import router as voice_router
from routes.document import router as document_router
from routes.risk import router as risk_router

# Initialize FastAPI app
app = FastAPI(title="Real-Time Smart Glasses AI Fraud Detection Engine", version="1.0.0")

# Ensure uploads directory exists on startup
os.makedirs("uploads", exist_ok=True)

# Enable CORS for local frontend & gateway development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include modular routers
app.include_router(face_router)
app.include_router(voice_router)
app.include_router(document_router)
app.include_router(risk_router)


@app.get("/")
def root():
    """Root health check endpoint."""
    return {
        "message": "Real-Time Fraud Detection Smart Glasses AI Cloud Engine Running",
        "version": "1.0.0",
        "architecture": "Edge-Gateway-Cloud (ESP32-S3 TinyML Enabled)",
    }
