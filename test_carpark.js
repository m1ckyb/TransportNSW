const axios = require('axios');
const Database = require('better-sqlite3');
const db = new Database('backend/src/data/transport.db');

async function test() {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'TFNSW_API_KEY_1'").get();
  if (!row || !row.value) {
    console.error("No API key found in DB");
    return;
  }
  const key = row.value;
  const url = 'https://api.transport.nsw.gov.au/v1/carpark';
  console.log("Testing URL:", url);
  try {
    const res = await axios.get(url, {
      headers: { 'Authorization': 'apikey ' + key }
    });
    console.log("Response data type:", typeof res.data);
    console.log("Is array:", Array.isArray(res.data));
    console.log("First few items:", JSON.stringify(res.data, null, 2).substring(0, 1000));
  } catch (err) {
    console.error("Error:", err.message);
    if (err.response) console.error("Data:", err.response.data);
  }
}
test();
