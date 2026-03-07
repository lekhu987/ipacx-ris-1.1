const express = require("express");
const router = express.Router();
const axios = require("axios");
const pool = require("../db");
const { sendMWL } = require("../services/mwlExporter");

const ORTHANC_URL = process.env.ORTHANC_URL;
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USER,
  password: process.env.ORTHANC_PASS,
};
const DEFAULT_MWL_TARGET_AE = process.env.DEFAULT_MWL_TARGET_AE || "IPACXPACS";

function pick(row, keys, fallback = "") {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return row[k];
    }
  }
  return fallback;
}

function toWorklistItem(row) {
  const patientId = String(pick(row, ["patientid", "patient_id"], ""));
  const patientName = String(pick(row, ["patientname", "patient_name"], ""));
  const patientSex = String(pick(row, ["patientsex", "patient_sex"], "O"));
  const accession = String(pick(row, ["accessionnumber", "accession_number"], ""));
  const studyUid = String(pick(row, ["studyinstanceuid", "study_instance_uid"], ""));
  const modality = String(pick(row, ["modality"], ""));
  const schedule = pick(row, ["schedulingdate", "scheduled_datetime"], null);
  const description = String(pick(row, ["studydescription", "study_description"], ""));
  const status = String(pick(row, ["status"], "NEW"));
  const now = new Date();
  const scheduleDate = schedule ? new Date(schedule) : now;

  return {
    // DICOM JSON fields
    "00100010": { vr: "PN", Value: [{ Alphabetic: patientName }] },
    "00100020": { vr: "LO", Value: [patientId] },
    "00100040": { vr: "CS", Value: [patientSex.slice(0, 1).toUpperCase()] },
    "00080050": { vr: "SH", Value: [accession] },
    "0020000D": { vr: "UI", Value: [studyUid] },
    "00400001": { vr: "AE", Value: [pick(row, ["scheduledstationaetitle", "station_aet"], "")] },
    "00400002": { vr: "DA", Value: [scheduleDate.toISOString().slice(0, 10).replace(/-/g, "")] },
    "00400003": { vr: "TM", Value: [scheduleDate.toISOString().slice(11, 19).replace(/:/g, "")] },
    "00321060": { vr: "LO", Value: [description] },
    "00080060": { vr: "CS", Value: [modality] },
    // Flat fields for frontend
    id: row.id,
    patient_id: patientId,
    patient_name: patientName,
    accession_number: accession,
    modality,
    status,
    scheduled_datetime: schedule,
    study_instance_uid: studyUid,
    created_at: row.created_at || null,
    pacs_id: row.pacs_id || null,
  };
}

function toLegacyRow(item) {
  return {
    id: item.id,
    patientid: item.patient_id,
    patientname: item.patient_name,
    patientsex: item["00100040"]?.Value?.[0] || "O",
    patientage: "",
    accessionnumber: item.accession_number || "",
    studydescription: item["00321060"]?.Value?.[0] || "",
    schedulingdate: item.scheduled_datetime,
    modality: item.modality,
    bodypartexamined: "",
    referringphysician: "",
    status: item.status || "NEW",
  };
}

function normalizeInput(body = {}) {
  return {
    id: body.id || null,
    pacs_id: body.pacs_id || null,
    patient_id: body.patient_id || body.PatientID || "",
    patient_name: body.patient_name || body.PatientName || "",
    patient_sex: body.patient_sex || body.PatientSex || "O",
    patient_age: body.patient_age || body.PatientAge || "N/A",
    accession_number: body.accession_number || body.AccessionNumber || "",
    study_description: body.study_description || body.StudyDescription || "",
    scheduling_datetime: body.scheduled_datetime || body.SchedulingDate || new Date().toISOString(),
    modality: body.modality || body.Modality || "",
    body_part_examined: body.body_part_examined || body.BodyPartExamined || "",
    referring_physician: body.referring_physician || body.ReferringPhysician || "",
    study_instance_uid: body.study_instance_uid || body.StudyInstanceUID || "",
  };
}

