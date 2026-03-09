const crypto = require("crypto");
const pool = require("../db");

let tableReadyPromise = null;

function ensureAuditTable() {
  if (tableReadyPromise) return tableReadyPromise;
  tableReadyPromise = pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT,
      username TEXT,
      role TEXT,
      event TEXT NOT NULL,
      page TEXT,
      details JSONB,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
  `);
  return tableReadyPromise;
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const normalize = (ip) => {
    const value = String(ip || "").trim();
    if (!value) return "";
    if (value.startsWith("::ffff:")) return value.replace("::ffff:", "");
    return value;
  };
  if (typeof fwd === "string" && fwd.trim()) {
    return normalize(fwd.split(",")[0].trim());
  }
  return normalize(req.ip || req.socket?.remoteAddress || "");
}

function newSessionId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString("hex");
}

async function writeAuditLog({
  session_id = null,
  username = null,
  role = null,
  event,
  page = null,
  details = null,
  ip_address = null,
  user_agent = null,
}) {
  if (!event) return;
  await ensureAuditTable();
  await pool.query(
    `
      INSERT INTO audit_logs
      (session_id, username, role, event, page, details, ip_address, user_agent)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [session_id, username, role, event, page, details, ip_address, user_agent]
  );
}

function getActorFromReq(req) {
  const username = String(req.headers["x-audit-username"] || "").trim() || null;
  const role = String(req.headers["x-audit-role"] || "").trim() || null;
  const session_id = String(req.headers["x-audit-session"] || "").trim() || null;
  return { username, role, session_id };
}

async function logAction(req, { event, page = null, details = null }) {
  const actor = getActorFromReq(req);
  await writeAuditLog({
    session_id: actor.session_id,
    username: actor.username,
    role: actor.role,
    event,
    page: page || req.originalUrl || null,
    details,
    ip_address: getClientIp(req),
    user_agent: req.headers["user-agent"] || "",
  });
}

module.exports = {
  ensureAuditTable,
  getClientIp,
  newSessionId,
  writeAuditLog,
  getActorFromReq,
  logAction,
};
