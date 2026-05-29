import React, { useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Info, AlertTriangle } from 'lucide-react';

interface StopUpdate {
  stopId: string;
  stopName: string;
  arrival: number | null;
  departure: number | null;
}

interface Departure {
  tripId: string;
  runNumber: string;
  setInfo: string;
  routeShortName: string;
  headsign: string;
  time: number;
  delay: number;
  isRealtime: boolean;
  isEmpty?: boolean;
  stoppingPattern: StopUpdate[];
  relatedServices?: string[];
  activeAlerts?: string[];
}

interface DepartureBoardProps {
  stopName: string;
  departures: Departure[];
  hideHeader?: boolean;
}

export const DepartureBoard: React.FC<DepartureBoardProps> = ({ stopName, departures, hideHeader }) => {
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());

  const toggleTrip = (tripId: string) => {
    const newExpanded = new Set(expandedTrips);
    if (newExpanded.has(tripId)) {
      newExpanded.delete(tripId);
    } else {
      newExpanded.add(tripId);
    }
    setExpandedTrips(newExpanded);
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '---';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getMinutesAway = (timestamp: number) => {
    if (!timestamp) return 0;
    const diff = timestamp - Date.now();
    return Math.max(0, Math.floor(diff / 60000));
  };

  return (
    <div className="departure-board">
      {!hideHeader && (
        <div className="board-header">
          <h2>{stopName || 'Select a Stop'}</h2>
          <div className="current-time">
            <Clock size={18} /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
          </div>
        </div>
      )}

      <div className="departures-list">
        {departures.length === 0 ? (
          <div className="empty-state">No upcoming departures found.</div>
        ) : (
          departures.map((dep, index) => {
            const isExpanded = expandedTrips.has(dep.tripId);
            return (
              <div key={`${dep.tripId}-${index}`} className="departure-group">
                <div className="departure-item" onClick={() => toggleTrip(dep.tripId)}>
                  <div className={`route-badge ${dep.isEmpty ? 'empty-badge-pill' : ''}`}>
                    {dep.isEmpty ? 'EMPTY' : dep.routeShortName}
                  </div>
                  <div className="departure-main">
                    <div className="destination" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {dep.headsign}
                      {dep.isRealtime && <span className="live-tag">LIVE</span>}
                      {dep.activeAlerts && dep.activeAlerts.length > 0 && (
                        <div className="alert-icon-wrapper" title={dep.activeAlerts.join('\n\n')}>
                          <AlertTriangle size={16} color="#ffcc00" />
                        </div>
                      )}
                    </div>
                    <div className="trip-meta">
                      <span className="run-number">Run: {dep.runNumber}</span>
                      <span className="set-info">Set: {dep.setInfo}</span>
                    </div>
                    {dep.relatedServices && dep.relatedServices.length > 0 && (
                      <div className="related-services">
                        <Info size={12} />
                        <span>{dep.relatedServices.join(', ')}</span>
                      </div>
                    )}
                  </div>
                  <div className="timing">
                    <div className="time">{formatTime(dep.time)}</div>
                    <div className="minutes">
                      {getMinutesAway(dep.time)} min
                      {dep.delay !== 0 && (
                        <span className={`delay ${dep.delay > 0 ? 'late' : 'early'}`}>
                          ({dep.delay > 0 ? `+${Math.round(dep.delay / 60)}` : Math.round(dep.delay / 60)}m)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="expand-trigger">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {isExpanded && dep.stoppingPattern && (
                  <div className="stopping-pattern">
                    <h4>Upcoming Stops</h4>
                    <ul>
                      {dep.stoppingPattern.map((stop, sIdx) => (
                        <li key={`${stop.stopId}-${sIdx}`}>
                          <span className="stop-name">{stop.stopName}</span>
                          <span className="stop-time">
                            {formatTime(stop.arrival || stop.departure || 0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
