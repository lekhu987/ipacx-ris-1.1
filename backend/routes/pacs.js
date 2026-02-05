const express = require("express");
const router = express.Router();
const axios = require("axios");
const net = require("net");
const { Pool } = require("pg");


const pool = new Pool({
  host: "localhost",
  user: "postgres",
  database: "RIS",
  port: 5432,
});

/* ================= GET ALL PACS ================= */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM pacs_config ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch PACS:", err.message);
    res.status(500).json({ error: "Failed to fetch PACS" });
  }
});

/* ================= ACTIVATE PACS ================= */
router.post(
  "/:id/activate",
  async (req, res) => {
    try {
      await pool.query("UPDATE pacs_config SET is_active=false");
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
  }
);

/* ================= DEACTIVATE PACS ================= */
router.post(
  "/:id/deactivate",
  async (req, res) => {
    try {
      await pool.query("UPDATE pacs_config SET is_active=false WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to deactivate PACS:", err.message);
      res.status(500).json({ error: "Failed to deactivate PACS" });
    }
  }
);

/* ================= TEST PACS CONNECTION ================= */
router.post("/test",  async (req, res) => {
  const { ip_address, port } = req.body;
  if (!ip_address || !port) return res.status(400).json({ error: "IP and Port required" });

  const socket = new net.Socket();
  socket.setTimeout(3000);

  socket.on("connect", () => {
    socket.destroy();
    res.json({ success: true, message: "PACS reachable" });
  });

  socket.on("timeout", () => {
    socket.destroy();
    res.status(504).json({ error: "Connection timeout" });
  });

  socket.on("error", () => {
    res.status(500).json({ error: "Unable to connect to PACS" });
  });

  socket.connect(port, ip_address);
});

/* ================= GET STUDIES ================= */
router.post("/studies",  async (req, res) => {
  try {
    const { pacs_id, startDate, endDate } = req.body;
    if (!pacs_id) return res.json([]);

    const pacsRes = await pool.query("SELECT * FROM pacs_config WHERE id=$1 AND is_active=true", [pacs_id]);
    if (!pacsRes.rows.length) return res.json([]);

    const pacs = pacsRes.rows[0];
    const baseUrl = `${pacs.protocol || "http"}://${pacs.ip_address}:${pacs.port}/`;
    const auth = pacs.username ? { username: pacs.username, password: pacs.password } : undefined;

    const { data: studyIds } = await axios.post(
      `${baseUrl}tools/find`,
      {
        Level: "Study",
        Query: startDate && endDate ? { StudyDate: `${startDate}-${endDate}` } : {},
        Limit: 200,
      },
      { auth }
    );

    if (!Array.isArray(studyIds)) return res.json([]);

    const studies = await Promise.all(
      studyIds.map(async (studyId) => {
        try {
          const { data: study } = await axios.get(`${baseUrl}studies/${studyId}`, { auth });
          const modalities = study.MainDicomTags?.ModalitiesInStudy || [];

          return {
            PatientID: study.PatientMainDicomTags?.PatientID || "N/A",
            PatientName: study.PatientMainDicomTags?.PatientName || "N/A",
            PatientSex:
              study.PatientMainDicomTags?.PatientSex === "M"
                ? "Male"
                : study.PatientMainDicomTags?.PatientSex === "F"
                ? "Female"
                : "Other",
            PatientAge: study.PatientMainDicomTags?.PatientAge || "",
            AccessionNumber: study.MainDicomTags?.AccessionNumber || "",
            StudyDescription: study.MainDicomTags?.StudyDescription || "",
            StudyDate: study.MainDicomTags?.StudyDate || "",
            Modality: modalities.join(","), // Fix for Orthanc
            StudyInstanceUID: study.MainDicomTags?.StudyInstanceUID || study.ID,
          };
        } catch (err) {
          console.error("Failed study:", studyId, err.message);
          return null;
        }
      })
    );

    res.json(studies.filter(Boolean));
  } catch (err) {
    console.error("PACS studies error:", err.message);
    res.status(500).json([]);
  }
});

/* ================= SYNC STUDIES ================= */
router.post("/:id/sync",  async (req, res) => {
  try {
    const { id } = req.params;
    const pacsRes = await pool.query("SELECT * FROM pacs_config WHERE id=$1 AND is_active=true", [id]);
    if (!pacsRes.rows.length) return res.status(404).json({ error: "PACS not found" });

    const pacs = pacsRes.rows[0];
    const baseUrl = `${pacs.protocol || "http"}://${pacs.ip_address}:${pacs.port}/`;
    const auth = pacs.username ? { username: pacs.username, password: pacs.password } : undefined;

    const { data: studyIds } = await axios.get(`${baseUrl}studies`, { auth });
    let synced = 0;

    for (const sid of studyIds) {
      try {
        const { data: study } = await axios.get(`${baseUrl}studies/${sid}`, { auth });
        const p = study.PatientMainDicomTags || {};
        const s = study.MainDicomTags || {};
        if (!s.StudyInstanceUID) continue;

        const modality = s.ModalitiesInStudy?.join(",") || "N/A";

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
            source
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PACS')
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
            p.PatientSex || "",
            p.PatientAge || "",
            s.AccessionNumber || "",
            s.StudyDate || "",
            s.StudyDescription || "",
            modality,
          ]
        );

        synced++;
      } catch (err) {
        console.error("Sync failed:", err.message);
      }
    }

    res.json({ success: true, synced });
  } catch (err) {
    console.error("Failed to sync studies:", err.message);
    res.status(500).json({ error: "Failed to sync studies" });
  }
});

module.exports = router;
