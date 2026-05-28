#!/usr/bin/env python3
import os
import sys
import json
import requests
import subprocess
from google.transit import gtfs_realtime_pb2
from google.protobuf.json_format import MessageToDict
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')

def get_keys():
    keys = []
    try:
        cmd = [
            "docker", "compose", "exec", "-T", "backend", "node", "-e",
            "const db = require('./dist/db'); try { db.db.prepare(\"SELECT value FROM app_settings WHERE key LIKE 'TFNSW_API_KEY%'\").all().forEach(r => console.log(r.value)); } catch(e) {}"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            keys.extend([line.strip() for line in result.stdout.split('\n') if line.strip()])
    except: pass
    if not keys:
        keys.append(os.getenv('TFNSW_API_KEY'))
    return [k for k in keys if k]

API_KEYS = get_keys()
URL = "https://api.transport.nsw.gov.au/v2/gtfs/vehiclepos/sydneytrains"

def fetch_with_rotation():
    for key in API_KEYS:
        headers = {
            'Authorization': f'apikey {key}',
            'Accept': 'application/x-google-protobuf'
        }
        try:
            response = requests.get(URL, headers=headers, timeout=30)
            if response.status_code == 200:
                return response.content
        except: continue
    return None

def inspect_sc():
    content = fetch_with_rotation()
    if not content:
        print("Failed to fetch data (likely 429).")
        return

    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(content)

    results = []
    for entity in feed.entity:
        if entity.HasField('vehicle'):
            stop_id = entity.vehicle.stop_id
            if 'SouthCoast' in stop_id:
                results.append({
                    "tripId": entity.vehicle.trip.trip_id,
                    "stopId": stop_id,
                    "label": entity.vehicle.vehicle.label,
                    "lat": entity.vehicle.position.latitude,
                    "lon": entity.vehicle.position.longitude
                })
    
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    inspect_sc()
