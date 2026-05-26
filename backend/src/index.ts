import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db';
import { connectMqtt } from './mqtt';
import { startWorker } from './services/worker';
import apiRoutes from './routes/api';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

app.get('/health', (req, res) => res.send('OK'));

// Initialize Services
initDb();
connectMqtt();
console.log(`Current server time: ${new Date().toString()}`);
console.log(`Starting with default transit mode: ${process.env.TFNSW_MODE || 'sydneytrains'}`);
startWorker();

// Routes
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Backend server running on port ${port}`);
});

server.timeout = 600000; // 10 minutes
