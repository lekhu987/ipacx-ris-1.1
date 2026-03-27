const pool = require("../db");

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mwl_settings (
      id INTEGER PRIMARY KEY,
      autopush_enabled BOOLEAN NOT NULL DEFAULT false
    )
  `);
  await pool.query(
    "INSERT INTO mwl_settings (id, autopush_enabled) VALUES (1, false) ON CONFLICT (id) DO NOTHING"
  );
}

async function getSettings() {
  await ensureSettingsTable();
  const result = await pool.query(
    "SELECT autopush_enabled FROM mwl_settings WHERE id = 1"
  );
  const enabled = result.rows[0]?.autopush_enabled || false;
  return { autopush_enabled: enabled };
}

async function saveSettings(autopush_enabled) {
  await ensureSettingsTable();
  const enabled = Boolean(autopush_enabled);
  await pool.query(
    "UPDATE mwl_settings SET autopush_enabled = $1 WHERE id = 1",
    [enabled]
  );
  return { autopush_enabled: enabled };
}

module.exports = {
  getSettings,
  saveSettings,
};
