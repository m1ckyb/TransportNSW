import { Router } from 'express';
import { getSetInfo } from '../utils/train-types';
import { fetchTripUpdates, fetchAlerts, fetchCarParks, fetchCarParksFullList, fetchVehiclePositions } from '../tfnsw';
import { getStopInfo, getTripInfo, getMonitoredRoutes, getMonitoredStops, getScheduledDepartures, getTerminatingTrips, getStopNames, getMonitoredCarParks, db } from '../db';

const router = Router();

router.get('/departures/:stopId', async (req, res) => {
  const { stopId } = req.params;
  const stopInfo = getStopInfo(stopId);
  
  try {
    // 1. Get Scheduled Departures from DB first (Primary Source)
    const now = new Date();
    const nowTs = now.getTime();
    
    // Calculate GTFS Service Day
    // Look back 60 minutes to catch late running trains that were scheduled in the past
    const lookbackDate = new Date(now.getTime() - 3600000); 
    const serviceDate = new Date(lookbackDate);
    let hours = serviceDate.getHours();
    
    if (hours < 4 && lookbackDate.getHours() < 4) {
      serviceDate.setDate(serviceDate.getDate() - 1);
      hours += 24; 
    }
    
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][serviceDate.getDay()];
    
    const hh = hours.toString().padStart(2, '0');
    const mm = serviceDate.getMinutes().toString().padStart(2, '0');
    const ss = serviceDate.getSeconds().toString().padStart(2, '0');
    const timeStr = `${hh}:${mm}:${ss}`;
    
    const dateStr = serviceDate.getFullYear().toString() + 
                   (serviceDate.getMonth() + 1).toString().padStart(2, '0') + 
                   serviceDate.getDate().toString().padStart(2, '0');

    let scheduled = getScheduledDepartures(stopId, dayName, timeStr, dateStr);
    
    // If it's close to 4AM, also fetch the *next* GTFS day's early trips
    if (hours >= 26) { 
        const nextDayDate = new Date(now);
        const nextDayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][nextDayDate.getDay()];
        const nextDateStr = nextDayDate.getFullYear().toString() + 
                           (nextDayDate.getMonth() + 1).toString().padStart(2, '0') + 
                           nextDayDate.getDate().toString().padStart(2, '0');
        const nextDayScheduled = getScheduledDepartures(stopId, nextDayName, "00:00:00", nextDateStr);
        scheduled = scheduled.concat(nextDayScheduled).slice(0, 25);
    }
    
    // 2. Fetch Real-time Updates and Vehicle Positions for enrichment
    const [updates, vehicles] = await Promise.all([
      fetchTripUpdates(),
      fetchVehiclePositions()
    ]);
    const finalDepartures: any[] = [];
    const matchedRtTripIds = new Set<string>();

    for (const sch of scheduled) {
      const tripIds = sch.trip_ids.split(',');
      
      // Look for any live match for this scheduled service
      let realtimeEntity: any = null;
      let stopUpdate: any = null;

      for (const tid of tripIds) {
        // 1. Try strict match
        let found = updates.find((u: any) => u.tripUpdate?.trip?.tripId === tid);
        
        // 2. Try fuzzy match by Run Number (first part of tripId)
        if (!found) {
          const runNumber = tid.split('.')[0];
          if (runNumber && runNumber !== '---') {
            found = updates.find((u: any) => {
              if (!u.tripUpdate?.trip?.tripId) return false;
              const rtRunNumber = u.tripUpdate.trip.tripId.split('.')[0];
              return rtRunNumber === runNumber;
            });
          }
        }

        if (found) {
          realtimeEntity = found;
          matchedRtTripIds.add(found.tripUpdate.trip.tripId);
          stopUpdate = found.tripUpdate?.stopTimeUpdate?.find((stu: any) => 
            stu.stopId === stopId || (stu.stopId && stopId.includes(stu.stopId)) || (stu.stopId && stu.stopId.includes(stopId))
          );
          if (stopUpdate) break;
        }
      }

      let timestamp: number;
      let delay = 0;
      let isRealtime = false;
      let setInfo = '---';
      let runNumber = tripIds[0].split('.')[0];
      let stoppingPattern: any[] = [];

      const timeData = stopUpdate?.departure || stopUpdate?.arrival;
      
      // Calculate scheduled time as base
      const timeParts = sch.departure_time.split(':').map(Number);
      const schDate = new Date(serviceDate);
      schDate.setHours(timeParts[0], timeParts[1], timeParts[2], 0);
      const scheduledTimestamp = schDate.getTime();

      if (realtimeEntity && (stopUpdate || realtimeEntity.tripUpdate.stopTimeUpdate?.length > 0)) {
        isRealtime = true;
        setInfo = realtimeEntity.tripUpdate.vehicle?.label || '---';

        if (stopUpdate) {
          // USE REAL-TIME ENRICHMENT (Direct stop match)
          if (timeData.time && Number(timeData.time?.low || timeData.time) > 0) {
            const rawTime = timeData.time;
            timestamp = (typeof rawTime === 'object' && rawTime !== null && 'low' in rawTime)
              ? Number(rawTime.low) * 1000
              : Number(rawTime) * 1000;
          } else {
            // Use delay against scheduled time
            timestamp = scheduledTimestamp + (timeData.delay * 1000);
          }

          delay = timeData.delay || 0;

          // Get live stopping pattern
          const stopUpdateIndex = realtimeEntity.tripUpdate.stopTimeUpdate.indexOf(stopUpdate);
          const futureStops = realtimeEntity.tripUpdate.stopTimeUpdate.slice(stopUpdateIndex);
          const stopIds = futureStops.map((s: any) => s.stopId);
          const stopNameMap = getStopNames(stopIds);

          stoppingPattern = futureStops.map((s: any) => ({
            stopId: s.stopId,
            stopName: stopNameMap[s.stopId] || `Stop ${s.stopId}`,
            arrival: s.arrival?.time ? Number(s.arrival.time.low || s.arrival.time) * 1000 : 
                     (s.arrival?.delay !== undefined ? scheduledTimestamp + (s.arrival.delay * 1000) : null),
            departure: s.departure?.time ? Number(s.departure.time.low || s.departure.time) * 1000 : 
                     (s.departure?.delay !== undefined ? scheduledTimestamp + (s.departure.delay * 1000) : null)
          }));
        } else {
           // TRIP IS LIVE BUT STOP IS MISSING (Early clearance)
           // Use the first available delay from the trip as a proxy
           const firstUpdate = realtimeEntity.tripUpdate.stopTimeUpdate[0];
           const fallbackDelay = firstUpdate?.departure?.delay || firstUpdate?.arrival?.delay || 0;
           
           timestamp = scheduledTimestamp + (fallbackDelay * 1000);
           delay = fallbackDelay;
        }

      } else {
        // USE SCHEDULED TIME (FALLBACK)
        timestamp = scheduledTimestamp;
      }

      // Always try to extract set info from tripId and/or run number
      const targetTripId = realtimeEntity ? realtimeEntity.tripUpdate.trip.tripId : tripIds[0];
      setInfo = getSetInfo(targetTripId, realtimeEntity?.tripUpdate?.vehicle?.label || setInfo);

      // If no live stopping pattern, fetch from schedule
      if (stoppingPattern.length === 0) {
        const schedPattern = db.prepare('SELECT st.stop_id, s.stop_name, st.arrival_time, st.departure_time FROM stop_times st JOIN stops s ON st.stop_id = s.stop_id WHERE st.trip_id = ? AND st.stop_sequence >= (SELECT stop_sequence FROM stop_times WHERE trip_id = ? AND stop_id = ?) ORDER BY st.stop_sequence').all(tripIds[0], tripIds[0], stopUpdate?.stopId || stopId) as any[];
        
        stoppingPattern = schedPattern.map((s: any) => {
          let arrTs: number | null = null;
          let depTs: number | null = null;
          
          if (s.arrival_time) {
            const [h, m, sec] = s.arrival_time.split(':').map(Number);
            const d = new Date(now);
            d.setHours(h, m, sec, 0);
            arrTs = d.getTime();
          }
          if (s.departure_time) {
            const [h, m, sec] = s.departure_time.split(':').map(Number);
            const d = new Date(now);
            d.setHours(h, m, sec, 0);
            depTs = d.getTime();
          }

          return {
            stopId: s.stop_id,
            stopName: s.stop_name || `Stop ${s.stop_id}`,
            arrival: arrTs,
            departure: depTs
          };
        });
      }

      // Check if this runNumber was already added
      const exists = finalDepartures.some(d => d.runNumber === runNumber);
      if (exists) continue;

      // Filter out trains that have already departed (gone for more than 15 seconds)
      if (timestamp < nowTs - 15000) continue;

      // Headsign Fallback (use last stop if missing or generic 'Empty Train')
      let headsign = sch.trip_headsign;
      let isEmpty = false;
      if (headsign && (headsign.toLowerCase().includes('empty train') || headsign.toLowerCase().includes('empty coaching stock'))) {
        isEmpty = true;
        headsign = 'Empty Service';
      } else if (!headsign) {
        if (stoppingPattern.length > 0) {
          headsign = stoppingPattern[stoppingPattern.length - 1].stopName;
        }
      }

      // Clean up headsign (remove ' Station' and ' Platform X')
      if (headsign && !isEmpty) {
        headsign = headsign.replace(/ Station/g, '').replace(/ Platform \d+/g, '');
      }

      // Look for vehicle position to provide current location
      const vehicle = vehicles.find((v: any) => v.vehicle?.trip?.tripId === targetTripId);
      let location = null;
      if (vehicle?.vehicle?.stopId) {
        const rawLoc = vehicle.vehicle.stopId.split('.').pop();
        if (/^\d+$/.test(rawLoc)) {
          const stopInfo = getStopInfo(rawLoc);
          location = stopInfo?.stop_name ? stopInfo.stop_name.replace(/ Station/g, '') : rawLoc;
        } else {
          location = rawLoc;
        }
      }

      finalDepartures.push({
        tripId: tripIds[0],
        runNumber,
        setInfo,
        directionId: sch.direction_id,
        routeShortName: sch.route_short_name,
        headsign: headsign,
        time: timestamp,
        delay: delay,
        isRealtime: isRealtime,
        trackSection: location,
        isEmpty: isEmpty,
        stoppingPattern
      });
      }

      // 2.5 Add "Real-time Only" trips (not in schedule window but in RT feed)
      for (const entity of updates) {
      if (!entity.tripUpdate || matchedRtTripIds.has(entity.tripUpdate.trip.tripId)) continue;

      const tripId = entity.tripUpdate.trip.tripId;
      const stopUpdate = entity.tripUpdate.stopTimeUpdate?.find((stu: any) => 
        stu.stopId === stopId || (stu.stopId && stopId.includes(stu.stopId)) || (stu.stopId && stu.stopId.includes(stopId))
      );

      if (stopUpdate) {
        const timeData = stopUpdate.departure || stopUpdate.arrival;
        if (timeData && timeData.time && Number(timeData.time?.low || timeData.time) > 0) {
          const rawTime = timeData.time;
          const timestamp = (typeof rawTime === 'object' && rawTime !== null && 'low' in rawTime)
            ? Number(rawTime.low) * 1000
            : Number(rawTime) * 1000;

          if (timestamp < nowTs - 15000) continue;
          if (timestamp > nowTs + 3600000) continue; 
          const tripInfo = getTripInfo(tripId);
          const tripParts = tripId.split('.');
          const runNumber = tripParts[0];

          let setInfo = getSetInfo(tripId, entity.tripUpdate.vehicle?.label);

          let headsign = tripInfo?.trip_headsign || 'Train';
          let isEmpty = false;
          if (headsign.toLowerCase().includes('empty train') || headsign.toLowerCase().includes('empty coaching stock')) {
             isEmpty = true;
             headsign = 'Empty Service';
          }

          if (headsign && !isEmpty) {
            headsign = headsign.replace(/ Station/g, '').replace(/ Platform \d+/g, '');
          }

          // Get live stopping pattern for RT-only trips
          const stopUpdateIndex = entity.tripUpdate.stopTimeUpdate.indexOf(stopUpdate);
          const futureStops = entity.tripUpdate.stopTimeUpdate.slice(stopUpdateIndex);
          const stopIds = futureStops.map((s: any) => s.stopId);
          const stopNameMap = getStopNames(stopIds);

          const rtStoppingPattern = futureStops.map((s: any) => ({
            stopId: s.stopId,
            stopName: stopNameMap[s.stopId] || `Stop ${s.stopId}`,
            arrival: s.arrival?.time ? Number(s.arrival.time.low || s.arrival.time) * 1000 : 
                     (s.arrival?.delay !== undefined ? timestamp + (s.arrival.delay * 1000) : null),
            departure: s.departure?.time ? Number(s.departure.time.low || s.departure.time) * 1000 : 
                     (s.departure?.delay !== undefined ? timestamp + (s.departure.delay * 1000) : null)
          }));

          // Look for vehicle position to provide current location
          const vehicle = vehicles.find((v: any) => v.vehicle?.trip?.tripId === tripId);
          let location = null;
          if (vehicle?.vehicle?.stopId) {
            const rawLoc = vehicle.vehicle.stopId.split('.').pop();
            if (/^\d+$/.test(rawLoc)) {
              const stopInfo = getStopInfo(rawLoc);
              location = stopInfo?.stop_name ? stopInfo.stop_name.replace(/ Station/g, '') : rawLoc;
            } else {
              location = rawLoc;
            }
          }

          finalDepartures.push({
            tripId,
            runNumber,
            setInfo,
            directionId: tripInfo?.direction_id,
            routeShortName: tripInfo?.route_short_name || 'RT',
            headsign,
            time: timestamp,
            delay: timeData.delay || 0,
            isRealtime: true,
            trackSection: location,
            isEmpty: isEmpty,
            stoppingPattern: rtStoppingPattern
          });
        }
      }
      }
      // 3. Detect Handovers (Divisions / Amalgamations)

    let processedDepartures = finalDepartures.sort((a, b) => a.time - b.time);

    try {
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
      const dateStr = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0') + now.getDate().toString().padStart(2, '0');

      // Fetch alerts to attach to trips
      const alerts = await fetchAlerts();

      for (let i = 0; i < processedDepartures.length; i++) {
        const current = processedDepartures[i];
        const related: string[] = [];

        // Determine if trip originates or terminates here
        let originatesHere = false;
        let terminatesHere = false;

        const dbStatus = db.prepare('SELECT stop_sequence, (SELECT MAX(stop_sequence) FROM stop_times WHERE trip_id = ?) as max_seq FROM stop_times WHERE trip_id = ? AND (stop_id = ? OR stop_id LIKE ?)').get(current.tripId, current.tripId, stopId, stopId.substring(0, 6) + '%') as any;

        if (dbStatus) {
          originatesHere = dbStatus.stop_sequence === 1;
          terminatesHere = dbStatus.stop_sequence === dbStatus.max_seq;
        } else {
          // For LIVE-only added trips, we treat them as originating here for handover detection
          originatesHere = current.isRealtime;
        }

        if (originatesHere) {
          // Find terminating trips in the feed that arrived here recently
          for (const entity of updates) {
            if (!entity.tripUpdate || !entity.tripUpdate.stopTimeUpdate || entity.tripUpdate.stopTimeUpdate.length === 0) continue;

            const lastStop = entity.tripUpdate.stopTimeUpdate[entity.tripUpdate.stopTimeUpdate.length - 1];
            if (lastStop.stopId === stopId || (lastStop.stopId && stopId.includes(lastStop.stopId))) {
              const termTime = Number(lastStop.arrival?.time?.low || lastStop.arrival?.time) * 1000;
              if (termTime > 0 && Math.abs(current.time - termTime) <= 1200000) { // 20 mins
                const termRun = entity.tripUpdate.trip.tripId.split('.')[0];
                related.push(`Forms from ${termRun}`);
              }
            }
          }

          // Check static schedule for terminated trips
          const curDate = new Date(current.time);
          const minTimeDate = new Date(current.time - 1200000); // 20 mins
          const maxTimeDate = new Date(current.time + 600000); // 10 mins
          const minTimeStr = minTimeDate.toLocaleTimeString('en-GB', { hour12: false });
          const maxTimeStr = maxTimeDate.toLocaleTimeString('en-GB', { hour12: false });

          if (minTimeDate.getDate() === curDate.getDate() && maxTimeDate.getDate() === curDate.getDate()) {
             const termTrips = getTerminatingTrips(stopId, dayName, dateStr, minTimeStr, maxTimeStr);
             for (const term of termTrips) {
                const termRun = term.trip_id.split('.')[0];
                if (!related.includes(`Forms from ${termRun}`)) {
                  related.push(`Forms from ${termRun}`);
                }
             }
          }
        }
        
        if (related.length > 0) {
          current.relatedServices = Array.from(new Set(related));
        }

        // Tag terminating trips so we can identify them
        if (terminatesHere) {
          current.isTerminating = true;
          current.headsign = "Terminates Here";
        }

        // Attach alerts
        current.activeAlerts = alerts.filter((a: any) => {
          if (!a.alert.informedEntity) return false;
          return a.alert.informedEntity.some((ie: any) => {
            if (ie.trip?.tripId && current.tripId.includes(ie.trip.tripId)) return true;
            if (ie.routeId && (ie.routeId === current.routeShortName || current.tripId.includes(ie.routeId))) return true;
            return false;
          });
        }).map((a: any) => {
          const header = a.alert.headerText?.translation?.[0]?.text || '';
          const desc = a.alert.descriptionText?.translation?.[0]?.text || '';
          // Combine and strip HTML tags for simple tooltip display
          const combined = desc ? `${header} ${desc}` : header;
          return combined.replace(/<[^>]*>?/gm, ''); 
        }).filter((text: string) => text);
      }

      // Slice to 15, keeping terminating trains visible
      processedDepartures = processedDepartures.slice(0, 15);

    } catch (dbErr) {
      console.error('Error during handover detection:', dbErr);
      processedDepartures = processedDepartures.slice(0, 15);
    }

    res.json({
      stopName: stopInfo?.stop_name || `Stop ${stopId}`,
      departures: processedDepartures
    });
  } catch (error) {
    console.error('Error fetching departures:', error);
    res.status(500).json({ error: 'Failed to fetch departures' });
  }
});

