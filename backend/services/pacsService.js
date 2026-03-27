const axios = require("axios");
const pool = require("../db");

const ORTHANC_URL = (process.env.ORTHANC_URL || "http://192.168.1.34:8042/").replace(/\/?$/, "/");
const ORTHANC_USER = process.env.ORTHANC_USER || "";
const ORTHANC_PASS = process.env.ORTHANC_PASS || "";
const DCM4CHEE_USER = process.env.DCM4CHEE_USER || "";
const DCM4CHEE_PASS = process.env.DCM4CHEE_PASS || "";

function orthancAuthConfig() {
  if (!ORTHANC_USER || !ORTHANC_PASS) return {};
  return { auth: { username: ORTHANC_USER, password: ORTHANC_PASS } };
}

function dcm4cheeAuthConfig(username, password) {
  const user = username || DCM4CHEE_USER;
  const pass = password || DCM4CHEE_PASS;
  if (!user || !pass) return {};
  return { auth: { username: user, password: pass } };
}

function extractAgeFromName(name) {
  if (!name) return "N/A";
  const clean = String(name);
  const yearMatch = clean.match(/(\d{1,3})\s*\^?\s*Y\b/i);
  if (yearMatch) return yearMatch[1];
  const monthMatch = clean.match(/(\d{1,2})\s*\^?\s*(MONTH|M)\b/i);
  if (monthMatch) return `${monthMatch[1]} Months`;
  return "N/A";
}

async function listPacs() {
  const result = await pool.query("SELECT * FROM pacs ORDER BY id ASC");
  return result.rows;
}

async function savePacs({ id, pacs_name, pacs_type, ae_title, ip_address, port }) {
  if (id) {
    const result = await pool.query(
      `UPDATE pacs
       SET pacs_name=$1, pacs_type=$2, ae_title=$3, ip_address=$4, port=$5
       WHERE id=$6
       RETURNING *`,
      [pacs_name, pacs_type, ae_title, ip_address, port, id]
    );
    return { mode: "update", row: result.rows[0] };
  }
  const result = await pool.query(
    `INSERT INTO pacs (pacs_name, pacs_type, ae_title, ip_address, port)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [pacs_name, pacs_type, ae_title, ip_address, port]
  );
  return { mode: "create", row: result.rows[0] };
}

async function deletePacs(id) {
  const deleted = await pool.query("DELETE FROM pacs WHERE id=$1 RETURNING id, pacs_name", [id]);
  return deleted.rows[0] || null;
}

async function setActive(id, isActive) {
  await pool.query("UPDATE pacs SET is_active=$1 WHERE id=$2", [isActive, id]);
}

async function testPacs({ pacs_type, ip_address, port, ae_title }) {
  if (pacs_type === "ORTHANC") {
    const { data: ids } = await axios.post(
      `http://${ip_address}:${port}/tools/find`,
      { Level: "Study", Query: {}, Limit: 1 },
      orthancAuthConfig()
    );
    return { success: true, message: "Orthanc reachable and query successful", studyCount: ids.length };
  }

  if (pacs_type === "DCM4CHEE") {
    const qidoUrl = `http://${ip_address}:${port}/dcm4chee-arc/aets/${ae_title}/rs/studies?limit=1`;
    const response = await axios.get(qidoUrl, {
      ...dcm4cheeAuthConfig(),
      headers: { Accept: "application/dicom+json" },
    });
    return { success: true, message: "DCM4CHEE reachable and query successful", studyCount: response.data.length };
  }

  const err = new Error("Unknown PACS type");
  err.status = 400;
  throw err;
}

async function listStudies({ startDate, endDate }) {
  const pacsRes = await pool.query("SELECT * FROM pacs WHERE is_active=true");
  const activePacs = pacsRes.rows;
  let allStudies = [];

  for (const pacs of activePacs) {
    try {
      if (pacs.pacs_type === "ORTHANC") {
        const payload = { Level: "Study", Query: {}, Limit: 200 };
        if (startDate && endDate) payload.Query.StudyDate = `${startDate}-${endDate}`;

        const { data: ids } = await axios.post(
          `${ORTHANC_URL}tools/find`,
          payload,
          orthancAuthConfig()
        );

        const studies = await Promise.all(
          ids.map(async (id) => {
            const { data } = await axios.get(`${ORTHANC_URL}studies/${id}`, orthancAuthConfig());

            let modality = "N/A";
            if (Array.isArray(data.ModalitiesInStudy) && data.ModalitiesInStudy.length) {
              modality = data.ModalitiesInStudy.join(",");
            } else if (Array.isArray(data.Series) && data.Series.length > 0) {
              try {
                const { data: series } = await axios.get(
                  `${ORTHANC_URL}series/${data.Series[0]}`,
                  orthancAuthConfig()
                );
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
          ...dcm4cheeAuthConfig(pacs.username, pacs.password),
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

  const uniqueStudiesMap = {};
  for (const study of allStudies) {
    if (!study.StudyInstanceUID) continue;
    if (!uniqueStudiesMap[study.StudyInstanceUID]) uniqueStudiesMap[study.StudyInstanceUID] = study;
  }
  return Object.values(uniqueStudiesMap);
}

async function syncStudies(pacsId) {
  const pacsRes = await pool.query("SELECT * FROM pacs WHERE id=$1", [pacsId]);
  const pacs = pacsRes.rows[0];
  if (!pacs) {
    const err = new Error("PACS not found");
    err.status = 404;
    throw err;
  }

  let syncedCount = 0;

  if (pacs.pacs_type === "ORTHANC") {
    const orthancUrl = `http://${pacs.ip_address}:${pacs.port}/`;
    const orthancAuth = {
      username: pacs.username || ORTHANC_USER,
      password: pacs.password || ORTHANC_PASS,
    };

    const { data: ids } = await axios.get(`${orthancUrl}studies`, {
      ...(orthancAuth.username && orthancAuth.password ? { auth: orthancAuth } : {}),
    });

    for (const id of ids) {
      try {
        const { data } = await axios.get(`${orthancUrl}studies/${id}`, {
          ...(orthancAuth.username && orthancAuth.password ? { auth: orthancAuth } : {}),
        });

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
  }

  if (pacs.pacs_type === "DCM4CHEE") {
    const qidoUrl = `http://${pacs.ip_address}:${pacs.port}/dcm4chee-arc/aets/${pacs.ae_title}/rs/studies`;
    const response = await axios.get(qidoUrl, {
      ...dcm4cheeAuthConfig(pacs.username, pacs.password),
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
  }

  return syncedCount;
}

module.exports = {
  listPacs,
  savePacs,
  deletePacs,
  setActive,
  testPacs,
  listStudies,
  syncStudies,
};
