# 🛣️ AIoT Smart Road Monitoring System

A real-time smart city dashboard for pothole detection, integrating **AI camera detection (YOLOv8)**, **ESP32 vibration sensors**, and a full-stack web application.

![Dashboard Preview](docs/dashboard-preview.png)

## 🏗️ Architecture

```
AI Camera (YOLOv8) ──→ Python FastAPI ──→ Backend API ──→ SQLite DB ──→ Dashboard
ESP32 Sensor ──────→ ThingSpeak ──────→ Backend API ──→ SQLite DB ──→ Dashboard
                                                                   ──→ WebSocket ──→ Live Updates
```

## 📦 Project Structure

```
├── backend/          # Node.js + Express API server
├── frontend/         # React + Vite + TailwindCSS dashboard
├── ai-service/       # Python FastAPI for YOLOv8 inference
├── iot/              # ESP32 Arduino sketch
└── docker-compose.yml
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+ (for AI service)
- Arduino IDE (for ESP32, optional)

### 1. Backend Setup

```bash
cd backend
npm install
node seed.js    # Populate demo data
npm run dev     # Start server on http://localhost:5000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev     # Start on http://localhost:5173
```

### 3. AI Service (Optional)

```bash
cd ai-service
pip install -r requirements.txt
python main.py  # Start on http://localhost:8000
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/pothole` | Submit pothole detection |
| `GET` | `/api/potholes` | Get all potholes |
| `PATCH` | `/api/pothole/:id` | Update pothole |
| `POST` | `/api/sensor` | Submit sensor data |
| `GET` | `/api/sensors` | Get sensor readings |
| `GET` | `/api/sensors/trends` | Vibration trends |
| `GET` | `/api/analytics` | Dashboard statistics |
| `PATCH` | `/api/admin/pothole/:id` | Admin: manage pothole |
| `GET` | `/api/admin/alerts` | Get alerts |

### Example: Submit Pothole Detection

```bash
curl -X POST http://localhost:5000/api/pothole \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key-2024" \
  -d '{
    "lat": 33.6844,
    "lng": 73.0479,
    "severity": "high",
    "source": "ai_camera",
    "roadName": "Jinnah Avenue",
    "confidence": 0.92,
    "description": "Large pothole near intersection"
  }'
```

### Example: Submit Sensor Data

```bash
curl -X POST http://localhost:5000/api/sensor \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-api-key-2024" \
  -d '{
    "deviceId": "ESP32-001",
    "vibrationLevel": 75.5,
    "lat": 33.6844,
    "lng": 73.0479,
    "potholeDetected": true
  }'
```

## 🔧 Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `API_KEY` | `dev-api-key-2024` | API authentication key |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |
| `THINGSPEAK_WRITE_KEY` | - | ThingSpeak write key |
| `THINGSPEAK_READ_KEY` | - | ThingSpeak read key |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:5000` | Backend API URL |
| `VITE_WS_URL` | `http://localhost:5000` | WebSocket URL |
| `VITE_API_KEY` | `dev-api-key-2024` | API key |

## 📱 Features

- ✅ Real-time dashboard with stats and road health index
- ✅ Interactive map with severity-coded markers
- ✅ Live detection feed with WebSocket updates
- ✅ Admin panel for managing pothole reports
- ✅ Data analytics with charts and trend analysis
- ✅ Heatmap overlay for density visualization
- ✅ Dark/Light mode toggle
- ✅ Mobile-responsive design
- ✅ Auto-refresh every 10 seconds
- ✅ API key authentication

## 🚢 Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build
npx vercel --prod
```

Set environment variables in Vercel dashboard:
- `VITE_API_URL` = your Railway backend URL
- `VITE_WS_URL` = your Railway backend URL
- `VITE_API_KEY` = your production API key

### Backend → Railway

1. Push backend folder to a Git repo
2. Deploy on Railway from the repo
3. Set environment variables:
   - `PORT` = 5000
   - `API_KEY` = your production API key
   - `FRONTEND_URL` = your Vercel frontend URL

### Docker

```bash
docker-compose up -d
```

## 🤖 ESP32 Setup

1. Open `iot/esp32_vibration.ino` in Arduino IDE
2. Install libraries: `ArduinoJson`, `WiFi`, `HTTPClient`
3. Update WiFi credentials and server URL
4. Connect SW-420 vibration sensor to GPIO 34
5. Upload to ESP32

## 📄 License

MIT License
