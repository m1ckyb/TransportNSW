import mqtt from 'mqtt';
import dotenv from 'dotenv';
import { getSetting } from './db';

dotenv.config();

const TOPIC_PREFIX = 'transportnsw';
let client: mqtt.MqttClient | null = null;

export function cleanupStaleTopics() {
  if (!client || !client.connected) return;

  const monitoredStops = ['200060', '252610', '2526171', '2526172', '2560691', '2560692', '2576341', '2576342'];
  const facilityIds = ['15', '16', '17', '19', '20', '39']; // Common ones

  console.log('MQTT: Clearing legacy discovery topics...');

  // 1. Clear old stops format (sensor/stop_ID)
  monitoredStops.forEach(id => {
    client?.publish(`homeassistant/sensor/stop_${id}/next_departure/config`, '', { retain: true });
  });

  // 2. Clear old carpark format (sensor/carpark_ID)
  facilityIds.forEach(id => {
    client?.publish(`homeassistant/sensor/carpark_${id}/occupancy/config`, '', { retain: true });
  });

  // 3. Clear intermediate format (sensor/tfnsw_stop_ID without hub prefix)
  monitoredStops.forEach(id => {
    client?.publish(`homeassistant/sensor/tfnsw_stop_${id}/next_departure/config`, '', { retain: true });
  });
}

export function connectMqtt() {
  const url = getSetting('MQTT_URL', process.env.MQTT_URL || 'mqtt://localhost');
  const user = getSetting('MQTT_USER', process.env.MQTT_USER || '');
  const pass = getSetting('MQTT_PASS', process.env.MQTT_PASS || '');

  const options: any = {};
  if (user) options.username = user;
  if (pass) options.password = pass;

  if (client) {
    client.end();
  }

  console.log(`MQTT: Connecting to ${url}...`);
  client = mqtt.connect(url, options);

  client.on('connect', () => {
    console.log('Connected to MQTT broker');
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
  });
}

export function publishStopDeparture(stopId: string, stopName: string, departures: any[]) {
  if (!client || !client.connected) return;

  const discoveryTopic = `homeassistant/sensor/tfnsw_stop_${stopId}/next_departure/config`;
  
  const config = {
    name: `${stopName}`,
    state_topic: `${TOPIC_PREFIX}/stop/${stopId}/state`,
    unique_id: `v2_hub_tfnsw_${stopId}_next_departure`,
    device: {
      identifiers: ["transportnsw_hub"],
      name: "TransportNSW",
      model: 'Transport Monitor',
      manufacturer: 'TransportNSW Integration'
    },
    value_template: "{{ value_json.due }}",
    unit_of_measurement: "min",
    device_class: "duration",
    state_class: "measurement",
    icon: "mdi:train",
    json_attributes_topic: `${TOPIC_PREFIX}/stop/${stopId}/attributes`
  };

  client.publish(discoveryTopic, JSON.stringify(config), { retain: true });

  const nextDeparture = departures[0];
  const stateTopic = `${TOPIC_PREFIX}/stop/${stopId}/state`;
  const attrTopic = `${TOPIC_PREFIX}/stop/${stopId}/attributes`;

  if (nextDeparture) {
    const date = new Date(nextDeparture.time);
    const timeStr = date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
    const due = Math.max(0, Math.floor((nextDeparture.time - Date.now()) / 60000));
    
    console.log(`MQTT: Publishing state for stop ${stopId}: ${due} min (${timeStr})`);
    
    // Main state is now "due" (minutes)
    client.publish(stateTopic, JSON.stringify({
      due: due,
      time: timeStr
    }), { retain: true });

    // Detailed attributes
    client.publish(attrTopic, JSON.stringify({
      stop_id: stopId,
      friendly_name: stopName,
      run_number: nextDeparture.runNumber,
      set_info: nextDeparture.setInfo,
      route: nextDeparture.routeLongName,
      route_code: nextDeparture.routeShortName,
      destination: nextDeparture.headsign,
      delay: Math.round(nextDeparture.delay / 60),
      real_time: nextDeparture.isRealtime ? 'y' : 'n',
      mode: 'Train',
      attribution: 'Data provided by Transport NSW',
      last_updated: new Date().toISOString(),
      upcoming: departures.slice(0, 5).map(d => ({
        ...d,
        readable_time: new Date(d.time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
        due: Math.max(0, Math.floor((d.time - Date.now()) / 60000))
      }))
    }), { retain: true });
  } else {
    // Publish empty state if no trains found
    console.log(`MQTT: No departures for stop ${stopId}, clearing state.`);
    client.publish(stateTopic, JSON.stringify({
      due: 0,
      status: 'No services'
    }), { retain: true });
    
    client.publish(attrTopic, JSON.stringify({
      departures: [],
      last_updated: new Date().toISOString()
    }), { retain: true });
  }
}

export function publishCarParkOccupancy(facilityId: string, facilityName: string, data: any) {
  if (!client || !client.connected) return;

  const discoveryTopic = `homeassistant/sensor/tfnsw_carpark_${facilityId}/occupancy/config`;
  
  const config = {
    name: `${facilityName} Parking`,
    state_topic: `${TOPIC_PREFIX}/carpark/${facilityId}/state`,
    unique_id: `v2_hub_tfnsw_carpark_${facilityId}_occupancy`,
    device: {
      identifiers: ["transportnsw_hub"],
      name: "TransportNSW",
      model: 'Transport Monitor',
      manufacturer: 'TransportNSW Integration'
    },
    value_template: "{{ value_json.available }}",
    unit_of_measurement: "spaces",
    state_class: "measurement",
    icon: "mdi:car-parking",
    json_attributes_topic: `${TOPIC_PREFIX}/carpark/${facilityId}/attributes`
  };

  client.publish(discoveryTopic, JSON.stringify(config), { retain: true });

  const stateTopic = `${TOPIC_PREFIX}/carpark/${facilityId}/state`;
  const attrTopic = `${TOPIC_PREFIX}/carpark/${facilityId}/attributes`;

  const spots = parseInt(data.spots) || 0;
  const total = parseInt(data.occupancy?.total) || 0;
  const available = Math.max(0, spots - total);
  const percent = spots > 0 ? Math.round((total / spots) * 100) : 0;

  client.publish(stateTopic, JSON.stringify({
    available: available,
    total: total,
    spots: spots,
    percent: percent
  }), { retain: true });

  client.publish(attrTopic, JSON.stringify({
    facility_id: facilityId,
    friendly_name: facilityName,
    suburb: data.location?.suburb,
    address: data.location?.address,
    last_updated: data.MessageDate || new Date().toISOString(),
    attribution: 'Data provided by Transport NSW'
  }), { retain: true });
}

export function unpublishCarParkOccupancy(facilityId: string) {
  if (!client || !client.connected) return;

  const discoveryTopic = `homeassistant/sensor/tfnsw_carpark_${facilityId}/occupancy/config`;
  
  client.publish(discoveryTopic, '', { retain: true });
  console.log(`Unpublished MQTT entity for car park: ${facilityId}`);
}

export function unpublishStopDeparture(stopId: string) {
  if (!client || !client.connected) return;

  const discoveryTopic = `homeassistant/sensor/tfnsw_stop_${stopId}/next_departure/config`;
  
  // Sending an empty payload to the discovery topic removes the entity from Home Assistant
  client.publish(discoveryTopic, '', { retain: true });
  console.log(`Unpublished MQTT entity for stop: ${stopId}`);
}
