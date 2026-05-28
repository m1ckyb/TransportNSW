import axios from 'axios';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import dotenv from 'dotenv';
import { getAllSettings } from './db';

dotenv.config();

// Track key health
interface KeyHealth {
  key: string;
  status: 'ok' | 'cooling_down';
  cooldownUntil: number;
}

const keyHealthMap = new Map<string, KeyHealth>();

// Load keys from DB with fallback to ENV
const getApiKeys = () => {
  const settings = getAllSettings();
  const keys: string[] = [];
  
  for (let i = 1; i <= 5; i++) {
    const key = settings[`TFNSW_API_KEY_${i}`];
    if (key) keys.push(key);
  }

  if (keys.length === 0) {
    if (process.env.TFNSW_API_KEY) keys.push(process.env.TFNSW_API_KEY);
    for (let i = 1; i <= 5; i++) {
      const key = process.env[`TFNSW_API_KEY_${i}`];
      if (key && !keys.includes(key)) keys.push(key);
    }
  }

  return keys;
};

const getHealthyKey = () => {
  const keys = getApiKeys();
  const now = Date.now();
  
  // Find a key that is OK or past its cooldown
  const availableKeys = keys.filter(k => {
    const health = keyHealthMap.get(k);
    if (!health || health.status === 'ok' || health.cooldownUntil < now) {
      return true;
    }
    return false;
  });

  if (availableKeys.length === 0) {
    console.warn('No healthy API keys available! Trying the first key anyway.');
    return keys[0];
  }

  // Pick a random available key to spread load
  const key = availableKeys[Math.floor(Math.random() * availableKeys.length)];
  console.log(`Using healthy API key (Available: ${availableKeys.length}/${keys.length})`);
  return key;
};

const markKeyAs429 = (key: string) => {
  console.log('Marking API key as cooling down due to 429 error.');
  keyHealthMap.set(key, {
    key,
    status: 'cooling_down',
    cooldownUntil: Date.now() + (10 * 60 * 1000) // 10 minute cooldown
  });
};

export const getApiKeyHealth = () => {
  const keys = getApiKeys();
  const now = Date.now();
  
  const healths = keys.map(k => {
    const health = keyHealthMap.get(k);
    const isCoolingDown = health && health.status === 'cooling_down' && health.cooldownUntil > now;
    return {
      key: k.substring(0, 8) + '...',
      status: isCoolingDown ? 'cooling_down' : 'ok',
      cooldownUntil: health?.cooldownUntil || 0
    };
  });

  return {
    total: keys.length,
    healthy: healths.filter(h => h.status === 'ok').length,
    keys: healths
  };
};

const client = axios.create({
  responseType: 'arraybuffer'
});

// Cache for trip updates
let tripUpdateCache: { entities: any[], timestamp: number } | null = null;
let tripUpdatesPromise: Promise<any[]> | null = null;

// Cache for alerts
let alertsCache: { entities: any[], timestamp: number } | null = null;
let alertsPromise: Promise<any[]> | null = null;

// Cache for vehicle positions
let vehiclePosCache: { entities: any[], timestamp: number } | null = null;
let vehiclePosPromise: Promise<any[]> | null = null;

const CACHE_TTL = 30 * 1000; // 30 seconds to respect rate limits

const getModes = () => {
  const settings = getAllSettings();
  const modeStr = settings['TFNSW_MODE'] || process.env.TFNSW_MODE || 'sydneytrains,nswtrains';
  return modeStr.split(',');
};

const getRealtimeUrl = (mode: string) => {
  const version = ['sydneytrains', 'metro', 'lightrail/innerwest', 'lightrail/cbdandsoutheast', 'nswtrains'].includes(mode) ? 'v2' : 'v1';
  return `https://api.transport.nsw.gov.au/${version}/gtfs/realtime/${mode}`;
};

const getVehiclePosUrl = (mode: string) => {
  const version = ['sydneytrains', 'metro', 'lightrail/innerwest', 'lightrail/cbdandsoutheast', 'nswtrains'].includes(mode) ? 'v2' : 'v1';
  return `https://api.transport.nsw.gov.au/${version}/gtfs/vehiclepos/${mode}`;
};

export async function fetchVehiclePositions(mode?: string) {
  const modes = mode ? [mode] : getModes();
  
  if (!mode) {
    if (vehiclePosCache && (Date.now() - vehiclePosCache.timestamp) < CACHE_TTL) {
      return vehiclePosCache.entities;
    }
    if (vehiclePosPromise) {
      return vehiclePosPromise;
    }
  }

  const doFetch = async () => {
    const allEntities: any[] = [];
    for (const m of modes) {
      const primaryUrl = getVehiclePosUrl(m);
      const key = getHealthyKey();
      if (!key) continue;

      try {
        const response = await client.get(primaryUrl, { 
          headers: { 'Authorization': `apikey ${key}` } 
        });
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
        allEntities.push(...feed.entity);
      } catch (error: any) {
        if (error.response?.status === 429) markKeyAs429(key);

        if (m === 'nswtrains' && error.response?.status === 404) {
          const fallbackUrl = primaryUrl.replace('/v2/', '/v1/');
          try {
            const response = await client.get(fallbackUrl, { 
              headers: { 'Authorization': `apikey ${getHealthyKey()}` } 
            });
            const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
            allEntities.push(...feed.entity);
          } catch (v1Error: any) {
            if (v1Error.response?.status === 429) markKeyAs429(key);
          }
        }
      }
    }

    if (!mode) {
      vehiclePosCache = {
        entities: allEntities,
        timestamp: Date.now()
      };
      vehiclePosPromise = null;
    }
    return allEntities;
  };

  if (!mode) {
    vehiclePosPromise = doFetch();
    return vehiclePosPromise;
  }

  return doFetch();
}

