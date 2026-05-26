import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface Alert {
  id: string;
  alert: {
    headerText: { translation: { text: string }[] };
    descriptionText: { translation: { text: string }[] };
    activePeriod?: { start?: string, end?: string }[];
    cause?: string | number;
    effect?: string | number;
    informedEntity?: { routeId?: string, stopId?: string }[];
  };
}

interface AlertsPanelProps {
  alerts: Alert[];
  title?: string;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, title = 'Network Alerts & Trackwork' }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const alertsList = Array.isArray(alerts) ? alerts : [];

  // Group alerts by line/route
  const groupedAlerts: Record<string, Alert[]> = {};
  
  alertsList.forEach(a => {
    let groupName = 'General Network';
    const firstEntity = a.alert.informedEntity?.[0];
    if (firstEntity?.routeId) {
      groupName = firstEntity.routeId.split('_')[0]; 
    }
    if (!groupedAlerts[groupName]) groupedAlerts[groupName] = [];
    groupedAlerts[groupName].push(a);
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const isTrackwork = (alert: Alert['alert']) => {
    return (alert.cause === 7 || alert.cause === 'MAINTENANCE') && 
           (alert.effect === 6 || alert.effect === 'MODIFIED_SERVICE');
  };

  const formatPeriod = (periods?: { start?: string, end?: string }[]) => {
    if (!periods || periods.length === 0) return null;
    const first = periods[0];
    if (!first.start) return null;
    
    const start = new Date(Number(first.start) * 1000);
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    };
    
    if (first.end) {
      const end = new Date(Number(first.end) * 1000);
      return `${start.toLocaleDateString([], options)} - ${end.toLocaleDateString([], options)}`;
    }
    
    return `Active from ${start.toLocaleDateString([], options)}`;
  };

  return (
    <div className="alerts-panel full-width">
      <h3>{title}</h3>
      <div className="alerts-groups">
        {Object.keys(groupedAlerts).length === 0 ? (
          <div className="empty-alerts">No active notifications for this category.</div>
        ) : (
          Object.entries(groupedAlerts).map(([groupName, groupAlerts]) => (
            <div key={groupName} className="alert-group-box">
              <h4 className="group-title">{groupName}</h4>
              <div className="group-content">
                {groupAlerts.map((entity) => {
                  const isExpanded = expandedIds.has(entity.id);
                  const trackwork = isTrackwork(entity.alert);
                  
                  return (
                    <div key={entity.id} className={`alert-card ${trackwork ? 'trackwork' : ''}`}>
                      <div className="alert-header" onClick={() => toggleExpand(entity.id)}>
                        <div className="alert-icon">
                          <AlertTriangle size={20} color={trackwork ? "#3b82f6" : "#ffcc00"} />
                        </div>
                        <div className="alert-title-group">
                          <strong>
                            {trackwork && <span className="trackwork-badge">TRACKWORK</span>}
                            {entity.alert.headerText.translation[0]?.text}
                          </strong>
                          <div className="alert-date">
                            {formatPeriod(entity.alert.activePeriod)}
                          </div>
                        </div>
                        <div className="expand-icon">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="alert-details">
                          <div 
                            className="details-content"
                            dangerouslySetInnerHTML={{ 
                              __html: entity.alert.descriptionText.translation[1]?.text || 
                                      entity.alert.descriptionText.translation[0]?.text || '' 
                            }} 
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
