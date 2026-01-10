require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = "8h";

// Utils
const generateFinalReportPDF = require("./utils/generateFinalReportPDF");

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',  // frontend URL
  credentials: true                 // allow cookies
}));
app.use(express.json());
app.use(
  "/uploads/report_images",
  express.static(path.join(__dirname, "uploads/report_images"))
);
app.use(cookieParser());

// ======================================================
// PostgreSQL CONNECTION
// ======================================================
const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "",
  database: process.env.POSTGRES_DB || "RIS",
});

// ======================================================
// ORTHANC CONNECTION CONFIG
// ======================================================
const ORTHANC_URL = (process.env.ORTHANC_URL || "http://192.168.1.34:8042/").replace(/\/?$/, "/");
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USER || "lekhana",
  password: process.env.ORTHANC_PASS || "lekhana",
};

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
// JWT Authentication Middleware
// ======================================================
function authenticateToken(req, res, next) {
  const token = req.cookies.accessToken || (req.headers["authorization"] && req.headers["authorization"].split(" ")[1]);
  if (!token) {
    return res.status(401).json({ error: "Token missing" });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
}

// ======================================================
// Role Authorization Middleware
// ======================================================
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
}

// login route
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username & password required" });
    }
    const result = await pool.query(
      `
      SELECT id, username, role, password_hash, is_active
      FROM users
      WHERE username = $1
      `,
      [username]
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    // 🚫 inactive user
    if (!user.is_active) {
      return res.status(403).json({
        message: "Account is disabled. Contact admin."
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      accessToken,
      expiresAt,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ======================================================
// AUTH: Get logged-in user
// ======================================================
app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role
  });
});

// ======================================================
// AUTH: Change Password
// ======================================================
app.put("/api/auth/change-password", authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Old & new password required" });
  }

  const result = await pool.query(
    "SELECT password_hash FROM users WHERE id=$1",
    [req.user.id]
  );
  const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: "Old password incorrect" });

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    "UPDATE users SET password_hash=$1 WHERE id=$2",
    [hash, req.user.id]
  );

  res.json({ success: true });
});

