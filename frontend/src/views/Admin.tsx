import React from 'react';
import { FileUpload } from '../components/FileUpload';
import { ConfigManager } from '../components/ConfigManager';
import { api } from '../services/api';

export const Admin: React.FC = () => {
  return (
    <div className="admin-container">
      <header className="app-header">
        <h1>Admin Settings</h1>
      </header>

      <main className="admin-grid">
        <section className="admin-section">
          <FileUpload />
        </section>

        <section className="admin-section">
          <ConfigManager />
        </section>

        <section className="admin-section mqtt-status">
          <h3>MQTT Integration</h3>
          <p>
            The backend worker polls for updates every 60 seconds and publishes to MQTT. 
            Broker details are configured in the <code>backend/.env</code> file.
          </p>
          <button 
            onClick={async () => {
              if (confirm('This will remove all stale "TransportNSW Stop" entities from Home Assistant. Continue?')) {
                await api.clearStaleMqtt();
                alert('Cleanup signal sent!');
              }
            }}
            className="cleanup-button"
          >
            Clear Stale MQTT Entities
          </button>
          <div className="mqtt-info">
            <strong>Status:</strong> Connected
          </div>
        </section>
      </main>
    </div>
  );
};
