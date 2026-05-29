import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { RefreshCw, ArrowRightLeft, ArrowDown, ArrowUp } from 'lucide-react';

interface CrossingPanel {
  id: string;
  name: string;
  routeLabel: string;
  stops: { id: string; name: string; platform: string; direction: 'Down' | 'Up' }[];
  entryStations: { Down: string; Up: string };
  singleLineSections: string[];
  waitingSections: string[];
  holdingSections: { Down: string[]; Up: string[] };
  approachSections: { Down: string[]; Up: string[] };
  approachStationPrefixes: { Down: string; Up: string };
  exitSections: { Down: string[]; Up: string[] };
  exitStationPrefixes: { Down: string[]; Up: string[] };
}

const PANELS: CrossingPanel[] = [
  {
    id: 'wollongong_north',
    name: 'Wollongong North',
    routeLabel: 'Coalcliff ↔ Scarborough',
    stops: [
      { id: '2508151', name: 'Coalcliff', platform: '1', direction: 'Up' },
      { id: '2508152', name: 'Coalcliff', platform: '2', direction: 'Down' },
      { id: '2515131', name: 'Scarborough', platform: '1', direction: 'Up' },
      { id: '2515132', name: 'Scarborough', platform: '2', direction: 'Down' },
    ],
    entryStations: { Down: 'Coalcliff', Up: 'Scarborough' },
    singleLineSections: [
      '627', '632-629', '640-633', '642'
    ],
    waitingSections: [
      '624-621', '622-619', '628', '626', '631-634', '637', '654', '643', '656', '665', '667', '647', '645', '660-653', '651-658', 'OTFD', 'THRL', 'HELS',
      'Otford', 'Thirroul', 'Helensburgh', 'Coalcliff', 'Scarborough', 'Wollongong'
    ],
    holdingSections: {
      Up: ['628', '626', '624', '622'],
      Down: ['653', '658', '660']
    },
    approachSections: {
      Up: ['616', '619', '622', '624', '626', '628'],
      Down: ['665', '667', '647', '645', '660', '651', '658']
    },
    approachStationPrefixes: {
      Up: 'THRL',
      Down: 'OTFD'
    },
    exitSections: {
      Up: ['645', '647', '665', '667', '660', '651', '658'],
      Down: ['626', '624', '622', '619', '616']
    },
    exitStationPrefixes: {
      Up: ['OTFD', 'HELS', 'Otford', 'Helensburgh'],
      Down: ['THRL', 'WOLL', 'Thirroul', 'Wollongong']
    }
  },
  {
    id: 'wollongong_south',
    name: 'Wollongong South',
    routeLabel: 'Coniston ↔ Unanderra North',
    stops: [
      { id: '2500371', name: 'Coniston', platform: '1', direction: 'Up' },
      { id: '2500372', name: 'Coniston', platform: '2', direction: 'Down' },
      { id: '2526171', name: 'Unanderra', platform: '2', direction: 'Up' },
      { id: '2526172', name: 'Unanderra', platform: '1', direction: 'Down' },
    ],
    entryStations: { Down: 'Coniston', Up: 'Unanderra' },
    singleLineSections: [
      'WOLL-112', 'WOLL-1007'
    ],
    waitingSections: [
      'WOLL-406-121', 'WOLL-408-125', 'UNAN-1016', 'UNAN-1018', 'Coniston', 'Unanderra', 'Wollongong'
    ],
    holdingSections: {
      Up: [],
      Down: []
    },
    approachSections: {
      Up: ['UNAN-1016', 'UNAN-1018'],
      Down: ['WOLL-406-121', 'WOLL-408-125']
    },
    approachStationPrefixes: {
      Up: 'DO41',
      Down: 'WOLL'
    },
    exitSections: {
      Up: ['WOLL-406-121', 'WOLL-408-125'],
      Down: ['UNAN-1016', 'UNAN-1018']
    },
    exitStationPrefixes: {
      Up: ['WOLL', 'Wollongong'],
      Down: ['DAPTO', 'KIAMA', 'Dapto', 'Kiama']
    }
  }
];

