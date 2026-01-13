// utils/auditLogger.js
const pool = require("../db"); // <-- reuse main pool ONLY

async function logAudit(auditData) {
  try {
    const query = `
      INSERT INTO audit_logs
      (user_id, username, action, method, path,
       status_code, ip_address, user_agent,
       duration_ms, success, session_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `;

    const values = [
      auditData.user_id,
      auditData.username,
      auditData.action,
      auditData.method,
      auditData.path,
      auditData.status_code,
      auditData.ip_address,
      auditData.user_agent,
      auditData.duration_ms,
      auditData.success,
      auditData.session_id,
    ];

    await pool.query(query, values);
  } catch (err) {
    console.error("AUDIT LOG FAILED:", err.message);
  }
}

module.exports = logAudit;