// USERS: Create user (ADMIN only)
app.post("/api/users", authenticateToken, authorizeRoles("ADMIN"), async (req, res) => {
  const { username, password, role, email } = req.body;
  if (!username || !password || !role || !email) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, email)
       VALUES ($1,$2,$3,$4)
       RETURNING id, username, email, role, is_active`,
      [username, hash, role, email]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});


// ======================================================
// USERS: Toggle active/inactive (ADMIN only)
// ======================================================
app.put("/api/users/:id/toggle", authenticateToken, authorizeRoles("ADMIN"), async (req, res) => {
  const result = await pool.query(
    `UPDATE users
     SET is_active = NOT is_active
     WHERE id=$1
     RETURNING id, is_active`,
    [req.params.id]
  );

  res.json(result.rows[0]);
});


// GET all users (ADMIN only)
app.get("/api/users", authenticateToken, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, role, is_active, created_at
       FROM users
       ORDER BY id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch users error:", err.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});
// Update user (ADMIN only)
app.put("/api/users/:id", authenticateToken, authorizeRoles("ADMIN"), async (req, res) => {
  const { username, password, role, email } = req.body;
  const { id } = req.params;

  try {
    let query = `UPDATE users SET username=$1, role=$2, email=$3`;
    const values = [username, role, email, id];

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query += `, password_hash=$4 WHERE id=$5 RETURNING id, username, email, role, is_active`;
      values[3] = hash;
      values[4] = id;
    } else {
      query += ` WHERE id=$4 RETURNING id, username, email, role, is_active`;
    }

    const result = await pool.query(query, values);
    if (!result.rows.length) return res.status(404).json({ error: "User not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});
// Delete user (ADMIN only)
app.delete("/api/users/:id", authenticateToken, authorizeRoles("ADMIN"), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id=$1 RETURNING id, username",
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});



/* ======================================================
   GET STUDIES FROM ORTHANC
====================================================== */
app.get("/api/studies", async (req, res) => {
  try {
    const { data: studyIds } = await axios.get(`${ORTHANC_URL}studies`, { auth: ORTHANC_AUTH });
    const studies = [];

    for (const id of studyIds) {
      try {
        const { data: study } = await axios.get(`${ORTHANC_URL}studies/${id}`, { auth: ORTHANC_AUTH });
        const patientName = study.PatientMainDicomTags?.PatientName || "N/A";
        const sexRaw = study.PatientMainDicomTags?.PatientSex || "O";
        const patientSex = sexRaw === "M" ? "Male" : sexRaw === "F" ? "Female" : "Other";

        let seriesCount = 0, instancesCount = 0, modality = "N/A";

        if (study.Series?.length > 0) {
          seriesCount = study.Series.length;
          const seriesInfo = await Promise.all(
            study.Series.map(sid => axios.get(`${ORTHANC_URL}series/${sid}`, { auth: ORTHANC_AUTH }))
          );
          modality = seriesInfo[0]?.data?.MainDicomTags?.Modality || study.MainDicomTags?.Modality || "N/A";
          instancesCount = seriesInfo.reduce((sum, s) => sum + (s.data?.Instances?.length || 0), 0);
        }

        studies.push({
          PatientID: study.PatientMainDicomTags?.PatientID || "N/A",
          PatientName: patientName,
          PatientAge: extractAgeFromName(patientName),
          PatientSex: patientSex,
          AccessionNumber: study.MainDicomTags?.AccessionNumber || "N/A",
          StudyDescription: study.MainDicomTags?.StudyDescription || "",
          StudyDate: study.MainDicomTags?.StudyDate || "",
          Modality: modality,
          Series: seriesCount,
          Instances: instancesCount,
          StudyInstanceUID: study.MainDicomTags?.StudyInstanceUID || study.ID,
        });
      } catch (err) {
        console.error(`Study load error ${id}:`, err.message);
      }
    }

    res.json(studies);
  } catch (err) {
    console.error("Study fetch failed:", err.message);
    res.status(500).json({ error: "Failed to fetch studies" });
  }
});


// Add MWL
app.post("/api/mwl", async (req, res) => {
  try {
    const entry = req.body;
    if (!entry.PatientName || !entry.Modality) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO mwl
       (PatientID, PatientName, PatientSex, PatientAge,
        AccessionNumber, StudyDescription, SchedulingDate,
        Modality, BodyPartExamined, ReferringPhysician)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        entry.PatientID || `P${Date.now()}`,
        entry.PatientName,
        entry.PatientSex || "O",
        entry.PatientAge || "N/A",
        entry.AccessionNumber || "",
        entry.StudyDescription || "",
        entry.SchedulingDate || new Date(),
        entry.Modality,
        entry.BodyPartExamined || "",
        entry.ReferringPhysician || "",
      ]
    );

    res.json({ message: "Added to MWL successfully", entry: result.rows[0] });
  } catch (err) {
    console.error("MWL add error:", err.message);
    res.status(500).json({ error: "Failed to add MWL" });
  }
});

// List MWL
app.get("/api/mwl", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM mwl ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("MWL fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch MWL" });
  }
});

// Delete MWL
app.delete("/api/mwl/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM mwl WHERE id=$1 RETURNING *", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "MWL entry not found" });
    res.json({ message: "MWL entry deleted", deleted: result.rows[0] });
  } catch (err) {
    console.error("MWL delete error:", err.message);
    res.status(500).json({ error: "Failed to delete MWL" });
  }
});

// Update MWL
app.put("/api/mwl/:id", async (req, res) => {
  try {
    const entry = req.body;
    const result = await pool.query(
      `UPDATE mwl SET
       PatientID=$1, PatientName=$2, PatientSex=$3, PatientAge=$4,
       AccessionNumber=$5, StudyDescription=$6, SchedulingDate=$7,
       Modality=$8, BodyPartExamined=$9, ReferringPhysician=$10
       WHERE id=$11 RETURNING *`,
      [
        entry.PatientID, entry.PatientName, entry.PatientSex, entry.PatientAge,
        entry.AccessionNumber, entry.StudyDescription, entry.SchedulingDate,
        entry.Modality, entry.BodyPartExamined, entry.ReferringPhysician,
        req.params.id,
      ]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "MWL entry not found" });
    res.json({ message: "MWL updated", entry: result.rows[0] });
  } catch (err) {
    console.error("MWL update error:", err.message);
    res.status(500).json({ error: "Failed to update MWL" });
  }
});

/* ======================================================
   SEND MWL ENTRY TO MODALITY
====================================================== */
app.post("/api/mwl/:id/send", async (req, res) => {
  try {
    let { modality, orthancModalityName } = req.body;
    const result = await pool.query("SELECT * FROM mwl WHERE id=$1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "MWL entry not found" });

    const entry = result.rows[0];
    modality = modality || entry.Modality;
    if (!modality && !orthancModalityName) return res.status(400).json({ error: "No modality available to send" });

    const MODALITY_MAP = { CT: "CT_PACS", MR: "MR_PACS", US: "US_PACS", CR: "CR_PACS", DX: "XRAY_PACS" };
    const target = orthancModalityName || MODALITY_MAP[modality];
    if (!target) return res.status(400).json({ error: "Unsupported modality" });

    let orthancStudyId = entry.studyinstanceuid;
    if (!orthancStudyId) {
      const search = { Level: "Study", Query: {} };
      if (entry.accessionnumber) search.Query.AccessionNumber = entry.accessionnumber;
      if (entry.patientid) search.Query.PatientID = entry.patientid;
      if (!search.Query.PatientID && !search.Query.AccessionNumber) search.Query.PatientName = entry.patientname;

      const find = await axios.post(`${ORTHANC_URL}tools/find`, search, { auth: ORTHANC_AUTH });
      if (!find.data?.length) return res.status(404).json({ error: "No matching Orthanc study found" });
      orthancStudyId = find.data[0];
    }

    const forward = await axios.post(
      `${ORTHANC_URL}modalities/${target}/store`,
      { Level: "Study", Resources: [orthancStudyId] },
      { auth: ORTHANC_AUTH }
    );

    res.json({ success: true, sentTo: target, orthancStudyId, job: forward.data });
  } catch (err) {
    console.error("Send error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to send MWL", details: err.response?.data || err.message });
  }
});

/* ======================================================
   GET STUDY + REPORT BY STUDY UID (FOR PREFILL)
====================================================== */
app.get("/api/study-report/:uid", authenticateToken, async (req, res) => {
  try {
    const { uid } = req.params;

    // 1️⃣ Fetch study info
    const studyRes = await pool.query(
      `SELECT * FROM studies WHERE study_uid=$1`,
      [uid]
    );

    if (!studyRes.rows.length) {
      return res.status(404).json({ error: "Study not found" });
    }
    const study = studyRes.rows[0];

    // 2️⃣ Fetch latest report (Draft / Final / Addendum)
    const reportRes = await pool.query(
      `
      SELECT r.*, 
        (SELECT reason FROM report_addendums 
         WHERE report_id = r.id 
         ORDER BY created_at DESC LIMIT 1) AS addendum_reason
      FROM reports r
      WHERE r.study_uid = $1
      ORDER BY 
        (r.status = 'Addendum') DESC,
        r.created_at DESC
      LIMIT 1
      `,
      [uid]
    );

    const report = reportRes.rows.length ? reportRes.rows[0] : null;

    // 3️⃣ Fetch report images if report exists
    let images = [];
    if (report) {
      const imagesRes = await pool.query(
        `SELECT image_path, image_type, sort_order 
         FROM report_images 
         WHERE report_id=$1 
         ORDER BY sort_order`,
        [report.id]
      );
      images = imagesRes.rows;
    }

    // 4️⃣ Return combined data
    res.json({
      study,
      report: report
        ? {
            ...report,
            report_content: report.report_content,
            report_title: report.report_title,
            body_part: report.body_part,
            referring_doctor: report.referring_doctor,
            images
          }
        : null
    });

  } catch (err) {
    console.error("Study-Report fetch error:", err);
    res.status(500).json({ error: "Failed to fetch study and report data" });
  }
});

/* ======================================================
   GET STUDY DETAILS BY UID
====================================================== */
app.get("/api/studies/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;
    const find = await axios.post(`${ORTHANC_URL}tools/find`, { Level: "Study", Query: { StudyInstanceUID: uid } }, { auth: ORTHANC_AUTH });
    if (!find.data?.length) return res.json({ message: "No study found" });

    const studyId = find.data[0];
    const study = await axios.get(`${ORTHANC_URL}studies/${studyId}`, { auth: ORTHANC_AUTH });
    const s = study.data;

    let modality = "", bodyPart = "";
    if (s.Series?.length) {
      const series = await axios.get(`${ORTHANC_URL}series/${s.Series[0]}`, { auth: ORTHANC_AUTH });
      modality = series.data.MainDicomTags.Modality || "";
      bodyPart = series.data.MainDicomTags.BodyPartExamined || "";
    }

    res.json({
      PatientID: s.PatientMainDicomTags.PatientID,
      PatientName: s.PatientMainDicomTags.PatientName,
      PatientSex: s.PatientMainDicomTags.PatientSex,
      PatientAge: s.PatientMainDicomTags.PatientAge,
      StudyInstanceUID: uid,
      StudyDate: s.MainDicomTags.StudyDate,
      StudyTime: s.MainDicomTags.StudyTime,
      AccessionNumber: s.MainDicomTags.AccessionNumber,
      StudyDescription: s.MainDicomTags.StudyDescription,
      Modality: modality,
      BodyPartExamined: bodyPart,
      History: "", Findings: "", Conclusion: "",
    });
  } catch (err) {
    console.error("Fetch study error:", err.message);
    res.status(500).json({ error: "Failed to load study" });
  }
});

/* ======================================================
   GET ALL REPORTS (FOR DASHBOARD / TABLE)
====================================================== */
app.get("/api/reports", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.id,
        r.study_uid,
        r.accession_number,
        r.patient_id,
        r.patient_name,
        r.modality,
        r.status,
        r.created_at
      FROM reports r
      ORDER BY r.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch reports error:", err.message);
    res.status(500).json({ error: "Failed to load reports" });
  }
});

/* ======================================================
   REPORT IMAGE UPLOAD  (FIXED)
====================================================== */
const reportImagesDir = path.join(__dirname, "uploads/report_images");
if (!fs.existsSync(reportImagesDir)) {
  fs.mkdirSync(reportImagesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, reportImagesDir);
  },

  filename: (req, file, cb) => {
    const studyUID = req.body.studyUID;
    if (!studyUID) {
      return cb(new Error("studyUID is required"));
    }

    const ext = path.extname(file.originalname) || ".jpg";

    // find existing images for same studyUID
    const existingFiles = fs
      .readdirSync(reportImagesDir)
      .filter(f => f.startsWith(studyUID));

    const suffix = existingFiles.length
      ? `_${existingFiles.length + 1}`
      : "";

    cb(null, `${studyUID}${suffix}${ext}`);
  },
});

const upload = multer({ storage });

app.post("/api/reports/upload", upload.array("images", 10), (req, res) => {
  try {
    const paths = req.files.map(
      f => `/uploads/report_images/${f.filename}`
    );
    res.json({ success: true, paths });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ success: false });
  }
});

//save and update
app.post("/api/reports/save", async (req, res) => {
  try {
    const {
      study_uid,
      accession_number,
      patient_id,
      patient_name,
      modality,
      reported_by,
      approved_by,
      status,
      history,
      findings,
      conclusion,
      reportTitle,
      body_part,
      referring_doctor,
      image_paths,
      isAddendum,
    } = req.body;

    const reportContent = { history, findings, conclusion };
    let reportId;

    /* =========================
       ADDENDUM → ALWAYS INSERT
    ========================== */
    if (status === "Addendum" || isAddendum) {
      const result = await pool.query(
        `INSERT INTO reports (
          study_uid, accession_number, patient_id, patient_name,
          modality, report_content, reported_by, approved_by,
          status, report_title, body_part, referring_doctor
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Addendum',$9,$10,$11)
        RETURNING id`,
        [
          study_uid, accession_number, patient_id, patient_name,
          modality, reportContent, reported_by, approved_by,
          reportTitle, body_part, referring_doctor
        ]
      );
      reportId = result.rows[0].id;
    }

    /* =========================
       FINAL → UPDATE DRAFT / FINAL
    ========================== */
    else if (status === "Final") {
      // 1️⃣ Try Draft first
      const draft = await pool.query(
        `SELECT id FROM reports
         WHERE study_uid=$1 AND status='Draft'
         ORDER BY updated_at DESC LIMIT 1`,
        [study_uid]
      );

      if (draft.rows.length) {
        // Draft → Final
        const result = await pool.query(
          `UPDATE reports
           SET report_content=$1,
               reported_by=$2,
               approved_by=$3,
               status='Final',
               report_title=$4,
               body_part=$5,
               referring_doctor=$6,
               updated_at=NOW()
           WHERE id=$7
           RETURNING id`,
          [
            reportContent,
            reported_by,
            approved_by,
            reportTitle,
            body_part,
            referring_doctor,
            draft.rows[0].id
          ]
        );
        reportId = result.rows[0].id;
      } else {
        // 2️⃣ Update existing Final (no duplicate Final)
        const final = await pool.query(
          `SELECT id FROM reports
           WHERE study_uid=$1 AND status='Final'
           ORDER BY updated_at DESC LIMIT 1`,
          [study_uid]
        );

        if (final.rows.length) {
          const result = await pool.query(
            `UPDATE reports
             SET report_content=$1,
                 reported_by=$2,
                 approved_by=$3,
                 report_title=$4,
                 body_part=$5,
                 referring_doctor=$6,
                 updated_at=NOW()
             WHERE id=$7
             RETURNING id`,
            [
              reportContent,
              reported_by,
              approved_by,
              reportTitle,
              body_part,
              referring_doctor,
              final.rows[0].id
            ]
          );
          reportId = result.rows[0].id;
        } else {
          // 3️⃣ No Draft & no Final → create Final
          const result = await pool.query(
            `INSERT INTO reports (
              study_uid, accession_number, patient_id, patient_name,
              modality, report_content, reported_by, approved_by,
              status, report_title, body_part, referring_doctor

            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Final',$9,$10,$11)
            RETURNING id`,
            [
              study_uid, accession_number, patient_id, patient_name,
              modality, reportContent, reported_by, approved_by,
              reportTitle, body_part, referring_doctor
            ]
          );
          reportId = result.rows[0].id;
        }
      }
    }

    /* =========================
       DRAFT → UPDATE OR INSERT
    ========================== */
    else {
      const existingDraft = await pool.query(
        `SELECT id FROM reports
         WHERE study_uid=$1 AND status='Draft'
         ORDER BY updated_at DESC LIMIT 1`,
        [study_uid]
      );

      if (existingDraft.rows.length) {
        // UPDATE Draft
        const result = await pool.query(
          `UPDATE reports
           SET report_content=$1,
               reported_by=$2,
               approved_by=$3,
               report_title=$4,
               body_part=$5,
               referring_doctor=$6,
               updated_at=NOW()
           WHERE id=$7
           RETURNING id`,
          [
            reportContent,
            reported_by,
            approved_by,
            reportTitle,
            body_part,
            referring_doctor,
            existingDraft.rows[0].id
          ]
        );
        reportId = result.rows[0].id;
      } else {
        // INSERT Draft
        const result = await pool.query(
          `INSERT INTO reports (
            study_uid, accession_number, patient_id, patient_name,
            modality, report_content, reported_by, approved_by,
            status, report_title, body_part, referring_doctor
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Draft',$9,$10,$11)
          RETURNING id`,
          [
            study_uid, accession_number, patient_id, patient_name,
            modality, reportContent, reported_by, approved_by,
            reportTitle, body_part, referring_doctor
          ]
        );
        reportId = result.rows[0].id;
      }
    }

    /* =========================
       IMAGES (replace for that row)
    ========================== */
    if (Array.isArray(image_paths)) {
      await pool.query(`DELETE FROM report_images WHERE report_id=$1`, [reportId]);
      for (let i = 0; i < image_paths.length; i++) {
        await pool.query(
          `INSERT INTO report_images (report_id, image_path, sort_order)
           VALUES ($1,$2,$3)`,
          [reportId, image_paths[i], i + 1]
        );
      }
    }

    res.json({ success: true, reportId });
  } catch (err) {
    console.error("Save report error:", err);
    res.status(500).json({ error: "Failed to save report" });
  }
});

/* ======================================================
   GET REPORT BY STUDY UID (PREFETCH LOGIC)
====================================================== */
app.get("/api/reports/by-study/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const reportRes = await pool.query("SELECT * FROM reports WHERE study_uid=$1", [uid]);
    if (!reportRes.rows.length) return res.json(null);

    const report = reportRes.rows[0];
    const imagesRes = await pool.query(
      `SELECT image_path, image_type, sort_order
       FROM report_images
       WHERE report_id=$1
       ORDER BY sort_order`,
      [report.id]
    );

    res.json({ 
      ...report,
      report_content: report.report_content,
      report_title: report.report_title,
      body_part: report.body_part,
      referring_doctor: report.referring_doctor,
      images: imagesRes.rows 
    });
  } catch (err) {
    console.error("Fetch report error:", err.message);
    res.status(500).json({ error: "Failed to load report" });
  }
});

// POST /api/report-addendums
app.post("/api/report-addendums", async (req, res) => {
  const { report_id, study_uid, reason, created_by } = req.body;

  // 1️⃣ Validate request
  if (!report_id || !study_uid || !reason) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    // 2️⃣ Insert addendum into DB
    const result = await pool.query(
      `INSERT INTO report_addendums (report_id, study_uid, reason, created_by, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [report_id, study_uid, reason, created_by || "system"]
    );

    // 3️⃣ Return the saved addendum
    res.json({ success: true, addendum: result.rows[0] });

  } catch (err) {
    console.error("Addendum save error:", err.message);
    res.status(500).json({ success: false, error: "Failed to save addendum" });
  }
});

// Get all active modalities
app.get("/api/modalities", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, code, name FROM modalities WHERE is_active = true ORDER BY id"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch modalities error:", err.message);
    res.status(500).json({ error: "Failed to fetch modalities" });
  }
});

