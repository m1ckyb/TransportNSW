import { fetchTripUpdates } from '../tfnsw';
import { getMonitoredStops, getTripInfo, db } from '../db';
import { publishStopDeparture } from '../mqtt';
import dotenv from 'dotenv';

dotenv.config();

const POLLING_INTERVAL = 60000; // 60 seconds

export function startWorker() {
  console.log('Starting MQTT background worker...');
  
  setInterval(async () => {
    try {
      const monitoredStops = getMonitoredStops();
      if (monitoredStops.length === 0) return;

      const updates = await fetchTripUpdates();
      const now = Date.now();
      
      for (const stop of monitoredStops) {
        const stopId = stop.stop_id;
        const departures: any[] = [];

        for (const entity of updates) {
          if (!entity.tripUpdate || !entity.tripUpdate.stopTimeUpdate) continue;

          const tripId = entity.tripUpdate.trip.tripId;
          
          // Use same fuzzy match as API
          const stopUpdate = entity.tripUpdate.stopTimeUpdate.find((stu: any) => 
            stu.stopId === stopId || 
            (stu.stopId && stopId.includes(stu.stopId)) || 
            (stu.stopId && stu.stopId.includes(stopId))
          );

          if (stopUpdate) {
            const timeData = stopUpdate.departure || stopUpdate.arrival;
            let timestamp: number | null = null;

            if (timeData && timeData.time && Number(timeData.time?.low || timeData.time) > 0) {
              const rawTime = timeData.time;
              timestamp = (typeof rawTime === 'object' && rawTime !== null && 'low' in rawTime)
                ? Number(rawTime.low) * 1000
                : Number(rawTime) * 1000;
            } else {
              // Schedule Fallback
              const schedTime = db.prepare('SELECT departure_time FROM stop_times WHERE trip_id = ? AND stop_id = ?').get(tripId, stopUpdate.stopId) as any;
              if (schedTime) {
                const [h, m, s] = schedTime.departure_time.split(':').map(Number);
                const d = new Date();
                d.setHours(h, m, s, 0);
                timestamp = d.getTime();
              }
            }

            if (timestamp) {
              if (timestamp < now - 300000) continue;
              const tripInfo = tripId ? getTripInfo(tripId) : null;
              
              // Extract Run Number
              const runNumber = tripId.split('.')[0];
              const setInfo = entity.tripUpdate.vehicle?.label || 'Unknown';

              departures.push({
                time: timestamp,
                runNumber,
                setInfo,
                routeShortName: tripInfo?.route_short_name || '???',
                routeLongName: tripInfo?.route_long_name || 'Unknown Route',
                headsign: tripInfo?.trip_headsign || entity.tripUpdate.trip.routeId || 'Unknown',
                delay: timeData.delay || 0,
                isRealtime: !!(timeData && timeData.time && Number(timeData.time?.low || timeData.time) > 0)
              });
            }
          }
        }

        // Sort and publish
        departures.sort((a, b) => a.time - b.time);
        publishStopDeparture(stopId, stop.stop_name || `Stop ${stopId}`, departures);
      }
    } catch (error) {
      console.error('Worker error:', error);
    }
  }, POLLING_INTERVAL);
}
