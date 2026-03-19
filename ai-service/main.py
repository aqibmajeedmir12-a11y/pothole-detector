"""
AIoT Smart Road Monitor - AI Detection Service (Production)
FastAPI service for YOLOv8 pothole detection inference with ThingSpeak GPS sync.
"""

import io
import os
import logging
import time
from datetime import datetime, timezone
from typing import Optional, Tuple

import httpx  # type: ignore
import numpy as np  # type: ignore
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from PIL import Image  # type: ignore
from pydantic import BaseModel  # type: ignore
from ultralytics import YOLO # type: ignore

# ── Logging ──────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("ai-service")

# ── Configuration ──────────────────────────────
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5001")
API_KEY = os.getenv("API_KEY", "dev-api-key-2024")
MODEL_PATH = os.getenv("MODEL_PATH", "best.pt")
THINGSPEAK_READ_KEY = os.getenv("THINGSPEAK_READ_KEY", "S0BXAA3VC6Q2Z5S4")
THINGSPEAK_CHANNEL_ID = os.getenv("THINGSPEAK_CHANNEL_ID", "3299005")

# ── Model Initialisation ───────────────────────
model = None
try:
    if os.path.exists(MODEL_PATH):
        model = YOLO(MODEL_PATH)
        log.info(f"✅ YOLOv8 model loaded from {MODEL_PATH}")
    else:
        log.warning(f"⚠️ Model file NOT found at {MODEL_PATH}. Falling back to default 'yolov8n.pt'")
        # Attempt fallback to default yolov8n.pt
        model = YOLO("yolov8n.pt")
        log.info("✅ YOLOv8 default model loaded (yolov8n.pt)")
except Exception as e:
    log.error(f"❌ Model load error: {e}")

# ── App Definition ─────────────────────────────
app = FastAPI(
    title="AIoT Road Monitor - AI Service",
    description="Production YOLOv8 Inference API with ThingSpeak Sync",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ──────────────────────────────────────
class DetectionResult(BaseModel):
    detected: bool
    confidence: float
    severity: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    description: str
    sent_to_backend: bool = False
    gps_source: str = "none"

# ── GPS Helper ──────────────────────────────────
async def fetch_latest_gps() -> Tuple[Optional[float], Optional[float]]:
    """Fetches the most recent coordinates from ThingSpeak fields 4 and 5."""
    url = f"https://api.thingspeak.com/channels/{THINGSPEAK_CHANNEL_ID}/feeds/last.json"
    params = {"api_key": THINGSPEAK_READ_KEY}
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                lat = float(data.get("field4")) if data.get("field4") else None
                lng = float(data.get("field5")) if data.get("field5") else None
                return lat, lng
    except Exception as e:
        log.warning(f"⚠️ ThingSpeak GPS fetch failed: {e}")
    
    return None, None

# ── Endpoints ────────────────────────────────────
@app.get("/health")
async def health_check():
    return {
        "status": "ready" if model else "degraded",
        "model_loaded": model is not None,
        "backend": BACKEND_URL,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/detect", response_model=DetectionResult)
async def detect_pothole(
    image: UploadFile = File(...),
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    road_name: Optional[str] = None
):
    """
    Performs YOLOv8 inference. If GPS is missing in request, 
    attempts to sync with the latest device coordinates from ThingSpeak.
    """
    if not model:
        raise HTTPException(status_code=503, detail="AI Model not loaded")
        
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # 1. Read Image
    try:
        image_data = await image.read()
        pil_img = Image.open(io.BytesIO(image_data))
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing error: {e}")

    # 2. Run Inference
    t_start = time.perf_counter()
    results = model(pil_img, verbose=False)
    t_end = time.perf_counter()
    
    detected = len(results[0].boxes) > 0
    confidence = float(results[0].boxes[0].conf[0]) if detected else 0.0
    
    # 3. GPS Sync (if missing)
    gps_source = "request"
    if lat is None or lng is None:
        sync_lat, sync_lng = await fetch_latest_gps()
        if sync_lat is not None and sync_lng is not None:
            lat, lng = sync_lat, sync_lng
            gps_source = "thingspeak_sync"
        else:
            gps_source = "none"

    # 4. Severity Logic
    if confidence > 0.85:
        severity = "critical"
    elif confidence > 0.7:
        severity = "high"
    elif confidence > 0.5:
        severity = "medium"
    else:
        severity = "low"

    result_data = {
        "detected": detected,
        "confidence": round(float(confidence), 3),  # type: ignore
        "severity": severity if detected else "low",
        "lat": lat,
        "lng": lng,
        "description": f"AI inference took {(t_end - t_start)*1000:.0f}ms. Conf: {confidence:.1%}",
        "gps_source": gps_source,
    }
    result = DetectionResult(**result_data)  # type: ignore

    # 5. Notify Backend
    if detected and lat is not None and lng is not None:
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "lat": lat,
                    "lng": lng,
                    "severity": severity,
                    "source": "ai_camera",
                    "confidence": confidence,
                    "roadName": road_name or "Real-time Detection Feed",
                    "description": f"AI Precision Detection ({confidence:.1%} confidence). GPS Sync: {gps_source}"
                }
                
                resp = await client.post(
                    f"{BACKEND_URL}/api/pothole",
                    json=payload,
                    headers={"x-api-key": API_KEY},
                    timeout=10.0
                )
                result.sent_to_backend = resp.status_code in (200, 201)
                if result.sent_to_backend:
                    log.info(f"✅ Detection forwarded to backend (Source: {gps_source})")
                else:
                    log.warning(f"⚠️ Backend rejected: {resp.status_code}")
        except Exception as e:
            log.error(f"❌ Backend sync failed: {e}")

    return result

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
