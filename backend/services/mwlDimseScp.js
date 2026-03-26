const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const DEFAULT_OUT_DIR = path.join(__dirname, "..", "..", "logs", "mwl-dimse");
let scpProcess = null;
let lastError = null;
let lastArgs = null;
let lastStartAt = null;
let lastPid = null;
let lastForcedKillAt = null;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolveDcmtkTool(tool) {
  const binDir = process.env.DCMTK_BIN;
  const exe = process.platform === "win32" ? `${tool}.exe` : tool;
  return binDir ? path.join(binDir, exe) : tool;
}

function parseArgs(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(/\s+/).filter(Boolean);
}

function startMwlDimseScp() {
  const enabled = String(process.env.MWL_DIMSE_SCP_ENABLED || "true").toLowerCase() !== "false";
  if (!enabled) return;
  if (scpProcess) return;

  const outDir = process.env.MWL_DIMSE_OUT_DIR || DEFAULT_OUT_DIR;
  ensureDir(outDir);

  const port = process.env.MWL_DIMSE_PORT || "11112";
  const calledAe =
    process.env.MWL_DIMSE_CALLED_AE ||
    process.env.MWL_DIMSE_AE_TITLE ||
    "WORKLIST";

  // wlmscpfs (filesystem datasource) expects a subdirectory named after
  // the called AE title; otherwise it rejects the association.
  const aeDir = path.join(outDir, String(calledAe).trim() || "WORKLIST");
  ensureDir(aeDir);
  const tool = resolveDcmtkTool("wlmscpfs");
  const customArgs = parseArgs(process.env.MWL_DIMSE_SCP_ARGS);
  const args =
    customArgs.length > 0
      ? customArgs.slice()
      : ["--log-level", "error", "-dfp", outDir, String(port)];

  lastArgs = [tool, ...args];
  lastStartAt = new Date().toISOString();
  if (String(process.env.MWL_DIMSE_SCP_LOG_STARTUP || "false").toLowerCase() === "true") {
    console.info("Starting MWL DIMSE SCP:", {
      port,
      args,
      tool,
      out_dir: outDir,
      called_ae: calledAe,
      ae_dir: aeDir,
    });
  }
  scpProcess = spawn(tool, args, { stdio: ["ignore", "pipe", "pipe"] });
  lastPid = scpProcess.pid || null;
  const handleOutput = (chunk) => {
    const text = chunk.toString();
    if (/WlmDataSourceFileSystem::SetReadlock: Cannot open file .*\\lockfile/i.test(text)) {
      return;
    }
    process.stderr.write(text);
  };
  if (scpProcess.stdout) {
    scpProcess.stdout.on("data", handleOutput);
  }
  if (scpProcess.stderr) {
    scpProcess.stderr.on("data", handleOutput);
  }
  scpProcess.on("exit", (code) => {
    scpProcess = null;
    lastPid = null;
    if (typeof code === "number" && code !== 0) {
      lastError = `SCP exited with code ${code}`;
    }
    console.warn(`MWL DIMSE SCP exited with code ${code}`);
  });
  scpProcess.on("error", (err) => {
    scpProcess = null;
    lastPid = null;
    lastError = err?.message || String(err);
    console.error("Failed to start MWL DIMSE SCP:", err.message);
  });
}

function killWlmscpfsOnPort(port) {
  const portNum = Number(port);
  if (!portNum) return false;
  try {
    if (process.platform === "win32") {
      const result = spawnSync(
        "netstat",
        ["-ano"],
        { encoding: "utf8" }
      );
      const output = String(result.stdout || "");
      const pids = new Set();
      output.split(/\r?\n/).forEach((line) => {
        if (!line.includes(`:${portNum}`)) return;
        if (!/\bLISTENING\b/i.test(line)) return;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(Number(pid));
      });
      if (pids.size === 0) return false;
      pids.forEach((pid) => {
        try {
          process.kill(pid);
        } catch {
          // ignore
        }
      });
      lastForcedKillAt = new Date().toISOString();
      return true;
    }
    const result = spawnSync("lsof", ["-i", `TCP:${portNum}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    });
    const output = String(result.stdout || "");
    const pids = output
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter((v) => /^\d+$/.test(v))
      .map((v) => Number(v));
    if (pids.length === 0) return false;
    pids.forEach((pid) => {
      try {
        process.kill(pid);
      } catch {
        // ignore
      }
    });
    lastForcedKillAt = new Date().toISOString();
    return true;
  } catch {
    return false;
  }
}

function stopMwlDimseScp() {
  const port = process.env.MWL_DIMSE_PORT || "11112";
  if (!scpProcess) {
    return killWlmscpfsOnPort(port);
  }
  try {
    scpProcess.kill();
  } catch (err) {
    console.warn("Failed to stop MWL DIMSE SCP:", err?.message || err);
  }
  scpProcess = null;
  lastPid = null;
  lastError = "Stopped by request";
  // Also ensure no orphan process is still bound to the port.
  killWlmscpfsOnPort(port);
  return true;
}

function getMwlDimseStatus() {
  return {
    running: Boolean(scpProcess),
    ae_title: process.env.MWL_DIMSE_AE_TITLE || "IPACX_MWL",
    port: process.env.MWL_DIMSE_PORT || "11112",
    called_ae: process.env.MWL_DIMSE_CALLED_AE || "WORKLIST",
    out_dir: process.env.MWL_DIMSE_OUT_DIR || DEFAULT_OUT_DIR,
    last_error: lastError,
    last_args: lastArgs,
    last_started_at: lastStartAt,
    last_forced_kill_at: lastForcedKillAt,
    pid: lastPid,
  };
}

module.exports = { startMwlDimseScp, stopMwlDimseScp, getMwlDimseStatus };
