# Unreleased Changes

### Added
- Initial project structure with Node.js backend and React frontend.
- SQLite database integration for static GTFS data.
- GTFS ZIP file parser with streaming support for large files.
- Chunked file upload system to bypass proxy/Cloudflare limits.
- TransportNSW API v2 integration for real-time trip updates and alerts.
- Hybrid departure board combining scheduled and real-time data.
- Home Assistant MQTT integration with rich transit attributes and auto-discovery.
- Full-screen tabbed UI with dedicated views for Departures, Trackwork, and Alerts.
- UI-based management for monitored stations and alert line filters.
- MQTT cleanup functionality to remove stale Home Assistant entities.
- Timezone support for accurate Sydney-based timing.

### Changed
- Migrated from v1 to v2 TfNSW API for improved reliability.
- Optimized GTFS ingestion using streaming CSV parsing and background processing.
- Refactored departure board to prioritize real-time feed with schedule fallback.
- Enhanced alerts UI with collapsible details and formatted dates.
- Grouped network alerts by line for better organization.

### Fixed
- Resolved 'Invalid Date' and 'NaN min' errors via backend time normalization.
- Fixed 'Stop null' issue by handling BOM characters in GTFS files.
- Resolved large file upload failures through Cloudflare/Traefik via chunking and increased timeouts.
- Fixed 'Ghost trains' by implementing GTFS calendar service exceptions.
- Resolved duplication issues on departure board using group-by logic.
- Fixed MQTT sensor data corruption by ensuring standard 24h time strings.