const getPassengerInfo = (run: string): { direction: 'Up' | 'Down' } | null => {
  const runUpper = run.toUpperCase().replace(/-/g, '');
  if (runUpper.startsWith('RC')) return { direction: 'Down' }; 
  if (runUpper.startsWith('M67') || runUpper.startsWith('CM')) {
     return { direction: /[02468]$/.test(runUpper) ? 'Up' : 'Down' };
  }
  const match = runUpper.match(/^([A-Z]*)(\d+)$/);
  if (!match) return null;
  const prefix = match[1];
  const numStr = match[2];
  const num = parseInt(numStr);
  const isEven = num % 2 === 0;
  if (['C', 'P', 'S'].includes(prefix)) {
    if (num >= 400 && num <= 499) return { direction: 'Up' };
    if (num >= 600 && num <= 699) return { direction: 'Down' };
  }
  if (prefix === 'K') return { direction: isEven ? 'Up' : 'Down' };
  if (['KN', 'CN', 'KU', 'CU'].includes(prefix)) return { direction: isEven ? 'Up' : 'Down' };
  if (['C', 'H', 'N', 'W', 'S'].includes(prefix)) {
     if (numStr.length === 3 || numStr.length === 4) return { direction: isEven ? 'Up' : 'Down' };
  }
  if (prefix === '') {
    if (numStr.length === 3 || numStr.length === 4) return { direction: isEven ? 'Up' : 'Down' };
  }
  return null;
};

const isUpFreight = (run: string) => /^MC\d[13579]$/.test(run) || /^9\d{3}$/.test(run) || /^\d(WB|WM|MB)\d$/i.test(run);
const isDownFreight = (run: string) => /^\d9\d{2}$/.test(run) || /^MC\d[02468]$/.test(run) || /\d+\s?(BW|MW|BM)\s?\d+/i.test(run);
const isFreightRun = (run: string) => isUpFreight(run) || isDownFreight(run);

const inferDirection = (runNumber: string, headsign?: string): 'Up' | 'Down' => {
  if (isUpFreight(runNumber)) return 'Up';
  if (isDownFreight(runNumber)) return 'Down';
  const passInfo = getPassengerInfo(runNumber);
  if (passInfo) return passInfo.direction;
  const cleanHeadsign = (headsign || '').toLowerCase();
  const upKeywords = ['central', 'waterfall', 'bondi', 'martin place', 'hurstville', 'cronulla', 'sutherland', 'town hall', 'north sydney', 'museum', 'st james', 'wynyard'];
  const downKeywords = ['kiama', 'port kembla', 'wollongong', 'dapto', 'bomaderry', 'coniston', 'thirroul', 'berry', 'albion park', 'unanderra', 'shellharbour'];
  if (upKeywords.some(k => cleanHeadsign.includes(k))) return 'Up';
  if (downKeywords.some(k => cleanHeadsign.includes(k))) return 'Down';
  const runDigitsMatch = runNumber.match(/\d+/);
  if (runDigitsMatch) {
      const lastDigit = parseInt(runDigitsMatch[0].slice(-1));
      return lastDigit % 2 === 0 ? 'Up' : 'Down';
  }
  return 'Down';
};

const matchesSection = (trackSection: string | null, target: string) => {
  if (!trackSection) return false;
  const segments = trackSection.split(/[-.]/);
  return segments.includes(target);
};

