import { useState, useEffect } from 'react';
import { Dashboard } from './views/Dashboard';
import { Admin } from './views/Admin';
import { SigView } from './views/SigView';
import { WidgetDashboard } from './views/WidgetDashboard';
import { CarParkPanel } from './components/CarParkPanel';
import { api } from './services/api';
import './styles/global.css';

function App() {
  const [view, setView] = useState<'widgets' | 'dashboard' | 'sigview' | 'parking' | 'trackwork' | 'alerts' | 'admin'>('widgets');
  const [time, setTime] = useState(new Date());
  const [keyHealth, setKeyHealth] = useState<{ total: number; healthy: number }>({ total: 0, healthy: 0 });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    const fetchHealth = async () => {
      try {
        const data = await api.getKeyHealth();
        setKeyHealth(data);
      } catch (e) {
        console.error('Failed to fetch key health');
      }
    };
    
    fetchHealth();
    const healthTimer = setInterval(fetchHealth, 60000); // Check key health every minute

    return () => {
      clearInterval(timer);
      clearInterval(healthTimer);
    };
  }, []);

  const getHealthColor = () => {
    if (keyHealth.healthy === 0) return '#ef4444'; // Red
    if (keyHealth.healthy === 1) return '#f59e0b'; // Orange
    return '#10b981'; // Green
  };

  return (
    <div className="app-container full-screen">
      <nav className="main-nav">
        <div className="nav-links">
          <button 
            className={view === 'widgets' ? 'active' : ''} 
            onClick={() => setView('widgets')}
          >
            Dashboard
          </button>
          <button 
            className={view === 'dashboard' ? 'active' : ''} 
            onClick={() => setView('dashboard')}
          >
            Departures
          </button>
          <button 
            className={view === 'sigview' ? 'active' : ''} 
            onClick={() => setView('sigview')}
          >
            SigView
          </button>
          <button 
            className={view === 'parking' ? 'active' : ''} 
            onClick={() => setView('parking')}
          >
            Parking
          </button>
          <button 
            className={view === 'trackwork' ? 'active' : ''} 
            onClick={() => setView('trackwork')}
          >
            Trackwork
          </button>
          <button 
            className={view === 'alerts' ? 'active' : ''} 
            onClick={() => setView('alerts')}
          >
            Alerts
          </button>
          <button 
            className={view === 'admin' ? 'active' : ''} 
            onClick={() => setView('admin')}
          >
            Settings
          </button>
        </div>

        <div className="nav-status">
          <div className="api-health" title="TfNSW API Key Health">
            <span className="health-label">API</span>
            <div 
              className="health-indicator" 
              style={{ backgroundColor: getHealthColor() }}
            >
              {keyHealth.healthy}
            </div>
          </div>
          <div className="nav-clock">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </div>
        </div>
      </nav>
      
      <div className="view-content">
        {view === 'widgets' && <WidgetDashboard />}
        {view === 'dashboard' && <Dashboard />}
        {view === 'sigview' && <SigView />}
        {view === 'parking' && <CarParkPanel />}
        {view === 'trackwork' && <Dashboard forceView="trackwork" />}
        {view === 'alerts' && <Dashboard forceView="alerts" />}
        {view === 'admin' && <Admin />}
      </div>
    </div>
  );
}

export default App;
