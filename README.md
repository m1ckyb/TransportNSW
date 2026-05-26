# TransportNSW Departure Board & MQTT Bridge

A web application to display real-time transport departures from Transport for NSW (TfNSW) and bridge the data to Home Assistant via MQTT.

## Features
- **Live Departure Board:** See upcoming services for any NSW transport stop.
- **Service Alerts:** Real-time disruption and trackwork notifications.
- **Home Assistant Integration:** Automatically publishes transit data to MQTT for use in your smart home.
- **Static GTFS Support:** Upload `.zip` bundles to resolve stop names and route details.

## Quick Start (Docker)

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/m1ckyb/TransportNSW.git
    cd TransportNSW
    ```

2.  **Configure Environment:**
    Edit `backend/.env` (use `backend/.env.example` as a template) and add your `TFNSW_API_KEY` and MQTT details.

3.  **Run with Docker Compose:**
    ```bash
    docker compose up -d
    ```

4.  **Access the Dashboard:**
    - Frontend: [http://localhost:8080](http://localhost:8080)
    - Backend API: [http://localhost:3001](http://localhost:3001)

## Development Setup

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Data Ingestion
Go to the **Admin** tab in the web interface and upload a static GTFS ZIP file (e.g., `sydney_trains_gtfs.zip`) to populate the database with stop and route names.