export const Crossings: React.FC = () => {
  const [selectedPanelId, setSelectedPanelId] = useState(PANELS[0].id);
  const [sequence, setSequence] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fastPolling, setFastPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const selectedPanel = PANELS.find(p => p.id === selectedPanelId) || PANELS[0];

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await Promise.all([
        ...selectedPanel.stops.map(s => api.getDepartures(s.id)),
        api.getSCTrackData()
      ]);

      setLastUpdated(new Date());
      const trackData = results.pop() as any[];
      
      const needsFastPolling = trackData.some(t => {
        const dir = inferDirection(t.runNumber, t.headsign);
        const section = t.section || '';
        const isInSingleLine = selectedPanel.singleLineSections.some(s => matchesSection(section, s));
        if (isInSingleLine) return true;

        const isCriticalDown = selectedPanel.approachSections.Down.some(s => matchesSection(section, s));
        const isCriticalUp = selectedPanel.approachSections.Up.some(s => matchesSection(section, s));

        if (dir === 'Down' && isCriticalDown) return true;
        if (dir === 'Up' && isCriticalUp) return true;
        
        return false;
      });
      setFastPolling(needsFastPolling);

      const departuresResults = results;
      const trainMap = new Map<string, any>();

      departuresResults.forEach((res, i) => {
        const currentStop = selectedPanel.stops[i];
        res.departures.forEach((dep: any) => {
          const runId = dep.runNumber;
          if (!runId || runId === '---') return;

          const direction = inferDirection(runId, dep.headsign);
          const isUp = direction === 'Up';
          const entryStationName = selectedPanel.entryStations[direction];
          const exitStationName = selectedPanel.entryStations[isUp ? 'Down' : 'Up'];

          if (!trainMap.has(runId)) {
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
              trackSection: trackInfo?.section || dep.trackSection || null,
              isFreight: isFreightRun(runId),
              entryDelay: 0,
              exitDelay: 0
            });
          }

          const train = trainMap.get(runId);
          if (currentStop.name === entryStationName) {
            train.onEntryBoard = true;
            train.entryTime = dep.time;
            train.entryPlatform = currentStop.platform;
            train.entryDelay = dep.delay || 0;
          } else if (currentStop.name === exitStationName) {
            train.onExitBoard = true;
            train.exitTime = dep.time;
            train.exitDelay = dep.delay || 0;
          }
          if (dep.isRealtime) train.isRealtime = true;

          if (!train.exitTime) {
            const exitStop = dep.stoppingPattern?.find((s: any) => s.stopName.includes(exitStationName));
            if (exitStop) {
              train.exitTime = exitStop.arrival || exitStop.departure;
              // If it's the same trip, assume similar delay if not explicitly provided
              if (train.exitDelay === 0) train.exitDelay = dep.delay || 0;
            }
          }
        });
      });

      trackData.forEach(track => {
        if (!trainMap.has(track.runNumber)) {
          const direction = inferDirection(track.runNumber, track.headsign);
          const isInSingleLine = selectedPanel.singleLineSections.some(s => matchesSection(track.section, s));
          const isInWaiting = selectedPanel.waitingSections.some(s => track.section.includes(s));
          const hasStationPrefix = [selectedPanel.approachStationPrefixes.Down, selectedPanel.approachStationPrefixes.Up, ...selectedPanel.exitStationPrefixes.Down, ...selectedPanel.exitStationPrefixes.Up].some(p => track.section.startsWith(p));
          
          if (!isInSingleLine && !isInWaiting && !hasStationPrefix) return; 

          const isFreight = isFreightRun(track.runNumber);
          const isSCO = track.runNumber.startsWith('C');

          const entryStationName = selectedPanel.entryStations[direction];
          const exitStationName = selectedPanel.entryStations[direction === 'Up' ? 'Down' : 'Up'];

          trainMap.set(track.runNumber, {
            tripId: track.tripId,
            runNumber: track.runNumber,
            direction,
            entryTime: track.timestamp + (isInSingleLine ? 0 : 300000), 
            exitTime: track.timestamp + 900000, 
            entryStation: entryStationName,
            exitStation: exitStationName,
            entryPlatform: isFreight ? 'F' : '--',
            onEntryBoard: false,
            onExitBoard: true,
            isRealtime: true,
            trackSection: track.section,
            routeShortName: isFreight ? 'FR' : (isSCO ? 'SCO' : 'T'),
            headsign: track.headsign || (isFreight ? 'Freight Service' : 'Passenger Service'),
            isFreight: isFreight
          });
        }
      });

      const merged = Array.from(trainMap.values()).map(t => {
        const physicalSingleLine = t.trackSection && (
          selectedPanel.singleLineSections.some(s => matchesSection(t.trackSection, s)) ||
          // Include logical Down entry points as physical single line for layout consistency (specific to North)
          (selectedPanel.id === 'wollongong_north' && t.direction === 'Down' && (matchesSection(t.trackSection, '645') || matchesSection(t.trackSection, '647')))
        );
        const isKnownTrackSection = t.trackSection && selectedPanel.waitingSections.some(s => t.trackSection.includes(s));
        const isSiding = t.trackSection && (t.trackSection.includes('637') || t.trackSection.includes('654'));
        const isRefuge = t.trackSection && (t.trackSection.includes('643') || t.trackSection.includes('656'));
        
        return {
          ...t,
          physicalSingleLine: !!physicalSingleLine,
          isKnownTrackSection: !!isKnownTrackSection,
          isSiding: !!isSiding,
          isRefuge: !!isRefuge
        };
      });

      const nowTs = Date.now();
      const filtered = merged.filter(t => {
        // Filter out 'K' trains as they typically terminate at Thirroul and don't cross to Coalcliff (specific to North)
        if (selectedPanel.id === 'wollongong_north' && t.runNumber.startsWith('K')) return false;

        // Wollongong South specific validation: Must strictly traverse the section
        if (selectedPanel.id === 'wollongong_south') {
           // 1. Up trains must have come from Unanderra (prevents PK branch trains appearing at Coniston)
           if (t.direction === 'Up' && !t.onEntryBoard && !t.physicalSingleLine) return false;

           // 2. Down trains must be heading to Unanderra (prevents PK branch trains and terminators)
           if (t.direction === 'Down' && !t.onExitBoard && !t.physicalSingleLine) {
             const goesToUnanderra = t.stoppingPattern?.some((s: any) => s.stopName.includes('Unanderra'));
             if (!goesToUnanderra) return false;
           }

           // 3. General Port Kembla headsign filter
           if (t.headsign.toLowerCase().includes('port kembla')) return false;
        }

        const isPastCrossing = t.trackSection && (
          (t.direction === 'Up' && (
            selectedPanel.exitStationPrefixes.Up.some(p => t.trackSection.startsWith(p)) ||
            selectedPanel.exitSections.Up.some(s => matchesSection(t.trackSection, s))
          )) ||
          (t.direction === 'Down' && (
            selectedPanel.exitStationPrefixes.Down.some(p => t.trackSection.startsWith(p)) ||
            selectedPanel.exitSections.Down.some(s => matchesSection(t.trackSection, s))
          ))
        );
        const hasExited = t.onExitBoard && !t.physicalSingleLine && (isPastCrossing || (t.exitTime && t.exitTime < nowTs - 30000));
        return !hasExited;
      });

      filtered.sort((a, b) => {
        if (a.physicalSingleLine && !b.physicalSingleLine) return -1;
        if (!a.physicalSingleLine && b.physicalSingleLine) return 1;
        
        const timeA = a.entryTime || (a.exitTime ? a.exitTime - 300000 : null) || (nowTs + 86400000);
        const timeB = b.entryTime || (b.exitTime ? b.exitTime - 300000 : null) || (nowTs + 86400000);
        
        return timeA - timeB;
      });

      setSequence(filtered.slice(0, 12));
      } catch (error) {
      console.error('Crossings fetch failed:', error);
      } finally {
      setLoading(false);
      }
  };

  const getStatus = (train: any, idx: number, seq: any[], now: number) => {
    const sectionOccupied = seq.some(t => t.physicalSingleLine && !t.isSiding && !t.isRefuge);
    const isLogicalDownEntry = selectedPanel.id === 'wollongong_north' && train.direction === 'Down' && !sectionOccupied && (train.trackSection?.includes('645') || train.trackSection?.includes('647'));

    if (train.physicalSingleLine || isLogicalDownEntry) {
      if (train.isSiding) return { label: 'IN SIDING', class: 'status-waiting' };
      if (train.isRefuge) return { label: 'IN REFUGE', class: 'status-waiting' };
      return { label: 'IN SECTION', class: 'status-active' };
    }

    const isAtHoldingPoint = train.trackSection && (
      (train.direction === 'Up' && (selectedPanel.holdingSections.Up.some(s => matchesSection(train.trackSection, s)))) ||
      (train.direction === 'Down' && (selectedPanel.holdingSections.Down.some(s => matchesSection(train.trackSection, s))))
    );

    const isAtPlatform = (train.onEntryBoard && train.entryTime && (train.entryTime <= now + 60000) && (isAtHoldingPoint || train.trackSection?.includes(train.entryStation))) || isAtHoldingPoint;
    
    // Detect Approach Range
    const sectionMatch = train.trackSection?.match(/([A-Z]+)-(\d+)/);
    let inApproachRange = false;
    if (sectionMatch) {
      const prefix = sectionMatch[1];
      const num = parseInt(sectionMatch[2]);
      
      if (selectedPanel.id === 'wollongong_north') {
        if (train.direction === 'Down' && prefix === 'OTFD' && num <= 699) inApproachRange = true;
        if (train.direction === 'Up' && prefix === 'THRL' && num >= 598) inApproachRange = true;
      }

      if (train.direction === 'Up' && selectedPanel.approachSections.Up.some(s => matchesSection(train.trackSection, s))) inApproachRange = true;
      if (train.direction === 'Down' && selectedPanel.approachSections.Down.some(s => matchesSection(train.trackSection, s))) inApproachRange = true;
      
    } else if (train.trackSection) {
      if (train.direction === 'Down' && train.trackSection === selectedPanel.stops.find(s => s.direction === 'Down')?.name) inApproachRange = true;
      if (train.direction === 'Up' && train.trackSection === selectedPanel.stops.find(s => s.direction === 'Up')?.name) inApproachRange = true;
      
      // Additional check for approach station prefix
      if (train.direction === 'Down' && train.trackSection.startsWith(selectedPanel.approachStationPrefixes.Down)) inApproachRange = true;
      if (train.direction === 'Up' && train.trackSection.startsWith(selectedPanel.approachStationPrefixes.Up)) inApproachRange = true;
    }

    const isApproachOnly = selectedPanel.id === 'wollongong_north' && train.trackSection && (train.trackSection.includes('665') || train.trackSection.includes('667'));
    const isApproaching = isApproachOnly || inApproachRange;

    const conflictingTrain = seq.find(other => 
      other.runNumber !== train.runNumber && 
      other.direction !== train.direction &&
      !other.physicalSingleLine &&
      train.entryTime && other.entryTime &&
      Math.abs(train.entryTime - other.entryTime) < 180000 
    );

    // DECISION NEEDED only if approaching or at platform
    if (conflictingTrain && !sectionOccupied && !isLogicalDownEntry && (isApproaching || isAtPlatform)) {
      return { label: 'DECISION NEEDED', class: 'status-conflict', isConflict: true };
    }

    if (isAtPlatform && (sectionOccupied || isLogicalDownEntry)) {
      return { label: 'WAITING', class: 'status-waiting' };
    }

    if (isApproachOnly) return { label: 'APPROACHING', class: 'status-waiting' };

    if (isAtPlatform) return { label: 'AT PLATFORM', class: 'status-waiting' };

    const isNext = idx === 0 || (seq[0]?.physicalSingleLine && idx === 1);
    if (isNext) return { label: 'NEXT', class: 'status-next' };
    
    if (inApproachRange) return { label: 'APPROACHING', class: 'status-approaching' };
    return { label: 'EN ROUTE', class: 'status-approaching' };
  };

  useEffect(() => {
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') fetchData(); };
    fetchData();
    const intervalTime = fastPolling ? 10000 : 30000;
    const interval = setInterval(() => { if (document.visibilityState === 'visible') fetchData(); }, intervalTime);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', handleVisibilityChange); };
  }, [selectedPanelId, fastPolling]);

  return (
    <div className="crossings-container">
      <header className="view-header">
        <div className="header-left">
          <div className="panel-selector">
            <label>Section:</label>
            <select value={selectedPanelId} onChange={(e) => setSelectedPanelId(e.target.value)}>
              {PANELS.map(p => (
                <option key={p.id} value={p.id}>{p.name}: {p.routeLabel}</option>
              ))}
            </select>
          </div>
          <div className="header-right-meta">
            {lastUpdated && <span className="last-updated-tag">UPDATED: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>}
            <span className={`poll-status ${fastPolling ? 'fast' : ''}`}>{fastPolling ? 'FAST (10s)' : 'NORMAL (30s)'}</span>
            <button className={`refresh-btn ${loading ? 'spinning' : ''}`} onClick={fetchData} disabled={loading}><RefreshCw size={18} /></button>
          </div>
        </div>
      </header>
      <div className="single-line-queue">
        <div className="queue-header">
          <ArrowRightLeft size={20} />
          <h2>Single Line: {selectedPanel.routeLabel}</h2>
          <span className="queue-hint">Sorted by predicted entry time</span>
        </div>
        <div className="queue-list">
          {sequence.map((train, idx) => {
            const now = Date.now();
            const status = getStatus(train, idx, sequence, now);
            const isConflict = (status as any).isConflict;
            return (
              <div key={`${train.tripId}-${idx}`} className={`queue-item ${train.direction.toLowerCase()} ${train.physicalSingleLine ? 'highlight-active' : ''} ${isConflict ? 'highlight-conflict' : ''} ${train.isFreight ? 'freight-item' : ''} ${train.isEmpty ? 'empty-item' : ''}`}>
                <div className="queue-pos">{idx + 1}</div>
                <div className="queue-direction">{train.direction === 'Down' ? <ArrowDown size={24} /> : <ArrowUp size={24} />}<span className="dir-label">{train.direction}</span></div>
                <div className="queue-main">
                  <div className="train-id-row">
                    {train.isEmpty ? (
                      <span className="route-pill status-waiting empty-badge-pill">EMPTY</span>
                    ) : (
                      <span className={`route-pill ${train.isFreight ? 'freight-pill' : ''}`}>{train.routeShortName}</span>
                    )}
                    <span className="run-id">{train.runNumber}{train.isRealtime && <span className="live-dot"></span>}</span>
                    <div className={`status-badge ${status.class}`}>{status.label}</div>
                    {train.trackSection ? (
                      <span className="track-section-badge">{train.trackSection}</span>
                    ) : (
                      <span className="track-section-badge unknown-loc">Location Not Known</span>
                    )}
                  </div>
                  <div className="dest-label">{train.isFreight ? 'Freight Service' : (train.isEmpty ? 'Empty Service' : `to ${formatStopName(train.headsign, true)}`)}</div>
                </div>
                <div className="queue-section-times">
                  <div className="time-block entry">
                    <span className="label">Entry ({train.entryStation})</span>
                    <span className="val-container">
                      <span className="val">
                        {(train.onEntryBoard || (train.isFreight && train.entryTime && train.entryTime > now)) && train.entryTime 
                          ? new Date(train.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
                          : (train.isRealtime ? 'Passed' : '--:--')}
                      </span>
                      {train.isRealtime && train.entryDelay !== undefined && Math.floor(train.entryDelay / 60) > 0 && (
                        <span className={`delay-tag ${Math.floor(train.entryDelay / 60) >= 5 ? 'delay-red' : Math.floor(train.entryDelay / 60) >= 2 ? 'delay-orange' : 'delay-green'}`}>
                          ({Math.floor(train.entryDelay / 60)})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="time-spacer"><div className="line"></div></div>
                  <div className="time-block exit">
                    <span className="label">Exit ({train.exitStation})</span>
                    <span className="val-container">
                      <span className="val">
                        {train.exitTime ? new Date(train.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                      </span>
                      {train.isRealtime && train.exitDelay !== undefined && Math.floor(train.exitDelay / 60) > 0 && (
                        <span className={`delay-tag ${Math.floor(train.exitDelay / 60) >= 5 ? 'delay-red' : Math.floor(train.exitDelay / 60) >= 2 ? 'delay-orange' : 'delay-green'}`}>
                          ({Math.floor(train.exitDelay / 60)})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="queue-timing"><div className="due-val">{train.entryTime && train.entryTime > now ? `${Math.max(0, Math.floor((train.entryTime - now) / 60000))} min` : '---'}</div></div>
              </div>
            );
          })}
          {sequence.length === 0 && !loading && <div className="empty-state">No trains currently approaching this section.</div>}
        </div>
      </div>
    </div>
  );
};

const formatStopName = (name: string, isDestination: boolean = false) => {
  if (!name) return '';
  const clean = name.replace(/ Station/g, '');
  if (isDestination) return clean.replace(/ Platform \d+/g, '');
  return clean.replace(/ Platform /g, ' #');
};
