const fs = require("fs");
const path = require("path");

const DEFAULT_OUT_DIR = path.join(__dirname, "..", "..", "logs", "mwl-dimse");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function formatDate(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatTime(date) {
  return date.toISOString().slice(11, 19).replace(/:/g, "");
}

function buildDicomJson(entry) {
  const schedule = entry.scheduling_datetime || entry.schedulingdate || new Date().toISOString();
  const scheduleDate = new Date(schedule);
  const patientName = entry.patientname || entry.patient_name || "";
  const patientId = entry.patientid || entry.patient_id || "";
  const patientSex = (entry.patientsex || entry.patient_sex || "O").slice(0, 1).toUpperCase();
  const accession = entry.accessionnumber || entry.accession_number || "";
  const studyUid = entry.studyinstanceuid || entry.study_instance_uid || "";
  const modality = entry.modality || "";
  const description = entry.studydescription || entry.study_description || "";
  const stationAet = entry.scheduledstationaetitle || entry.station_aet || "";

  return {
    "00100010": { vr: "PN", Value: [{ Alphabetic: String(patientName) }] },
    "00100020": { vr: "LO", Value: [String(patientId)] },
    "00100040": { vr: "CS", Value: [String(patientSex)] },
    "00080050": { vr: "SH", Value: [String(accession)] },
    "0020000D": { vr: "UI", Value: [String(studyUid)] },
    "00400001": { vr: "AE", Value: [String(stationAet)] },
    "00400002": { vr: "DA", Value: [formatDate(scheduleDate)] },
    "00400003": { vr: "TM", Value: [formatTime(scheduleDate)] },
    "00321060": { vr: "LO", Value: [String(description)] },
    "00080060": { vr: "CS", Value: [String(modality)] },
  };
}

function buildReadableLine(entry) {
  const parts = [
    `PatientName=${entry.patientname || entry.patient_name || ""}`,
    `PatientID=${entry.patientid || entry.patient_id || ""}`,
    `Accession=${entry.accessionnumber || entry.accession_number || ""}`,
    `Modality=${entry.modality || ""}`,
    `Scheduled=${entry.scheduling_datetime || entry.schedulingdate || ""}`,
  ];
  return parts.join(" | ");
}

async function exportDimseWorklist(entry, options = {}) {
  const outDir = options.outDir || process.env.MWL_DIMSE_OUT_DIR || DEFAULT_OUT_DIR;
  ensureDir(outDir);

  const baseName = `mwl_${entry.id || Date.now()}`;
  const jsonPath = path.join(outDir, `${baseName}.json`);
  const txtPath = path.join(outDir, `${baseName}.txt`);

  const dicomJson = buildDicomJson(entry);
  fs.writeFileSync(jsonPath, JSON.stringify(dicomJson, null, 2), "utf8");
  fs.writeFileSync(txtPath, buildReadableLine(entry) + "\n", "utf8");

  return {
    outDir,
    jsonPath,
    txtPath,
    dicomJson,
  };
}

module.exports = { exportDimseWorklist };
