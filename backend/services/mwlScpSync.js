const { URL } = require("url");
const pool = require("../db");
const { sendMWL } = require("./mwlExporter");

const DEFAULT_BATCH = 50;

function getOrthancTarget() {
  const raw = String(process.env.ORTHANC_URL || "").trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  return {
    pacs_name: "Orthanc MWL",
    pacs_type: "ORTHANC",
    ip_address: url.hostname,
    port: Number(url.port || 8042),
    username: process.env.ORTHANC_USER || "",
    password: process.env.ORTHANC_PASS || "",
  };
}

async function ensureMwlStatusColumn() {
  await pool.query("ALTER TABLE mwl ADD COLUMN IF NOT EXISTS status text DEFAULT 'NEW'");
}

async function ensureMwlDatetimeColumn() {
  await pool.query(
    "ALTER TABLE mwl ADD COLUMN IF NOT EXISTS scheduling_datetime timestamp"
  );
}

async function fetchPendingMwl(limit = DEFAULT_BATCH) {
  await ensureMwlStatusColumn();
  await ensureMwlDatetimeColumn();
  const result = await pool.query(
    `
    SELECT *
    FROM mwl
    WHERE COALESCE(status, 'NEW') = 'NEW'
    ORDER BY id ASC
    LIMIT $1
    `,
    [limit]
  );
  return result.rows || [];
}

async function pushEntryToOrthanc(target, entry) {
  return sendMWL(target, {
    patient_name: entry.patientname || "",
    patient_id: entry.patientid || "",
    accession_number: entry.accessionnumber || "",
    requested_procedure_id: "",
    modality: entry.modality || "",
    scheduled_start: entry.scheduling_datetime || entry.schedulingdate || new Date().toISOString(),
    station_aet: entry.scheduledstationaetitle || "",
  });
}

async function syncMwlToOrthanc() {
  const target = getOrthancTarget();
  if (!target) return;

  const pending = await fetchPendingMwl();
  for (const entry of pending) {
    try {
      await pushEntryToOrthanc(target, entry);
      await pool.query("UPDATE mwl SET status = $1 WHERE id = $2", ["SYNCED", entry.id]);
    } catch (err) {
      console.error("MWL SCP sync failed:", err.message || err);
      // keep status as NEW so it can retry on next run
    }
  }
}

let timer = null;
let running = false;

function startMwlScpSync() {
  const enabled = String(process.env.MWL_SCP_ENABLED || "true").toLowerCase() !== "false";
  if (!enabled || timer) return;

  const intervalMs = Number(process.env.MWL_SCP_INTERVAL_MS || 2000);
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await syncMwlToOrthanc();
    } finally {
      running = false;
    }
  }, intervalMs);
}

module.exports = { startMwlScpSync, syncMwlToOrthanc };
