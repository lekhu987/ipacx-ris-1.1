const { logAction } = require("../utils/auditLogger");
const pacsService = require("../services/pacsService");

async function list(req, res) {
  try {
    const rows = await pacsService.listPacs();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch PACS" });
  }
}

async function save(req, res) {
  const { id, pacs_name, pacs_type, ae_title, ip_address, port } = req.body;

  if (!pacs_name || !pacs_type || !ae_title || !ip_address || !port) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    const result = await pacsService.savePacs({ id, pacs_name, pacs_type, ae_title, ip_address, port });
    if (result.mode === "update") {
      await logAction(req, {
        event: "PACS_UPDATED",
        details: {
          pacs_id: result.row.id,
          pacs_name: result.row.pacs_name,
          ae_title,
          ip_address,
          port,
        },
      });
      return res.json(result.row);
    }

    await logAction(req, {
      event: "PACS_CREATED",
      details: {
        pacs_id: result.row.id,
        pacs_name: result.row.pacs_name,
        ae_title,
        ip_address,
        port,
      },
    });
    return res.json(result.row);
  } catch (err) {
    res.status(500).json({ error: "Failed to save PACS" });
  }
}

async function remove(req, res) {
  const deleted = await pacsService.deletePacs(req.params.id);
  if (deleted) {
    await logAction(req, {
      event: "PACS_DELETED",
      details: {
        pacs_id: deleted.id,
        pacs_name: deleted.pacs_name,
      },
    });
  }
  res.json({ success: true });
}

async function activate(req, res) {
  await pacsService.setActive(req.params.id, true);
  await logAction(req, {
    event: "PACS_ACTIVATED",
    details: { pacs_id: Number(req.params.id) },
  });
  res.json({ success: true });
}

async function deactivate(req, res) {
  await pacsService.setActive(req.params.id, false);
  await logAction(req, {
    event: "PACS_DEACTIVATED",
    details: { pacs_id: Number(req.params.id) },
  });
  res.json({ success: true });
}

async function test(req, res) {
  try {
    const out = await pacsService.testPacs(req.body || {});
    return res.json(out);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

async function listStudies(req, res) {
  try {
    const out = await pacsService.listStudies({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    return res.json(out);
  } catch (err) {
    console.error("Fetch studies failed:", err);
    return res.status(500).json({ error: "Failed to fetch studies" });
  }
}

async function sync(req, res) {
  try {
    const syncedCount = await pacsService.syncStudies(req.params.id);
    res.json({ success: true, synced: syncedCount });
  } catch (err) {
    console.error("Sync route failed:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "Sync failed" });
  }
}

module.exports = {
  list,
  save,
  remove,
  activate,
  deactivate,
  test,
  listStudies,
  sync,
};
