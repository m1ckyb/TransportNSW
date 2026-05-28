import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { processGtfsZip } from '../gtfs-parser';
import fs from 'fs';
import axios from 'axios';
import { downloadStaticSchedule } from '../tfnsw';
import { 
  getMonitoredStops, addMonitoredStop, removeMonitoredStop, 
  getMonitoredRoutes, addMonitoredRoute, removeMonitoredRoute,
  getMonitoredCarParks, addMonitoredCarPark, removeMonitoredCarPark,
  searchStops, searchRoutes,
  getAllSettings, updateSettings
} from '../db';
import { unpublishStopDeparture, unpublishCarParkOccupancy, cleanupStaleTopics, connectMqtt } from '../mqtt';

const router = Router();
const uploadsDir = path.resolve(__dirname, '../uploads/');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Config Routes
router.get('/config/stops', (req, res) => res.json(getMonitoredStops()));
router.post('/config/stops', (req, res) => {
  console.log('POST /config/stops body:', req.body);
  const { stopId } = req.body;
  if (!stopId) return res.status(400).json({ error: 'Missing stopId' });
  addMonitoredStop(stopId);
  res.json({ message: 'Stop added' });
});
router.delete('/config/stops/:stopId', (req, res) => {
  console.log('Removing monitored stop:', req.params.stopId);
  removeMonitoredStop(req.params.stopId);
  unpublishStopDeparture(req.params.stopId);
  res.json({ message: 'Stop removed' });
});

router.get('/config/routes', (req, res) => res.json(getMonitoredRoutes()));

// Temporary MQTT Cleanup Route
router.post('/mqtt-cleanup', (req, res) => {
  console.log('Starting MQTT manual cleanup...');
  cleanupStaleTopics();
  res.json({ message: 'Legacy discovery topics cleared' });
});

router.post('/config/routes', (req, res) => {
  console.log('Adding monitored route:', req.body.routeId);
  if (!req.body.routeId) return res.status(400).json({ error: 'Missing routeId' });
  addMonitoredRoute(req.body.routeId);
  res.json({ message: 'Route added' });
});
router.delete('/config/routes/:routeId', (req, res) => {
  console.log('Removing monitored route:', req.params.routeId);
  removeMonitoredRoute(req.params.routeId);
  res.json({ message: 'Route removed' });
});

// Car Park Config
router.get('/config/carparks', (req, res) => res.json(getMonitoredCarParks()));
router.post('/config/carparks', (req, res) => {
  const { facilityId, facilityName } = req.body;
  if (!facilityId) return res.status(400).json({ error: 'Missing facilityId' });
  addMonitoredCarPark(facilityId, facilityName);
  res.json({ message: 'Car park added' });
});
router.delete('/config/carparks/:facilityId', (req, res) => {
  removeMonitoredCarPark(req.params.facilityId);
  unpublishCarParkOccupancy(req.params.facilityId);
  res.json({ message: 'Car park removed' });
});

// App Settings Routes
router.get('/settings', (req, res) => res.json(getAllSettings()));
router.post('/settings', (req, res) => {
  console.log('Updating app settings:', req.body);
  updateSettings(req.body);
  // Re-connect MQTT with new settings
  connectMqtt();
  res.json({ message: 'Settings updated' });
});

router.post('/test-key', async (req, res) => {
  const { apikey } = req.body;
  if (!apikey) return res.status(400).json({ error: 'Missing apikey' });

  try {
    const testUrl = 'https://api.transport.nsw.gov.au/v2/gtfs/alerts/all';
    const response = await axios.get(testUrl, {
      headers: { 'Authorization': `apikey ${apikey}` },
      responseType: 'arraybuffer',
      validateStatus: () => true // Catch all statuses
    });
    console.log(`Test key status: ${response.status}`);
    res.json({ status: response.status });
  } catch (err: any) {
    res.json({ status: err.response?.status || 500, error: err.message });
  }
});

router.post('/sync-gtfs', async (req, res) => {
  const mode = req.body.mode || 'sydneytrains'; 
  const zipPath = path.join(uploadsDir, `${mode}_schedule.zip`);
  
  // Set response timeout to 15 minutes as this takes a while
  req.setTimeout(900000);
  res.setTimeout(900000);

  try {
    await downloadStaticSchedule(mode, zipPath);
    console.log(`Successfully downloaded ${mode} GTFS. Starting ingestion...`);
    await processGtfsZip(zipPath);
    console.log(`Finished ingesting ${mode} GTFS data.`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); // Cleanup
    res.json({ message: 'Sync and ingestion completed successfully.' });
  } catch (err: any) {
    console.error(`Error during automated GTFS sync for ${mode}:`, err);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

// Search Routes
router.get('/search/stops', (req, res) => res.json(searchStops(req.query.q as string || '')));
router.get('/search/routes', (req, res) => res.json(searchRoutes(req.query.q as string || '')));

const upload = multer({ 
  dest: uploadsDir,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

router.post('/upload-gtfs-chunk', upload.single('chunk'), async (req, res) => {
  const { chunkIndex, totalChunks, filename } = req.body;
  const chunkPath = req.file?.path;

  if (!chunkPath) {
    return res.status(400).json({ error: 'No chunk uploaded' });
  }

  const tempDir = path.join(uploadsDir, `${filename}_parts`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const finalChunkPath = path.join(tempDir, `chunk-${chunkIndex}`);
  fs.renameSync(chunkPath, finalChunkPath);

  if (Number(chunkIndex) === Number(totalChunks) - 1) {
    // Reassemble file
    const finalPath = path.join(uploadsDir, filename);
    const writeStream = fs.createWriteStream(finalPath);

    for (let i = 0; i < totalChunks; i++) {
      const p = path.join(tempDir, `chunk-${i}`);
      const chunkBuffer = fs.readFileSync(p);
      writeStream.write(chunkBuffer);
      fs.unlinkSync(p);
    }
    writeStream.end();

    writeStream.on('finish', () => {
      fs.rmdirSync(tempDir);
      // Run processing in background
      console.log(`Starting background processing for: ${filename}`);
      processGtfsZip(finalPath).then(() => {
        console.log(`Background processing complete for: ${filename}`);
      }).catch(err => {
        console.error(`Background processing failed for ${filename}:`, err);
      });
      
      // Respond immediately to the last chunk
      res.json({ message: 'Upload complete, processing in background' });
    });
  } else {
    res.json({ message: `Chunk ${chunkIndex} uploaded` });
  }
});

router.post('/upload-gtfs', upload.single('gtfs_zip'), async (req, res) => {
  console.log(`Received GTFS upload request. File: ${req.file?.originalname}, Size: ${req.file?.size} bytes`);
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    await processGtfsZip(req.file.path);
    console.log(`GTFS upload processed successfully: ${req.file.originalname}`);
    res.json({ message: 'GTFS data processed successfully', filename: req.file.filename });
  } catch (error) {
    console.error('Error processing GTFS:', error);
    res.status(500).json({ error: 'Failed to process GTFS data' });
  }
});

export default router;