export async function fetchTripUpdates(mode?: string) {
  const modes = mode ? [mode] : getModes();
  
  // Use cache only if fetching ALL modes (default behavior)
  if (!mode) {
    if (tripUpdateCache && (Date.now() - tripUpdateCache.timestamp) < CACHE_TTL) {
      return tripUpdateCache.entities;
    }
    if (tripUpdatesPromise) {
      return tripUpdatesPromise;
    }
  }

  const doFetch = async () => {
    const allEntities: any[] = [];
    for (const m of modes) {
      const primaryUrl = getRealtimeUrl(m);
      const key = getHealthyKey();
      if (!key) continue;

      try {
        const response = await client.get(primaryUrl, { 
          headers: { 'Authorization': `apikey ${key}` } 
        });
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
        allEntities.push(...feed.entity);
      } catch (error: any) {
        if (error.response?.status === 429) {
          markKeyAs429(key);
        }

        if (m === 'nswtrains' && error.response?.status === 404) {
          const fallbackUrl = primaryUrl.replace('/v2/', '/v1/');
          try {
            const response = await client.get(fallbackUrl, { 
              headers: { 'Authorization': `apikey ${getHealthyKey()}` } 
            });
            const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
            allEntities.push(...feed.entity);
          } catch (v1Error: any) {
            if (v1Error.response?.status === 429) markKeyAs429(key);
          }
        }
      }
    }

    if (!mode) {
      tripUpdateCache = {
        entities: allEntities,
        timestamp: Date.now()
      };
      tripUpdatesPromise = null;
    }
    return allEntities;
  };

  if (!mode) {
    tripUpdatesPromise = doFetch();
    return tripUpdatesPromise;
  }

  return doFetch();
}

export async function fetchAlerts(mode?: string) {
  const targetMode = mode || 'all';
  
  if (targetMode === 'all') {
    if (alertsCache && (Date.now() - alertsCache.timestamp) < CACHE_TTL) {
      return alertsCache.entities;
    }
    if (alertsPromise) {
      return alertsPromise;
    }
  }

  const doFetch = async () => {
    const url = `https://api.transport.nsw.gov.au/v2/gtfs/alerts/${targetMode}`;
    const key = getHealthyKey();
    if (!key) return [];
    
    try {
      const response = await client.get(url, { 
        headers: { 'Authorization': `apikey ${key}` } 
      });
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
      
      if (targetMode === 'all') {
        alertsCache = {
          entities: feed.entity,
          timestamp: Date.now()
        };
        alertsPromise = null;
      }
      return feed.entity;
    } catch (error: any) {
      if (error.response?.status === 429) markKeyAs429(key);
      if (targetMode === 'all') alertsPromise = null;
      return [];
    }
  };

  if (targetMode === 'all') {
    alertsPromise = doFetch();
    return alertsPromise;
  }

  return doFetch();
}

export async function fetchCarParks(facilityId?: string) {
  const baseUrl = 'https://api.transport.nsw.gov.au/v1/carpark';
  const url = facilityId ? `${baseUrl}?facility=${facilityId}` : baseUrl;
  const key = getHealthyKey();
  if (!key) return [];

  console.log(`Fetching car park(s) from: ${url}`);
  try {
    const response = await axios.get(url, {
      headers: { 'Authorization': `apikey ${key}` },
      responseType: 'json'
    });

    // If it's a single facility response (it has facility_id)
    if (response.data && response.data.facility_id) {
      return [response.data];
    }

    // If it's the lookup map format { "ID": "Name" }
    if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
      return Object.entries(response.data).map(([id, name]) => ({
        facility_id: id,
        facility_name: name
      }));
    }

    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    if (error.response?.status === 429) markKeyAs429(key);
    console.error(`Error fetching car parks:`, error.message);
    return [];
  }
}

export async function fetchCarParksFullList() {
  const url = 'https://api.transport.nsw.gov.au/v1/carpark/full-list';
  const key = getHealthyKey();
  if (!key) return [];

  console.log(`Fetching all car parks from: ${url}`);
  try {
    const response = await axios.get(url, {
      headers: { 'Authorization': `apikey ${key}` },
      responseType: 'json'
    });
    return Array.isArray(response.data) ? response.data : [response.data];
  } catch (error: any) {
    if (error.response?.status === 429) markKeyAs429(key);
    console.error(`Error fetching car park full-list:`, error.message);
    return [];
  }
}

// Download the "For Realtime" static GTFS bundle
export async function downloadStaticSchedule(mode: string, destinationPath: string) {
  // Static schedules are still on v1
  const url = `https://api.transport.nsw.gov.au/v1/gtfs/schedule/${mode}`;
  const key = getHealthyKey();
  
  if (!key) {
    throw new Error('No healthy API key available to download schedule.');
  }

  console.log(`Downloading static schedule for ${mode} to ${destinationPath}...`);
  
  const fs = await import('fs');
  const writer = fs.createWriteStream(destinationPath);

  try {
    const response = await axios.get(url, {
      headers: { 'Authorization': `apikey ${key}` },
      responseType: 'stream',
      timeout: 120000 // 2 minutes, as these files are large
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error: any) {
    if (error.response?.status === 429) markKeyAs429(key);
    console.error(`Failed to download static schedule for ${mode}:`, error.message);
    throw error;
  }
}
