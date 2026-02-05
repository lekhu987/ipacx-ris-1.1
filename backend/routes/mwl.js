const express = require("express");
const router = express.Router();
const axios = require("axios");
const pool = require("../db"); // use a separate db.js
const ORTHANC_URL = process.env.ORTHANC_URL;
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USER,
  password: process.env.ORTHANC_PASS,
};

// Add MWL
router.post("/", async (req, res) => {
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
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM mwl ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("MWL fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch MWL" });
  }
});

// Delete MWL
router.delete("/:id", async (req, res) => {
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
router.put("/:id", async (req, res) => {
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

// Send MWL entry to modality
router.post("/:id/send", async (req, res) => {
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

module.exports = router;