router.post("/", async (req, res) => {
  try {
    const entry = normalizeInput(req.body);
    if (!entry.patient_name || !entry.modality) {
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
        entry.patient_id || `P${Date.now()}`,
        entry.patient_name,
        entry.patient_sex || "O",
        entry.patient_age || "N/A",
        entry.accession_number || "",
        entry.study_description || "",
        entry.scheduling_datetime || new Date(),
        entry.modality,
        entry.body_part_examined || "",
        entry.referring_physician || "",
      ]
    );

    res.json({ message: "Added to MWL successfully", entry: result.rows[0] });
  } catch (err) {
    console.error("MWL add error:", err.message);
    res.status(500).json({ error: "Failed to add MWL" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const entry = normalizeInput(req.body);
    if (!entry.patient_name || !entry.modality) {
      return res.status(400).json({ error: "PatientName and Modality are required" });
    }

    const created = await pool.query(
      `INSERT INTO mwl
       (PatientID, PatientName, PatientSex, PatientAge,
        AccessionNumber, StudyDescription, SchedulingDate,
        Modality, BodyPartExamined, ReferringPhysician)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        entry.patient_id || `P${Date.now()}`,
        entry.patient_name,
        entry.patient_sex || "O",
        entry.patient_age || "N/A",
        entry.accession_number || "",
        entry.study_description || "",
        entry.scheduling_datetime || new Date(),
        entry.modality,
        entry.body_part_examined || "",
        entry.referring_physician || "",
      ]
    );

    const row = created.rows[0];
    const response = { success: true, status: "NEW", data: toWorklistItem(row) };

    if (entry.pacs_id) {
      try {
        const pacsResult = await pool.query("SELECT * FROM pacs WHERE id = $1 LIMIT 1", [entry.pacs_id]);
        const pacs = pacsResult.rows[0];
        if (!pacs) {
          response.warning = `PACS ${entry.pacs_id} not found`;
        } else {
          await sendMWL(pacs, {
            patient_name: row.patientname,
            patient_id: row.patientid,
            accession_number: row.accessionnumber,
            requested_procedure_id: "",
            modality: row.modality,
            scheduled_start: row.schedulingdate,
            station_aet: pacs.ae_title || "",
          });
          response.status = "SYNCED";
        }
      } catch (pushErr) {
        console.error("MWL register push error:", pushErr.message);
        response.status = "FAILED";
        response.error = pushErr.message;
      }
    }

    return res.json(response);
  } catch (err) {
    console.error("MWL register error:", err.message);
    return res.status(500).json({ success: false, error: "MWL register failed" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { modality, scheduled_date: scheduledDate, date, q, legacy } = req.query;
    const where = [];
    const params = [];

    if (modality) {
      params.push(String(modality));
      where.push(`modality = $${params.length}`);
    }

    const dateValue = scheduledDate || date;
    if (dateValue) {
      params.push(String(dateValue));
      where.push(`schedulingdate::date = $${params.length}::date`);
    }

    if (q) {
      params.push(`%${String(q).toLowerCase()}%`);
      const idx = params.length;
      where.push(`(
        LOWER(COALESCE(patientname, '')) LIKE $${idx}
        OR LOWER(COALESCE(patientid, '')) LIKE $${idx}
        OR LOWER(COALESCE(accessionnumber, '')) LIKE $${idx}
      )`);
    }

    const sql = `
      SELECT *
      FROM mwl
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY id DESC
    `;

    const result = await pool.query(sql, params);
    const mwlItems = result.rows.map(toWorklistItem);

    if (legacy === "1") {
      return res.json(mwlItems.map(toLegacyRow));
    }
    return res.json({ success: true, data: mwlItems });
  } catch (err) {
    console.error("MWL fetch error:", err.message);
    return res.status(500).json({ success: false, error: "MWL Error" });
  }
});

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

router.put("/:id", async (req, res) => {
  try {
    const entry = normalizeInput(req.body);
    const result = await pool.query(
      `UPDATE mwl SET
       PatientID=$1, PatientName=$2, PatientSex=$3, PatientAge=$4,
       AccessionNumber=$5, StudyDescription=$6, SchedulingDate=$7,
       Modality=$8, BodyPartExamined=$9, ReferringPhysician=$10
       WHERE id=$11 RETURNING *`,
      [
        entry.patient_id,
        entry.patient_name,
        entry.patient_sex,
        entry.patient_age,
        entry.accession_number,
        entry.study_description,
        entry.scheduling_datetime,
        entry.modality,
        entry.body_part_examined,
        entry.referring_physician,
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

router.post("/:id/send", async (req, res) => {
  try {
    let { modality, orthancModalityName } = req.body;
    const result = await pool.query("SELECT * FROM mwl WHERE id=$1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "MWL entry not found" });

    const entry = result.rows[0];
    modality = modality || entry.modality;
    if (!modality && !orthancModalityName) {
      return res.status(400).json({ error: "No modality available to send" });
    }

    const MODALITY_MAP = {
      CT: DEFAULT_MWL_TARGET_AE,
      MR: DEFAULT_MWL_TARGET_AE,
      MRI: DEFAULT_MWL_TARGET_AE,
      US: DEFAULT_MWL_TARGET_AE,
      ULTRASOUND: DEFAULT_MWL_TARGET_AE,
      CR: DEFAULT_MWL_TARGET_AE,
      DX: DEFAULT_MWL_TARGET_AE,
      "X-RAY": DEFAULT_MWL_TARGET_AE,
      XRAY: DEFAULT_MWL_TARGET_AE,
      MG: DEFAULT_MWL_TARGET_AE,
      NM: DEFAULT_MWL_TARGET_AE,
    };
    const key = String(modality).toUpperCase();
    const target = orthancModalityName || MODALITY_MAP[key] || DEFAULT_MWL_TARGET_AE;
    if (!target) return res.status(400).json({ error: "Unsupported modality" });

    const pacsResult = await pool.query(
      `
      SELECT *
      FROM pacs
      WHERE is_active = true
        AND (
          UPPER(COALESCE(ae_title, '')) = UPPER($1)
          OR UPPER(COALESCE(pacs_name, '')) = UPPER($1)
        )
      ORDER BY id ASC
      LIMIT 1
      `,
      [target]
    );
    let targetPacs = pacsResult.rows[0] || null;
    if (!targetPacs) {
      const fallback = await pool.query(
        `SELECT * FROM pacs WHERE is_active = true ORDER BY id ASC LIMIT 1`
      );
      targetPacs = fallback.rows[0] || null;
    }

    // Preferred: push MWL JSON to selected target PACS endpoint.
    if (targetPacs) {
      const pushed = await sendMWL(targetPacs, {
        patient_name: entry.patientname || "",
        patient_id: entry.patientid || "",
        accession_number: entry.accessionnumber || "",
        requested_procedure_id: "",
        modality: entry.modality || "",
        scheduled_start: entry.schedulingdate || new Date().toISOString(),
        station_aet: targetPacs.ae_title || "",
      });
      return res.json({
        success: true,
        sentTo: target,
        mode: "mwl_json_push",
        endpoint: pushed.url,
      });
    }
    return res.status(404).json({
      error: `No active PACS found. Enable one PACS row in PACS Management.`,
    });
  } catch (err) {
    const upstream = err?.response?.data || err?.cause?.response?.data || null;
    const statusCode = err?.statusCode || (err?.response?.status >= 400 ? err.response.status : 500);
    const publicMessage =
      err?.publicMessage ||
      (typeof upstream === "string" ? upstream : upstream?.Message || upstream?.OrthancError) ||
      err?.message ||
      "Failed to send MWL";
    console.error("Send error:", upstream || err.message);
    res.status(statusCode).json({
      error: publicMessage,
      details: upstream || err.message,
    });
  }
});

module.exports = router;
