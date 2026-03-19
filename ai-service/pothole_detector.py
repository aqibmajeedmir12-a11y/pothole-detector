from ultralytics import YOLO  # type: ignore
import cv2  # type: ignore
import os
import requests  # type: ignore
import threading
import time
import logging
import numpy as np  # type: ignore
from datetime import datetime
from collections import deque
from typing import List, Any, Optional, cast

# ─────────────────────────────────────────────
#  CONFIGURATION  — edit these values only
# ─────────────────────────────────────────────
# Use environment variables with defaults
MODEL_PATH = r"G:\iot-hackathone\runs\detect\train5\weights\best.pt"
API_KEY          = os.getenv("API_KEY", "5HXILJIDPZS4TPPG")
THINGSPEAK_URL   = os.getenv("THINGSPEAK_URL", "https://api.thingspeak.com/update")
BACKEND_URL      = os.getenv("BACKEND_URL", "http://localhost:5001")
BACKEND_API_KEY  = os.getenv("BACKEND_API_KEY", "dev-api-key-2024")

CONF_THRESHOLD   = float(os.getenv("CONF_THRESHOLD", "0.55"))
IOU_THRESHOLD    = float(os.getenv("IOU_THRESHOLD", "0.45"))
IMG_SIZE         = int(os.getenv("IMG_SIZE", "640"))
FRAME_SKIP       = int(os.getenv("FRAME_SKIP", "2"))
CONFIRM_FRAMES   = int(os.getenv("CONFIRM_FRAMES", "3"))
THINGSPEAK_COOLDOWN = int(os.getenv("THINGSPEAK_COOLDOWN", "16"))
SAVE_DETECTIONS  = os.getenv("SAVE_DETECTIONS", "True").lower() == "true"
DETECTION_DIR    = os.getenv("DETECTION_DIR", "detections")
SHOW_STATS       = os.getenv("SHOW_STATS", "True").lower() == "true"
# Check if we should show GUI (OpenCV window)
HEADLESS         = os.getenv("HEADLESS", "False").lower() == "true"
# ─────────────────────────────────────────────

# ── logging ──────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("pothole_log.txt", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# ── directories ───────────────────────────────
os.makedirs(DETECTION_DIR, exist_ok=True)

# ── Persistent HTTP session for backend calls ─
_backend_session = requests.Session()
_backend_session.headers.update({
    "Content-Type": "application/json",
    "x-api-key": BACKEND_API_KEY,
    "Connection": "keep-alive",
})


# ══════════════════════════════════════════════
#  REVERSE GEOCODING  — get road name from lat/lng
# ══════════════════════════════════════════════
_geocode_cache: dict = {}

def get_road_name(lat: float, lng: float) -> str:
    """Use OpenStreetMap Nominatim to look up a human-readable location name."""
    cache_key = f"{lat:.4f},{lng:.4f}"
    if cache_key in _geocode_cache:
        return _geocode_cache[cache_key]
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "json", "zoom": 16},
            headers={"User-Agent": "AIoT-Road-Monitor/1.0"},
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            addr = data.get("address", {})
            # Try road → suburb → town → city → display_name
            name = (
                addr.get("road")
                or addr.get("suburb")
                or addr.get("town")
                or addr.get("city")
                or data.get("display_name", "").split(",")[0]
            )
            if name:
                # Append area for more context
                area = addr.get("suburb") or addr.get("town") or addr.get("city") or addr.get("state_district", "")
                if area and area != name:
                    name = f"{name}, {area}"
                _geocode_cache[cache_key] = name
                log.info("📍 Geocoded: %s", name)
                return name
    except Exception as exc:
        log.warning("Geocoding failed: %s", exc)
    fallback = f"Location ({lat:.4f}, {lng:.4f})"
    _geocode_cache[cache_key] = fallback
    return fallback


