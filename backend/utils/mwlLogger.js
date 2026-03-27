const fs = require("fs");
const path = require("path");

const DEFAULT_LOG_DIR = path.join(__dirname, "..", "..", "logs", "mwl");
const DEFAULT_LOG_FILE = path.join(DEFAULT_LOG_DIR, "mwl.log");

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogFile() {
  const file = process.env.MWL_LOG_FILE;
  return file ? String(file) : DEFAULT_LOG_FILE;
}

function ensureLogDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeMeta(meta) {
  if (!meta) return null;
  if (meta instanceof Error) {
    return { message: meta.message, stack: meta.stack };
  }
  if (typeof meta === "object") return meta;
  return { value: String(meta) };
}

function formatLine(level, message, meta) {
  const ts = new Date().toISOString();
  const payload = normalizeMeta(meta);
  const suffix = payload ? ` ${JSON.stringify(payload)}` : "";
  return `${ts} [${level.toUpperCase()}] ${message}${suffix}\n`;
}

function shouldLog(level) {
  const envLevel = String(process.env.MWL_LOG_LEVEL || "info").toLowerCase();
  const min = LEVELS[envLevel] || LEVELS.info;
  return LEVELS[level] >= min;
}

function writeLine(line) {
  try {
    const filePath = resolveLogFile();
    ensureLogDir(filePath);
    fs.appendFileSync(filePath, line, "utf8");
  } catch {
    // ignore logging failures
  }
}

function log(level, message, meta) {
  if (!shouldLog(level)) return;
  const line = formatLine(level, message, meta);
  if (level === "error") console.error(message, meta || "");
  else if (level === "warn") console.warn(message, meta || "");
  else if (level === "debug") console.debug(message, meta || "");
  else console.info(message, meta || "");
  writeLine(line);
}

module.exports = {
  debug: (msg, meta) => log("debug", msg, meta),
  info: (msg, meta) => log("info", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  error: (msg, meta) => log("error", msg, meta),
};
