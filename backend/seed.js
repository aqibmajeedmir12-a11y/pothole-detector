/**
 * Seed script to populate the database with demo data
 * Run: node seed.js
 */
require('dotenv').config();
const db = require('./config/db');
const Pothole = require('./models/Pothole');
const SensorData = require('./models/SensorData');
const Alert = require('./models/Alert');

console.log('🌱 Seeding database with demo data...\n');

// Demo pothole locations (using Islamabad/Rawalpindi area coordinates)
const potholes = []; // Demo data disabled for production-ready state

// Set different timestamps for demo variety
potholes.forEach((p, i) => {
  p.detectedAt = new Date(Date.now() - (i * 3 * 60 * 60 * 1000)).toISOString(); // stagger by 3 hours
});

// Insert potholes
let createdCount = 0;
for (const p of potholes) {
  try {
    Pothole.create(p);
    createdCount++;
  } catch (err) {
    console.error('  Error inserting pothole:', err.message);
  }
}
console.log(`✅ Created ${createdCount} demo potholes`);

// Demo sensor data
const devices = ['ESP32-001', 'ESP32-002', 'ESP32-003'];
let sensorCount = 0;
for (const deviceId of devices) {
  for (let i = 0; i < 30; i++) {
    const vibrationLevel = Math.random() * 100;
    SensorData.create({
      deviceId,
      vibrationLevel: Math.round(vibrationLevel * 100) / 100,
      lat: 33.65 + Math.random() * 0.1,
      lng: 73.03 + Math.random() * 0.1,
      timestamp: new Date(Date.now() - (i * 30 * 60 * 1000)).toISOString(),
      potholeDetected: vibrationLevel > 70
    });
    sensorCount++;
  }
}
console.log(`✅ Created ${sensorCount} demo sensor readings`);

// Demo alerts
const alertMessages = [
  { message: 'Critical pothole detected on Jinnah Avenue', type: 'detection' },
  { message: 'High severity detection on Faisal Avenue', type: 'detection' },
  { message: 'Sensor ESP32-001 reports high vibration', type: 'detection' },
  { message: 'Pothole on I-8 Markaz has been repaired', type: 'repair' },
  { message: 'New cluster of potholes on Ataturk Avenue', type: 'severity_change' },
];
alertMessages.forEach((a, i) => {
  Alert.create({ ...a, potholeId: i + 1 });
});
console.log(`✅ Created ${alertMessages.length} demo alerts`);

console.log('\n🎉 Database seeded successfully!');
console.log(`   📊 ${createdCount} potholes, ${sensorCount} sensor readings, ${alertMessages.length} alerts`);