// Get active body parts by modality_id
app.get("/api/body-parts", async (req, res) => {
  try {
    const modality_id = req.query.modality_id;
    if (!modality_id) return res.status(400).json({ error: "modality_id is required" });

    const result = await pool.query(
      "SELECT id, name FROM body_parts WHERE modality_id = $1 AND is_active = true ORDER BY id",
      [modality_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch body parts error:", err.message);
    res.status(500).json({ error: "Failed to fetch body parts" });
  }
});

// ========================
// REPORT TEMPLATES ROUTES
// ========================

// Create a new template
app.post("/api/report-templates", async (req, res) => {
  try {
    const { template_name, modality, body_part, template_type, content, created_by, created_by_role } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const finalTemplateName =
      template_name && template_name.trim() !== ""
        ? template_name
        : modality && body_part
        ? `${modality}_${body_part}_${template_type || "plain"}`
        : null;

    const result = await pool.query(
      `
      INSERT INTO report_templates
      (template_name, modality, body_part, template_type, content, created_by, created_by_role, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
      RETURNING *
      `,
      [
        finalTemplateName,
        modality || null,
        body_part || null,
        template_type || "plain",
        JSON.stringify(content),
        created_by || null,
        created_by_role || null
      ]
    );

    const created = result.rows[0];
    created.content = content;

    res.json({ success: true, template: created });
  } catch (err) {
    console.error("Create template error:", err.message);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Template with same Modality + Body Part + Name already exists" });
    }
    res.status(500).json({ error: "Failed to create template" });
  }
});

// Get all templates
app.get("/api/report-templates", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM report_templates ORDER BY updated_at DESC");
    const templates = result.rows.map(r => ({ ...r, content: r.content }));
    res.json(templates);
  } catch (err) {
    console.error("Fetch templates error:", err.message);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Get template by ID
app.get("/api/report-templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM report_templates WHERE id=$1", [id]);
    if (!result.rows.length) return res.status(404).json({ error: "Template not found" });

    const template = result.rows[0];
    template.content = template.content; // keep as JSON
    res.json(template);
  } catch (err) {
    console.error("Fetch template error:", err.message);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// Update template
app.put("/api/report-templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { template_name, modality, body_part, template_type, content, created_by, created_by_role } = req.body;

    if (!content) return res.status(400).json({ error: "Content is required" });

    const finalTemplateName =
      template_name && template_name.trim() !== ""
        ? template_name
        : modality && body_part
        ? `${modality}_${body_part}_${template_type || "plain"}`
        : null;

    const result = await pool.query(
      `
      UPDATE report_templates
      SET
        template_name = COALESCE($1, template_name),
        modality = COALESCE($2, modality),
        body_part = COALESCE($3, body_part),
        template_type = COALESCE($4, template_type),
        content = $5::jsonb,
        created_by = COALESCE($6, created_by),
        created_by_role = COALESCE($7, created_by_role),
        updated_at = NOW()
      WHERE id=$8
      RETURNING *
      `,
      [
        finalTemplateName,
        modality || null,
        body_part || null,
        template_type || null,
        JSON.stringify(content),
        created_by || null,
        created_by_role || null,
        id
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: "Template not found" });

    const updated = result.rows[0];
    updated.content = content;
    res.json(updated);
  } catch (err) {
    console.error("Update template error:", err.message);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Template with same Modality + Body Part + Name already exists" });
    }
    res.status(500).json({ error: "Failed to update template" });
  }
});

