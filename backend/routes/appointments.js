// routes/appointments.js
const express = require("express");
const router = express.Router();
const { Pool } = require("pg");

// PostgreSQL pool (make sure to use same config or pass pool from server.js)
const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "",
  database: process.env.POSTGRES_DB || "RIS",
});

// ======================================================
// Get appointments by date
// ======================================================
router.get("/", async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Date query parameter is required" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM appointments WHERE appointment_date = $1 ORDER BY appointment_time ASC",
      [date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching appointments:", err.message);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

module.exports = router;
