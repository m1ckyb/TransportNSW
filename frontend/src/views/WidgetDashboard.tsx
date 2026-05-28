import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { RefreshCw, MapPin } from 'lucide-react';

interface WidgetData {
  stopId: string;
  stopName: string;
  nextTrains: any[];
}

export const WidgetDashboard: React.FC = () => {
  const [widgets, setWidgets] = useState<WidgetData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const stops = await api.getConfigStops();
      const results = await Promise.all(
        stops.map(async (stop: any) => {
          try {
            const data = await api.getDepartures(stop.stop_id);
            return {
              stopId: stop.stop_id,
              stopName: stop.stop_name || stop.stop_id,
              nextTrains: (data.departures || []).slice(0, 3)
            };
          } catch (err) {
            return { stopId: stop.stop_id, stopName: stop.stop_name, nextTrains: [] };
          }
        })
      );
      setWidgets(results);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('WidgetDashboard fetch failed:', error);
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
    }, 60000); // Refresh every minute

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const getMinutesAway = (timestamp: number) => {
    if (!timestamp) return 0;
    const diff = timestamp - Date.now();
    return Math.max(0, Math.floor(diff / 60000));
  };

  const formatStopName = (name: string, isDestination: boolean = false) => {
    if (!name) return '';
    const clean = name.replace(/ Station/g, '');
    if (isDestination) {
      return clean.replace(/ Platform \d+/g, '');
    }
    return clean.replace(/ Platform /g, ' #');
  };

  return (
    <div className="widget-dashboard-container full-screen">
      <header className="app-header">
        <div className="header-left">
          <h1>Next Train Overview</h1>
          <button 
            className={`refresh-btn ${loading ? 'spinning' : ''}`} 
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="header-right" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
          Last sync: {lastUpdated.toLocaleTimeString([], { hour12: false })}
        </div>
      </header>

      <div className="widget-grid">
        {widgets.map(w => (
          <div key={w.stopId} className="train-widget">
            <div className="widget-header">
              <MapPin size={14} className="pin-icon" />
              <h3>{formatStopName(w.stopName)}</h3>
            </div>
            
            <div className="widget-content">
              {w.nextTrains.length > 0 ? (
                w.nextTrains.map((train, idx) => (
                  <div key={`${w.stopId}-${train.tripId}-${idx}`} className={`train-row ${idx === 0 ? 'primary' : 'secondary'}`}>
                    <div className="train-main-info">
                      <div className="route-and-dest">
                        <span className="route-pill">{train.routeShortName}</span>
                        <span className="dest-text">{formatStopName(train.headsign, true)}</span>
                        {train.isRealtime && <span className="live-dot" title="Live"></span>}
                      </div>
                      <div className="secondary-info">
                        <span className="sch-time">
                          {new Date(train.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        <div className="meta-info">
                          <span className="run">{train.runNumber}</span>
                          <span className="set">{train.setInfo}</span>
                        </div>
                      </div>
                    </div>
                    <div className="due-info">
                      <span className="due-min">{getMinutesAway(train.time)}m</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="widget-empty">
                  No upcoming trains
                </div>
              )}
            </div>
          </div>
        ))}
        {widgets.length === 0 && !loading && (
          <div className="empty-state-full">
            No monitored stations found. Add them in Settings.
          </div>
        )}
      </div>
    </div>
  );
};

