// routes/patients.js

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

// =============================
// PostgreSQL Connection
// =============================
const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "",
  database: process.env.POSTGRES_DB || "RIS",
});

// =============================
// Upload Folder Setup
// =============================
const uploadDir = path.join(__dirname, "../uploads/patient_docs");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// =============================
// Multer Storage
// =============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `PAT_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
});

// =============================
// Generate UHID
// =============================
function generateUHID() {
  return `UHID${Date.now()}${Math.floor(Math.random() * 100)}`;
}

// =============================
// CREATE PATIENT
// =============================
router.post("/", upload.single("id_proof_path"), async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      gender,
      dob,
      age,
      mobile,
      email,
      address,
      idType,
      idNumber,
      biometric_flag,
      data_privacy_accepted,
      consent_image_sharing,
      consent_telemedicine,
      digital_signature,
    } = req.body;

    // Basic validation
    if (!first_name || !last_name || !gender) {
      return res.status(400).json({
        success: false,
        message: "First Name, Last Name, and Gender are required",
      });
    }

    const uhid = generateUHID();
    const idProofPath = req.file ? `/uploads/patient_docs/${req.file.filename}` : null;

    const result = await pool.query(
      `
      INSERT INTO patients (
        uhid,
        first_name,
        last_name,
        gender,
        dob,
        age,
        mobile,
        email,
        address,
        id_type,
        id_number,
        biometric_flag,
        id_proof_path,
        data_privacy_accepted,
        consent_image_sharing,
        consent_telemedicine,
        digital_signature
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,$17
      )
      RETURNING *
      `,
      [
        uhid,
        first_name,
        last_name,
        gender,
        dob || null,
        age || null,
        mobile || null,
        email || null,
        address || null,
        idType || null,
        idNumber || null,
        biometric_flag === "true" || biometric_flag === true,
        idProofPath,
        data_privacy_accepted === "true" || data_privacy_accepted === true,
        consent_image_sharing === "true" || consent_image_sharing === true,
        consent_telemedicine === "true" || consent_telemedicine === true,
        digital_signature || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Patient Registered Successfully",
      patient: result.rows[0],
    });
  } catch (error) {
    console.error("Patient Create Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error while creating patient",
    });
  }
});

// =============================
// GET ALL PATIENTS
// =============================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM patients ORDER BY created_at DESC");

    res.json({
      success: true,
      count: result.rowCount,
      patients: result.rows,
    });
  } catch (error) {
    console.error("Fetch Patients Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patients",
    });
  }
});

// =============================
// GET SINGLE PATIENT
// =============================
router.get("/:uhid", async (req, res) => {
  try {
    const { uhid } = req.params;

    const result = await pool.query("SELECT * FROM patients WHERE uhid = $1", [uhid]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({
      success: true,
      patient: result.rows[0],
    });
  } catch (error) {
    console.error("Get Patient Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// =============================
// DELETE PATIENT
// =============================
router.delete("/:uhid", async (req, res) => {
  try {
    const { uhid } = req.params;

    await pool.query("DELETE FROM patients WHERE uhid = $1", [uhid]);

    res.json({
      success: true,
      message: "Patient deleted successfully",
    });
  } catch (error) {
    console.error("Delete Patient Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete patient",
    });
  }
});

module.exports = router;
