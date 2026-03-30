const path = require('path');
const db = require('./config/db');

console.log('🔄 Shifting timestamps forward to simulate recent data...');

// Get the latest timestamp from the database
const latestPothole = db.prepare('SELECT MAX(detected_at) as maxD FROM potholes').get().maxD;
const latestSensor = db.prepare('SELECT MAX(timestamp) as maxT FROM sensor_data').get().maxT;

// Determine the latest overall time in the DB
let latestDbTime = new Date('2020-01-01T00:00:00Z');
if (latestPothole && new Date(latestPothole) > latestDbTime) latestDbTime = new Date(latestPothole);
if (latestSensor && new Date(latestSensor) > latestDbTime) latestDbTime = new Date(latestSensor);

// Calculate how many milliseconds to shift forward to make the latest data equal to 'now'
const now = new Date();
const timeShiftMs = now.getTime() - latestDbTime.getTime();

if (timeShiftMs <= 0) {
  console.log('✅ Timestamps are already up to date or in the future.');
  process.exit(0);
}

const timeShiftSeconds = Math.floor(timeShiftMs / 1000);
console.log(`⏱️ Shifting all timestamps forward by ${timeShiftSeconds} seconds (${(timeShiftSeconds / 3600).toFixed(2)} hours)`);

// Using SQLite datetime functions to shift dates
try {
  db.prepare(`UPDATE potholes SET 
    detected_at = datetime(detected_at, '+' || ? || ' seconds'),
    created_at = datetime(created_at, '+' || ? || ' seconds'),
    updated_at = datetime(updated_at, '+' || ? || ' seconds')
  `).run(timeShiftSeconds, timeShiftSeconds, timeShiftSeconds);

  db.prepare(`UPDATE sensor_data SET 
    timestamp = datetime(timestamp, '+' || ? || ' seconds'),
    created_at = datetime(created_at, '+' || ? || ' seconds')
  `).run(timeShiftSeconds, timeShiftSeconds);

  db.prepare(`UPDATE alerts SET 
    created_at = datetime(created_at, '+' || ? || ' seconds')
  `).run(timeShiftSeconds);

  console.log('✅ Successfully updated timestamps.');

  // Print the new latest timestamps to verify
  const newLatestPothole = db.prepare('SELECT MAX(detected_at) as maxD FROM potholes').get().maxD;
  console.log('New Latest Pothole:', newLatestPothole);

  const newTodayDetections = db.prepare(`SELECT COUNT(*) as count FROM potholes WHERE status != 'repaired' AND date(detected_at) = date('now')`).get().count;
  console.log('New Today Detections Count:', newTodayDetections);
  
} catch (error) {
  console.error('❌ Error shifting timestamps:', error);
}
