import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Save, Key, Wifi, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    TFNSW_API_KEY_1: '',
    TFNSW_API_KEY_2: '',
    TFNSW_API_KEY_3: '',
    TFNSW_API_KEY_4: '',
    TFNSW_API_KEY_5: '',
    MQTT_URL: 'mqtt://localhost',
    MQTT_USER: '',
    MQTT_PASS: '',
    TFNSW_MODE: 'sydneytrains,nswtrains'
  });
  
  const [testResults, setTestResults] = useState<Record<string, { status: number, loading: boolean }>>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getAppSettings();
      setSettings(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setStatus('idle');
  };

  const handleSave = async () => {
    setStatus('saving');
    try {
      await api.updateAppSettings(settings);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
    }
  };

  const handleTestKey = async (keyIndex: number) => {
    const fieldName = `TFNSW_API_KEY_${keyIndex}`;
    const key = settings[fieldName];
    if (!key) return;

    setTestResults(prev => ({ ...prev, [fieldName]: { status: 0, loading: true } }));
    
    try {
      const res = await api.testApiKey(key);
      setTestResults(prev => ({ 
        ...prev, 
        [fieldName]: { status: res.status, loading: false } 
      }));
    } catch (err) {
      setTestResults(prev => ({ 
        ...prev, 
        [fieldName]: { status: 500, loading: false } 
      }));
    }
  };

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div className="system-settings">
      <div className="config-grid">
        {/* API Keys Section */}
        <section className="config-card">
          <div className="card-header">
            <Key size={20} />
            <h3>TransportNSW API Keys</h3>
          </div>
          <p className="card-desc">Enter up to 5 API keys for automatic rotation.</p>
          
          <div className="settings-form">
            {[1, 2, 3, 4, 5].map(i => {
              const fieldName = `TFNSW_API_KEY_${i}`;
              const result = testResults[fieldName];
              
              return (
                <div key={i} className="form-group key-test-group">
                  <label>Key {i}</label>
                  <div className="input-with-action">
                    <input 
                      type="password" 
                      placeholder="Paste apikey here..."
                      value={settings[fieldName] || ''}
                      onChange={(e) => handleChange(fieldName, e.target.value)}
                    />
                    <button 
                      className="test-key-btn" 
                      onClick={() => handleTestKey(i)}
                      disabled={!settings[fieldName] || result?.loading}
                    >
                      {result?.loading ? <RefreshCw className="spin" size={14} /> : 'Test'}
                    </button>
                    {result && !result.loading && (
                      <div className={`test-status ${result.status === 200 ? 'ok' : 'fail'}`}>
                        {result.status === 200 ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        <span>{result.status}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* MQTT Section */}
        <section className="config-card">
          <div className="card-header">
            <Wifi size={20} />
            <h3>MQTT Settings</h3>
          </div>
          <p className="card-desc">Configure your Home Assistant MQTT broker.</p>
          
          <div className="settings-form">
            <div className="form-group">
              <label>Broker URL</label>
              <input 
                type="text" 
                placeholder="mqtt://192.168.1.x"
                value={settings.MQTT_URL || ''}
                onChange={(e) => handleChange('MQTT_URL', e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Username</label>
                <input 
                  type="text" 
                  value={settings.MQTT_USER || ''}
                  onChange={(e) => handleChange('MQTT_USER', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  value={settings.MQTT_PASS || ''}
                  onChange={(e) => handleChange('MQTT_PASS', e.target.value)}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Transit Modes (comma-separated)</label>
              <input 
                type="text" 
                placeholder="sydneytrains,nswtrains"
                value={settings.TFNSW_MODE || ''}
                onChange={(e) => handleChange('TFNSW_MODE', e.target.value)}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="settings-actions">
        <button 
          className="save-button" 
          onClick={handleSave}
          disabled={status === 'saving'}
        >
          {status === 'saving' ? <RefreshCw className="spin" /> : <Save size={18} />}
          {status === 'saving' ? 'Saving...' : 'Save Settings'}
        </button>
        {status === 'success' && <span className="status-success">Settings saved successfully!</span>}
        {status === 'error' && <span className="status-error">Failed to save settings.</span>}
      </div>
    </div>
  );
};
