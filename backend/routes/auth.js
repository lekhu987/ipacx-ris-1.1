const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { getClientIp, newSessionId, writeAuditLog } = require("../utils/auditLogger");
const router = express.Router();

// =======================
// LOGIN ROUTE
// =======================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    if (!username || !password) {
      await writeAuditLog({
        event: "LOGIN_FAILED",
        username: username || null,
        details: { reason: "missing_credentials" },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return res.status(400).json({ message: "Username and password are required" });
    }

    const result = await pool.query(
      `
      SELECT id, username, role, password_hash, is_active
      FROM users
      WHERE username = $1
      `,
      [username]
    );

    if (result.rows.length === 0) {
      await writeAuditLog({
        event: "LOGIN_FAILED",
        username,
        details: { reason: "user_not_found" },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      await writeAuditLog({
        event: "LOGIN_FAILED",
        username: user.username,
        role: user.role,
        details: { reason: "account_disabled" },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return res.status(403).json({ message: "Account disabled" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await writeAuditLog({
        event: "LOGIN_FAILED",
        username: user.username,
        role: user.role,
        details: { reason: "invalid_password" },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const sessionId = newSessionId();
    await writeAuditLog({
      session_id: sessionId,
      username: user.username,
      role: user.role,
      event: "LOGIN_SUCCESS",
      page: "/",
      details: { user_id: user.id },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        session_id: sessionId,
      },
    });

  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Login failed" });
  }
});

module.exports = router;