app.get("/api/report-templates/filter", async (req, res) => {
  try {
    const { modality, body_part } = req.query;
    const conditions = [];
    const values = [];

    if (modality) {
      values.push(modality);
      conditions.push(`modality = $${values.length}`);
    }
    if (body_part) {
      values.push(body_part);
      conditions.push(`body_part = $${values.length}`);
    }

    const query = `SELECT * FROM report_templates ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""} ORDER BY updated_at DESC`;
    const result = await pool.query(query, values);
    res.json(result.rows.map(r => ({ ...r, content: r.content })));
  } catch (err) {
    console.error("Filter templates error:", err.message);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});


// Delete template
app.delete("/api/report-templates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM report_templates WHERE id=$1 RETURNING *", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Template not found" });

    res.json({ success: true, message: "Template deleted", deleted: result.rows[0] });
  } catch (err) {
    console.error("Delete template error:", err.message);
    res.status(500).json({ error: "Failed to delete template" });
  }
});


/* =========================
   GET PDF BY REPORT ID
========================= */
app.get("/api/reports/:id/pdf", async (req, res) => {
  try {
    const reportId = req.params.id;

    // We use a Subquery for addendum_reason to get the LATEST entry
    const reportRes = await pool.query(
      `SELECT r.*, 
        (SELECT reason FROM report_addendums 
         WHERE report_id = r.id 
         ORDER BY created_at DESC LIMIT 1) AS addendum_reason 
       FROM reports r 
       WHERE r.id = $1`,
      [reportId]
    );

    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const report = reportRes.rows[0];

    // Fetch associated images
    const imagesRes = await pool.query(
      `SELECT image_path FROM report_images WHERE report_id = $1 ORDER BY sort_order`,
      [reportId]
    );

    // Generate the PDF and wait for the file to be ready
   const pdfPath = await generateFinalReportPDF(
  report,
  imagesRes.rows,
  { printMode: false }   // 👈 VIEW MODE
);

    const absolutePdfPath = path.resolve(pdfPath);

    // Serve the file
    res.contentType("application/pdf");
    res.sendFile(absolutePdfPath, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        if (!res.headersSent) res.status(500).send("Error downloading PDF");
      }
    });

  } catch (err) {
    console.error("PDF Route Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =========================
   GET PDF BY STUDY UID (UPDATED)
========================= */
app.get("/api/reports/study/:studyUid/pdf", async (req, res) => {
  try {
    const { studyUid } = req.params;
    const requestedType = req.query.type; 

    // The subquery looks into report_addendums for the specific report_id
    // and grabs the single most recent reason string.
    let query = `
      SELECT r.*, 
        (SELECT reason 
         FROM report_addendums 
         WHERE report_id = r.id 
         ORDER BY created_at DESC 
         LIMIT 1) AS addendum_reason
      FROM reports r
      WHERE r.study_uid = $1
    `;
    const params = [studyUid];

    if (requestedType) {
      query += ` AND r.status = $2 ORDER BY r.created_at DESC LIMIT 1`;
      params.push(requestedType);
    } else {
      query += ` ORDER BY (r.status = 'Addendum') DESC, r.created_at DESC LIMIT 1`;
    }

    const reportRes = await pool.query(query, params);
    
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: "No report found for this study" });
    }

    const report = reportRes.rows[0];
    
    // Fetch associated images
    const imagesRes = await pool.query(
      `SELECT image_path FROM report_images WHERE report_id = $1 ORDER BY sort_order`,
      [report.id]
    );

    const pdfPath = await generateFinalReportPDF(
  report,
  imagesRes.rows,
  { printMode: false }   // explicitly VIEW MODE
);

    res.contentType("application/pdf").sendFile(path.resolve(pdfPath));

  } catch (err) {
    console.error("Study PDF Route Error:", err);
    res.status(500).send("Error generating PDF");
  }
});

/* =========================
   PRINT PDF (STATUS HIDDEN)
========================= */
app.get("/api/reports/:id/pdf/print", async (req, res) => {
  try {
    const reportId = req.params.id;

    const reportRes = await pool.query(
      `SELECT r.*, 
        (SELECT reason FROM report_addendums 
         WHERE report_id = r.id 
         ORDER BY created_at DESC LIMIT 1) AS addendum_reason 
       FROM reports r 
       WHERE r.id = $1`,
      [reportId]
    );

    if (!reportRes.rows.length) {
      return res.status(404).json({ error: "Report not found" });
    }

    const imagesRes = await pool.query(
      `SELECT image_path FROM report_images 
       WHERE report_id = $1 ORDER BY sort_order`,
      [reportId]
    );

    const pdfPath = await generateFinalReportPDF(
      reportRes.rows[0],
      imagesRes.rows,
      { printMode: true }
    );

    res.contentType("application/pdf");
    res.sendFile(path.resolve(pdfPath));
  } catch (err) {
    console.error("Print PDF error:", err);
    res.status(500).send("Error generating print PDF");
  }
});
/* ======================================================
   START SERVER
====================================================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