# ══════════════════════════════════════════════
#  THINGSPEAK — non-blocking, rate-limited
# ══════════════════════════════════════════════
class ThingSpeakSender:
    """Sends data to ThingSpeak on a background thread with rate-limiting."""

    def __init__(self, api_key: str, cooldown: float = THINGSPEAK_COOLDOWN):
        self.api_key   = api_key
        self.cooldown  = cooldown
        self._last_sent = 0.0
        self._lock      = threading.Lock()
        self.total_sent = 0
        self.total_fail = 0

    def send(self, field1=None, field2=None, field3=None):
        """Fire-and-forget.  Returns True if request was queued, False if throttled."""
        now = time.time()
        with self._lock:
            if now - self._last_sent < self.cooldown:
                remaining = self.cooldown - (now - self._last_sent)
                log.debug("ThingSpeak throttled — %.1f s remaining", remaining)
                return False
            self._last_sent = now   # reserve the slot immediately

        params = {"api_key": self.api_key}
        if field1 is not None: params["field1"] = field1
        if field2 is not None: params["field2"] = field2
        if field3 is not None: params["field3"] = field3

        threading.Thread(target=self._post, args=(params,), daemon=True).start()
        return True

    def _post(self, params: dict):
        try:
            r = requests.get(THINGSPEAK_URL, params=params, timeout=10)
            if r.status_code == 200 and r.text.strip() != "0":
                self.total_sent += 1
                log.info("✅ ThingSpeak updated  (entry_id=%s)", r.text.strip())
            else:
                self.total_fail += 1
                log.warning("⚠️  ThingSpeak rejected  status=%s body=%r",
                             r.status_code, r.text.strip())
        except requests.RequestException as exc:
            self.total_fail += 1
            log.error("❌ ThingSpeak request failed: %s", exc)


# ══════════════════════════════════════════════
#  MULTI-FRAME CONFIRMATION
# ══════════════════════════════════════════════
class PotholeTracker:
    """Requires CONFIRM_FRAMES consecutive detections before confirming a pothole."""

    def __init__(self, required: int = CONFIRM_FRAMES):
        self.required: int = required
        self._streak: int = 0
        self.confirmed: int = 0      # total confirmed events

    def update(self, detected: bool) -> bool:
        """Call with True/False each processed frame.
        Returns True on the exact frame the streak is confirmed."""
        if detected:
            self._streak = int(self._streak) + 1
            if self._streak == self.required:
                self.confirmed = int(self.confirmed) + 1
                return True
        else:
            self._streak = 0
        return False

    @property
    def streak(self) -> int:
        return self._streak


