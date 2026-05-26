import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Search, Plus, Trash2, Train, MapPin } from 'lucide-react';

export const ConfigManager: React.FC = () => {
  const [stops, setStops] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [stopQuery, setStopQuery] = useState('');
  const [routeQuery, setRouteQuery] = useState('');
  const [stopResults, setStopResults] = useState<any[]>([]);
  const [routeResults, setRouteResults] = useState<any[]>([]);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    const [s, r] = await Promise.all([api.getConfigStops(), api.getConfigRoutes()]);
    setStops(s);
    setRoutes(r);
  };

  const handleStopSearch = async (q: string) => {
    setStopQuery(q);
    if (q.length > 2) {
      const results = await api.searchStops(q);
      setStopResults(results);
    } else {
      setStopResults([]);
    }
  };

  const handleRouteSearch = async (q: string) => {
    setRouteQuery(q);
    if (q.length > 1) {
      const results = await api.searchRoutes(q);
      setRouteResults(results);
    } else {
      setRouteResults([]);
    }
  };

  const addStop = async (stopId: string) => {
    if (!stopId) return;
    await api.addConfigStop(stopId);
    setStopQuery('');
    setStopResults([]);
    fetchConfigs();
  };

  const addRoute = async (routeId: string) => {
    if (!routeId) return;
    await api.addConfigRoute(routeId);
    setRouteQuery('');
    setRouteResults([]);
    fetchConfigs();
  };

  const removeStop = async (stopId: string) => {
    if (!stopId) return;
    await api.removeConfigStop(stopId);
    fetchConfigs();
  };

  const removeRoute = async (routeId: string) => {
    if (!routeId) return;
    await api.removeConfigRoute(routeId);
    fetchConfigs();
  };

  return (
    <div className="config-manager">
      <div className="config-grid">
        {/* Stations Section */}
        <section className="config-card">
          <div className="card-header">
            <MapPin size={20} />
            <h3>Monitored Stations</h3>
          </div>
          <p className="card-desc">Add stations to track departures and MQTT updates.</p>
          
          <div className="search-box">
            <div className="search-input">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search station name or ID..." 
                value={stopQuery}
                onChange={(e) => handleStopSearch(e.target.value)}
              />
            </div>
            {stopResults.length > 0 && (
              <ul className="search-results">
                {stopResults.map(s => (
                  <li key={s.stop_id} onClick={() => addStop(s.stop_id)}>
                    <span>{s.stop_name}</span>
                    <small>{s.stop_id}</small>
                    <Plus size={14} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="config-list">
            {stops.map(s => (
              <li key={s.stop_id}>
                <div className="info">
                  <strong>{s.stop_name || `Stop ${s.stop_id}`}</strong>
                  <span>ID: {s.stop_id}</span>
                </div>
                <button onClick={() => removeStop(s.stop_id)} className="remove-btn">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
            {stops.length === 0 && <li className="empty">No stations configured.</li>}
          </ul>
        </section>

        {/* Routes Section */}
        <section className="config-card">
          <div className="card-header">
            <Train size={20} />
            <h3>Alert Filters (Lines)</h3>
          </div>
          <p className="card-desc">Select lines to show relevant network alerts.</p>
          
          <div className="search-box">
            <div className="search-input">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search line name or ID..." 
                value={routeQuery}
                onChange={(e) => handleRouteSearch(e.target.value)}
              />
            </div>
            {routeResults.length > 0 && (
              <ul className="search-results">
                {routeResults.map(r => (
                  <li key={r.route_id} onClick={() => addRoute(r.route_id)}>
                    <span>{r.route_short_name} - {r.route_long_name}</span>
                    <Plus size={14} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="config-list">
            {routes.map(r => (
              <li key={r.route_id}>
                <div className="info">
                  <strong>{r.route_short_name}</strong>
                  <span>{r.route_long_name}</span>
                </div>
                <button onClick={() => removeRoute(r.route_id)} className="remove-btn">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
            {routes.length === 0 && <li className="empty">Showing all network alerts (no filters).</li>}
          </ul>
        </section>
      </div>
    </div>
  );
};
