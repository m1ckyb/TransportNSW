import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { processGtfsZip } from '../gtfs-parser';
import fs from 'fs';
import { 
  getMonitoredStops, addMonitoredStop, removeMonitoredStop, 
  getMonitoredRoutes, addMonitoredRoute, removeMonitoredRoute,
  searchStops, searchRoutes
} from '../db';
import { unpublishStopDeparture } from '../mqtt';

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
  const staleIds = ['200060', '252610', '2526171', '2526172', '2560691', '2560692', '2576341', '2576342', 'null'];
  console.log('Starting MQTT manual cleanup...');
  staleIds.forEach(id => unpublishStopDeparture(id));
  res.json({ message: 'Cleanup signals sent for 9 stale entities' });
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