# ══════════════════════════════════════════════
#  DRAWING HELPERS
# ══════════════════════════════════════════════
def draw_overlay(frame, fps: float, tracker: PotholeTracker,
                 sender: ThingSpeakSender, alert_active: bool):
    h, w = frame.shape[:2]

    # semi-transparent top bar
    bar = frame.copy()
    cv2.rectangle(bar, (0, 0), (w, 52), (15, 15, 15), -1)
    cv2.addWeighted(bar, 0.6, frame, 0.4, 0, frame)

    cv2.putText(frame, f"FPS: {fps:4.1f}", (10, 34),
                cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 230, 0), 2)
    cv2.putText(frame, f"Detections: {tracker.confirmed}", (160, 34),
                cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 200, 0), 2)
    cv2.putText(frame, f"TS sent: {sender.total_sent}", (360, 34),
                cv2.FONT_HERSHEY_SIMPLEX, 0.75, (100, 200, 255), 2)

    if alert_active:
        # pulsing red banner
        pulse = int(128 + 127 * np.sin(time.time() * 6))
        cv2.rectangle(frame, (0, h - 50), (w, h), (0, 0, pulse), -1)
        cv2.putText(frame, "⚠  POTHOLE CONFIRMED  ⚠",
                    (w // 2 - 195, h - 15),
                    cv2.FONT_HERSHEY_DUPLEX, 0.9, (255, 255, 255), 2)

    # streak indicator dots
    dot_x = w - 20
    for i in range(CONFIRM_FRAMES):
        color = (0, 220, 0) if i < tracker.streak else (60, 60, 60)
        cv2.circle(frame, (dot_x, 15 + i * 14), 5, color, -1)

    return frame


# ══════════════════════════════════════════════
#  STATS & STATE
# ══════════════════════════════════════════════
class DetectionState:
    def __init__(self):
        self.frame_count: int = 0
        self.save_id: int = 0
        self.confirmed_count: int = 0

# ══════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════
def main():
    log.info("Loading model from: %s", MODEL_PATH)
    if not os.path.exists(MODEL_PATH):
        log.error("❌ Model file not found at %s", MODEL_PATH)
        return

    model = YOLO(MODEL_PATH)

    # Warm-up pass so first inference isn't slow
    dummy = np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8)
    model(dummy, verbose=False)
    log.info("Model warm-up complete")

    # In Docker or headless mode, use a dummy or skip camera
    if HEADLESS:
        log.info("Running in HEADLESS mode - no GUI will be shown")
    
    source = 0
    # Try to get source from env (could be a video file or stream URL)
    source_env = os.getenv("CAMERA_SOURCE")
    if source_env:
        try:
            source = int(source_env)
        except ValueError:
            source = source_env

    # Try to open the video source
    cap = None
    if isinstance(source, int):
        # For webcam index, try multiple backends (DSHOW often crashes on Windows)
        backends = [
            ("MSMF",  cv2.CAP_MSMF),
            ("DSHOW", cv2.CAP_DSHOW),
            ("ANY",   cv2.CAP_ANY),
        ]
        for name, backend in backends:
            log.info("Trying camera %s with backend %s …", source, name)
            cap = cv2.VideoCapture(source, backend)
            if cap.isOpened():
                log.info("✅ Camera opened with backend %s", name)
                break
            cap.release()
            cap = None

        if cap is None:
            log.error("❌ Cannot open camera %s with any backend. "
                      "Make sure a webcam is connected, or set CAMERA_SOURCE "
                      "to a video file path.", source)
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    else:
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            log.error("Cannot open source: %s", source)
            return

    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)   # minimise camera lag

    sender  = ThingSpeakSender(API_KEY)
    tracker = PotholeTracker(CONFIRM_FRAMES)

    state = DetectionState()
    alert_active: bool = False
    alert_until: float = 0.0          # show alert banner for 2 s after confirmation
    fps_deque: deque = deque(maxlen=30)
    t_prev: float = time.perf_counter()

    log.info("Starting capture loop  (press ESC to quit)")

    while True:
        ret, frame = cap.read()
        if not ret:
            if isinstance(source, str): # Probably a file, loop it or end
                log.info("End of video stream")
                break
            log.warning("Frame grab failed — retrying…")
            time.sleep(0.05)
            continue

        state.frame_count += 1  # type: ignore

        # ── FPS ──────────────────────────────
        t_now = time.perf_counter()
        fps_deque.append(1.0 / max(t_now - t_prev, 1e-9))
        t_prev = t_now
        fps = float(np.mean(fps_deque))

        # ── skip frames ───────────────────────
        if state.frame_count % FRAME_SKIP != 0:
            if not HEADLESS:
                alert_active = time.time() < alert_until
                if SHOW_STATS:
                    frame = draw_overlay(frame, fps, tracker, sender, alert_active)
                cv2.imshow("AI Road Monitor", frame)
                if cv2.waitKey(1) & 0xFF == 27:
                    break
            continue

        # ── resize for inference ─────────────
        inf_frame = cv2.resize(frame, (IMG_SIZE, IMG_SIZE))

        # ── run YOLO ─────────────────────────
        results: Any = model(
            inf_frame,
            conf=CONF_THRESHOLD,
            iou=IOU_THRESHOLD,
            verbose=False,
        )

        # ── parse detections ─────────────────
        pothole_found = False
        best_conf     = 0.0
        box_count: int     = 0
        best_bbox_w: int   = 0
        best_bbox_h: int   = 0

        for r in results:
            if not hasattr(r, 'boxes') or r.boxes is None:
                continue
            boxes: Any = r.boxes
            for box in boxes:
                conf_val = float(box.conf[0])
                if conf_val >= CONF_THRESHOLD:
                    pothole_found = True
                    box_count += 1  # type: ignore
                    if conf_val > best_conf:
                        best_conf = conf_val
                        # Extract bounding box width/height (xyxy format)
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        best_bbox_w = int(abs(x2 - x1))
                        best_bbox_h = int(abs(y2 - y1))

        if pothole_found:
            log.debug("Pothole candidate  conf=%.3f  boxes=%d  streak=%d",
                      best_conf, box_count, tracker.streak + 1)

        # ── multi-frame confirm ───────────────
        confirmed = tracker.update(pothole_found)

        if confirmed:
            alert_until  = time.time() + 2.0
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            log.info("🚨 POTHOLE CONFIRMED  conf=%.2f  boxes=%d", best_conf, box_count)

            saved_filename = None
            if SAVE_DETECTIONS:
                # annotate and save full-res frame
                ann = results[0].plot()
                ann_resized = cv2.resize(ann, (frame.shape[1], frame.shape[0]))
                saved_filename = f"pothole_{ts}_{state.save_id:04d}.jpg"
                filepath = os.path.join(DETECTION_DIR, saved_filename)
                cv2.imwrite(filepath, ann_resized)
                state.save_id += 1  # type: ignore
                log.info("Saved: %s", filepath)

            # send to ThingSpeak: field1 = confidence, field2 = flag
            queued = sender.send(
                field1=float(round(float(best_conf), 3)), # type: ignore
                field2=1,
                field3=int(box_count),
            )
            if not queued:
                log.info("ThingSpeak update skipped (cooldown active)")
            
            # Forward to Backend API if configured (includes bbox for repair estimation)
            if BACKEND_URL:
                threading.Thread(target=send_to_backend, args=(best_conf, box_count, saved_filename, best_bbox_w, best_bbox_h), daemon=True).start()

        alert_active = time.time() < alert_until

        if not HEADLESS:
            # ── annotate & display ────────────────
            annotated = results[0].plot()
            annotated = cv2.resize(annotated, (frame.shape[1], frame.shape[0]))

            if SHOW_STATS:
                annotated = draw_overlay(annotated, fps, tracker, sender, alert_active)

            cv2.imshow("AI Road Monitor", annotated)
            if cv2.waitKey(1) & 0xFF == 27:
                break
        else:
            # In headless, just small sleep to avoid pegged CPU if not enough load
            if int(state.frame_count) % 100 == 0:
                log.info("Headless status: FPS=%.1f Confirmed=%d", fps, tracker.confirmed)

    # ── cleanup ───────────────────────────────
    cap.release()
    if not HEADLESS:
        cv2.destroyAllWindows()
    log.info("Session ended  |  confirmed=%d  TS_sent=%d  TS_failed=%d",
             tracker.confirmed, sender.total_sent, sender.total_fail)

