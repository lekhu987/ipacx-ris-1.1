const net = require("net");
const { spawnSync } = require("child_process");
const path = require("path");
const { getMwlDimseStatus } = require("./mwlDimseScp");

function resolveTool(tool) {
  const binDir = process.env.DCMTK_BIN;
  const exe = process.platform === "win32" ? `${tool}.exe` : tool;
  return binDir ? path.join(binDir, exe) : tool;
}

function checkPort(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok, message) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, message });
    };
    socket.setTimeout(timeoutMs);
    socket.once("error", (err) => finish(false, err.message));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.connect(Number(port), host, () => finish(true, "ok"));
  });
}

async function getHealth() {
  const status = getMwlDimseStatus();
  const portCheck = await checkPort("127.0.0.1", status.port);
  return {
    success: true,
    ...status,
    port_open: portCheck.ok,
    port_check_message: portCheck.message,
  };
}

function buildCandidates(preferred, fallback, extras) {
  const out = [];
  if (preferred) out.push(preferred);
  if (fallback && !out.includes(fallback)) out.push(fallback);
  extras.forEach((ae) => {
    if (!out.includes(ae)) out.push(ae);
  });
  return out;
}

function runEcho(tool, host, port, callAet, calledAet) {
  const args = [
    "-aet",
    String(callAet),
    "-aec",
    String(calledAet),
    String(host),
    String(port),
  ];
  const result = spawnSync(tool, args, { encoding: "utf8" });
  return { args, result };
}

function runFind(tool, host, port, callAet, calledAet) {
  const args = [
    "-W",
    "-aet",
    String(callAet),
    "-aec",
    String(calledAet),
    String(host),
    String(port),
    "-k",
    "0008,0052=WORKLIST",
    "-k",
    "0010,0010=",
    "-k",
    "0010,0020=",
    "-k",
    "0008,0060=",
    "-k",
    "0008,0050=",
    "-k",
    "0040,0001=",
  ];
  const result = spawnSync(tool, args, { encoding: "utf8" });
  return { args, result };
}

function runDimseTest({
  type = "echo",
  host = "127.0.0.1",
  port,
  called_ae,
  calling_ae = "IPACX_TEST",
}) {
  const status = getMwlDimseStatus();
  const targetPort = Number(port || status.port || 11112);
  const preferredAe = String(called_ae || "").trim();
  const defaultAe = String(process.env.MWL_DIMSE_CALLED_AE || status.ae_title || "WORKLIST");
  const preferredCalling = String(calling_ae || "").trim();
  const defaultCalling = String(process.env.MWL_DIMSE_CALLING_AE || "IPACX_TEST");

  if (!host || !targetPort) {
    const err = new Error("host/port required");
    err.status = 400;
    throw err;
  }

  const calledCandidates = buildCandidates(
    preferredAe,
    defaultAe,
    ["DCMWL", "WORKLIST", "WLMSCPFS", "MWLSCP", "DCMTK", "ANY-SCP"]
  );

  const callingCandidates = buildCandidates(
    preferredCalling,
    defaultCalling,
    ["IPACX_TEST", "DCMTK", "WORKLIST", "ANY-SCU"]
  );

  if (String(type).toLowerCase() === "find") {
    const tool = resolveTool("findscu");
    const tried = [];
    for (const callAet of callingCandidates) {
      for (const calledAet of calledCandidates) {
        const { args, result } = runFind(tool, host, targetPort, callAet, calledAet);
        tried.push({
          calling_ae: callAet,
          called_ae: calledAet,
          status: result.status,
          stderr: result.stderr || "",
        });
        if (!result.error && result.status === 0) {
          return {
            success: true,
            mode: "find",
            accepted_calling_ae: callAet,
            accepted_called_ae: calledAet,
            command: `${tool} ${args.join(" ")}`,
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            tried,
          };
        }
      }
    }
    const last = tried[tried.length - 1] || {};
    const err = new Error("Find failed for all AE candidate combinations");
    err.status = 500;
    err.payload = {
      success: false,
      mode: "find",
      error: err.message,
      tried,
      last_error: last.stderr || "",
    };
    throw err;
  }

  const tool = resolveTool("echoscu");
  const tried = [];
  for (const callAet of callingCandidates) {
    for (const calledAet of calledCandidates) {
      const { args, result } = runEcho(tool, host, targetPort, callAet, calledAet);
      tried.push({
        calling_ae: callAet,
        called_ae: calledAet,
        status: result.status,
        stderr: result.stderr || "",
      });
      if (!result.error && result.status === 0) {
        return {
          success: true,
          mode: "echo",
          accepted_calling_ae: callAet,
          accepted_called_ae: calledAet,
          command: `${tool} ${args.join(" ")}`,
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          tried,
        };
      }
    }
  }

  const triedFind = [];
  for (const callAet of callingCandidates) {
    for (const calledAet of calledCandidates) {
      const toolFind = resolveTool("findscu");
      const { args, result } = runFind(toolFind, host, targetPort, callAet, calledAet);
      triedFind.push({
        calling_ae: callAet,
        called_ae: calledAet,
        status: result.status,
        stderr: result.stderr || "",
      });
      if (!result.error && result.status === 0) {
        return {
          success: true,
          mode: "echo_fallback_find",
          accepted_calling_ae: callAet,
          accepted_called_ae: calledAet,
          command: `${toolFind} ${args.join(" ")}`,
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          tried_echo: tried,
          tried_find: triedFind,
          note: "C-ECHO failed; C-FIND succeeded (MWL SCP is reachable).",
        };
      }
    }
  }

  const last = tried[tried.length - 1] || {};
  const err = new Error("Echo failed for all called AE candidates");
  err.status = 500;
  err.payload = {
    success: false,
    mode: "echo",
    error: err.message,
    tried,
    tried_find: triedFind,
    last_error: last.stderr || "",
  };
  throw err;
}

module.exports = {
  getHealth,
  runDimseTest,
};
