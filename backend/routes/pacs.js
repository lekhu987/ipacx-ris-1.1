require("dotenv").config();
const express = require("express");
const router = express.Router();
const axios = require("axios");
const net = require("net");
const pool = require("../db"); // ✅ shared db.js

// ======================================================
// ORTHANC CONFIG
// ======================================================
const ORTHANC_URL = (process.env.ORTHANC_URL || "http://localhost:8042/").replace(/\/?$/, "/");
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USER || "orthanc",
  password: process.env.ORTHANC_PASS || "orthanc",
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
// GET ALL PACS
// ======================================================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM pacs ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch PACS error:", err.message);
    res.status(500).json({ error: "Failed to fetch PACS" });
  }
});

// ======================================================
// ADD / UPDATE PACS
// ======================================================
router.post("/", async (req, res) => {
  const { id, pacs_name, ae_title, ip_address, port } = req.body;

  if (!pacs_name || !ae_title || !ip_address || !port) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    if (id) {
      const result = await pool.query(
        `UPDATE pacs
         SET pacs_name=$1, ae_title=$2, ip_address=$3, port=$4
         WHERE id=$5
         RETURNING *`,
        [pacs_name, ae_title, ip_address, port, id]
      );
      if (!result.rows.length) return res.status(404).json({ error: "PACS not found" });
      res.json(result.rows[0]);
    } else {
      const result = await pool.query(
        `INSERT INTO pacs (pacs_name, ae_title, ip_address, port)
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [pacs_name, ae_title, ip_address, port]
      );
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error("Save PACS error:", err.message);
    res.status(500).json({ error: "Failed to save PACS" });
  }
});

// ======================================================
// DELETE PACS
// ======================================================
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM pacs WHERE id=$1 RETURNING *", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "PACS not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete PACS error:", err.message);
    res.status(500).json({ error: "Failed to delete PACS" });
  }
});

// ======================================================
// ACTIVATE / DEACTIVATE PACS
// ======================================================
router.post("/:id/activate", async (req, res) => {
  try {
    await pool.query("UPDATE pacs SET is_active=false");
    await pool.query("UPDATE pacs SET is_active=true WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Activate PACS error:", err.message);
    res.status(500).json({ error: "Failed to activate PACS" });
  }
});

router.post("/:id/deactivate", async (req, res) => {
  try {
    await pool.query("UPDATE pacs SET is_active=false WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Deactivate PACS error:", err.message);
    res.status(500).json({ error: "Failed to deactivate PACS" });
  }
});

// ======================================================
// TEST PACS CONNECTION (TCP)
// ======================================================
router.post("/test", async (req, res) => {
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

// ======================================================
// GET STUDIES FROM ORTHANC (DATE FILTER)
// ======================================================
router.post("/studies", async (req, res) => {
   try {
      const { pacs_id, startDate, endDate } = req.body;
  
      if (!pacs_id) return res.status(400).json({ error: "pacs_id required" });
  
      // Build search payload
      const findPayload = { Level: "Study", Query: {}, Limit: 200 };
      if (startDate && endDate) findPayload.Query.StudyDate = `${startDate}-${endDate}`;
  
      const { data: studyIds } = await axios.post(
        `${ORTHANC_URL}tools/find`,
        findPayload,
        { auth: ORTHANC_AUTH }
      );
  
      if (!Array.isArray(studyIds) || studyIds.length === 0) return res.json([]);
  
      const studies = await Promise.all(
        studyIds.map(async (studyId) => {
          try {
            const { data: study } = await axios.get(`${ORTHANC_URL}studies/${studyId}`, { auth: ORTHANC_AUTH });
  
            const patientName = study.PatientMainDicomTags?.PatientName || "N/A";
            const sexRaw = study.PatientMainDicomTags?.PatientSex || "O";
            const patientSex = sexRaw === "M" ? "Male" : sexRaw === "F" ? "Female" : "Other";
  
            // ✅ Modality: try ModalitiesInStudy first, then first series, then fallback
            let modality = study.MainDicomTags?.ModalitiesInStudy?.[0] || null;
            if (!modality && study.Series?.length > 0) {
              const series = await axios.get(`${ORTHANC_URL}series/${study.Series[0]}`, { auth: ORTHANC_AUTH });
              modality = series.data.MainDicomTags?.Modality || "N/A";
            }
            if (!modality) modality = study.MainDicomTags?.Modality || "N/A";
  
            return {
              PatientID: study.PatientMainDicomTags?.PatientID || "N/A",
              PatientName: patientName,
              PatientAge: extractAgeFromName(patientName),
              PatientSex: patientSex,
              AccessionNumber: study.MainDicomTags?.AccessionNumber || "N/A",
              StudyDescription: study.MainDicomTags?.StudyDescription || "No Description",
              StudyDate: study.MainDicomTags?.StudyDate || "N/A",
              Modality: modality,
              PACS: "orthanc",
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
      res.status(500).json({ error: "Failed to fetch studies" });
    }
  });
  
// ======================================================
// SYNC STUDIES INTO DB
// ======================================================
router.post("/:id/sync", async (req, res) => {
  try {
    const { data: studyIds } = await axios.get(`${ORTHANC_URL}studies`, { auth: ORTHANC_AUTH });
    let synced = 0;

    for (const sid of studyIds) {
      try {
        const { data: study } = await axios.get(`${ORTHANC_URL}studies/${sid}`, { auth: ORTHANC_AUTH });
        const p = study.PatientMainDicomTags || {};
        const s = study.MainDicomTags || {};
        if (!s.StudyInstanceUID) continue;

        await pool.query(
          `
          INSERT INTO studies (
            study_uid, patient_id, patient_name,
            patient_sex, patient_age, accession_number,
            study_date, study_description, modality, source
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
            s.ModalitiesInStudy?.join(",") || "N/A",
          ]
        );
        synced++;
      } catch (err) {
        console.error("Sync failed:", err.message);
      }
    }

    res.json({ success: true, synced });
  } catch (err) {
    console.error("Sync error:", err.message);
    res.status(500).json({ error: "Failed to sync studies" });
  }
});

module.exports = router;
