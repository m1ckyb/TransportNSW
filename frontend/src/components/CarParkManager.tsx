import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Trash2, Search, Car } from 'lucide-react';

interface CarParkLookup {
  facility_id: string;
  facility_name: string;
  suburb?: string;
}

interface MonitoredCarPark {
  facility_id: string;
  facility_name: string;
}

export const CarParkManager: React.FC = () => {
  const [monitored, setMonitored] = useState<MonitoredCarPark[]>([]);
  const [available, setAvailable] = useState<CarParkLookup[]>([]);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const [m, a] = await Promise.all([
        api.getConfigCarParks(),
        api.lookupCarParks()
      ]);
      setMonitored(Array.isArray(m) ? m : []);
      setAvailable(Array.isArray(a) ? a : []);
    } catch (error) {
      console.error('Failed to load carpark config:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = async (cp: CarParkLookup) => {
    await api.addMonitoredCarPark(cp.facility_id, cp.facility_name);
    fetchData();
  };

  const handleRemove = async (facilityId: string) => {
    await api.removeMonitoredCarPark(facilityId);
    fetchData();
  };

  const filtered = (available || []).filter(cp => {
    const isMonitored = monitored.some(m => m.facility_id === cp.facility_id);
    const matchesSearch = (cp.facility_name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (cp.suburb?.toLowerCase().includes(search.toLowerCase()) ?? false);
    return !isMonitored && matchesSearch;
  });

  return (
    <div className="config-manager">
      <h3>Monitored Car Parks</h3>
      
      <div className="monitored-list">
        {(monitored || []).map(m => (
          <div key={m.facility_id} className="monitored-item">
            <div className="item-info">
              <Car size={16} />
              <span>{(m.facility_name || '').replace('Park&Ride - ', '')}</span>
            </div>
            <button className="remove-btn" onClick={() => handleRemove(m.facility_id)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {monitored.length === 0 && (
          <div className="empty-msg">No car parks monitored.</div>
        )}
      </div>

      <div className="search-box" style={{ marginTop: '1.5rem' }}>
        <div className="search-input">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search available car parks..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="available-list" style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '0.5rem' }}>
        {filtered.map(cp => (
          <div key={cp.facility_id} className="available-item">
            <div className="item-info">
              <strong>{(cp.facility_name || cp.facility_id || '').replace('Park&Ride - ', '')}</strong>
              {cp.suburb && <small>{cp.suburb}</small>}
            </div>
            <button className="add-btn" onClick={() => handleAdd(cp)}>
              <Plus size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
