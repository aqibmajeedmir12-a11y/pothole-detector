"""
╔══════════════════════════════════════════════════════════════╗
║  Stabilized YOLOv8 Pothole Detector — Hackathon Demo        ║
║                                                              ║
║  Features:                                                   ║
║  • Exponential Moving Average (EMA) bounding box smoothing   ║
║  • Multi-frame confirmation (3 consecutive frames)           ║
║  • Confidence filtering (> 0.6)                              ║
║  • Position jitter suppression (20px threshold)              ║
║  • Freeze-box stabilization after confirmation               ║
║  • OpenCV real-time visualization                            ║
╚══════════════════════════════════════════════════════════════╝

Usage:
    python stable_detector.py

Set environment variables:
    MODEL_PATH   - path to YOLOv8 .pt model file
    CAMERA_SOURCE - webcam index (0) or video file path
"""

from ultralytics import YOLO  # type: ignore
import cv2  # type: ignore
import numpy as np  # type: ignore
import os
import time
from dataclasses import dataclass, field
from typing import Optional, Tuple, List, Any, Union, cast

# ─────────────────────────────────────────────
#  CONFIGURATION
# ─────────────────────────────────────────────
MODEL_PATH: str      = os.getenv("MODEL_PATH", r"G:\iot-hackathone\runs\detect\train5\weights\best.pt")
CAMERA_SOURCE: str   = os.getenv("CAMERA_SOURCE", "0")
CONF_THRESHOLD: float = 0.6          # Only consider detections above this confidence
EMA_ALPHA: float      = 0.7          # Smoothing factor (0 = full history, 1 = no smoothing)
CONFIRM_FRAMES: int   = 3            # Consecutive frames needed to confirm a pothole
JITTER_THRESH: float  = 20.0         # Ignore position changes smaller than this (pixels)
FREEZE_DURATION: int  = 15           # Frames to freeze a confirmed bounding box
IMG_SIZE: int         = 640          # Inference resolution


# ─────────────────────────────────────────────
#  DATA STRUCTURES
# ─────────────────────────────────────────────
@dataclass
class SmoothBox:
    """Stores a smoothed bounding box with EMA history."""
    x1: float = 0.0
    y1: float = 0.0
    x2: float = 0.0
    y2: float = 0.0
    confidence: float = 0.0
    initialized: bool = False

    def update(self, raw_x1: float, raw_y1: float, raw_x2: float, raw_y2: float,
               conf: float, alpha: float = EMA_ALPHA, jitter: float = JITTER_THRESH) -> None:
        """
        Apply EMA smoothing to the bounding box.
        Ignores updates where the center moved less than `jitter` pixels.
        """
        if not self.initialized:
            # First detection — accept as-is
            self.x1, self.y1, self.x2, self.y2 = raw_x1, raw_y1, raw_x2, raw_y2
            self.confidence = conf
            self.initialized = True
            return

        # Step 1: Check if position change exceeds jitter threshold
        old_cx: float = (self.x1 + self.x2) / 2
        old_cy: float = (self.y1 + self.y2) / 2
        new_cx: float = (raw_x1 + raw_x2) / 2
        new_cy: float = (raw_y1 + raw_y2) / 2
        displacement: float = float(np.sqrt((new_cx - old_cx) ** 2 + (new_cy - old_cy) ** 2))

        if displacement < jitter:
            # Small change — keep current box, just update confidence
            self.confidence = alpha * conf + (1 - alpha) * self.confidence
            return

        # Step 2: Apply EMA smoothing
        self.x1 = alpha * raw_x1 + (1 - alpha) * self.x1
        self.y1 = alpha * raw_y1 + (1 - alpha) * self.y1
        self.x2 = alpha * raw_x2 + (1 - alpha) * self.x2
        self.y2 = alpha * raw_y2 + (1 - alpha) * self.y2
        self.confidence = alpha * conf + (1 - alpha) * self.confidence

    def as_ints(self) -> Tuple[int, int, int, int]:
        return int(self.x1), int(self.y1), int(self.x2), int(self.y2)


