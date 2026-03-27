const auditService = require("../services/auditService");

async function logEvent(req, res) {
  try {
    const {
      session_id = null,
      username = null,
      role = null,
      event = "USER_EVENT",
      page = null,
      details = null,
    } = req.body || {};

    await auditService.logEvent(req, {
      session_id,
      username,
      role,
      event,
      page,
      details,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Audit event log error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to log event" });
  }
}

async function logLogout(req, res) {
  try {
    const { session_id = null, username = null, role = null, page = null } = req.body || {};
    await auditService.logLogout(req, { session_id, username, role, page });
    return res.json({ success: true });
  } catch (err) {
    console.error("Audit logout log error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to log logout" });
  }
}

async function getLogs(req, res) {
  try {
    const result = await auditService.fetchLogs(req.query || {});
    return res.json({
      success: true,
      data: result.rows,
      summary: result.summary,
      paging: result.paging,
      archive: { found: false },
    });
  } catch (err) {
    console.error("Audit logs fetch error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch audit logs" });
  }
}

async function runArchive(req, res) {
  try {
    const date = req.body?.date ? String(req.body.date).trim() : null;
    const out = await auditService.runArchive(date);
    return res.json(out);
  } catch (err) {
    console.error("Audit archive run error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to archive logs" });
  }
}

async function listArchives(req, res) {
  try {
    const data = await auditService.listArchives();
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Audit archives list error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch archives" });
  }
}

async function availableDates(req, res) {
  try {
    const out = await auditService.listAvailableDates();
    return res.json({
      success: true,
      live_dates: out.live_dates,
      archived_dates: out.archived_dates,
    });
  } catch (err) {
    console.error("Audit available dates error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch available dates" });
  }
}

async function downloadArchive(req, res) {
  try {
    const logDate = String(req.params.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
    }

    const result = await auditService.getArchiveFile(logDate);
    if (!result.found) {
      return res.status(404).json({ success: false, message: "Archive file not found for this date" });
    }

    return res.download(result.absolutePath, `audit-${logDate}.txt`);
  } catch (err) {
    console.error("Audit archive download error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to download archive file" });
  }
}

async function downloadFilteredTxt(req, res) {
  try {
    const out = await auditService.downloadFilteredTxt(req.query || {});
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${out.filename}\"`);
    return res.send(out.reportText);
  } catch (err) {
    console.error("Audit filtered txt download error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || "Failed to download TXT file" });
  }
}

module.exports = {
  logEvent,
  logLogout,
  getLogs,
  runArchive,
  listArchives,
  availableDates,
  downloadArchive,
  downloadFilteredTxt,
};
