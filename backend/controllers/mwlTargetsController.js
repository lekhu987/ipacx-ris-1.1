const mwlTargetsService = require("../services/mwlTargetsService");

async function getOptions(req, res) {
  try {
    const out = await mwlTargetsService.getOptions();
    return res.json({
      success: true,
      modalities: out.modalities,
      pacs: out.pacs,
    });
  } catch (err) {
    console.error("MWL target options error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to load MWL options" });
  }
}

async function listTargets(req, res) {
  try {
    const rows = await mwlTargetsService.listTargets();
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("MWL target fetch error:", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch MWL targets" });
  }
}

async function upsertTarget(req, res) {
  try {
    const data = await mwlTargetsService.upsertTarget(req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    console.error("MWL target save error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ success: false, error: err.message || "Failed to save MWL target" });
  }
}

async function deleteTarget(req, res) {
  try {
    await mwlTargetsService.deleteTarget(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    console.error("MWL target delete error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ success: false, error: err.message || "Failed to delete MWL target" });
  }
}

module.exports = {
  getOptions,
  listTargets,
  upsertTarget,
  deleteTarget,
};
