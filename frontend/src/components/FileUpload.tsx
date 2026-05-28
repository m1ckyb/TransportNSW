import React, { useState } from 'react';
import { api } from '../services/api';
import { Upload, CheckCircle, AlertCircle, Loader2, DownloadCloud } from 'lucide-react';

export const FileUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [syncMode, setSyncMode] = useState('sydneytrains');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setMessage('');
      setProgress(0);
    }
  };

  const handleSync = async () => {
    setStatus('processing');
    setMessage('Downloading and ingesting... This may take several minutes.');
    try {
      await api.syncGtfs(syncMode);
      setStatus('success');
      setMessage('GTFS data synchronized and processed successfully!');
    } catch (error) {
      console.error('Sync trigger error:', error);
      setStatus('error');
      setMessage('Failed to sync GTFS data. Check backend logs.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('uploading');
    setProgress(0);
    
    const CHUNK_SIZE = 25 * 1024 * 1024; // 25MB chunks (better for proxies)
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const filename = `${Date.now()}-${file.name}`;

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunk = file.slice(start, end);

        // Simple retry logic (3 attempts)
        let success = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await api.uploadGtfsChunk(chunk, i, totalChunks, filename);
            success = true;
            break;
          } catch (err: any) {
            console.warn(`Chunk ${i} upload failed (attempt ${attempt + 1}):`, err.message);
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
          }
        }

        if (!success) throw new Error(`Failed to upload chunk ${i} after 3 attempts`);

        const percent = Math.round(((i + 1) / totalChunks) * 100);
        setProgress(percent);
        
        // Pause between chunks to stay under proxy rate limits
        await new Promise(r => setTimeout(r, 500));
      }
      setStatus('success');
      setMessage('Upload complete! The server is now importing the data in the background. You can check the dashboard in a few minutes.');
    } catch (error) {
      console.error('Upload error details:', error);
      setStatus('error');
      setMessage('Failed to upload GTFS data. Please try again.');
    }
  };

  return (
    <div className="file-upload-card">
      <h3>GTFS Data Management</h3>
      
      <div className="sync-section" style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #334155' }}>
        <h4>Auto-Sync from TfNSW</h4>
        <p>Download the "For Realtime" static GTFS bundle directly from the API.</p>
        <div className="upload-input-group">
          <select 
            value={syncMode} 
            onChange={(e) => setSyncMode(e.target.value)}
            className="file-label"
            style={{ appearance: 'auto' }}
          >
            <option value="sydneytrains">Sydney Trains (inc. NSW TrainLink)</option>
            <option value="buses">Buses</option>
            <option value="ferries">Ferries</option>
            <option value="lightrail">Light Rail</option>
            <option value="sydneymetro">Sydney Metro</option>
          </select>
          <button 
            onClick={handleSync} 
            disabled={status === 'processing'}
            className="upload-button"
          >
            {status === 'processing' ? <Loader2 className="spin" /> : <DownloadCloud size={18} />}
            Sync
          </button>
        </div>
      </div>

      <h4>Manual Upload</h4>
      <p>Upload a .zip file containing stops.txt, routes.txt, etc.</p>
      
      <div className="upload-input-group">
        <input 
          type="file" 
          accept=".zip" 
          onChange={handleFileChange} 
          id="gtfs-upload"
          hidden 
        />
        <label htmlFor="gtfs-upload" className="file-label">
          {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)` : 'Select GTFS ZIP File'}
        </label>
        
        <button 
          onClick={handleUpload} 
          disabled={!file || status === 'uploading' || status === 'processing'}
          className="upload-button"
        >
          {status === 'uploading' || status === 'processing' ? <Loader2 className="spin" /> : <Upload size={18} />}
          {status === 'processing' ? 'Processing...' : 'Upload'}
        </button>
      </div>

      {(status === 'uploading' || status === 'processing') && (
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          <span className="progress-text">
            {status === 'uploading' ? `Uploading: ${progress}%` : 'Processing on server...'}
          </span>
        </div>
      )}

      {status === 'success' && (
        <div className="status-msg success">
          <CheckCircle size={16} /> {message}
        </div>
      )}
      {status === 'error' && (
        <div className="status-msg error">
          <AlertCircle size={16} /> {message}
        </div>
      )}
    </div>
  );
};
