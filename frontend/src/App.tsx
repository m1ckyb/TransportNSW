import { useState } from 'react';
import { Dashboard } from './views/Dashboard';
import { Admin } from './views/Admin';
import './styles/global.css';

function App() {
  const [view, setView] = useState<'dashboard' | 'trackwork' | 'alerts' | 'admin'>('dashboard');

  return (
    <div className="app-container full-screen">
      <nav className="main-nav">
        <button 
          className={view === 'dashboard' ? 'active' : ''} 
          onClick={() => setView('dashboard')}
        >
          Departures
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
      </nav>
      
      <div className="view-content">
        {view === 'dashboard' && <Dashboard />}
        {view === 'trackwork' && <Dashboard forceView="trackwork" />}
        {view === 'alerts' && <Dashboard forceView="alerts" />}
        {view === 'admin' && <Admin />}
      </div>
    </div>
  );
}

export default App;
