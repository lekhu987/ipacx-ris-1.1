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

function generateMRN() {
  return `MRN${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
}

async function getPatientColumns() {
  const result = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients'
    `
  );
  return new Set(result.rows.map((r) => r.column_name));
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
    if (!first_name || !gender) {
      return res.status(400).json({
        success: false,
        message: "First Name and Gender are required",
      });
    }

    const uhid = generateUHID();
    const patientId = `HIS${Date.now()}`;
    const mrn = generateMRN();
    const fullName = [first_name, last_name].filter(Boolean).join(" ").trim();
    const idProofPath = req.file ? `/uploads/patient_docs/${req.file.filename}` : null;
    const patientColumns = await getPatientColumns();

    const record = {
      uhid,
      patient_id: patientId,
      mrn,
      full_name: fullName || first_name,
      first_name,
      last_name: last_name || null,
      gender,
      dob: dob || null,
      age: age || null,
      mobile: mobile || null,
      email: email || null,
      address: address || null,
      id_type: idType || null,
      id_number: idNumber || null,
      biometric_flag: biometric_flag === "true" || biometric_flag === true,
      id_proof_path: idProofPath,
      data_privacy_accepted: data_privacy_accepted === "true" || data_privacy_accepted === true,
      consent_image_sharing: consent_image_sharing === "true" || consent_image_sharing === true,
      consent_telemedicine: consent_telemedicine === "true" || consent_telemedicine === true,
      digital_signature: digital_signature || null,
    };

    const insertCols = Object.keys(record).filter((col) => patientColumns.has(col));
    const insertValues = insertCols.map((col) => record[col]);
    const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(", ");

    if (insertCols.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Patients table has no compatible columns",
      });
    }

    const result = await pool.query(
      `INSERT INTO patients (${insertCols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      insertValues
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
      error: error.message,
    });
  }
});

// =============================
// GET ALL PATIENTS
// =============================
router.get("/", async (req, res) => {
  try {
    const patientColumns = await getPatientColumns();
    const orderBy = patientColumns.has("created_at")
      ? "created_at DESC"
      : patientColumns.has("id")
      ? "id DESC"
      : patientColumns.has("patient_id")
      ? "patient_id DESC"
      : patientColumns.has("uhid")
      ? "uhid DESC"
      : "first_name ASC";

    const result = await pool.query(`SELECT * FROM patients ORDER BY ${orderBy}`);

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
      error: error.message,
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
