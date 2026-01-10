const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcrypt");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

// CREATE USER (ADMIN)
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    const { username, password, email, role } = req.body;

    if (!username || !password || !email || !role) {
      return res.status(400).json({ message: "All fields required" });
    }

    try {
      const hash = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `INSERT INTO users (username, password_hash, email, role)
         VALUES ($1,$2,$3,$4)
         RETURNING id, username, email, role, is_active`,
        [username, hash, email, role]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Create user error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
