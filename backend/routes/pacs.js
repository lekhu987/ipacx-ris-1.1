// backend/routes/pacs.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { Pool } = require("pg");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

const pool = new Pool({
  host: "localhost",
  user: "postgres",
  database: "RIS",
  port: 5432,
});

/* ================= GET ALL PACS ================= */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM pacs_config ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch PACS:", err.message);
    res.status(500).json({ error: "Failed to fetch PACS" });
  }
});

/* ================= ACTIVATE PACS ================= */
router.post("/:id/activate", authenticateToken, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    // Disable all first
    await pool.query("UPDATE pacs_config SET is_active=false");

    // Activate selected
    await pool.query("UPDATE pacs_config SET is_active=true WHERE id=$1", [req.params.id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, username, action, file_or_endpoint)
       VALUES ($1,$2,$3,$4)`,
      [req.user.id, req.user.username, "Activated PACS", "/api/pacs/:id/activate"]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to activate PACS:", err.message);
    res.status(500).json({ error: "Failed to activate PACS" });
  }
});

/* ================= GET STUDIES FROM PACS ================= */
router.get("/:id/studies", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch PACS config
    const pacsRes = await pool.query(
      "SELECT * FROM pacs_config WHERE id=$1 AND is_active=true",
      [id]
    );

    if (!pacsRes.rows.length) return res.status(404).json({ error: "PACS not found or inactive" });

    const pacs = pacsRes.rows[0];
    const baseUrl = `${pacs.protocol || "http"}://${pacs.ip_address}:${pacs.port}/`;
    const auth = pacs.username ? { username: pacs.username, password: pacs.password } : undefined;

    // Fetch study IDs
    const { data: studyIds } = await axios.get(`${baseUrl}studies`, { auth });

    const studies = [];

    for (const sid of studyIds) {
      try {
        const { data: study } = await axios.get(`${baseUrl}studies/${sid}?expand=true`, { auth });

        const patientName = study.PatientMainDicomTags?.PatientName || "N/A";
        const sexRaw = study.PatientMainDicomTags?.PatientSex || "O";
        const patientSex = sexRaw === "M" ? "M" : sexRaw === "F" ? "F" : "O";

        let seriesCount = 0,
          instancesCount = 0,
          modality = "N/A";

        if (study.Series?.length > 0) {
          seriesCount = study.Series.length;
          const seriesInfo = await Promise.all(
            study.Series.map((sid) => axios.get(`${baseUrl}series/${sid}`, { auth }))
          );
          modality =
            seriesInfo[0]?.data?.MainDicomTags?.Modality || study.MainDicomTags?.Modality || "N/A";
          instancesCount = seriesInfo.reduce((sum, s) => sum + (s.data?.Instances?.length || 0), 0);
        }

        studies.push({
          PatientID: study.PatientMainDicomTags?.PatientID || "N/A",
          PatientName: patientName,
          PatientAge: study.PatientMainDicomTags?.PatientAge || "",
          PatientSex: patientSex,
          AccessionNumber: study.MainDicomTags?.AccessionNumber || "",
          StudyDescription: study.MainDicomTags?.StudyDescription || "",
          StudyDate: study.MainDicomTags?.StudyDate || "",
          Modality: modality,
          Series: seriesCount,
          Instances: instancesCount,
          StudyInstanceUID: study.MainDicomTags?.StudyInstanceUID || study.ID,
        });
      } catch (err) {
        console.error(`Failed to fetch study ${sid}:`, err.message);
      }
    }

    res.json(studies);
  } catch (err) {
    console.error("Live PACS study error:", err.message);
    res.status(500).json({ error: "Failed to fetch PACS studies" });
  }
});

/* ================= SYNC STUDIES ================= */
router.post("/:id/sync", authenticateToken, authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.body;

    const pacsRes = await pool.query(
      "SELECT * FROM pacs_config WHERE id=$1 AND is_active=true",
      [id]
    );

    if (!pacsRes.rows.length) return res.status(404).json({ error: "PACS not found or inactive" });

    const pacs = pacsRes.rows[0];
    const baseUrl = `${pacs.protocol || "http"}://${pacs.ip_address}:${pacs.port}/`;
    const auth = pacs.username ? { username: pacs.username, password: pacs.password } : undefined;

    const { data: studyIds } = await axios.get(`${baseUrl}studies`, { auth });
    let synced = 0;

    for (const sid of studyIds) {
      try {
        const { data: study } = await axios.get(`${baseUrl}studies/${sid}?expand=true`, { auth });

        const p = study.PatientMainDicomTags || {};
        const s = study.MainDicomTags || {};
        if (!s.StudyInstanceUID) continue;

        const modality = study.Series?.[0]?.MainDicomTags?.Modality || "N/A";

        await pool.query(
          `
          INSERT INTO studies (
            study_uid,
            patient_id,
            patient_name,
            patient_sex,
            patient_age,
            accession_number,
            study_date,
            study_description,
            modality,
            series_count,
            instance_count,
            source
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PACS')
          ON CONFLICT (study_uid)
          DO UPDATE SET
            patient_name = EXCLUDED.patient_name,
            patient_sex = EXCLUDED.patient_sex,
            patient_age = EXCLUDED.patient_age,
            modality = EXCLUDED.modality,
            synced_at = NOW()
          `,
          [
            s.StudyInstanceUID,
            p.PatientID || "",
            p.PatientName || "N/A",
            p.PatientSex || "N/A",
            p.PatientAge || "",
            s.AccessionNumber || "",
            s.StudyDate || "",
            s.StudyDescription || "",
            modality,
            study.Series?.length || 0,
            study.Instances?.length || 0,
          ]
        );

        synced++;
      } catch (err) {
        console.error(`Failed to sync study ${sid}:`, err.message);
      }
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, username, action, file_or_endpoint)
       VALUES ($1,$2,$3,$4)`,
      [req.user.id, req.user.username, `Synced ${synced} PACS studies`, "/api/pacs/:id/sync"]
    );

    res.json({ success: true, synced });
  } catch (err) {
    console.error("Failed to sync studies:", err.message);
    res.status(500).json({ error: "Failed to sync studies" });
  }
});

module.exports = router;
