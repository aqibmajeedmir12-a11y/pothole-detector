# Use Python 3.9-slim base image
FROM python:3.9-slim

# Install system dependencies for OpenCV and other libraries
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ffmpeg \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements if they exist (otherwise we'll install manually)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt || \
    pip install --no-cache-dir ultralytics requests opencv-python-headless numpy httpx fastapi uvicorn python-multipart

# Copy application code
COPY . .

# Ensure detections directory exists
RUN mkdir -p detections

# Expose port (if running main.py as a service, though pothole_detector.py is a loop)
EXPOSE 8000

# Default command runs the detection script
CMD ["python", "pothole_detector.py"]
