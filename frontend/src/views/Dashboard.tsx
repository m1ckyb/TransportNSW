import React, { useState, useEffect } from 'react';
import { DepartureBoard } from '../components/DepartureBoard';
import { AlertsPanel } from '../components/AlertsPanel';
import { api } from '../services/api';
import { RefreshCw } from 'lucide-react';

interface DashboardProps {
  forceView?: 'dashboard' | 'trackwork' | 'alerts';
}

export const Dashboard: React.FC<DashboardProps> = ({ forceView = 'dashboard' }) => {
  const [stopId, setStopId] = useState('');
  const [monitoredStops, setMonitoredStops] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchStops();
  }, []);

  const fetchStops = async () => {
    const stops = await api.getConfigStops();
    setMonitoredStops(stops);
    if (stops.length > 0 && !stopId) {
      setStopId(stops[0].stop_id);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [departureRes, alertRes] = await Promise.all([
        stopId ? api.getDepartures(stopId) : Promise.resolve({ departures: [] }),
        api.getAlerts()
      ]);
      setData(departureRes);
      setAlerts(Array.isArray(alertRes?.alerts) ? alertRes.alerts : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    fetchData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    }, 60000); // Refresh every 60 seconds

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stopId]);

  const handleManualRefresh = async () => {
    fetchData();
  };

  // Filter alerts based on forceView
  const filteredAlerts = alerts.filter(a => {
    const isTW = (a.alert.cause === 7 || a.alert.cause === 'MAINTENANCE') && 
                 (a.alert.effect === 6 || a.alert.effect === 'MODIFIED_SERVICE');
    if (forceView === 'trackwork') return isTW;
    if (forceView === 'alerts') return !isTW;
    return true;
  });

  return (
    <div className="dashboard-container full-screen">
      <header className="app-header">
        <div className="header-left">
          <h1>
            {forceView === 'dashboard' && 'Departures'}
            {forceView === 'trackwork' && 'Network Trackwork'}
            {forceView === 'alerts' && 'Service Alerts'}
          </h1>
          <div className="header-right-meta">
            {lastUpdated && (
              <span className="last-updated-tag">
                UPDATED: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
            )}
            <button 
              className={`refresh-btn ${loading ? 'spinning' : ''}`} 
              onClick={handleManualRefresh}
              disabled={loading}
              title="Manual Refresh"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
        {forceView === 'dashboard' && (
          <div className="stop-selector">
            <label>Station: </label>
            <select 
              value={stopId} 
              onChange={(e) => setStopId(e.target.value)}
              disabled={monitoredStops.length === 0}
            >
              {monitoredStops.map(s => (
                <option key={s.stop_id} value={s.stop_id}>
                  {s.stop_name || `Stop ${s.stop_id}`}
                </option>
              ))}
              {monitoredStops.length === 0 && <option value="">No stations configured</option>}
            </select>
          </div>
        )}
      </header>

      <main className="single-column">
        {forceView === 'dashboard' ? (
          <section className="main-board">
            {!stopId ? (
              <div className="empty-state">
                <h3>Welcome!</h3>
                <p>Go to <strong>Settings</strong> to add monitored stations.</p>
              </div>
            ) : loading && !data ? (
              <div className="loading">Loading departures...</div>
            ) : (
              <DepartureBoard 
                stopName={data?.stopName} 
                departures={data?.departures || []} 
              />
            )}
          </section>
        ) : (
          <section className="full-width-panel">
            <AlertsPanel alerts={filteredAlerts} title={forceView === 'trackwork' ? 'Current Trackwork' : 'Active Service Alerts'} />
          </section>
        )}
      </main>
    </div>
  );
};
