// routes/patients.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

// PostgreSQL pool (make sure to import the same config or pass pool from server.js)
const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "",
  database: process.env.POSTGRES_DB || "RIS",
});

// ======================================================
// Helper: Extract age from patient name
// ======================================================
function extractAgeFromName(name) {
  if (!name) return "N/A";
  const ageMatch = name.match(/(\d{1,3})\s*Y/i);
  if (ageMatch) return ageMatch[1];
  const monthMatch = name.match(/(\d{1,2})\s*MONTH/i);
  if (monthMatch) return monthMatch[1] + " Months";
  return "N/A";
}

// ======================================================
// File upload setup for patient ID proof
// ======================================================
const patientDocsDir = path.join(__dirname, "../uploads/patient_docs");
if (!fs.existsSync(patientDocsDir)) {
  fs.mkdirSync(patientDocsDir, { recursive: true });
}

const patientUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, patientDocsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `PAT_${Date.now()}${ext}`);
  },
});

const uploadPatient = multer({
  storage: patientUploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
});

// ======================================================
// Generate unique patient ID
// ======================================================
function generatePatientId() {
  return `HIS${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// ======================================================
// Create a new patient
// ======================================================
router.post("/", uploadPatient.single("id_proof_path"), async (req, res) => {
  try {
    const { first_name, last_name, gender, dob, mobile } = req.body;

    if (!first_name || !last_name || !gender) {
      return res.status(400).json({ error: "First name, last name, and gender are required" });
    }

    const idProofPath = req.file ? `/uploads/patient_docs/${req.file.filename}` : null;
    const patientId = generatePatientId();

    const result = await pool.query(
      `INSERT INTO patients 
        (patient_id, first_name, last_name, gender, dob, mobile, id_proof_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [patientId, first_name, last_name, gender, dob || null, mobile || null, idProofPath]
    );

    res.status(201).json({ success: true, patient: result.rows[0] });
  } catch (err) {
    console.error("Patient registration error:", err.message);
    res.status(500).json({ error: "Failed to register patient" });
  }
});

// ======================================================
// Get all patients OR count by date
// ======================================================
router.get("/", async (req, res) => {
  const { date } = req.query;

  try {
    if (date) {
      const result = await pool.query(
        "SELECT COUNT(*) FROM patients WHERE DATE(created_at) = $1",
        [date]
      );
      res.json({ count: parseInt(result.rows[0].count, 10) });
    } else {
      const result = await pool.query(
        "SELECT * FROM patients ORDER BY created_at DESC"
      );
      res.json(result.rows);
    }
  } catch (err) {
    console.error("Error fetching patients:", err.message);
    res.status(500).json({ count: 0 });
  }
});

module.exports = router;
