const Database = require('better-sqlite3');
const db = new Database('backend/src/data/transport.db');
const rows = db.prepare("SELECT trip_id, trip_headsign FROM trips WHERE trip_id LIKE 'SN37%' OR trip_id LIKE 'SN41%' OR trip_id LIKE 'SN43%' LIMIT 10;").all();
console.log(JSON.stringify(rows, null, 2));
