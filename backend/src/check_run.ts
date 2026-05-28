import { fetchTripUpdates } from './tfnsw';
import dotenv from 'dotenv';

dotenv.config();

async function checkRun(runNumber: string) {
  console.log(`Searching for Run: ${runNumber}...`);
  const updates = await fetchTripUpdates();
  
  const matches = updates.filter((u: any) => u.tripUpdate?.trip?.tripId?.startsWith(runNumber));
  
  if (matches.length === 0) {
    console.log(`No active trips found for Run ${runNumber} in the current feed.`);
    return;
  }

  console.log(`Found ${matches.length} matching trips:\n`);
  
  matches.forEach((m: any) => {
    const tu = m.tripUpdate;
    console.log(`Trip ID: ${tu.trip.tripId}`);
    console.log(`Route ID: ${tu.trip.routeId}`);
    console.log(`Schedule Relationship: ${tu.trip.scheduleRelationship}`);
    console.log(`Vehicle Label: ${tu.vehicle?.label || 'N/A'}`);
    console.log(`Stops Found: ${tu.stopTimeUpdate?.length || 0}`);
    
    if (tu.stopTimeUpdate) {
      console.log(`--- Stopping Pattern (${tu.stopTimeUpdate.length} stops) ---`);
      tu.stopTimeUpdate.forEach((s: any) => {
        const arrival = s.arrival?.time;
        const departure = s.departure?.time;
        const rawTime = arrival || departure;
        const ts = Number(rawTime?.low || rawTime);
        const timeStr = ts > 0 ? new Date(ts * 1000).toLocaleTimeString() : 'NO TIME';
        console.log(`Stop: ${s.stopId.padEnd(8)} | Time: ${timeStr} (Raw: ${ts}) | Delay: ${s.arrival?.delay || s.departure?.delay || 0}s`);
      });
    }
    console.log('\n' + '='.repeat(40) + '\n');
  });
}

const targetRun = process.argv[2] || 'C713';
checkRun(targetRun);
