import { Router } from 'express';
import { fetchTripUpdates, fetchAlerts } from '../tfnsw';
import { getStopInfo, getTripInfo, getMonitoredRoutes, getMonitoredStops, getScheduledDepartures, getStopNames, db } from '../db';

const router = Router();

router.get('/departures/:stopId', async (req, res) => {
  const { stopId } = req.params;
  const stopInfo = getStopInfo(stopId);
  
  try {
    const updates = await fetchTripUpdates();
    const finalDepartures: any[] = [];
    const now = Date.now();

    for (const entity of updates) {
      if (!entity.tripUpdate || !entity.tripUpdate.stopTimeUpdate) continue;

      const tripId = entity.tripUpdate.trip.tripId;
      
      // Find if this trip stops at our target station (fuzzy match IDs)
      const stopUpdateIndex = entity.tripUpdate.stopTimeUpdate.findIndex((stu: any) => 
        stu.stopId === stopId || 
        (stu.stopId && stopId.includes(stu.stopId)) || 
        (stu.stopId && stu.stopId.includes(stopId))
      );

      if (stopUpdateIndex !== -1) {
        const stopUpdate = entity.tripUpdate.stopTimeUpdate[stopUpdateIndex];
        const timeData = stopUpdate.departure || stopUpdate.arrival;
        let timestamp: number | null = null;
        let delay = 0;

        if (timeData && timeData.time && Number(timeData.time?.low || timeData.time) > 0) {
          const rawTime = timeData.time;
          timestamp = (typeof rawTime === 'object' && rawTime !== null && 'low' in rawTime)
            ? Number(rawTime.low) * 1000
            : Number(rawTime) * 1000;
          delay = timeData.delay || 0;
        } else {
          // Real-time update exists but has no predicted time - lookup schedule in DB
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
          
          // Extract Run Number (e.g., K308) from tripId
          const runNumber = tripId.split('.')[0];
          
          // Extract Set Info from vehicle label if available
          const setInfo = entity.tripUpdate.vehicle?.label || 'Unknown';

          // Resolve Stopping Pattern (future stops only)
          const futureStops = entity.tripUpdate.stopTimeUpdate.slice(stopUpdateIndex);
          const stopIds = futureStops.map((s: any) => s.stopId);
          const stopNameMap = getStopNames(stopIds);

          const stoppingPattern = futureStops.map((s: any) => ({
            stopId: s.stopId,
            stopName: stopNameMap[s.stopId] || `Stop ${s.stopId}`,
            arrival: s.arrival?.time ? Number(s.arrival.time.low || s.arrival.time) * 1000 : null,
            departure: s.departure?.time ? Number(s.departure.time.low || s.departure.time) * 1000 : null
          }));

          finalDepartures.push({
            tripId,
            runNumber,
            setInfo,
            routeShortName: tripInfo?.route_short_name || '???',
            headsign: tripInfo?.trip_headsign || entity.tripUpdate.trip.routeId || 'Unknown',
            time: timestamp,
            delay: delay,
            isRealtime: true,
            stoppingPattern
          });
        }
      }
    }

    res.json({
      stopName: stopInfo?.stop_name || `Stop ${stopId}`,
      departures: finalDepartures.sort((a, b) => a.time - b.time).slice(0, 20)
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

export default router;
