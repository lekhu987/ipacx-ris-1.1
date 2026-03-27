const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getClientIp, newSessionId, writeAuditLog } = require("../utils/auditLogger");
const requireAuth = require("../middleware/auth");
const authService = require("../services/authService");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !String(secret).trim()) return null;
  return String(secret);
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttempts = new Map();

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  const now = Date.now();
  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

function issueToken({ id, username, role, session_id }, jwtSecret) {
  return jwt.sign(
    {
      id,
      username,
      role,
      session_id,
    },
    jwtSecret,
    { expiresIn: "24h" }
  );
}

async function login(req, res) {
  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return res.status(500).json({ message: "JWT_SECRET is not configured" });
    }
    const { username, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    if (isRateLimited(ipAddress)) {
      await writeAuditLog({
        event: "LOGIN_FAILED",
        username: username || null,
        details: { reason: "rate_limited" },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return res.status(429).json({ message: "Too many login attempts. Try again later." });
    }

    if (!username || !password) {
      recordFailedAttempt(ipAddress);
      await writeAuditLog({
        event: "LOGIN_FAILED",
        username: username || null,
        details: { reason: "missing_credentials" },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await authService.findUserByUsername(username);
    if (!user) {
      recordFailedAttempt(ipAddress);
      await writeAuditLog({
        event: "LOGIN_FAILED",
        username,
        details: { reason: "user_not_found" },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.is_active) {
      recordFailedAttempt(ipAddress);
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
      recordFailedAttempt(ipAddress);
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

    const token = issueToken(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        session_id: sessionId,
      },
      jwtSecret
    );

    clearAttempts(ipAddress);

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
}

async function logout(req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
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
}

function verify(req, res) {
  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return res.status(500).json({ message: "JWT_SECRET is not configured" });
    }
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, jwtSecret);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    console.error("Token verification error:", err.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

async function me(req, res) {
  try {
    const user = await authService.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: "Account disabled" });
    }
    res.json({ user });
  } catch (err) {
    console.error("Me error:", err.message);
    res.status(500).json({ message: "Failed to load user" });
  }
}

async function refresh(req, res) {
  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return res.status(500).json({ message: "JWT_SECRET is not configured" });
    }

    const user = await authService.findBasicUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: "Account disabled" });
    }

    const token = issueToken(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        session_id: req.user.session_id,
      },
      jwtSecret
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        session_id: req.user.session_id,
      },
    });
  } catch (err) {
    console.error("Refresh error:", err.message);
    res.status(500).json({ message: "Token refresh failed" });
  }
}

module.exports = {
  login,
  logout,
  verify,
  me,
  refresh,
  requireAuth,
};
