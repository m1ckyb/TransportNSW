/**
 * Utility to map TfNSW run numbers to train types and descriptions.
 * Based on South Coast line specifications.
 */

export function getTrainTypeFromRun(run: string): string | null {
  if (!run) return null;

  // Intercity / Oscar
  if (/^C0[0-9]{2}$/.test(run)) return "Intercity (V set) / Oscar (H set)";
  if (/^C1[0-9]{2}$/.test(run)) return "Oscar (H set)";
  
  // Oscar / Suburban
  if (/^C3[0-9]{2}$/.test(run)) return "Oscar (H set) / Suburban";
  if (/^3[0-9]{2}$/.test(run)) return "Oscar (H set) / Suburban";
  
  // Mariyung (D set) - 10 car (4 leading) - Up Direction
  if (/^C4[0-8][0-9]$/.test(run)) return "Mariyung (D set) 10-car (4 lead)";
  if (/^P4[0-9]{2}$/.test(run)) return "Mariyung (D set) 10-car (4 lead) STN";
  if (/^C49[0-9]$/.test(run)) return "Mariyung (D set) 10-car (4 lead) Transp.";
  
  // Oscar - South Coast
  if (/^4[0-9]{2}$/.test(run)) return "Oscar (H set)";

  // Mariyung (D set) - 10 car (6 leading) - Down Direction
  if (/^C6[0-8][0-9]$/.test(run)) return "Mariyung (D set) 10-car (6 lead)";
  if (/^P6[0-9]{2}$/.test(run)) return "Mariyung (D set) 10-car (6 lead) STN";
  if (/^C69[0-9]$/.test(run)) return "Mariyung (D set) 10-car (6 lead) Transp.";

  // Mariyung (D set) - 4, 6 or 8 car
  if (/^C7[0-9]{2}$/.test(run)) return "Mariyung (D set) 4/6-car";
  if (/^C8[0-9]{2}$/.test(run)) return "Mariyung (D set) 8-car";

  // Oscar / Suburban - Coalcliff area
  if (/^K3[0-9]{2}$/.test(run)) return "Oscar (H set) / Suburban";
  if (/^K4[0-9]{2}$/.test(run)) return "Oscar (H set)";
  if (/^K7[0-9]{2}$/.test(run)) return "Oscar (H set) / Suburban (Shunt)";

  // Empty Mariyung (D set)
  if (/^S4[0-8][0-9]$/.test(run)) return "Empty Mariyung (D set) 10-car (4 lead)";
  if (/^S49[0-9]$/.test(run)) return "Empty Mariyung (D set) 10-car (4 lead) Transp.";
  if (/^S6[0-8][0-9]$/.test(run)) return "Empty Mariyung (D set) 10-car (6 lead)";
  if (/^S69[0-9]$/.test(run)) return "Empty Mariyung (D set) 10-car (6 lead) Transp.";
  if (/^S7[0-9]{2}$/.test(run)) return "Empty Mariyung (D set) 4/6-car";
  if (/^S8[0-9]{2}$/.test(run)) return "Empty Mariyung (D set) 8-car";

  // Endeavour
  if (/^KN[0-9]{2}$/.test(run)) return "Endeavour";
  if (/^KN-[1-9]$/.test(run)) return "Endeavour (Berry Stock Sidings)";
  if (/^CN[0-9]{2}$/.test(run)) return "Endeavour";

  // Regional Intercity (R set)
  if (/^KU-[1-9]$|^KU10$/.test(run)) return "Regional Intercity (R set) (Berry)";
  if (/^KU(1[1-9]|[2-8][0-9])$/.test(run)) return "Regional Intercity (R set)";
  if (/^KU9[0-9]$/.test(run)) return "Regional Intercity (R set) (DWTT)";
  if (/^CU[0-9]{2}$/.test(run)) return "Regional Intercity (R set)";

  // Miscellaneous / Track Vehicles
  if (/^RC/.test(run)) return "Road Coach";
  if (/^M67/.test(run)) return "Hi-Rail Vehicle (Track Insp)";
  if (/^CH[0-9]{2}$/.test(run)) return "Additional Train";

  // Track Inspection Cars (AK / Mechanised) (AANN)
  if (/^[SWNCH][KM][1-9][0-9]$/.test(run)) {
    const areas: Record<string, string> = {
      'S': 'South', 'W': 'West', 'N': 'North', 'C': 'Illawarra', 'H': 'Suburban'
    };
    const types: Record<string, string> = {
      'K': 'AK Track Inspection',
      'M': 'Mechanised Track Inspection'
    };
    const area = areas[run[0]];
    const type = types[run[1]];
    const direction = parseInt(run[3]) % 2 === 0 ? "Up" : "Down";
    return `${type} (${area}) ${direction}`;
  }

  // Heritage Operator Tours (NANN)
  if (/^[4-9][ELJRSZDX][0-9]{2}$/.test(run)) {
    const operators: Record<string, string> = {
      '4': "Lithgow State Mine",
      '5': "3801 Limited",
      '6': "NSW Rail Museum",
      '7': "Rail Motor Society",
      '8': "Lachlan Valley Railway",
      '9': "Sydney Rail Services"
    };
    const types: Record<string, string> = {
      'E': "Electric Hauled",
      'L': "Diesel Hauled",
      'J': "Single Diesel Car",
      'R': "DMU / Rail Motor",
      'S': "Steam Hauled",
      'Z': "Light Steam Loco",
      'D': "Light Diesel Loco",
      'X': "Light Electric Loco"
    };
    const op = operators[run[0]];
    const type = types[run[1]];
    const direction = parseInt(run[3]) % 2 === 0 ? "Up" : "Down";
    if (op && type) return `HOT: ${op} (${type}) ${direction}`;
  }

  // Intrastate Freight (NNNN) - Specifically for Illawarra (District 9)
  if (/^\d{4}$/.test(run)) {
    const start = run[0];
    const end = run[1];
    const mid = parseInt(run.substring(2));

    // We only care if it involves Illawarra (District 9)
    if (start === '9' || end === '9') {
      const districts: Record<string, string> = {
        '1': 'Sydney',
        '2': 'Goulburn',
        '3': 'South (Junee)',
        '4': 'Newcastle',
        '5': 'North West (Werris)',
        '6': 'Grafton',
        '7': 'Merrygoen-Lithgow',
        '8': 'West (Orange)',
        '9': 'Illawarra'
      };

      const from = districts[start] || 'Unknown';
      const to = districts[end] || 'Unknown';
      const direction = parseInt(run[3]) % 2 === 0 ? "Up" : "Down";

      let operator = "Freight";
      if (mid >= 0 && mid <= 19) operator = "Sydney Trains";
      else if (mid >= 20 && mid <= 39) operator = "Pacific National";
      else if (mid >= 40 && mid <= 49) operator = "SSR";
      else if (mid >= 60 && mid <= 69) operator = "QUBE";
      else if (mid >= 70 && mid <= 89) operator = "SSR";
      else if (mid >= 90 && mid <= 93) operator = "Sydney Rail Services";
      else if (mid >= 96 && mid <= 99) operator = "John Holland";
      
      // AWR/ARG specific check
      if ((mid >= 56 && mid <= 59)) operator = "AWR/ARG";

      return `${operator} (${from} -> ${to}) ${direction}`;
    }
  }

  // Interstate Freight and Passenger (NAAN)
  if (/^[1-7][A-Z][A-Z][0-9]$/.test(run)) {
    const days: Record<string, string> = {
      '1': "Sun", '2': "Mon", '3': "Tue", '4': "Wed", '5': "Thu", '6': "Fri", '7': "Sat"
    };
    const locations: Record<string, string> = {
      'A': 'Adelaide', 'B': 'Brisbane', 'C': 'Junee/Coota', 'D': 'Darwin',
      'F': 'Mudgee/Dubbo', 'G': 'Parkes', 'H': 'Hunter Valley', 'J': 'VIC North East',
      'K': 'VIC North West', 'L': 'Alice Springs', 'M': 'Melbourne', 'N': 'Newcastle',
      'O': 'Fisherman Islands', 'P': 'Perth', 'Q': 'Moree', 'R': 'Port Pirie',
      'S': 'Sydney', 'T': 'Taree', 'U': 'Broken Hill', 'V': 'Goulburn/Canberra',
      'W': 'South Coast', 'X': 'Spencer Jct', 'Y': 'Whyalla'
    };

    const day = days[run[0]];
    const from = locations[run[1]] || run[1];
    const to = locations[run[2]] || run[2];
    const isPassenger = run[3] === '8';
    const type = isPassenger ? "Interstate Pax" : "Interstate Freight";

    return `${type} (${from} -> ${to}) ${day}`;
  }

  // Coal Trains - South and West (AANN)
  if (/^[A-Z]{2}[0-9]{2}$/.test(run)) {
    const locations: Record<string, string> = {
      'AR': 'Airly', 'BB': 'Baal Bone', 'CA': 'Clarence', 'CB': 'Charbon',
      'CG': 'Cringila BHP', 'GL': 'Glenlee', 'IH': 'Inner Harbour', 'LS': 'Lidsdale',
      'LG': 'Lithgow', 'MC': 'Metropolitan', 'TM': 'Tahmoor'
    };

    const loc = locations[run.substring(0, 2)];
    if (loc) {
      const mid = parseInt(run.substring(2));
      const isLoaded = mid % 2 === 0;
      const status = isLoaded ? "Loaded" : "Empty";
      
      let operator = "Coal";
      if (mid >= 1 && mid <= 20) operator = "SSR";
      else if (mid >= 21 && mid <= 30) operator = "Pacific National";
      else if (mid >= 31 && mid <= 40) operator = "Freightliner";
      else if (mid >= 41 && mid <= 49) operator = "Pacific National";
      else if (mid >= 51 && mid <= 63) operator = "Aurizon";
      else if (mid >= 64 && mid <= 99) operator = "Pacific National";

      return `${operator} Coal (${loc}) ${status}`;
    }
  }

  // Light Locomotives (ADDD)
  if (/^[DX][1-9][0-9]{2}$/.test(run)) {
    const types: Record<string, string> = { 'D': 'Diesel', 'X': 'Electric' };
    const districts: Record<string, string> = {
      '1': 'Sydney', '2': 'Goulburn', '3': 'Junee', '4': 'Newcastle',
      '5': 'Werris Creek', '6': 'Grafton', '7': 'Lithgow-Merrygoen',
      '8': 'Orange', '9': 'Illawarra'
    };
    
    const type = types[run[0]];
    const dist = districts[run[1]];
    const mid = parseInt(run.substring(2));
    
    let operator = "Freight"; 
    if (mid >= 0 && mid <= 19) operator = "Sydney Trains";
    else if (mid >= 20 && mid <= 39) operator = "Pacific National";
    else if (mid >= 40 && mid <= 49) operator = "SSR";
    else if (mid >= 60 && mid <= 69) operator = "QUBE";
    else if (mid >= 70 && mid <= 89) operator = "SSR";
    else if (mid >= 90 && mid <= 93) operator = "Sydney Rail Services";
    else if (mid >= 96 && mid <= 99) operator = "John Holland";
    else if (mid >= 56 && mid <= 59) operator = "AWR/ARG";

    let label = `${operator} ${type} Light Loco (${dist})`;
    
    // 7.11.4 Special Case: Port Kembla / Inner Harbour local movements
    if (run[0] === 'D' && run[1] === '9' && mid >= 21 && mid <= 40) {
      label += " [Port Kembla Local]";
    }
    
    return label;
  }

  // Trip Trains - Illawarra (T9NN)
  if (/^T9[0-9]{2}$/.test(run)) {
    const mid = parseInt(run.substring(2));
    let operator = "Freight";
    if (mid >= 0 && mid <= 19) operator = "Pacific National";
    else if (mid >= 20 && mid <= 39) operator = "WATCO WA Rail";
    else if (mid >= 40 && mid <= 49) operator = "QUBE";
    else if (mid >= 51 && mid <= 59) operator = "Aurizon";
    else if (mid >= 60 && mid <= 69) operator = "QUBE";
    
    return `${operator} Trip Train (Port Kembla Local)`;
  }

  // Maintenance Trains (ANNN)
  if (/^[ME][1-8][0-9]{2}$/.test(run)) {
    const mainType = run[0] === 'M' ? "Maintenance" : "Maintenance (Elec Hauled)";
    const districts: Record<string, string> = {
      '1': 'Metrop Goods', '2': 'North Shore', '3': 'West',
      '4': 'Illawarra (Redfern-Waterfall)', '5': 'South',
      '6': 'South Coast (Illawarra beyond Waterfall)', '7': 'Suburban',
      '8': 'North'
    };
    const subTypes: Record<string, string> = {
      '1': 'Overhead Wiring', '2': 'Metal Ballast', '3': 'Metal Ballast',
      '4': 'Material/Spoil', '5': 'Material/Spoil', '6': 'Material/Spoil',
      '7': 'Track Maintenance / Hi-Rail', '8': 'Track Recording / Speno',
      '9': 'Herbicide', '0': 'Rail Set'
    };

    const dist = districts[run[1]] || "Unknown District";
    const type = subTypes[run[2]] || "General Maintenance";

    return `${mainType}: ${type} (${dist})`;
  }

  // ARTC / CRN Maintenance (NMN[0-9])
  if (/^[1-9]M[0-9]{2}$/.test(run)) {
    const districts: Record<string, string> = {
      '1': 'Sydney', '2': 'Goulburn', '3': 'Junee', '4': 'Newcastle',
      '5': 'Werris Creek', '6': 'Grafton', '7': 'Lithgow-Merrygoen',
      '8': 'Orange', '9': 'Illawarra'
    };
    const subTypes: Record<string, string> = {
      '2': 'Ballast', '3': 'Ballast', '4': 'Rail Train', '5': 'Sleeper Train',
      '7': 'Track Maint / Grinders', '8': 'Test Vehicle', '9': 'Herbicide'
    };
    const dist = districts[run[0]];
    const type = subTypes[run[2]] || "Maintenance";
    return `ARTC Maint: ${type} (${dist})`;
  }

  return null;
}

/**
 * Extracts set info from tripId and/or run number.
 */
export function getSetInfo(tripId: string, vehicleLabel?: string): string {
  const tripParts = tripId.split('.');
  const runNumber = tripParts[0];

  // 1. Try to get specific description from run number (highest priority)
  const runDescription = getTrainTypeFromRun(runNumber);
  if (runDescription) return runDescription;

  // 2. Fallback to vehicle label if provided
  if (vehicleLabel && vehicleLabel !== '---' && vehicleLabel !== 'Unknown') {
    return vehicleLabel;
  }

  // 3. Extract from tripId (e.g., ...D.8...)
  if (tripParts.length >= 6) {
    // Usually RUN.DATE.VERSION.SET.CARS.VERSION... or RUN.DATE.SET.CARS...
    // Let's try to find a single letter followed by a number
    for (let i = 2; i < tripParts.length - 1; i++) {
      const part = tripParts[i];
      const nextPart = tripParts[i+1];
      if (part.length === 1 && /^[A-Z]$/.test(part) && !isNaN(Number(nextPart))) {
        return `${part} Set (${nextPart} cars)`;
      }
    }
  }

  return vehicleLabel || '---';
}
