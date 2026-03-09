const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("../db");
const {
  ensureAuditTable,
  getClientIp,
  writeAuditLog,
  getISTDateString,
  archiveLogDate,
  archiveAllPastDays,
} = require("../utils/auditLogger");

const router = express.Router();
const PROJECT_ROOT = path.join(__dirname, "..", "..");

function parseArchiveLines(filePath) {
  if (!filePath) return [];
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(PROJECT_ROOT, filePath);

  if (!fs.existsSync(absolutePath)) return [];
  const content = fs.readFileSync(absolutePath, "utf8");
  if (!content.trim()) return [];

  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function filterArchiveRows(rows, { username, sessionId, event, ip }) {
  return rows.filter((row) => {
    if (username && String(row.username || "") !== username) return false;
    if (sessionId && String(row.session_id || "") !== sessionId) return false;
    if (event && String(row.event || "") !== event) return false;
    if (ip && !String(row.ip_address || "").toLowerCase().includes(ip.toLowerCase())) return false;
    return true;
  });
}

function formatDetails(details) {
  if (!details) return "-";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

function formatHumanAuditReport({ date, username, ip, event, rows }) {
  const header = [
    "IPACX RIS - AUDIT LOG EXPORT",
    `Date       : ${date}`,
    `Username   : ${username || "ALL"}`,
    `IP Filter  : ${ip || "ALL"}`,
    `Event      : ${event || "ALL"}`,
    `Total Rows : ${rows.length}`,
    "",
    "TIME | USER | ROLE | EVENT | PAGE | IP | SESSION | DETAILS",
    "--------------------------------------------------------------------------------------------------------------------------------",
  ];

  const body = rows.map((row) => {
    const time = row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "-";
    return [
      time,
      row.username || "-",
      row.role || "-",
      row.event || "-",
      row.page || "-",
      row.ip_address || "-",
      row.session_id || "-",
      formatDetails(row.details),
    ].join(" | ");
  });

  return [...header, ...body, ""].join("\n");
}

router.post("/event", async (req, res) => {
  try {
    const {
      session_id = null,
      username = null,
      role = null,
      event = "USER_EVENT",
      page = null,
      details = null,
    } = req.body || {};

    await writeAuditLog({
      session_id,
      username,
      role,
      event,
      page,
      details,
      ip_address: getClientIp(req),
      user_agent: req.headers["user-agent"] || "",
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Audit event log error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to log event" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { session_id = null, username = null, role = null, page = null } = req.body || {};
    await writeAuditLog({
      session_id,
      username,
      role,
      event: "LOGOUT",
      page,
      details: { reason: "user_initiated_or_timeout" },
      ip_address: getClientIp(req),
      user_agent: req.headers["user-agent"] || "",
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("Audit logout log error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to log logout" });
  }
});

router.get("/logs", async (req, res) => {
  try {
    await ensureAuditTable();
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const username = req.query.username ? String(req.query.username).trim() : null;
    const sessionId = req.query.session_id ? String(req.query.session_id).trim() : null;
    const event = req.query.event ? String(req.query.event).trim() : null;
    const ip = req.query.ip ? String(req.query.ip).trim() : null;
    const from = req.query.from ? String(req.query.from).trim() : null; // YYYY-MM-DD
    const to = req.query.to ? String(req.query.to).trim() : null; // YYYY-MM-DD
    const todayIST = getISTDateString();
    const hasDateFilter = Boolean(from || to);

    // Archived day read path: single full previous date file
    if (from && to && from === to && from < todayIST) {
      const archiveMetaRes = await pool.query(
        `SELECT log_date, file_path, row_count, archived_at
         FROM audit_log_archives
         WHERE log_date = $1::date
         LIMIT 1`,
        [from]
      );

      if (!archiveMetaRes.rows.length) {
        return res.json({
          success: true,
          data: [],
          summary: { total: 0, login_success: 0, login_failed: 0, logout: 0 },
          paging: { total: 0, limit, offset, has_next: false },
          archive: { log_date: from, found: false },
        });
      }

      const meta = archiveMetaRes.rows[0];
      let rows = parseArchiveLines(meta.file_path);
      rows = filterArchiveRows(rows, { username, sessionId, event, ip });
      rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      const total = rows.length;
      const pageRows = rows.slice(offset, offset + limit);

      return res.json({
        success: true,
        data: pageRows,
        summary: {
          total,
          login_success: rows.filter((r) => r.event === "LOGIN_SUCCESS").length,
          login_failed: rows.filter((r) => r.event === "LOGIN_FAILED").length,
          logout: rows.filter((r) => r.event === "LOGOUT").length,
        },
        paging: {
          total,
          limit,
          offset,
          has_next: offset + limit < total,
        },
        archive: {
          log_date: String(meta.log_date),
          found: true,
          file_path: meta.file_path,
          row_count: meta.row_count,
          archived_at: meta.archived_at,
        },
      });
    }

    let whereSql = ` WHERE 1=1 `;
    const params = [];

    // By default (no date filter), DB should return only today's logs (IST)
    if (!hasDateFilter) {
      params.push(todayIST);
      whereSql += ` AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = $${params.length}::date`;
    }

    if (username) {
      params.push(username);
      whereSql += ` AND username = $${params.length}`;
    }
    if (sessionId) {
      params.push(sessionId);
      whereSql += ` AND session_id = $${params.length}`;
    }
    if (event) {
      params.push(event);
      whereSql += ` AND event = $${params.length}`;
    }
    if (ip) {
      params.push(`%${ip}%`);
      whereSql += ` AND ip_address ILIKE $${params.length}`;
    }
    if (from) {
      params.push(from);
      whereSql += ` AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= $${params.length}::date`;
    }
    if (to) {
      params.push(to);
      whereSql += ` AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= $${params.length}::date`;
    }

    const summarySql = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE event = 'LOGIN_SUCCESS')::int AS login_success,
        COUNT(*) FILTER (WHERE event = 'LOGIN_FAILED')::int AS login_failed,
        COUNT(*) FILTER (WHERE event = 'LOGOUT')::int AS logout
      FROM audit_logs
      ${whereSql}
    `;
    const summaryResult = await pool.query(summarySql, params);
    const summaryRow = summaryResult.rows[0] || {};
    const total = Number(summaryRow.total || 0);

    let sql = `
      SELECT id, session_id, username, role, event, page, details, ip_address, user_agent, created_at
      FROM audit_logs
      ${whereSql}
      ORDER BY created_at DESC
    `;

    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const result = await pool.query(sql, params);
    return res.json({
      success: true,
      data: result.rows,
      summary: {
        total,
        login_success: Number(summaryRow.login_success || 0),
        login_failed: Number(summaryRow.login_failed || 0),
        logout: Number(summaryRow.logout || 0),
      },
      paging: {
        total,
        limit,
        offset,
        has_next: offset + limit < total,
      },
      archive: { found: false },
    });
  } catch (err) {
    console.error("Audit logs fetch error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch audit logs" });
  }
});

router.post("/archive/run", async (req, res) => {
  try {
    await ensureAuditTable();
    const date = req.body?.date ? String(req.body.date).trim() : null; // YYYY-MM-DD
    if (date) {
      const out = await archiveLogDate(date);
      return res.json({ success: true, mode: "single", result: out });
    }
    const out = await archiveAllPastDays();
    return res.json({ success: true, mode: "all_past", result: out });
  } catch (err) {
    console.error("Audit archive run error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to archive logs" });
  }
});

router.get("/archives", async (req, res) => {
  try {
    await ensureAuditTable();
    const result = await pool.query(
      `SELECT id, log_date, file_path, row_count, archived_at
       FROM audit_log_archives
       ORDER BY log_date DESC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Audit archives list error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch archives" });
  }
});

router.get("/available-dates", async (req, res) => {
  try {
    await ensureAuditTable();
    const live = await pool.query(
      `SELECT DISTINCT ((created_at AT TIME ZONE 'Asia/Kolkata')::date)::text AS log_date
       FROM audit_logs
       ORDER BY log_date DESC`
    );
    const archived = await pool.query(
      `SELECT log_date::text AS log_date
       FROM audit_log_archives
       ORDER BY log_date DESC`
    );
    return res.json({
      success: true,
      live_dates: live.rows.map((r) => r.log_date),
      archived_dates: archived.rows.map((r) => r.log_date),
    });
  } catch (err) {
    console.error("Audit available dates error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch available dates" });
  }
});

router.get("/archives/:date/download", async (req, res) => {
  try {
    await ensureAuditTable();
    const logDate = String(req.params.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
    }

    const result = await pool.query(
      `SELECT log_date::text AS log_date, file_path
       FROM audit_log_archives
       WHERE log_date = $1::date
       LIMIT 1`,
      [logDate]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Archive file not found for this date" });
    }

    const filePath = result.rows[0].file_path;
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(PROJECT_ROOT, filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: "Archive file missing on disk" });
    }

    return res.download(absolutePath, `audit-${logDate}.txt`);
  } catch (err) {
    console.error("Audit archive download error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to download archive file" });
  }
});

