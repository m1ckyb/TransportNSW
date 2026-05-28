#!/usr/bin/env python3
import os
import sys
import json
import requests
import sqlite3
import subprocess
from google.transit import gtfs_realtime_pb2
from google.protobuf.json_format import MessageToDict
from dotenv import load_dotenv

# Load fallback API Key from project .env
load_dotenv(dotenv_path='backend/.env')

def get_keys_from_db():
    keys = []
    
    # 1. Try to get keys from Docker Database
    print("Attempting to fetch API keys from Docker database...")
    try:
        cmd = [
            "docker", "compose", "exec", "-T", "backend", "node", "-e",
            "const db = require('./dist/db'); try { db.db.prepare(\"SELECT value FROM app_settings WHERE key LIKE 'TFNSW_API_KEY%'\").all().forEach(r => console.log(r.value)); } catch(e) {}"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            docker_keys = [line.strip() for line in result.stdout.split('\n') if line.strip()]
            if docker_keys:
                print(f"  Successfully retrieved {len(docker_keys)} keys from Docker.")
                keys.extend(docker_keys)
    except Exception as e:
        print(f"  Note: Could not reach Docker database: {e}")

    # 2. Check local .env as fallback
    env_keys = []
    k_env = os.getenv('TFNSW_API_KEY')
    if k_env: env_keys.append(k_env)
    for i in range(1, 6):
        k = os.getenv(f'TFNSW_API_KEY_{i}')
        if k and k not in env_keys:
            env_keys.append(k)
    
    # Merge and deduplicate
    all_keys = list(dict.fromkeys(keys + env_keys))
    return all_keys

API_KEYS = get_keys_from_db()

# Define Feeds (Sydney is v2, Intercity is v1)
FEEDS = [
    "https://api.transport.nsw.gov.au/v2/gtfs/realtime/sydneytrains",
    "https://api.transport.nsw.gov.au/v1/gtfs/realtime/nswtrains",
    "https://api.transport.nsw.gov.au/v2/gtfs/vehiclepos/sydneytrains",
    "https://api.transport.nsw.gov.au/v1/gtfs/vehiclepos/nswtrains"
]

def fetch_with_rotation(url):
    for i, key in enumerate(API_KEYS):
        print(f"  Attempting {url} with Key {i+1}/{len(API_KEYS)}...")
        headers = {
            'Authorization': f'apikey {key}',
            'Accept': 'application/x-google-protobuf'
        }
        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                return response.content
            elif response.status_code == 429:
                print(f"    Key {i+1} is rate limited (429).")
                continue
            else:
                print(f"    Error: Received status {response.status_code}")
        except Exception as e:
            print(f"    Request failed: {e}")
    return None

def inspect_run(run_number):
    if not API_KEYS:
        print("Error: No TFNSW_API_KEYs found in database or .env")
        return

    found_any = False

    for url in FEEDS:
        print(f"Fetching from: {url}...")
        content = fetch_with_rotation(url)
        if not content:
            continue

        try:
            feed = gtfs_realtime_pb2.FeedMessage()
            feed.ParseFromString(content)

            for entity in feed.entity:
                # Check Trip Updates
                if entity.HasField('trip_update'):
                    trip_id = entity.trip_update.trip.trip_id
                    if trip_id.startswith(run_number):
                        found_any = True
                        print("\n" + "!" * 60)
                        print(f"MATCH FOUND: {trip_id}")
                        print("!" * 60)
                        entity_dict = MessageToDict(entity)
                        print(json.dumps(entity_dict, indent=2))
                
                # Check Vehicle Positions
                if entity.HasField('vehicle'):
                    trip_id = entity.vehicle.trip.trip_id
                    if trip_id.startswith(run_number):
                        found_any = True
                        print("\n" + "*" * 60)
                        print(f"VEHICLE POSITION MATCH: {trip_id}")
                        print("*" * 60)
                        entity_dict = MessageToDict(entity)
                        print(json.dumps(entity_dict, indent=2))

        except Exception as e:
            print(f"  Failed to parse feed: {e}")

    if not found_any:
        print(f"\nNo data found for run '{run_number}' in current feeds.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 inspect_run.py <RUN_NUMBER>")
    else:
        inspect_run(sys.argv[1])
