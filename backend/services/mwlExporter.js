const axios = require("axios");
const mwlLogger = require("../utils/mwlLogger");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(err) {
  const status = err?.response?.status;
  if (status === 408 || status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;
  const code = String(err?.code || "").toUpperCase();
  return ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND", "ECONNABORTED"].includes(code);
}

async function requestWithRetry(fn, context = {}) {
  const retries = Math.max(Number(process.env.MWL_SEND_RETRY_COUNT || 3), 0);
  const baseDelay = Math.max(Number(process.env.MWL_SEND_RETRY_DELAY_MS || 500), 100);

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (!shouldRetry(err) || attempt >= retries) {
        mwlLogger.error("MWL send failed", { ...context, attempt, error: err?.message });
        throw err;
      }
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 5000);
      mwlLogger.warn("MWL send retrying", { ...context, attempt: attempt + 1, delay_ms: delay, error: err?.message });
      await sleep(delay);
      attempt += 1;
    }
  }
}

function normalizePacs(pacs = {}) {
  return {
    id: pacs.id,
    name: pacs.pacs_name || pacs.name || "",
    type: String(pacs.pacs_type || pacs.type || "").toLowerCase(),
    host: pacs.host || pacs.ip_address || pacs.ip || "localhost",
    port: Number(pacs.port || 8042),
    username: pacs.username || "",
    password: pacs.password || "",
  };
}

function buildMWL(appointment = {}) {
  return {
    PatientName: appointment.patient_name || "",
    PatientID: appointment.patient_id || "",
    AccessionNumber: appointment.accession_number || "",
    RequestedProcedureID: appointment.requested_procedure_id || "",
    ScheduledProcedureStepSequence: [
      {
        Modality: appointment.modality || "",
        ScheduledProcedureStepStartDateTime: appointment.scheduled_start || "",
        ScheduledStationAETitle: appointment.station_aet || "",
      },
    ],
  };
}

async function sendMWL(pacsInput, appointment) {
  const pacs = normalizePacs(pacsInput);
  if (!appointment?.patient_id || !appointment?.patient_name) {
    mwlLogger.warn("MWL payload missing patient info", {
      patient_id: appointment?.patient_id,
      patient_name: appointment?.patient_name,
      pacs: pacs.name,
    });
  }
  let baseUrl = `${pacs.host}:${pacs.port}`;
  if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `http://${baseUrl}`;
  baseUrl = baseUrl.replace(/\/+$/, "");

  const payload = buildMWL(appointment);
  const config = { timeout: 10000 };
  const orthancUser = process.env.ORTHANC_USER || "";
  const orthancPass = process.env.ORTHANC_PASS || "";
  const dcmUser = process.env.DCM4CHEE_USER || "pacs";
  const dcmPass = process.env.DCM4CHEE_PASS || "pacs";

  const authUser = pacs.username || (pacs.type.includes("orthanc") ? orthancUser : dcmUser);
  const authPass = pacs.password || (pacs.type.includes("orthanc") ? orthancPass : dcmPass);
  if (authUser && authPass) {
    config.auth = { username: authUser, password: authPass };
  }

  if (pacs.type.includes("orthanc")) {
    const endpoints = String(
      process.env.ORTHANC_MWL_ENDPOINTS || "/tools/worklists,/tools/worklist,/worklists"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let lastErr = null;
    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
      try {
        const response = await requestWithRetry(
          () => axios.post(url, payload, config),
          { pacs: pacs.name, url, type: pacs.type }
        );
        return { url, payload, data: response.data };
      } catch (err) {
        const status = err?.response?.status;
        const orthancError = err?.response?.data?.OrthancError || "";
        // Try next endpoint only for "not found / unknown resource" cases.
        if (status === 404 || /unknown resource/i.test(String(orthancError))) {
          lastErr = err;
          continue;
        }
        throw err;
      }
    }

    const msg =
      "Orthanc MWL endpoint not found. Enable Orthanc Worklist plugin HTTP route or set ORTHANC_MWL_ENDPOINTS in .env.";
    const e = new Error(msg);
    e.statusCode = 502;
    e.publicMessage = msg;
    e.cause = lastErr;
    throw e;
  }

  const url = `${baseUrl}/mwl`;
  const response = await requestWithRetry(
    () => axios.post(url, payload, config),
    { pacs: pacs.name, url, type: pacs.type }
  );
  return { url, payload, data: response.data };
}

module.exports = { sendMWL, buildMWL };