@dataclass
class PotholeTracker:
    """Multi-frame confirmation + freeze-box tracker for a single pothole."""
    smooth_box: SmoothBox = field(default_factory=SmoothBox)
    streak: int = 0                  # Consecutive frames detected
    confirmed: bool = False          # True after CONFIRM_FRAMES consecutive detections
    freeze_counter: int = 0          # Frames remaining in freeze state
    total_confirmations: int = 0     # Running total of confirmations

    def feed(self, detected: bool, raw_box: Optional[Tuple[float, float, float, float]] = None,
             conf: float = 0.0) -> bool:
        """
        Feed a frame result. Returns True on the exact frame detection is confirmed.
        """
        # If currently frozen, just decrement counter and keep showing the box
        if self.freeze_counter > 0:
            self.freeze_counter -= 1
            if self.freeze_counter == 0:
                self.confirmed = False  # Unfreeze — require fresh confirmation
            return False

        if detected and raw_box is not None:
            self.streak += 1
            # Update the smoothed bounding box
            self.smooth_box.update(raw_box[0], raw_box[1], raw_box[2], raw_box[3], conf)

            if self.streak >= CONFIRM_FRAMES and not self.confirmed:
                # Confirmed! Freeze the box
                self.confirmed = True
                self.freeze_counter = FREEZE_DURATION
                self.total_confirmations += 1
                return True  # Signal: just confirmed
        else:
            # No detection — reset streak
            self.streak = 0
            if not self.confirmed:
                self.smooth_box.initialized = False  # Reset box when lost

        return False


