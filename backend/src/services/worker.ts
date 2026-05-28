import { fetchTripUpdates, fetchCarParksFullList } from '../tfnsw';
import { getMonitoredStops, getMonitoredCarParks, getTripInfo, db } from '../db';
import { publishStopDeparture, publishCarParkOccupancy } from '../mqtt';
import dotenv from 'dotenv';

dotenv.config();

const POLLING_INTERVAL = 300000; // 5 minutes

export function startWorker() {
  console.log('Starting MQTT background worker...');
  
  const runUpdate = async () => {
    try {
      console.log('Worker: Starting update cycle...');
      // 1. Process Train Departures
      const monitoredStops = getMonitoredStops();
      if (monitoredStops.length > 0) {
        console.log(`Worker: Processing ${monitoredStops.length} stops for departures...`);
        const updates = await fetchTripUpdates();
        const now = Date.now();
        
        for (const stop of monitoredStops) {
          const stopId = stop.stop_id;
          const departures: any[] = [];
          // ... (rest of departure logic remains same)
          for (const entity of updates) {
            if (!entity.tripUpdate || !entity.tripUpdate.stopTimeUpdate) continue;
            const tripId = entity.tripUpdate.trip.tripId;
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
                const tripParts = tripId.split('.');
                const runNumber = tripParts[0];
                let setInfo = entity.tripUpdate.vehicle?.label || 'Unknown';
                if (tripParts.length >= 6) {
                  const setType = tripParts[4];
                  const carCount = tripParts[5];
                  if (setType.length === 1 && !isNaN(Number(carCount))) {
                    setInfo = `${setType} Set (${carCount} cars)`;
                  }
                }
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
          departures.sort((a, b) => a.time - b.time);
          publishStopDeparture(stopId, stop.stop_name || `Stop ${stopId}`, departures);
        }
      } else {
        console.log('Worker: No monitored stops configured.');
      }

      // 2. Process Car Park Occupancy
      const monitoredCarParks = getMonitoredCarParks();
      if (monitoredCarParks.length > 0) {
        console.log(`Worker: Processing ${monitoredCarParks.length} monitored car parks...`);
        const allCarParks = await fetchCarParksFullList();
        console.log(`Worker: Fetched ${allCarParks.length} live car park records.`);
        for (const mcp of monitoredCarParks) {
          const liveData = allCarParks.find((cp: any) => String(cp.facility_id) === String(mcp.facility_id));
          if (liveData) {
            console.log(`MQTT: Publishing car park occupancy for ${mcp.facility_name} (${mcp.facility_id})`);
            publishCarParkOccupancy(mcp.facility_id, mcp.facility_name, liveData);
          } else {
            console.warn(`Worker: Could not find live data for monitored car park ${mcp.facility_id}`);
          }
        }
      } else {
        console.log('Worker: No monitored car parks configured.');
      }
      console.log('Worker: Update cycle complete.');
    } catch (error) {
      console.error('Worker error:', error);
    }
  };

  // Run once immediately
  runUpdate();
  
  // Then run at interval
  setInterval(runUpdate, POLLING_INTERVAL);
}
