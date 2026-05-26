# Development Workflow

## Continuous Documentation
After every feature addition, change, or bug fix, `unreleased.md` must be updated immediately with a concise summary of the change under the appropriate heading (### Added, ### Changed, ### Fixed). This ensures the changelog is always ready for the next release.

**Exception:** Changes made to this file (`GEMINI.md`) do not need to be documented in `unreleased.md`.

# Gemini Code Assist - Project Memory for TransportNSW
This document is a summary of the key architectural patterns, decisions, and common pitfalls encountered during the development of the TransportNSW project. It serves as a "memory" to ensure future work is consistent and efficient.

## Architectural Decisions

### 1. API Versioning (v2 vs v1)
- **Status:** TransportNSW has migrated major modes (Sydney Trains, Metro, Light Rail) to **v2**. Regional modes (NSW TrainLink) are still primarily on **v1** for real-time trip updates.
- **Strategy:** Use an "Attempt v2, Fallback to v1" pattern. The `tfnsw.ts` client is configured to try the v2 endpoint first and automatically switch to v1 if a 404 is received. This ensures future-proofing without losing current data.
- **Alerts:** Network-wide alerts should be fetched using the consolidated `/v2/gtfs/alerts/all` endpoint for maximum efficiency.

### 2. Timezone & Timing Consistency
- **Constraint:** GTFS schedule data is provided in "local time" (HH:MM:SS), but real-time Protobuf feeds use Unix timestamps (seconds since epoch).
- **Solution:** Both the Backend and Frontend containers are locked to the `Australia/Sydney` timezone (`TZ=Australia/Sydney`). All backend timestamps must be normalized to standard JavaScript numbers (milliseconds) before being sent to the UI or MQTT to prevent "Invalid Date" errors.

### 3. Large Scale Data Ingestion (GTFS)
- **Challenge:** TfNSW GTFS bundles are very large (280MB+ ZIP, millions of SQL rows). Standard proxy (Cloudflare/Traefik) limits often block payloads > 100MB.
- **Solution:**
    - **Chunked Uploads:** The frontend slices ZIP files into 25MB chunks and sends them sequentially with a 500ms delay to stay under proxy rate limits.
    - **Streaming Parser:** The backend uses `unzipper` and `csv-parse` in a stream-based pipeline. Data is never loaded fully into memory.
    - **Background Import:** Ingestion runs as an async background task to prevent request timeouts.

### 4. Hybrid Departure Logic
- **Constraint:** Real-time feeds (Trip Updates) can be empty during off-peak hours or for trips that haven't started.
- **Solution:** The board uses a "Hybrid" model. It queries the local SQLite schedule first, then merges in real-time delays if a matching `trip_id` is found in the live feed.

### 5. Home Assistant / MQTT Standards
- **Discovery:** The app uses HA MQTT Discovery. Sensors should include `device_class: duration`, `unit_of_measurement: min`, and `state_class: measurement` to ensure beautiful history graphs in the HA UI.
- **Attributes:** Always include rich metadata (Run Number, Set Type, Stopping Pattern) in the attributes to enable complex automations and custom cards.