def get_realtime_gps():
    """Get real-time GPS coordinates using IP-based geolocation.
    Falls back to environment defaults if unavailable."""
    try:
        import geocoder  # type: ignore
        g = geocoder.ip('me')
        if g.ok and g.latlng:
            _lat, _lng = g.latlng
            log.info("📡 Real-time GPS: %.6f, %.6f", _lat, _lng)
            return float(str(_lat)), float(str(_lng))
    except ImportError:
        log.warning("geocoder not installed — using env fallback. Install with: pip install geocoder")
    except Exception as exc:
        log.warning("GPS lookup failed: %s — using env fallback", exc)

    # Fallback to environment variables
    lat = float(str(os.getenv("DEFAULT_LAT", "0.0")))
    lng = float(str(os.getenv("DEFAULT_LNG", "0.0")))
    return lat, lng


def send_to_backend(confidence, boxes, image_filename=None, bbox_w=0, bbox_h=0):
    lat, lng = get_realtime_gps()
    road_name = get_road_name(lat, lng)

    payload = {
        "lat": lat,
        "lng": lng,
        "severity": "critical" if confidence > 0.9 else "high" if confidence > 0.8 else "medium",
        "source": "ai_camera",
        "confidence": confidence,
        "roadName": road_name,
        "description": f"AI detected {boxes} pothole(s) with {confidence:.1%} confidence",
        "bboxWidth": bbox_w,
        "bboxHeight": bbox_h,
    }
    if image_filename:
        payload["imageUrl"] = image_filename

    max_retries = 3
    for attempt in range(max_retries):
        try:
            r = _backend_session.post(
                f"{BACKEND_URL}/api/pothole",
                json=payload,
                timeout=10,
            )
            if r.status_code == 201:
                log.info("✅ Backend updated  (road: %s, bbox: %dx%d)", road_name, bbox_w, bbox_h)
                return
            else:
                log.warning("⚠️  Backend rejected: %s", r.text)
                return
        except (requests.ConnectionError, ConnectionResetError) as e:
            if attempt < max_retries - 1:
                log.warning("⚠️  Backend connection error (attempt %d/%d): %s", attempt + 1, max_retries, e)
                time.sleep(1)
            else:
                log.error("❌ Backend update failed after %d attempts: %s", max_retries, e)
        except Exception as e:
            log.error("❌ Backend update failed: %s", e)
            return

if __name__ == "__main__":
    main()
