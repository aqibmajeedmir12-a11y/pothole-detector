require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Initialize database (creates tables on first run)
const db = require('./config/db');

// Import routes
const potholeRoutes = require('./routes/potholeRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Import middleware
const { authenticateApiKey } = require('./middleware/auth');

// Import services
const notificationService = require('./services/notificationService');
const thingspeakService = require('./services/thingspeakService');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Store io instance for use in routes
app.set('io', io);
notificationService.setSocketIO(io);
thingspeakService.setSocketIO(io);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve AI detection images (saved by pothole_detector.py)
app.use('/detections-images', express.static(path.join(__dirname, '..', 'ai-service', 'detections')));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', apiLimiter);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'AIoT Smart Road Monitor - Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      potholes: '/api/potholes',
      sensors: '/api/sensors',
      analytics: '/api/analytics',
      thingspeak: '/api/thingspeak/latest'
    },
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/pothole', authenticateApiKey, potholeRoutes);
app.use('/api/potholes', potholeRoutes); // GET alias without auth
app.use('/api/sensor', authenticateApiKey, sensorRoutes);
app.use('/api/sensors', sensorRoutes); // GET alias
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', authenticateApiKey, adminRoutes);
app.use('/api/settings', authenticateApiKey, settingsRoutes);
app.use('/api/reports', reportRoutes);

// ThingSpeak direct data route
app.get('/api/thingspeak/latest', async (req, res) => {
  try {
    const data = await thingspeakService.readChannel(parseInt(req.query.results) || 10);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ThingSpeak data' });
  }
});

app.get('/api/thingspeak/last', async (req, res) => {
  try {
    const data = await thingspeakService.readLastEntry();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ThingSpeak data' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'SQLite (local)',
    thingspeak: {
      channelId: process.env.THINGSPEAK_CHANNEL_ID || 'not configured',
      polling: thingspeakService.pollingInterval ? 'active' : 'inactive'
    }
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });

  // Allow clients to subscribe to specific events
  socket.on('subscribe', (channel) => {
    socket.join(channel);
    console.log(`📡 ${socket.id} subscribed to ${channel}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║     🛣️  AIoT Smart Road Monitor - Backend        ║
║                                                  ║
║     Server:     http://localhost:${PORT}            ║
║     WebSocket:  ws://localhost:${PORT}              ║
║     Database:   SQLite (local file)              ║
║     ThingSpeak: Channel ${process.env.THINGSPEAK_CHANNEL_ID || 'N/A'}                ║
║     Status:     Running ✅                        ║
╚══════════════════════════════════════════════════╝
  `);

  // Start ThingSpeak polling for real-time data
  thingspeakService.startPolling(15000);
});

module.exports = { app, server, io };
