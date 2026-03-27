const pool = require("../db");
const axios = require("axios");

async function getActiveDcm4cheePacs() {
  const result = await pool.query(
    "SELECT * FROM pacs WHERE pacs_type = 'DCM4CHEE' AND is_active = true"
  );
  return result.rows[0] || null;
}

async function fetchStudiesFromDcm4chee(pacs) {
  const qidoUrl = `http://${pacs.ip_address}:${pacs.port}/dcm4chee-arc/aets/${pacs.ae_title}/rs/studies`;

  const response = await axios.get(qidoUrl, {
    headers: {
      Accept: "application/dicom+json",
    },
    timeout: 10000,
  });

  return response.data.map((study) => ({
    pacs: "DCM4CHEE",
    studyUID: study["0020000D"]?.Value?.[0],
    studyDate: study["00080020"]?.Value?.[0],
    modality: study["00080061"]?.Value?.join(", "),
    patientName: study["00100010"]?.Value?.[0]?.Alphabetic || "",
    patientId: study["00100020"]?.Value?.[0],
    studyUrl: study["00081190"]?.Value?.[0],
    numberOfSeries: study["00201206"]?.Value?.[0],
    numberOfInstances: study["00201208"]?.Value?.[0],
  }));
}

module.exports = {
  getActiveDcm4cheePacs,
  fetchStudiesFromDcm4chee,
};