router.get("/archives/download", async (req, res) => {
  try {
    await ensureAuditTable();
    const date = String(req.query.date || "").trim();
    const username = String(req.query.username || "").trim();
    const ip = String(req.query.ip || "").trim();
    const event = String(req.query.event || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "date is required in YYYY-MM-DD format" });
    }

    let rows = [];
    const archiveRes = await pool.query(
      `SELECT file_path FROM audit_log_archives WHERE log_date = $1::date LIMIT 1`,
      [date]
    );

    if (archiveRes.rows.length) {
      rows = parseArchiveLines(archiveRes.rows[0].file_path);
    } else {
      const params = [date];
      let where = `WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date`;
      if (username) {
        params.push(username);
        where += ` AND username = $${params.length}`;
      }
      if (ip) {
        params.push(`%${ip}%`);
        where += ` AND ip_address ILIKE $${params.length}`;
      }
      if (event) {
        params.push(event);
        where += ` AND event = $${params.length}`;
      }
      const liveRes = await pool.query(
        `
          SELECT id, session_id, username, role, event, page, details, ip_address, user_agent,
                 (created_at AT TIME ZONE 'Asia/Kolkata')::date AS log_date, created_at
          FROM audit_logs
          ${where}
          ORDER BY created_at ASC, id ASC
        `,
        params
      );
      rows = liveRes.rows;
    }

    if (username || ip || event) {
      rows = filterArchiveRows(rows, { username, sessionId: "", event, ip });
    }

    const reportText = formatHumanAuditReport({ date, username, ip, event, rows });
    const suffix = username ? `-${username}` : "";
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"audit-${date}${suffix}-${stamp}.txt\"`);
    return res.send(reportText);
  } catch (err) {
    console.error("Audit filtered txt download error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to download TXT file" });
  }
});

module.exports = router;