# ─────────────────────────────────────────────
#  DRAWING HELPERS
# ─────────────────────────────────────────────
def draw_stable_box(frame: Any, tracker: PotholeTracker, label: str = "Pothole") -> Any:
    """Draw the stabilized bounding box on frame."""
    if not tracker.smooth_box.initialized:
        return frame

    x1, y1, x2, y2 = tracker.smooth_box.as_ints()
    conf: float = tracker.smooth_box.confidence

    if tracker.confirmed or tracker.freeze_counter > 0:
        # Confirmed: solid green box
        color: Tuple[int, int, int] = (0, 255, 0)
        thickness: int = 3
        status: str = "CONFIRMED"
    elif tracker.streak > 0:
        # Building streak: yellow box
        color = (0, 200, 255)
        thickness = 2
        status = f"Streak {tracker.streak}/{CONFIRM_FRAMES}"
    else:
        return frame  # Nothing to draw

    # Draw bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

    # Draw label background
    text: str = f"{label} {conf:.0%} [{status}]"
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
    cv2.rectangle(frame, (x1, y1 - th - 10), (x1 + tw + 6, y1), color, -1)
    cv2.putText(frame, text, (x1 + 3, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1, cv2.LINE_AA)

    # Freeze indicator
    if tracker.freeze_counter > 0:
        freeze_text: str = f"FREEZE {tracker.freeze_counter}"
        cv2.putText(frame, freeze_text, (x1, y2 + 18),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1, cv2.LINE_AA)

    return frame


def draw_hud(frame: Any, fps: float, tracker: PotholeTracker) -> Any:
    """Draw heads-up display with stats."""
    h: int = frame.shape[0]
    w: int = frame.shape[1]

    # Semi-transparent top bar
    overlay: Any = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 50), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

    # FPS
    cv2.putText(frame, f"FPS: {fps:.1f}", (10, 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 230, 0), 2)

    # Confirmed count
    cv2.putText(frame, f"Confirmed: {tracker.total_confirmations}", (160, 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 200, 0), 2)

    # Streak indicator (dots in top-right)
    for i in range(CONFIRM_FRAMES):
        cx: int = w - 20
        cy: int = 12 + i * 14
        dot_color: Tuple[int, int, int] = (0, 220, 0) if i < tracker.streak else (60, 60, 60)
        cv2.circle(frame, (cx, cy), 5, dot_color, -1)

    # Alert banner when confirmed
    if tracker.confirmed or tracker.freeze_counter > 0:
        pulse: int = int(128 + 127 * np.sin(time.time() * 6))
        cv2.rectangle(frame, (0, h - 45), (w, h), (0, 0, pulse), -1)
        cv2.putText(frame, "POTHOLE CONFIRMED - BOX FROZEN",
                    (w // 2 - 230, h - 14),
                    cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 2)

    return frame


# ─────────────────────────────────────────────
#  MAIN DETECTION LOOP
# ─────────────────────────────────────────────
def main() -> None:
    print(f"Loading model: {MODEL_PATH}")
    if not os.path.exists(MODEL_PATH):
        print(f"ERROR: Model not found at {MODEL_PATH}")
        return

    model: Any = YOLO(MODEL_PATH)

    # Warm-up
    dummy: Any = np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8)
    model(dummy, verbose=False)
    print("Model warmed up")

    # Open video source
    source: Union[int, str] = CAMERA_SOURCE
    try:
        source = int(CAMERA_SOURCE)
    except ValueError:
        pass

    cap: Any = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"ERROR: Cannot open video source: {source}")
        return

    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    # Initialize tracker
    tracker: PotholeTracker = PotholeTracker()
    fps_times: List[float] = []
    frame_count: int = 0

    print("Starting stable detection... Press ESC to quit.")

    while True:
        read_result: Any = cap.read()
        ret: bool = bool(read_result[0])
        frame: Any = read_result[1]
        if not ret or frame is None:
            if isinstance(source, str):
                print("End of video")
                break
            time.sleep(0.01)
            continue

        frame_count = cast(int, frame_count) + 1

        # ── FPS calculation ──
        now: float = time.perf_counter()
        fps_times.append(now)
        # Keep only last 30 timestamps
        while len(fps_times) > 30:
            fps_times.pop(0)
        fps: float = 0.0
        if len(fps_times) > 1:
            fps = (len(fps_times) - 1) / (fps_times[-1] - fps_times[0])

        # ── Skip every other frame for speed ──
        fc: int = cast(int, frame_count)
        if fc % 2 != 0:
            # Still show the frame with existing box
            frame = draw_stable_box(frame, tracker)
            frame = draw_hud(frame, fps, tracker)
            cv2.imshow("Stable Pothole Detector", frame)
            if cv2.waitKey(1) & 0xFF == 27:
                break
            continue

        # ── Resize for inference ──
        inf_frame: Any = cv2.resize(frame, (IMG_SIZE, IMG_SIZE))

        # ── Run YOLOv8 ──
        results: Any = model(inf_frame, conf=CONF_THRESHOLD, verbose=False)

        # ── Find best detection ──
        best_box: Optional[Tuple[float, float, float, float]] = None
        best_conf: float = 0.0
        detected: bool = False

        for r in results:
            if not hasattr(r, 'boxes') or r.boxes is None:
                continue
            for box in r.boxes:
                conf_val: float = float(box.conf[0])
                if conf_val >= CONF_THRESHOLD and conf_val > best_conf:
                    detected = True
                    best_conf = conf_val
                    # Scale bounding box from inference size back to frame size
                    xyxy: List[float] = box.xyxy[0].tolist()
                    bx1: float = float(xyxy[0])
                    by1: float = float(xyxy[1])
                    bx2: float = float(xyxy[2])
                    by2: float = float(xyxy[3])
                    scale_x: float = frame.shape[1] / IMG_SIZE
                    scale_y: float = frame.shape[0] / IMG_SIZE
                    best_box = (bx1 * scale_x, by1 * scale_y, bx2 * scale_x, by2 * scale_y)

        # ── Feed tracker (multi-frame confirmation + EMA smoothing) ──
        just_confirmed: bool = tracker.feed(detected, best_box, best_conf)

        if just_confirmed:
            print(f"🚨 POTHOLE CONFIRMED #{tracker.total_confirmations}  "
                  f"conf={best_conf:.2f}  "
                  f"box={tracker.smooth_box.as_ints()}")

        # ── Draw stabilized overlay ──
        frame = draw_stable_box(frame, tracker)
        frame = draw_hud(frame, fps, tracker)

        cv2.imshow("Stable Pothole Detector", frame)
        if cv2.waitKey(1) & 0xFF == 27:
            break

    cap.release()
    cv2.destroyAllWindows()
    print(f"\nSession ended | Confirmed: {tracker.total_confirmations}")


if __name__ == "__main__":
    main()
