require("dotenv").config();
const express = require("express");
const router = express.Router();
const axios = require("axios");
const net = require("net");
const pool = require("../db");
const { logAction } = require("../utils/auditLogger");

/* ======================================================
   ORTHANC CONFIG
====================================================== */
const ORTHANC_URL = (process.env.ORTHANC_URL || "http://192.168.1.34:8042/").replace(/\/?$/, "/");
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USER || "lekhana",
  password: process.env.ORTHANC_PASS || "lekhana",
};

/* ======================================================
   Helper
====================================================== */
function extractAgeFromName(name) {
  if (!name) return "N/A";

  const clean = String(name);

  // Match: 34Y, 34 Y, ^34^Y, ^34Y
  const yearMatch = clean.match(/(\d{1,3})\s*\^?\s*Y\b/i);
  if (yearMatch) return yearMatch[1];

  const monthMatch = clean.match(/(\d{1,2})\s*\^?\s*(MONTH|M)\b/i);
  if (monthMatch) return `${monthMatch[1]} Months`;

  return "N/A";
}


/* ======================================================
   GET ALL PACS
====================================================== */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM pacs ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch PACS" });
  }
});

/* ======================================================
   ADD / UPDATE PACS
====================================================== */
router.post("/", async (req, res) => {
  const { id, pacs_name, pacs_type, ae_title, ip_address, port } = req.body;

  if (!pacs_name || !pacs_type || !ae_title || !ip_address || !port) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    if (id) {
      const result = await pool.query(
        `UPDATE pacs
         SET pacs_name=$1, pacs_type=$2, ae_title=$3, ip_address=$4, port=$5
         WHERE id=$6
         RETURNING *`,
        [pacs_name, pacs_type, ae_title, ip_address, port, id]
      );
      await logAction(req, {
        event: "PACS_UPDATED",
        details: {
          pacs_id: result.rows[0].id,
          pacs_name: result.rows[0].pacs_name,
          ae_title,
          ip_address,
          port,
        },
      });
      res.json(result.rows[0]);
    } else {
      const result = await pool.query(
        `INSERT INTO pacs (pacs_name, pacs_type, ae_title, ip_address, port)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [pacs_name, pacs_type, ae_title, ip_address, port]
      );
      await logAction(req, {
        event: "PACS_CREATED",
        details: {
          pacs_id: result.rows[0].id,
          pacs_name: result.rows[0].pacs_name,
          ae_title,
          ip_address,
          port,
        },
      });
      res.json(result.rows[0]);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save PACS" });
  }
});

/* ======================================================
   DELETE PACS
====================================================== */
router.delete("/:id", async (req, res) => {
  const deleted = await pool.query("DELETE FROM pacs WHERE id=$1 RETURNING id, pacs_name", [req.params.id]);
  if (deleted.rows.length) {
    await logAction(req, {
      event: "PACS_DELETED",
      details: {
        pacs_id: deleted.rows[0].id,
        pacs_name: deleted.rows[0].pacs_name,
      },
    });
  }
  res.json({ success: true });
});

/* ======================================================
   ACTIVATE / DEACTIVATE
====================================================== */
router.post("/:id/activate", async (req, res) => {
  await pool.query(
    "UPDATE pacs SET is_active=true WHERE id=$1",
    [req.params.id]
  );
  await logAction(req, {
    event: "PACS_ACTIVATED",
    details: { pacs_id: Number(req.params.id) },
  });
  res.json({ success: true });
});

router.post("/:id/deactivate", async (req, res) => {
  await pool.query("UPDATE pacs SET is_active=false WHERE id=$1", [req.params.id]);
  await logAction(req, {
    event: "PACS_DEACTIVATED",
    details: { pacs_id: Number(req.params.id) },
  });
  res.json({ success: true });
});

/* ======================================================
   TEST PACS
====================================================== */
router.post("/test", async (req, res) => {
  const { pacs_type, ip_address, port, ae_title } = req.body;

  try {
    if (pacs_type === "ORTHANC") {
      // Test connectivity + small C-FIND equivalent
      const { data: ids } = await axios.post(
        `http://${ip_address}:${port}/tools/find`,
        { Level: "Study", Query: {}, Limit: 1 }, // limit to 1 study for testing
        { auth: ORTHANC_AUTH }
      );
      return res.json({ success: true, message: "Orthanc reachable and query successful", studyCount: ids.length });
    }

    if (pacs_type === "DCM4CHEE") {
      const qidoUrl = `http://${ip_address}:${port}/dcm4chee-arc/aets/${ae_title}/rs/studies?limit=1`;
      const response = await axios.get(qidoUrl, {
        auth: { username: "pacs", password: "pacs" },
        headers: { Accept: "application/dicom+json" },
      });

      return res.json({ success: true, message: "DCM4CHEE reachable and query successful", studyCount: response.data.length });
    }

    res.status(400).json({ success: false, message: "Unknown PACS type" });
  } catch (err) {
    console.error("PACS test error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* ======================================================
   GET STUDIES (ACTIVE PACS)
====================================================== */
router.get("/studies", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // 1️⃣ Fetch only active PACS
    const pacsRes = await pool.query("SELECT * FROM pacs WHERE is_active=true");
    const activePACS = pacsRes.rows;

    let allStudies = [];

    // 2️⃣ Fetch each PACS independently
    for (const pacs of activePACS) {
      try {
        if (pacs.pacs_type === "ORTHANC") {
          const payload = { Level: "Study", Query: {}, Limit: 200 };
          if (startDate && endDate) payload.Query.StudyDate = `${startDate}-${endDate}`;

          const { data: ids } = await axios.post(
            `${ORTHANC_URL}tools/find`,
            payload,
            { auth: ORTHANC_AUTH }
          );

          const studies = await Promise.all(
            ids.map(async (id) => {
              const { data } = await axios.get(`${ORTHANC_URL}studies/${id}`, { auth: ORTHANC_AUTH });

              // modality fix
              let modality = "N/A";
              if (Array.isArray(data.ModalitiesInStudy) && data.ModalitiesInStudy.length) {
                modality = data.ModalitiesInStudy.join(",");
              } else if (Array.isArray(data.Series) && data.Series.length > 0) {
                try {
                  const { data: series } = await axios.get(`${ORTHANC_URL}series/${data.Series[0]}`, { auth: ORTHANC_AUTH });
                  modality = series.MainDicomTags?.Modality || "N/A";
                } catch {}
              }

              return {
                PatientID: data.PatientMainDicomTags?.PatientID || "N/A",
                PatientName: data.PatientMainDicomTags?.PatientName || "N/A",
                PatientAge: extractAgeFromName(data.PatientMainDicomTags?.PatientName),
                PatientSex: data.PatientMainDicomTags?.PatientSex || "O",
                AccessionNumber: data.MainDicomTags?.AccessionNumber || "N/A",
                StudyDescription: data.MainDicomTags?.StudyDescription || "No Description",
                StudyDate: data.MainDicomTags?.StudyDate || "N/A",
                Modality: modality,
                StudyInstanceUID: data.MainDicomTags?.StudyInstanceUID || data.ID,
                PACS: "ORTHANC",
              };
            })
          );

          allStudies.push(...studies);
        }

        if (pacs.pacs_type === "DCM4CHEE") {
          const qidoUrl = `http://${pacs.ip_address}:${pacs.port}/dcm4chee-arc/aets/${pacs.ae_title}/rs/studies`;
          const params = { includefield: "all", limit: 200 };
          if (startDate && endDate) params.StudyDate = `${startDate}-${endDate}`;

          const response = await axios.get(qidoUrl, {
            auth: { username: pacs.username || "pacs", password: pacs.password || "pacs" }, // optionally store creds per PACS
            params,
            headers: { Accept: "application/dicom+json" },
          });

          const studies = response.data.map((s) => ({
            PatientID: s["00100020"]?.Value?.[0] || "N/A",
            PatientName: s["00100010"]?.Value?.[0]?.Alphabetic || "N/A",
            PatientAge: s["00101010"]?.Value?.[0] || "N/A",
            PatientSex: s["00100040"]?.Value?.[0] || "O",
            AccessionNumber: s["00080050"]?.Value?.[0] || "N/A",
            StudyDescription: s["00081030"]?.Value?.[0] || "",
            StudyDate: s["00080020"]?.Value?.[0] || "",
            Modality: s["00080061"]?.Value?.[0] || "N/A",
            StudyInstanceUID: s["0020000D"]?.Value?.[0],
            PACS: "DCM4CHEE",
          }));

          allStudies.push(...studies);
        }
      } catch (err) {
        console.error(`${pacs.pacs_type} (${pacs.ip_address}) fetch failed:`, err.message);
      }
    }

    // 3️⃣ Deduplicate by StudyInstanceUID
    const uniqueStudiesMap = {};
    for (const study of allStudies) {
      if (!study.StudyInstanceUID) continue;
      if (!uniqueStudiesMap[study.StudyInstanceUID]) uniqueStudiesMap[study.StudyInstanceUID] = study;
    }
    const uniqueStudies = Object.values(uniqueStudiesMap);

    return res.json(uniqueStudies);
  } catch (err) {
    console.error("Fetch studies failed:", err);
    return res.status(500).json({ error: "Failed to fetch studies" });
  }
});

/* ======================================================
   SYNC STUDIES
====================================================== */
router.post("/:id/sync", async (req, res) => {
  try {
    const pacsRes = await pool.query("SELECT * FROM pacs WHERE id=$1", [req.params.id]);
    const pacs = pacsRes.rows[0];

    if (!pacs) return res.status(404).json({ error: "PACS not found" });

    let syncedCount = 0;

    if (pacs.pacs_type === "ORTHANC") {
      const orthancUrl = `http://${pacs.ip_address}:${pacs.port}/`; // optional override from DB
      const orthancAuth = {
        username: pacs.username || ORTHANC_AUTH.username,
        password: pacs.password || ORTHANC_AUTH.password,
      };

      try {
        const { data: ids } = await axios.get(`${orthancUrl}studies`, { auth: orthancAuth });

        for (const id of ids) {
          try {
            const { data } = await axios.get(`${orthancUrl}studies/${id}`, { auth: orthancAuth });

            const p = data.PatientMainDicomTags || {};
            const s = data.MainDicomTags || {};

            await pool.query(
              `INSERT INTO studies (
                study_uid, patient_id, patient_name,
                patient_sex, patient_age, accession_number,
                study_date, study_description, modality, source
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PACS')
              ON CONFLICT (study_uid) DO NOTHING`,
              [
                s.StudyInstanceUID,
                p.PatientID,
                p.PatientName,
                p.PatientSex,
                p.PatientAge,
                s.AccessionNumber,
                s.StudyDate,
                s.StudyDescription,
                s.ModalitiesInStudy?.join(","),
              ]
            );

            syncedCount++;
          } catch (err) {
            console.error(`Orthanc study ${id} sync failed:`, err.message);
          }
        }
      } catch (err) {
        console.error("Orthanc sync failed:", err.message);
        return res.status(500).json({ error: "Orthanc sync failed" });
      }
    }

    if (pacs.pacs_type === "DCM4CHEE") {
      const qidoUrl = `http://${pacs.ip_address}:${pacs.port}/dcm4chee-arc/aets/${pacs.ae_title}/rs/studies`;

      try {
        const response = await axios.get(qidoUrl, {
          auth: { username: pacs.username || "pacs", password: pacs.password || "pacs" },
          params: { includefield: "all", limit: 200 },
          headers: { Accept: "application/dicom+json" },
        });

        for (const s of response.data) {
          try {
            await pool.query(
              `INSERT INTO studies (
                study_uid, patient_id, patient_name,
                patient_sex, patient_age, accession_number,
                study_date, study_description, modality, source
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PACS')
              ON CONFLICT (study_uid) DO NOTHING`,
              [
                s["0020000D"]?.Value?.[0],
                s["00100020"]?.Value?.[0] || "N/A",
                s["00100010"]?.Value?.[0]?.Alphabetic || "N/A",
                s["00100040"]?.Value?.[0] || "O",
                s["00101010"]?.Value?.[0] || "N/A",
                s["00080050"]?.Value?.[0] || "N/A",
                s["00080020"]?.Value?.[0] || "",
                s["00081030"]?.Value?.[0] || "",
                s["00080061"]?.Value?.[0] || "N/A",
              ]
            );

            syncedCount++;
          } catch (err) {
            console.error("DCM4CHEE study insert failed:", err.message);
          }
        }
      } catch (err) {
        console.error("DCM4CHEE sync failed:", err.message);
        return res.status(500).json({ error: "DCM4CHEE sync failed" });
      }
    }

    res.json({ success: true, synced: syncedCount });
  } catch (err) {
    console.error("Sync route failed:", err.message);
    return res.status(500).json({ error: "Sync failed" });
  }
});

module.exports = router;
