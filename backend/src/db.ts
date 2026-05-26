import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'transport.db');
export const db = new Database(dbPath);

// Initialize tables
export const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stops (
      stop_id TEXT PRIMARY KEY,
      stop_name TEXT,
      stop_lat REAL,
      stop_lon REAL,
      location_type INTEGER,
      parent_station TEXT
    );

    CREATE TABLE IF NOT EXISTS routes (
      route_id TEXT PRIMARY KEY,
      route_short_name TEXT,
      route_long_name TEXT,
      route_type INTEGER
    );

    CREATE TABLE IF NOT EXISTS trips (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT,
      service_id TEXT,
      trip_headsign TEXT,
      direction_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS stop_times (
      trip_id TEXT,
      arrival_time TEXT,
      departure_time TEXT,
      stop_id TEXT,
      stop_sequence INTEGER,
      PRIMARY KEY (trip_id, stop_sequence)
    );

    CREATE TABLE IF NOT EXISTS calendar (
      service_id TEXT PRIMARY KEY,
      monday INTEGER,
      tuesday INTEGER,
      wednesday INTEGER,
      thursday INTEGER,
      friday INTEGER,
      saturday INTEGER,
      sunday INTEGER,
      start_date TEXT,
      end_date TEXT
    );

    CREATE TABLE IF NOT EXISTS calendar_dates (
      service_id TEXT,
      date TEXT,
      exception_type INTEGER,
      PRIMARY KEY (service_id, date)
    );

    CREATE TABLE IF NOT EXISTS monitored_stops (
      stop_id TEXT PRIMARY KEY,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monitored_routes (
      route_id TEXT PRIMARY KEY,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

export const getStopInfo = (stopId: string) => {
  return db.prepare('SELECT * FROM stops WHERE stop_id = ?').get(stopId) as any;
};

export const getTripInfo = (tripId: string) => {
  return db.prepare(`
    SELECT t.*, r.route_short_name 
    FROM trips t 
    JOIN routes r ON t.route_id = r.route_id 
    WHERE t.trip_id = ?
  `).get(tripId) as any;
};

// Monitored Stops Helpers
export const getMonitoredStops = () => {
  return db.prepare(`
    SELECT ms.stop_id, s.stop_name 
    FROM monitored_stops ms 
    LEFT JOIN stops s ON ms.stop_id = s.stop_id
  `).all() as any[];
};

export const addMonitoredStop = (stopId: string) => {
  return db.prepare('INSERT OR REPLACE INTO monitored_stops (stop_id) VALUES (?)').run(stopId);
};

export const removeMonitoredStop = (stopId: string) => {
  return db.prepare('DELETE FROM monitored_stops WHERE stop_id = ?').run(stopId);
};

// Monitored Routes Helpers
export const getMonitoredRoutes = () => {
  return db.prepare(`
    SELECT mr.route_id, r.route_short_name, r.route_long_name 
    FROM monitored_routes mr 
    LEFT JOIN routes r ON mr.route_id = r.route_id
  `).all() as any[];
};

export const addMonitoredRoute = (routeId: string) => {
  return db.prepare('INSERT OR REPLACE INTO monitored_routes (route_id) VALUES (?)').run(routeId);
};

export const removeMonitoredRoute = (routeId: string) => {
  return db.prepare('DELETE FROM monitored_routes WHERE route_id = ?').run(routeId);
};

// Search Helpers
export const searchStops = (query: string) => {
  return db.prepare(`
    SELECT stop_id, stop_name 
    FROM stops 
    WHERE stop_name LIKE ? OR stop_id LIKE ? 
    LIMIT 20
  `).all(`%${query}%`, `%${query}%`) as any[];
};

export const getStopNames = (stopIds: string[]) => {
  if (stopIds.length === 0) return {};
  const placeholders = stopIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT stop_id, stop_name FROM stops WHERE stop_id IN (${placeholders})`).all(...stopIds) as any[];
  const mapping: Record<string, string> = {};
  rows.forEach(r => { mapping[r.stop_id] = r.stop_name; });
  return mapping;
};

export const searchRoutes = (query: string) => {
  return db.prepare(`
    SELECT route_id, route_short_name, route_long_name 
    FROM routes 
    WHERE route_short_name LIKE ? OR route_long_name LIKE ? OR route_id LIKE ? 
    LIMIT 20
  `).all(`%${query}%`, `%${query}%`, `%${query}%`) as any[];
};

export const getScheduledDepartures = (stopId: string, dayOfWeek: string, timeStr: string, dateStr: string) => {
  return db.prepare(`
    SELECT st.departure_time, t.trip_headsign, r.route_short_name, r.route_long_name,
           GROUP_CONCAT(st.trip_id) as trip_ids
    FROM stop_times st
    JOIN trips t ON st.trip_id = t.trip_id
    JOIN routes r ON t.route_id = r.route_id
    JOIN calendar c ON t.service_id = c.service_id
    LEFT JOIN calendar_dates cd ON t.service_id = cd.service_id AND cd.date = ?
    WHERE st.stop_id = ? 
    AND (
      (c.${dayOfWeek} = 1 AND (cd.exception_type IS NULL OR cd.exception_type != 2))
      OR cd.exception_type = 1
    )
    AND st.departure_time >= ?
    AND c.start_date <= ?
    AND c.end_date >= ?
    GROUP BY st.departure_time, t.trip_headsign
    ORDER BY st.departure_time ASC
    LIMIT 15
  `).all(dateStr, stopId, timeStr, dateStr, dateStr) as any[];
};