router.get('/alerts', async (req, res) => {
  const mode = req.query.mode as string | undefined;
  try {
    const alerts = await fetchAlerts(mode);
    const monitoredRoutes = getMonitoredRoutes();
    const monitoredStops = getMonitoredStops();
    
    let filteredAlerts = alerts;
    if (monitoredRoutes.length > 0 || monitoredStops.length > 0) {
      const allowedRouteIds = new Set(monitoredRoutes.map(mr => mr.route_id));
      const allowedStopIds = new Set(monitoredStops.map((ms: any) => ms.stop_id));
      const allowedShortNames = new Set(monitoredRoutes.map(mr => mr.route_short_name).filter(n => n));

      filteredAlerts = alerts.filter((entity: any) => {
        if (!entity.alert.informedEntity) return true; // Keep general network alerts
        
        return entity.alert.informedEntity.some((ie: any) => {
          // 1. Match by exact Route ID
          if (ie.routeId && (allowedRouteIds.has(ie.routeId) || allowedShortNames.has(ie.routeId))) return true;
          
          // 2. Match by Fuzzy Route ID (e.g., 'SCO_1a' matching 'SCO')
          if (ie.routeId) {
            const match = monitoredRoutes.some(mr => {
              const sn = mr.route_short_name;
              return sn && (ie.routeId.startsWith(sn + '_') || ie.routeId === sn);
            });
            if (match) return true;
          }

          // 3. Match by Stop ID (Station specific alerts)
          if (ie.stopId && allowedStopIds.has(ie.stopId)) return true;

          return false;
        });
      });
    }

    res.json({ alerts: filteredAlerts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

router.get('/carparks/monitored', async (req, res) => {
  try {
    const monitored = getMonitoredCarParks();
    if (monitored.length === 0) {
      return res.json([]);
    }

    const allCarParks = await fetchCarParksFullList();
    const filtered = allCarParks.filter((cp: any) => 
      monitored.some(m => m.facility_id === cp.facility_id)
    );

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch monitored carparks' });
  }
});

router.get('/carparks/lookup', async (req, res) => {
  try {
    // The GET /v1/carpark (no facility) returns a list of facility names and IDs
    const list = await fetchCarParks();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch carpark list' });
  }
});

router.get('/track/sc', async (req, res) => {
  try {
    const { getTripInfo } = require('../db');
    const vehicles = await fetchVehiclePositions();
    const scTrains = vehicles
      .filter((v: any) => v.vehicle?.stopId && v.vehicle.stopId.includes('SouthCoast'))
      .map((v: any) => {
        const tripId = v.vehicle.trip.tripId;
        const stopId = v.vehicle.stopId;
        
        let runNumber = tripId.split('.')[0];
        if (runNumber === 'NonTimetabled' && tripId.includes('.')) {
          runNumber = tripId.split('.')[1] || runNumber;
        }
        
        // Extract section from stopId (e.g., "SouthCoast.COAL-665" -> "COAL-665")
        const section = stopId.split('.').pop();
        
        // Enrich with trip info if available
        const tripInfo = getTripInfo(tripId);
        
        return {
          tripId,
          runNumber,
          section,
          stopId,
          directionId: v.vehicle.trip.directionId !== undefined ? v.vehicle.trip.directionId : tripInfo?.direction_id,
          headsign: tripInfo?.trip_headsign || v.vehicle.vehicle?.label || '',
          label: v.vehicle.vehicle?.label || '',
          timestamp: v.vehicle.timestamp ? Number(v.vehicle.timestamp.low || v.vehicle.timestamp) * 1000 : Date.now(),
          position: v.vehicle.position
        };
      });
    
    res.json(scTrains);
  } catch (error) {
    console.error('Error fetching SC track data:', error);
    res.status(500).json({ error: 'Failed to fetch SC track data' });
  }
});

router.get('/health/keys', (req, res) => {
  try {
    const { getApiKeyHealth } = require('../tfnsw');
    res.json(getApiKeyHealth());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch key health' });
  }
});

export default router;
