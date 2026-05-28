import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { RefreshCw, ArrowRightLeft, ArrowDown, ArrowUp } from 'lucide-react';

interface CrossingPanel {
  id: string;
  name: string;
  stops: { id: string; name: string; platform: string; direction: 'Down' | 'Up' }[];
  singleLineSections: string[];
  waitingSections: string[];
  holdingSections: string[];
}

const PANELS: CrossingPanel[] = [
  {
    id: 'wollongong_north',
    name: 'Wollongong North',
    stops: [
      { id: '2508151', name: 'Coalcliff', platform: '1', direction: 'Up' },
      { id: '2508152', name: 'Coalcliff', platform: '2', direction: 'Down' },
      { id: '2515131', name: 'Scarborough', platform: '1', direction: 'Up' },
      { id: '2515132', name: 'Scarborough', platform: '2', direction: 'Down' },
    ],
    singleLineSections: [
      '627', '632-629', '640-633', '642'
    ],
    waitingSections: [
      '624-621', '622-619', '628', '626', '631-634', '637', '654', '643', '656', '665', '667', '647', '645', '660-653', '651-658'
    ],
    holdingSections: ['627', '632-629', '640-633', '642'] // These are the specific blocks that trigger IN SECTION
  }
];

export const Crossings: React.FC = () => {
  const [selectedPanelId, setSelectedPanelId] = useState(PANELS[0].id);
  const [sequence, setSequence] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedPanel = PANELS.find(p => p.id === selectedPanelId) || PANELS[0];

  const fetchData = async () => {
    setLoading(true);
    const now = Date.now();
    try {
      const results = await Promise.all([
        ...selectedPanel.stops.map(s => api.getDepartures(s.id)),
        api.getSCTrackData()
      ]);

      const trackData = results.pop() as any[];
      const departuresResults = results;

      const trainMap = new Map<string, any>();

      departuresResults.forEach((res, i) => {
        const currentStop = selectedPanel.stops[i];
        
        res.departures.forEach((dep: any) => {
          const runId = dep.runNumber;
          if (!runId || runId === '---') return;

          const isUp = dep.directionId === 1;
          const direction = isUp ? 'Up' : 'Down';
          const entryStationName = isUp ? 'Scarborough' : 'Coalcliff';
          const exitStationName = isUp ? 'Coalcliff' : 'Scarborough';

          if (!trainMap.has(runId)) {
            // Find track info for this train
            const trackInfo = trackData.find(t => t.runNumber === runId);

            trainMap.set(runId, {
              ...dep,
              direction,
              entryTime: null,
              exitTime: null,
              entryStation: entryStationName,
              exitStation: exitStationName,
              entryPlatform: '--',
              onEntryBoard: false,
              onExitBoard: false,
              isRealtime: !!dep.isRealtime,
              trackSection: trackInfo?.section || null,
              isFreight: false
            });
          }

          const train = trainMap.get(runId);

          if (currentStop.name === entryStationName) {
            train.onEntryBoard = true;
            train.entryTime = dep.time;
            train.entryPlatform = currentStop.platform;
          } else if (currentStop.name === exitStationName) {
            train.onExitBoard = true;
            train.exitTime = dep.time;
          }

          if (dep.isRealtime) train.isRealtime = true;

          // Fallback exit time from stopping pattern if not on exit board yet
          if (!train.exitTime) {
            const exitStop = dep.stoppingPattern?.find((s: any) => s.stopName.includes(exitStationName));
            if (exitStop) train.exitTime = exitStop.arrival || exitStop.departure;
          }
        });
      });

      // Add "Track Only" trains (Freight / Unscheduled)
      trackData.forEach(track => {
        if (!trainMap.has(track.runNumber)) {
          // Infer direction: Even run numbers are usually UP in NSW, Odd are DOWN.
          const runDigits = track.runNumber.match(/\d+/);
          const isEven = runDigits ? parseInt(runDigits[0]) % 2 === 0 : false;
          const direction = isEven ? 'Up' : 'Down'; 
          
          const isInSingleLine = selectedPanel.singleLineSections.some(s => track.section.includes(s));
          const isInWaiting = selectedPanel.waitingSections.some(s => track.section.includes(s));
          
          if (!isInSingleLine && !isInWaiting) return; 

          trainMap.set(track.runNumber, {
            tripId: track.tripId,
            runNumber: track.runNumber,
            direction,
            entryTime: track.timestamp, 
            exitTime: track.timestamp + 600000, 
            entryStation: direction === 'Up' ? 'Scarborough' : 'Coalcliff',
            exitStation: direction === 'Up' ? 'Coalcliff' : 'Scarborough',
            entryPlatform: 'F',
            onEntryBoard: false,
            onExitBoard: true,
            isRealtime: true,
            trackSection: track.section,
            routeShortName: 'FR',
            headsign: 'Freight Service',
            isFreight: true
          });
        }
      });

      // Refine Section Status based on board presence and live tracking
      const merged = Array.from(trainMap.values()).map(t => {
        // STRICT: Only these four blocks trigger IN SECTION
        const isInSingleLineSection = t.trackSection && (
          t.trackSection.includes('627') || 
          t.trackSection.includes('632-629') ||
          t.trackSection.includes('640-633') ||
          t.trackSection.includes('642')
        );
        
        // Tracking: All other sections from waitingSections list
        const isKnownTrackSection = t.trackSection && selectedPanel.waitingSections.some(s => t.trackSection.includes(s));
        
        // Detailed Path Tracking (Sidings/Refuge)
        const isSiding = t.trackSection && (t.trackSection.includes('637') || t.trackSection.includes('654'));
        const isRefuge = t.trackSection && (t.trackSection.includes('643') || t.trackSection.includes('656'));
        
        const inSection = t.isRealtime && isInSingleLineSection;
        
        return {
          ...t,
          inSection: !!inSection,
          isInSingleLineSection: !!isInSingleLineSection,
          isKnownTrackSection: !!isKnownTrackSection,
          isSiding: !!isSiding,
          isRefuge: !!isRefuge
        };
      });

      // Filter and Sort
      merged.sort((a, b) => {
        if (a.inSection && !b.inSection) return -1;
        if (!a.inSection && b.inSection) return 1;
        return (a.entryTime || 0) - (b.entryTime || 0);
      });

      setSequence(merged.filter(t => t.exitTime === null || t.exitTime > now - 15000).slice(0, 12));
      } catch (error) {
      console.error('Crossings fetch failed:', error);
      } finally {
      setLoading(false);
      }
      };

      const getStatus = (train: any, idx: number, seq: any[], now: number) => {
      if (train.inSection) {
        if (train.isSiding) return { label: 'IN SIDING', class: 'status-waiting' };
        if (train.isRefuge) return { label: 'IN REFUGE', class: 'status-waiting' };
        return { label: 'IN SECTION', class: 'status-active' };
      }

      const isApproachOnly = train.trackSection && (train.trackSection.includes('665') || train.trackSection.includes('667'));

      // Check if ANY other train is currently IN SECTION (excluding sidings/refuges)
      const sectionOccupied = seq.some(t => t.inSection && !t.isSiding && !t.isRefuge);

      const isAtPlatform = train.onEntryBoard && train.entryTime && (train.entryTime <= now + 60000) && (train.entryTime > now - 30000);
      
      // A train is WAITING if it's in a known approach/boundary section AND the single line is occupied
      if (!isApproachOnly && (train.isKnownTrackSection || isAtPlatform) && sectionOccupied) {
        return { label: 'WAITING', class: 'status-waiting' };
      }

      if (isAtPlatform) return { label: 'AT PLATFORM', class: 'status-waiting' };
      
      if (isApproachOnly) return { label: 'APPROACHING', class: 'status-approaching' };

      // If it's in a known section but not waiting for occupancy, it's the NEXT or APPROACHING
      if (train.isKnownTrackSection || idx === 0 || (seq[0]?.inSection && idx === 1)) {
        return { label: 'NEXT', class: 'status-next' };
      }

      return { label: 'APPROACHING', class: 'status-approaching' };
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
    }, 30000); // 30 seconds for crossings

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedPanelId]);

  return (
    <div className="crossings-container">
      <header className="view-header">
        <div className="header-left">
          <div className="panel-selector">
            <label>Section:</label>
            <select value={selectedPanelId} onChange={(e) => setSelectedPanelId(e.target.value)}>
              {PANELS.map(p => (
                <option key={p.id} value={p.id}>{p.name}: Coalcliff ↔ Scarborough</option>
              ))}
            </select>
          </div>
          <button 
            className={`refresh-btn ${loading ? 'spinning' : ''}`} 
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <div className="single-line-queue">
        <div className="queue-header">
          <ArrowRightLeft size={20} />
          <h2>Single Line Entry Sequence</h2>
          <span className="queue-hint">Sorted by predicted entry time</span>
        </div>

        <div className="queue-list">
          {sequence.map((train, idx) => {
            const now = Date.now();
            const status = getStatus(train, idx, sequence, now);
            return (
              <div key={`${train.tripId}-${idx}`} className={`queue-item ${train.direction.toLowerCase()} ${train.inSection ? 'highlight-active' : ''} ${train.isFreight ? 'freight-item' : ''}`}>
                <div className="queue-pos">{idx + 1}</div>
                
                <div className="queue-direction">
                  {train.direction === 'Down' ? <ArrowDown size={24} /> : <ArrowUp size={24} />}
                  <span className="dir-label">{train.direction}</span>
                </div>

                <div className="queue-main">
                  <div className="train-id-row">
                    <span className={`route-pill ${train.isFreight ? 'freight-pill' : ''}`}>{train.routeShortName}</span>
                    <span className="run-id">
                      {train.runNumber}
                      {train.isRealtime && <span className="live-dot" style={{ display: 'inline-block', marginLeft: '6px', marginBottom: '2px' }}></span>}
                    </span>
                    <div className={`status-badge ${status.class}`}>{status.label}</div>
                    {train.trackSection && (
                      <span className="track-section-badge" style={{ 
                        marginLeft: '8px', 
                        fontSize: '0.75rem', 
                        background: '#1e293b', 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        color: train.isInSingleLineSection ? '#38bdf8' : '#94a3b8',
                        fontFamily: 'monospace',
                        border: train.isInSingleLineSection ? '1px solid #0ea5e9' : 'none'
                      }}>
                        {train.trackSection}
                      </span>
                    )}
                  </div>
                  <div className="dest-label">{train.isFreight ? 'Freight Service' : `to ${formatStopName(train.headsign, true)}`}</div>
                </div>

                <div className="queue-section-times">
                  <div className="time-block entry">
                    <span className="label">Entry ({train.entryStation})</span>
                    <span className="val">
                      {train.onEntryBoard && train.entryTime
                        ? new Date(train.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                        : (train.isRealtime ? 'Passed' : '--:--')}
                    </span>
                  </div>
                  <div className="time-spacer">
                    <div className="line"></div>
                  </div>
                  <div className="time-block exit">
                    <span className="label">Exit ({train.exitStation})</span>
                    <span className="val">
                      {train.exitTime 
                        ? new Date(train.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                        : '--:--'}
                    </span>
                  </div>
                </div>

                <div className="queue-timing">
                  <div className="due-val">
                    {train.entryTime && train.entryTime > now 
                      ? `${Math.max(0, Math.floor((train.entryTime - now) / 60000))} min`
                      : '---'}
                  </div>
                </div>
              </div>
            );
          })}

          {sequence.length === 0 && !loading && (
            <div className="empty-state">No trains currently approaching this section.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const formatStopName = (name: string, isDestination: boolean = false) => {
  if (!name) return '';
  const clean = name.replace(/ Station/g, '');
  if (isDestination) {
    return clean.replace(/ Platform \d+/g, '');
  }
  return clean.replace(/ Platform /g, ' #');
};
