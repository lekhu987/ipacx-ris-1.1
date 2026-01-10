const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authenticate = require("../middleware/auth");
const JWT_SECRET = process.env.JWT_SECRET;
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }
  try {
    const result = await pool.query(
      `SELECT id, username, email, password_hash, role, is_active
       FROM users
       WHERE username = $1 OR email = $1`,
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ message: "User account is inactive" });
    }
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    const expiresIn = "8h"; 
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn }
    );
   const expiresAt = new Date(Date.now() + 45 * 60 * 1000);
    res.json({
      accessToken,
      expiresAt,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// CHECK LOGGED-IN USER
router.get("/me", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, role FROM users WHERE id = $1",
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
module.exports = router;
