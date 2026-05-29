import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Car, RefreshCw, MapPin } from 'lucide-react';

interface CarParkData {
  facility_id: string;
  facility_name: string;
  spots: string;
  occupancy: {
    total: string;
  };
  location: {
    suburb: string;
    address: string;
  };
  MessageDate: string;
}

export const CarParkPanel: React.FC = () => {
  const [carparks, setCarparks] = useState<CarParkData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.getMonitoredCarParks();
      setCarparks(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch carparks:', error);
      setCarparks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getAvailability = (spots: string, total: string) => {
    const s = parseInt(spots) || 0;
    const t = parseInt(total) || 0;
    return Math.max(0, s - t);
  };

  const getStatus = (spots: string, total: string) => {
    const s = parseInt(spots) || 0;
    const t = parseInt(total) || 0;
    const avail = s - t;
    
    if (avail < 1) return { label: 'FULL', class: 'status-full' };
    if (avail < s * 0.1) return { label: 'ALMOST FULL', class: 'status-almost-full' };
    return { label: 'AVAILABLE', class: 'status-available' };
  };

  return (
    <div className="carpark-panel full-screen">
      <header className="app-header">
        <div className="header-left">
          <h1>Park & Ride Occupancy</h1>
          <div className="header-right-meta">
            {lastUpdated && (
              <span className="last-updated-tag">
                UPDATED: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
            )}
            <button 
              className={`refresh-btn ${loading ? 'spinning' : ''}`} 
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="carpark-grid">
        {carparks.length > 0 ? (
          carparks.map(cp => {
            const status = getStatus(cp.spots, cp.occupancy?.total || '0');
            const avail = getAvailability(cp.spots, cp.occupancy?.total || '0');
            const occupancyPercent = Math.min(100, Math.round((parseInt(cp.occupancy?.total || '0') / parseInt(cp.spots || '1')) * 100));

            return (
              <div key={cp.facility_id} className="carpark-card">
                <div className="card-top">
                  <div className="card-title">
                    <Car size={18} className="car-icon" />
                    <h3>{(cp.facility_name || cp.facility_id || 'Unknown').replace('Park&Ride - ', '')}</h3>
                  </div>
                  <div className={`status-pill ${status.class}`}>
                    {status.label}
                  </div>
                </div>

                <div className="card-location">
                  <MapPin size={14} />
                  <span>{cp.location?.suburb || 'NSW'}</span>
                </div>

                <div className="occupancy-stats">
                  <div className="stat-main">
                    <span className="avail-count">~{avail}</span>
                    <span className="avail-label">spaces left</span>
                  </div>
                  <div className="stat-total">
                    of {cp.spots || '0'} total
                  </div>
                </div>

                <div className="progress-bar-container">
                  <div 
                    className={`progress-bar-fill ${status.class}`} 
                    style={{ width: `${isNaN(occupancyPercent) ? 0 : occupancyPercent}%` }}
                  ></div>
                </div>

                <div className="card-footer">
                  <span className="footer-time">
                    As of {cp.MessageDate ? new Date(cp.MessageDate).toLocaleTimeString([], { hour12: false }) : 'Just now'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          !loading && (
            <div className="empty-state-full">
              No car parks monitored. Add them in Settings.
            </div>
          )
        )}
      </div>
    </div>
  );
};
