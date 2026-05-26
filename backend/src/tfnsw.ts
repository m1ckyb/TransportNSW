import axios from 'axios';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.TFNSW_API_KEY;
const DEFAULT_MODES = (process.env.TFNSW_MODE || 'sydneytrains,nswtrains').split(',');

const client = axios.create({
  headers: {
    'Authorization': `apikey ${API_KEY}`
  },
  responseType: 'arraybuffer'
});

// Sydney Trains & Metro are v2, others (Buses, NSWTrains) are transitioning
const getRealtimeUrl = (mode: string) => {
  // Always prefer v2 if likely available, fallback logic handled in fetch
  const version = ['sydneytrains', 'metro', 'lightrail/innerwest', 'lightrail/cbdandsoutheast', 'nswtrains'].includes(mode) ? 'v2' : 'v1';
  return `https://api.transport.nsw.gov.au/${version}/gtfs/realtime/${mode}`;
};

const getAlertsUrl = (mode: string) => {
  return `https://api.transport.nsw.gov.au/v2/gtfs/alerts/${mode}`;
};

export async function fetchTripUpdates(mode?: string) {
  const modes = mode ? [mode] : DEFAULT_MODES;
  const allEntities: any[] = [];

  for (const m of modes) {
    const primaryUrl = getRealtimeUrl(m);
    console.log(`Fetching trip updates from: ${primaryUrl}...`);
    try {
      const response = await client.get(primaryUrl);
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
      allEntities.push(...feed.entity);
    } catch (error: any) {
      // If v2 fails for nswtrains, try v1 as a backup
      if (m === 'nswtrains' && error.response?.status === 404) {
        const fallbackUrl = primaryUrl.replace('/v2/', '/v1/');
        console.log(`v2 not found for nswtrains, trying v1 fallback: ${fallbackUrl}`);
        try {
          const response = await client.get(fallbackUrl);
          const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
          allEntities.push(...feed.entity);
        } catch (v1Error) {
          console.error(`v1 fallback also failed for ${m}:`, v1Error);
        }
      } else {
        console.error(`Error fetching trip updates from ${primaryUrl}:`, error.message);
      }
    }
  }
  return allEntities;
}

export async function fetchAlerts(mode?: string) {
  // Use 'all' endpoint for maximum efficiency if no specific mode is forced
  const targetMode = mode || 'all';
  const url = `https://api.transport.nsw.gov.au/v2/gtfs/alerts/${targetMode}`;
  
  try {
    const response = await client.get(url);
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
    return feed.entity;
  } catch (error) {
    console.error(`Error fetching alerts from ${url}:`, error);
    return [];
  }
}
