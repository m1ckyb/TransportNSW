import unzipper from 'unzipper';
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { db } from './db';

export async function processGtfsZip(zipPath: string) {
  console.log(`Processing GTFS zip: ${zipPath}`);
  
  const extractTo = path.join('/tmp', `gtfs_${Date.now()}`);
  if (!fs.existsSync(extractTo)) {
    fs.mkdirSync(extractTo, { recursive: true });
  }
  
  console.log(`Extracting to: ${extractTo}`);
  
  // Use unzipper for streaming extraction
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: extractTo }))
    .promise();

  console.log('Extraction complete.');

  const files = [
    { name: 'stops.txt', table: 'stops', query: 'INSERT OR REPLACE INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station) VALUES (?, ?, ?, ?, ?, ?)', params: (r: any) => [r.stop_id, r.stop_name, r.stop_lat, r.stop_lon, r.location_type, r.parent_station] },
    { name: 'routes.txt', table: 'routes', query: 'INSERT OR REPLACE INTO routes (route_id, route_short_name, route_long_name, route_type) VALUES (?, ?, ?, ?)', params: (r: any) => [r.route_id, r.route_short_name, r.route_long_name, r.route_type] },
    { name: 'trips.txt', table: 'trips', query: 'INSERT OR REPLACE INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id) VALUES (?, ?, ?, ?, ?)', params: (r: any) => [r.trip_id, r.route_id, r.service_id, r.trip_headsign, r.direction_id] },
    { name: 'stop_times.txt', table: 'stop_times', query: 'INSERT OR REPLACE INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)', params: (r: any) => [r.trip_id, r.arrival_time, r.departure_time, r.stop_id, r.stop_sequence] },
    { name: 'calendar.txt', table: 'calendar', query: 'INSERT OR REPLACE INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', params: (r: any) => [r.service_id, r.monday, r.tuesday, r.wednesday, r.thursday, r.friday, r.saturday, r.sunday, r.start_date, r.end_date] },
    { name: 'calendar_dates.txt', table: 'calendar_dates', query: 'INSERT OR REPLACE INTO calendar_dates (service_id, date, exception_type) VALUES (?, ?, ?)', params: (r: any) => [r.service_id, r.date, r.exception_type] }
  ];

  for (const fileDef of files) {
    const filePath = path.join(extractTo, fileDef.name);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping missing file: ${fileDef.name}`);
      continue;
    }

    console.log(`Parsing ${fileDef.name}...`);
    const stmt = db.prepare(fileDef.query);
    const parser = fs.createReadStream(filePath).pipe(
      parse({ 
        columns: true, 
        skip_empty_lines: true,
        bom: true,
        trim: true
      })
    );

    db.prepare('BEGIN').run();
    let count = 0;
    try {
      for await (const record of parser) {
        stmt.run(...fileDef.params(record));
        count++;
        if (count % 10000 === 0) {
          db.prepare('COMMIT').run();
          db.prepare('BEGIN').run();
          if (count % 50000 === 0) {
            console.log(`Still parsing ${fileDef.name}: ${count} records...`);
          }
        }
      }
      db.prepare('COMMIT').run();
      console.log(`Finished ${fileDef.name}: ${count} records.`);
    } catch (err) {
      db.prepare('ROLLBACK').run();
      console.error(`Error processing ${fileDef.name}:`, err);
      throw err;
    }
  }

  // Cleanup temp files
  fs.rmSync(extractTo, { recursive: true, force: true });
  console.log(`Cleanup complete for: ${extractTo}`);
}
