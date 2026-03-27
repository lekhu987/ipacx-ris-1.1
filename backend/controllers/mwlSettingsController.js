const mwlSettingsService = require("../services/mwlSettingsService");

async function getSettings(req, res) {
  try {
    const out = await mwlSettingsService.getSettings();
    res.json({ success: true, autopush_enabled: out.autopush_enabled });
  } catch (err) {
    console.error("MWL settings fetch error:", err.message);
    res.status(500).json({ success: false, error: "Failed to load settings" });
  }
}

async function saveSettings(req, res) {
  try {
    const out = await mwlSettingsService.saveSettings(req.body?.autopush_enabled);
    res.json({ success: true, autopush_enabled: out.autopush_enabled });
  } catch (err) {
    console.error("MWL settings update error:", err.message);
    res.status(500).json({ success: false, error: "Failed to save settings" });
  }
}

module.exports = { getSettings, saveSettings };
