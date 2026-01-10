const jwt = require("jsonwebtoken");
const pool = require("../db");

const IDLE_LIMIT = 45 * 60 * 1000; // 45 minutes

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = header.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Malformed token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔍 Get last activity from DB
    const result = await pool.query(
      "SELECT last_activity FROM users WHERE id = $1",
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const lastActivity = result.rows[0].last_activity;

    // ⏱️ IDLE CHECK
    if (lastActivity) {
      const idleTime = Date.now() - new Date(lastActivity).getTime();

      if (idleTime > IDLE_LIMIT) {
        return res.status(401).json({
          error: "Session expired due to inactivity"
        });
      }
    }

    // ✅ Update activity (sliding session)
    await pool.query(
      "UPDATE users SET last_activity = NOW() WHERE id = $1",
      [decoded.id]
    );

    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = authenticate;
