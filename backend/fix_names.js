require('dotenv').config();
const db = require('./config/db');
db.prepare("UPDATE potholes SET road_name = 'GCE Tirunelveli, Tamil Nadu' WHERE road_name = 'Maharaja Nagar'").run();
const rows = db.prepare('SELECT id, road_name FROM potholes ORDER BY id').all();
rows.forEach(r => console.log(`#${r.id}: ${r.road_name}`));
