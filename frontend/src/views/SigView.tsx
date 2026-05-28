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
      <header className="view-header">
        <div className="header-left">
          <nav className="sub-nav">
            <button 
              className={activeTab === 'sig' ? 'active' : ''} 
              onClick={() => setActiveTab('sig')}
            >
              <Layout size={16} />
              <span>Signaller View</span>
            </button>
            <button 
              className={activeTab === 'crossings' ? 'active' : ''} 
              onClick={() => setActiveTab('crossings')}
            >
              <ArrowRightLeft size={16} />
              <span>Crossings</span>
            </button>
          </nav>
        </div>
      </header>

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
