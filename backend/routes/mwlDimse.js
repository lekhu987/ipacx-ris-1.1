const express = require("express");
const net = require("net");
const { spawnSync } = require("child_process");
const { getMwlDimseStatus } = require("../services/mwlDimseScp");

const router = express.Router();

function resolveTool(tool) {
  const binDir = process.env.DCMTK_BIN;
  const exe = process.platform === "win32" ? `${tool}.exe` : tool;
  return binDir ? require("path").join(binDir, exe) : tool;
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

router.get("/health", async (req, res) => {
  const status = getMwlDimseStatus();
  const portCheck = await checkPort("127.0.0.1", status.port);
  return res.json({
    success: true,
    ...status,
    port_open: portCheck.ok,
    port_check_message: portCheck.message,
  });
});

router.post("/test", (req, res) => {
  const {
    type = "echo",
    host = "127.0.0.1",
    port,
    called_ae,
    calling_ae = "IPACX_TEST",
  } = req.body || {};

  const status = getMwlDimseStatus();
  const targetPort = Number(port || status.port || 11112);
  const preferredAe = String(called_ae || "").trim();
  const defaultAe = String(process.env.MWL_DIMSE_CALLED_AE || status.ae_title || "WORKLIST");
  const preferredCalling = String(calling_ae || "").trim();
  const defaultCalling = String(process.env.MWL_DIMSE_CALLING_AE || "IPACX_TEST");

  if (!host || !targetPort) {
    return res.status(400).json({ success: false, error: "host/port required" });
  }

  const calledCandidates = [];
  if (preferredAe) calledCandidates.push(preferredAe);
  if (defaultAe && !calledCandidates.includes(defaultAe)) calledCandidates.push(defaultAe);
  ["DCMWL", "WORKLIST", "WLMSCPFS", "MWLSCP", "DCMTK", "ANY-SCP"].forEach((ae) => {
    if (!calledCandidates.includes(ae)) calledCandidates.push(ae);
  });

  const callingCandidates = [];
  if (preferredCalling) callingCandidates.push(preferredCalling);
  if (defaultCalling && !callingCandidates.includes(defaultCalling)) callingCandidates.push(defaultCalling);
  ["IPACX_TEST", "DCMTK", "WORKLIST", "ANY-SCU"].forEach((ae) => {
    if (!callingCandidates.includes(ae)) callingCandidates.push(ae);
  });

  if (String(type).toLowerCase() === "find") {
    const tool = resolveTool("findscu");
    const tried = [];
    for (const callAet of callingCandidates) {
      for (const calledAet of calledCandidates) {
        const args = [
          "-W",
          "-aet",
          String(callAet),
          "-aec",
          String(calledAet),
          String(host),
          String(targetPort),
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
        tried.push({
          calling_ae: callAet,
          called_ae: calledAet,
          status: result.status,
          stderr: result.stderr || "",
        });
        if (!result.error && result.status === 0) {
          return res.json({
            success: true,
            mode: "find",
            accepted_calling_ae: callAet,
            accepted_called_ae: calledAet,
            command: `${tool} ${args.join(" ")}`,
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            tried,
          });
        }
      }
    }
    const last = tried[tried.length - 1] || {};
    return res.status(500).json({
      success: false,
      mode: "find",
      error: "Find failed for all AE candidate combinations",
      tried,
      last_error: last.stderr || "",
    });
  }

  const tool = resolveTool("echoscu");
  const runEcho = (callAet, calledAet) => {
    const args = [
      "-aet",
      String(callAet),
      "-aec",
      String(calledAet),
      String(host),
      String(targetPort),
    ];
    const result = spawnSync(tool, args, { encoding: "utf8" });
    return { callAet, calledAet, args, result };
  };

  const runFind = (callAet, calledAet) => {
    const toolFind = resolveTool("findscu");
    const args = [
      "-W",
      "-aet",
      String(callAet),
      "-aec",
      String(calledAet),
      String(host),
      String(targetPort),
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
    const result = spawnSync(toolFind, args, { encoding: "utf8" });
    return { callAet, calledAet, args, result, toolFind };
  };

  const tried = [];
  for (const callAet of callingCandidates) {
    for (const calledAet of calledCandidates) {
      const { args, result } = runEcho(callAet, calledAet);
      tried.push({
        calling_ae: callAet,
        called_ae: calledAet,
        status: result.status,
        stderr: result.stderr || "",
      });
      if (!result.error && result.status === 0) {
        return res.json({
          success: true,
          mode: "echo",
          accepted_calling_ae: callAet,
          accepted_called_ae: calledAet,
          command: `${tool} ${args.join(" ")}`,
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          tried,
        });
      }
    }
  }

  // Some MWL SCPs (wlmscpfs) do not support C-ECHO. Fall back to C-FIND.
  const triedFind = [];
  for (const callAet of callingCandidates) {
    for (const calledAet of calledCandidates) {
      const { args, result, toolFind } = runFind(callAet, calledAet);
      triedFind.push({
        calling_ae: callAet,
        called_ae: calledAet,
        status: result.status,
        stderr: result.stderr || "",
      });
      if (!result.error && result.status === 0) {
        return res.json({
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
        });
      }
    }
  }

  const last = tried[tried.length - 1] || {};
  return res.status(500).json({
    success: false,
    mode: "echo",
    error: "Echo failed for all called AE candidates",
    tried,
    tried_find: triedFind,
    last_error: last.stderr || "",
  });
});

module.exports = router;
