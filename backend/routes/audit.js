const express = require("express");
const pool = require("../db");
const { ensureAuditTable, getClientIp, writeAuditLog } = require("../utils/auditLogger");

const router = express.Router();

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
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;

    let whereSql = ` WHERE 1=1 `;
    const params = [];

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
      whereSql += ` AND created_at >= $${params.length}::timestamp`;
    }
    if (to) {
      params.push(to);
      whereSql += ` AND created_at <= $${params.length}::timestamp + interval '1 day'`;
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
    });
  } catch (err) {
    console.error("Audit logs fetch error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch audit logs" });
  }
});

module.exports = router;
