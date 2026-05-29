import React, { useState, useEffect } from 'react';
import { DepartureBoard } from '../components/DepartureBoard';
import { api } from '../services/api';
import { RefreshCw, Layout, ArrowRightLeft } from 'lucide-react';
import { Crossings } from './Crossings';

export const SigView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sig' | 'crossings'>('sig');
  const [monitoredStops, setMonitoredStops] = useState<any[]>([]);
  const [stopId1, setStopId1] = useState('');
  const [stopId2, setStopId2] = useState('');
  const [data1, setData1] = useState<any>(null);
  const [data2, setData2] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchStops();
  }, []);

  const fetchStops = async () => {
    const stops = await api.getConfigStops();
    setMonitoredStops(stops);
    if (stops.length > 0) {
      if (!stopId1) setStopId1(stops[0].stop_id);
      if (!stopId2 && stops.length > 1) setStopId2(stops[1].stop_id);
    }
  };

  const fetchData = async () => {
    if (activeTab !== 'sig') return;
    setLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        stopId1 ? api.getDepartures(stopId1) : Promise.resolve({ departures: [] }),
        stopId2 ? api.getDepartures(stopId2) : Promise.resolve({ departures: [] })
      ]);
      setData1(res1);
      setData2(res2);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('SigView fetch failed:', error);
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
    }, 300000); // 5 mins

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stopId1, stopId2, activeTab]);

  return (
    <div className="sigview-container full-screen">
      {activeTab === 'sig' && (
        <header className="view-header">
          <div className="header-left">
            <nav className="sub-nav">
              <button 
                className="active" 
                onClick={() => setActiveTab('sig')}
              >
                <Layout size={16} />
                <span>Signaller View</span>
              </button>
              <button 
                onClick={() => setActiveTab('crossings')}
              >
                <ArrowRightLeft size={16} />
                <span>Crossings</span>
              </button>
            </nav>
            <div className="header-right-meta" style={{ marginLeft: 'auto' }}>
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
      )}

      {activeTab === 'crossings' && (
        <div className="view-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div className="header-left">
            <nav className="sub-nav">
              <button 
                className="active" 
                onClick={() => setActiveTab('sig')}
              >
                <Layout size={16} />
                <span>Signaller View</span>
              </button>
              <button 
                className="active" 
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
              >
                <ArrowRightLeft size={16} />
                <span>Crossings</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      <main className="sig-content">
        {activeTab === 'sig' ? (
          <div className="sigview-grid">
            {/* Left Station */}
            <section className="sig-board">
              <div className="sig-selector">
                <select value={stopId1} onChange={(e) => setStopId1(e.target.value)}>
                  {monitoredStops.map(s => (
                    <option key={s.stop_id} value={s.stop_id}>{s.stop_name || s.stop_id}</option>
                  ))}
                </select>
                <button 
                  className={`refresh-btn ${loading ? 'spinning' : ''}`} 
                  onClick={fetchData}
                  disabled={loading}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              {data1 && <DepartureBoard stopName={data1.stopName} departures={data1.departures} hideHeader={true} />}
            </section>

            {/* Right Station */}
            <section className="sig-board">
              <div className="sig-selector">
                <select value={stopId2} onChange={(e) => setStopId2(e.target.value)}>
                  {monitoredStops.map(s => (
                    <option key={s.stop_id} value={s.stop_id}>{s.stop_name || s.stop_id}</option>
                  ))}
                </select>
                <button 
                  className={`refresh-btn ${loading ? 'spinning' : ''}`} 
                  onClick={fetchData}
                  disabled={loading}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              {data2 && <DepartureBoard stopName={data2.stopName} departures={data2.departures} hideHeader={true} />}
            </section>
          </div>
        ) : (
          <Crossings />
        )}
      </main>
    </div>
  );
};
