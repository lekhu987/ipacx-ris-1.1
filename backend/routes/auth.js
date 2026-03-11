const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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

    // Generate JWT token that expires in 24 hours (long expiry, idle handled client-side)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        session_id: sessionId
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
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

// =======================
// LOGOUT ROUTE
// =======================
router.post("/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      // Here you could add token to blacklist if needed
      // For now, just log the logout
      const decoded = jwt.decode(token);
      if (decoded) {
        await writeAuditLog({
          session_id: decoded.session_id,
          username: decoded.username,
          role: decoded.role,
          event: "LOGOUT_SUCCESS",
          page: "/",
          details: { user_id: decoded.id },
          ip_address: req.ip,
          user_agent: req.headers["user-agent"] || "",
        });
      }
    }
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err.message);
    res.status(500).json({ message: "Logout failed" });
  }
});

// =======================
// VERIFY TOKEN ROUTE
// =======================
router.get("/verify", (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    res.json({ valid: true, user: decoded });
  } catch (err) {
    console.error("Token verification error:", err.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

module.exports = router;
