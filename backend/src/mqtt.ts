import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost';
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const TOPIC_PREFIX = 'transportnsw';

let client: mqtt.MqttClient | null = null;

export function connectMqtt() {
  const options: any = {};
  if (MQTT_USER) options.username = MQTT_USER;
  if (MQTT_PASS) options.password = MQTT_PASS;

  client = mqtt.connect(MQTT_URL, options);

  client.on('connect', () => {
    console.log('Connected to MQTT broker');
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
  });
}

export function publishStopDeparture(stopId: string, stopName: string, departures: any[]) {
  if (!client || !client.connected) return;

  const deviceId = `stop_${stopId}`;
  const discoveryTopic = `homeassistant/sensor/${deviceId}/next_departure/config`;
  
  const config = {
    name: `${stopName} Next Departure`,
    state_topic: `${TOPIC_PREFIX}/stop/${stopId}/state`,
    unique_id: `tfnsw_${stopId}_next_departure`,
    device: {
      identifiers: [deviceId],
      name: `TransportNSW Stop ${stopId}`,
      model: 'Departure Board',
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

export function unpublishStopDeparture(stopId: string) {
  if (!client || !client.connected) return;

  const deviceId = `stop_${stopId}`;
  const discoveryTopic = `homeassistant/sensor/${deviceId}/next_departure/config`;
  
  // Sending an empty payload to the discovery topic removes the entity from Home Assistant
  client.publish(discoveryTopic, '', { retain: true });
  console.log(`Unpublished MQTT entity for stop: ${stopId}`);
}
