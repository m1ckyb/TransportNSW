import axios from 'axios';

const API_BASE_URL = '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const api = {
  getDepartures: async (stopId: string) => {
    const response = await client.get(`/departures/${stopId}`);
    return response.data;
  },
  getAlerts: async () => {
    const response = await client.get('/alerts');
    return response.data;
  },
  getSCTrackData: async () => {
    const response = await client.get('/track/sc');
    return response.data;
  },
  getKeyHealth: async () => {
    const response = await client.get('/health/keys');
    return response.data;
  },

  // Car Park APIs
  getMonitoredCarParks: async () => {
    const response = await client.get('/carparks/monitored');
    return response.data;
  },
  lookupCarParks: async () => {
    const response = await client.get('/carparks/lookup');
    return response.data;
  },
  getConfigCarParks: async () => {
    const response = await client.get('/admin/config/carparks');
    return response.data;
  },
  addMonitoredCarPark: async (facilityId: string, facilityName: string) => {
    const response = await client.post('/admin/config/carparks', { facilityId, facilityName });
    return response.data;
  },
  removeMonitoredCarPark: async (facilityId: string) => {
    const response = await client.delete(`/admin/config/carparks/${facilityId}`);
    return response.data;
  },

  // Admin APIs

  getConfigStops: async () => {
    const response = await client.get('/admin/config/stops');
    return response.data;
  },
  addConfigStop: async (stopId: string) => {
    const response = await client.post('/admin/config/stops', { stopId });
    return response.data;
  },
  removeConfigStop: async (stopId: string) => {
    const response = await client.delete(`/admin/config/stops/${stopId}`);
    return response.data;
  },

  // Config Routes
  getConfigRoutes: async () => {
    const response = await client.get('/admin/config/routes');
    return response.data;
  },
  addConfigRoute: async (routeId: string) => {
    const response = await client.post('/admin/config/routes', { routeId });
    return response.data;
  },
  removeConfigRoute: async (routeId: string) => {
    const response = await client.delete(`/admin/config/routes/${routeId}`);
    return response.data;
  },

  getAppSettings: async () => {
    const response = await client.get('/admin/settings');
    return response.data;
  },
  updateAppSettings: async (settings: Record<string, string>) => {
    const response = await client.post('/admin/settings', settings);
    return response.data;
  },
  testApiKey: async (apikey: string) => {
    const response = await client.post('/admin/test-key', { apikey });
    return response.data;
  },

  syncGtfs: async (mode: string) => {
    const response = await client.post('/admin/sync-gtfs', { mode });
    return response.data;
  },

  clearStaleMqtt: async () => {
    const response = await client.post('/admin/mqtt-cleanup');
    return response.data;
  },

  // Search
  searchStops: async (query: string) => {
    const response = await client.get(`/admin/search/stops?q=${query}`);
    return response.data;
  },
  searchRoutes: async (query: string) => {
    const response = await client.get(`/admin/search/routes?q=${query}`);
    return response.data;
  },

  // Upload
  uploadGtfsChunk: async (chunk: Blob, index: number, total: number, filename: string) => {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', index.toString());
    formData.append('totalChunks', total.toString());
    formData.append('filename', filename);
    const response = await client.post('/admin/upload-gtfs-chunk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
