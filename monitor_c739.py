import requests
import time
from datetime import datetime

def monitor_train(run_number):
    print(f"Monitoring {run_number} until it clears the section...")
    while True:
        try:
            response = requests.get("http://localhost:3001/api/track/sc")
            if response.status_code != 200:
                print(f"API Error: {response.status_code}")
                time.sleep(10)
                continue
                
            data = response.json()
            train = next((t for t in data if t['runNumber'] == run_number), None)
            
            if not train:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] {run_number} has cleared the monitored section.")
                break
                
            section = train['section']
            ts = train['timestamp'] / 1000
            update_time = datetime.fromtimestamp(ts).strftime('%H:%M:%S')
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {run_number} in section: {section} (Last Live Update: {update_time})")
            
        except Exception as e:
            print(f"Error: {e}")
            
        time.sleep(30)

if __name__ == "__main__":
    monitor_train("C739")
