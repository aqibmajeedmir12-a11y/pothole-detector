require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Initialize Supabase connection (validates credentials on startup)
require('./config/db');

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
    methods: ['GET', 'POST'],
  },
});

// Store io instance for use in routes
app.set('io', io);
notificationService.setSocketIO(io);
thingspeakService.setSocketIO(io);

// ── Security Middleware ─────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow image loading from frontend
  contentSecurityPolicy: false, // Disable CSP for API server
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve AI detection images (saved by pothole_detector.py)
app.use('/detections-images', express.static(path.join(__dirname, '..', 'ai-service', 'detections')));

// ── Rate Limiting ────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', apiLimiter);

// ── Root Route ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'AIoT Smart Road Monitor - Backend API',
    version: '2.0.0',
    status: 'running',
    database: 'Supabase',
    endpoints: {
      health: '/api/health',
      potholes: '/api/potholes',
      sensors: '/api/sensors',
      analytics: '/api/analytics',
      thingspeak: '/api/thingspeak/latest',
    },
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ───────────────────────────────────────────
app.use('/api/pothole', authenticateApiKey, potholeRoutes);
app.use('/api/potholes', potholeRoutes);
app.use('/api/sensor', authenticateApiKey, sensorRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', authenticateApiKey, adminRoutes);
app.use('/api/settings', authenticateApiKey, settingsRoutes);
app.use('/api/reports', reportRoutes);

// ── ThingSpeak Direct Data Routes ────────────────────────
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

// ── Health Check ─────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    const supabase = require('./config/db');
    const { error } = await supabase.from('potholes').select('id', { count: 'exact', head: true });
    dbStatus = error ? `error: ${error.message}` : 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: `Supabase (${dbStatus})`,
    thingspeak: {
      channelId: process.env.THINGSPEAK_CHANNEL_ID || 'not configured',
      polling: thingspeakService.pollingInterval ? 'active' : 'inactive',
    },
  });
});

// ── WebSocket Connection Handling ──────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Clients send their user info so we can assign them to the right rooms
  socket.on('registerUser', (userData) => {
    if (!userData) return;

    // Leave any previous rooms (except the socket's own room)
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }

    const { role, state, district, superadmin } = userData;

    if (role === 'user') {
      // Citizens only get safety/proximity warnings
      socket.join('role:citizen');
      if (state) socket.join(`citizen_state:${state.toLowerCase().trim()}`);
      if (state && district) socket.join(`citizen_district:${state.toLowerCase().trim()}:${district.toLowerCase().trim()}`);
      console.log(`👤 ${socket.id} joined room: role:citizen, state/district filtered`);
    } else if (superadmin) {
      // Super admins get ALL notifications
      socket.join('role:superadmin');
      console.log(`👑 ${socket.id} joined room: role:superadmin`);
    } else if (role === 'admin') {
      // District admins get notifications for their district only
      socket.join('role:admin');
      if (state) {
        const stateRoom = `state:${state.toLowerCase().trim()}`;
        socket.join(stateRoom);
        console.log(`🏛️ ${socket.id} joined room: ${stateRoom}`);
      }
      if (state && district) {
        const districtRoom = `district:${state.toLowerCase().trim()}:${district.toLowerCase().trim()}`;
        socket.join(districtRoom);
        console.log(`🏛️ ${socket.id} joined room: ${districtRoom}`);
      }
    }
  });

  // Allow super admin to change their filter dynamically
  socket.on('updateFilter', (filterData) => {
    if (!filterData) return;
    // Leave old geographic rooms
    for (const room of socket.rooms) {
      if (room.startsWith('state:') || room.startsWith('district:') || room.startsWith('filter:')) {
        socket.leave(room);
      }
    }
    // Join new filtered rooms (empty = national view = superadmin sees all)
    const { state, district } = filterData;
    if (state) {
      socket.join(`filter:state:${state.toLowerCase().trim()}`);
      if (district) {
        socket.join(`filter:district:${state.toLowerCase().trim()}:${district.toLowerCase().trim()}`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });

  socket.on('subscribe', (channel) => {
    socket.join(channel);
    console.log(`📡 ${socket.id} subscribed to ${channel}`);
  });
});

// ── Error Handling Middleware ───────────────────────────
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ── 404 Handler ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Start Server ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║     🛣️  AIoT Smart Road Monitor - Backend        ║
║                                                  ║
║     Server:     http://localhost:${PORT}            ║
║     WebSocket:  ws://localhost:${PORT}              ║
║     Database:   Supabase (cloud)                 ║
║     ThingSpeak: Channel ${process.env.THINGSPEAK_CHANNEL_ID || 'N/A'}                ║
║     Status:     Running ✅                        ║
╚══════════════════════════════════════════════════╝
  `);

  // Start ThingSpeak polling for real-time data
  thingspeakService.startPolling(15000);
});

module.exports = { app, server, io };
