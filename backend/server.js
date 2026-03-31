const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { Pool } = require("pg");
const fs = require("fs");
const http = require("http");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const app = express();
const PORT = process.env.PORT || 5000;
const generateFinalReportPDF = require("./utils/generateFinalReportPDF");
const uploadSignature = require("./middleware/uploadSignature"); 

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://localhost:3000",
  "https://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://localhost:5000",
  "https://127.0.0.1:5000",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
].filter(Boolean);

const lanOriginPattern = /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}:(3000|5000)$/;

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || lanOriginPattern.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "Expires",
    "x-audit-username",
    "x-audit-role",
    "x-audit-session",
  ],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());
app.use(
  "/uploads/report_images",
  express.static(path.join(__dirname, "uploads/report_images"))
);
app.use(
  "/uploads/signatures",
  express.static(path.join(__dirname, "uploads/signatures"))
);
app.disable("etag");

// ======================================================
// PostgreSQL CONNECTION
// ======================================================
const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "",
  database: process.env.POSTGRES_DB || "RIS",
});

// ======================================================
// ORTHANC CONNECTION CONFIG
// ======================================================
const ORTHANC_URL = (process.env.ORTHANC_URL || "http://192.168.1.34:8042/").replace(/\/?$/, "/");
const ORTHANC_AUTH = {
  username: process.env.ORTHANC_USER || "",
  password: process.env.ORTHANC_PASS || "",
};

const authRoutes = require("./routes/auth");
app.use("/api", authRoutes);

const requireAuth = require("./middleware/auth");
const crypto = require("crypto");
app.use((req, res, next) => {
  req.request_id =
    req.headers["x-request-id"] ||
    (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"));
  res.setHeader("x-request-id", req.request_id);
  next();
});
app.use("/api", requireAuth);

const { allowRoles } = require("./middleware/roles");
const { logAction } = require("./utils/auditLogger");

// Global audit logging for all API actions + errors (non-admin users included).
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    try {
      const path = req.originalUrl || "";
      if (path.startsWith("/api/audit")) return;

      const status = res.statusCode || 0;
      const method = req.method || "GET";
      const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
      const isError = status >= 400;

      if (!isError && !isWrite) return;
      if (isError && res.locals._auditErrorLogged) return;

      const details = {
        method,
        status,
        ms: Date.now() - start,
      };

      if (isError) {
        details.message =
          res.locals._auditErrorMessage || res.statusMessage || "Error";
      }

      const event = isError ? "API_ERROR" : "API_ACTION";
      logAction(req, { event, page: path, details }).catch(() => {});
    } catch {
      // Avoid breaking the request cycle if audit logging fails.
    }
  });
  next();
});

const mwlDimseRoutes = require("./routes/mwlDimse");
app.use("/api/mwl-dimse", allowRoles("ADMIN", "TECHNICIAN", "RADIOLOGIST"), mwlDimseRoutes);

const usersRoutes = require("./routes/users");
app.use("/api/users", allowRoles("ADMIN"), usersRoutes);

const reportedByRouter = require("./routes/reportedBy");
app.use("/api/reported-by", reportedByRouter);

app.post("/api/signatures", (req, res) => {
  uploadSignature.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.json({
      success: true,
      filename: req.file.filename,
      path: `/uploads/signatures/${req.file.filename}`
    });
  });
});

const mwlRoutes = require("./routes/mwl");
const mwlPublicRoutes = require("./routes/mwlRoutes");
app.use("/api/mwl", mwlRoutes);
app.use("/mwl", mwlPublicRoutes);
const mwlTargetsRoutes = require("./routes/mwlTargets");
app.use("/api/mwl-targets", allowRoles("ADMIN", "TECHNICIAN"), mwlTargetsRoutes);
const mwlSettingsRoutes = require("./routes/mwlSettings");
app.use("/api/mwl-settings", allowRoles("ADMIN", "TECHNICIAN"), mwlSettingsRoutes);

const reportsRoutes = require("./routes/reports");
app.use("/", reportsRoutes);

const patientsRoutes = require("./routes/patients");
app.use("/api/patients", patientsRoutes);

const appointmentsRoutes = require("./routes/appointments");
app.use("/api/appointments", appointmentsRoutes);

const reportTemplatesRoutes = require("./routes/reportTemplates");
app.use("/api", reportTemplatesRoutes);

const pacsRoutes = require("./routes/pacs");
app.use("/api/pacs", pacsRoutes);

const modalitiesRoutes = require("./routes/modalities");
app.use("/api", modalitiesRoutes);

const speechRoutes = require("./routes/speech");
app.use("/api/speech", speechRoutes);

const auditRoutes = require("./routes/audit");
app.use("/api/audit", auditRoutes);
const { startAuditArchiveScheduler } = require("./utils/auditLogger");
const { startMwlAutoPushScheduler } = require("./services/mwlAutoPush");
const { startMwlDimseScp } = require("./services/mwlDimseScp");

const publicReportSheetRoutes = require("./routes/publicReportSheet");
app.use("/api/public/report-sheet", publicReportSheetRoutes);

// Central error handler (logs API errors to audit)
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const path = req.originalUrl || "";
  if (!path.startsWith("/api/audit")) {
    res.locals._auditErrorLogged = true;
    res.locals._auditErrorMessage = err.message;
    logAction(req, {
      event: "API_ERROR",
      page: path,
      details: {
        method: req.method,
        status,
        message: err.message || "Server error",
      },
    }).catch(() => {});
  }

  if (res.headersSent) {
    return next(err);
  }
  return res.status(status).json({
    success: false,
    message: err.message || "Server error",
  });
});

//const studiesRoutes = require("./routes/studies");
//app.use("/api/studies", studiesRoutes);

// Test PostgreSQL connection at startup
pool.connect()
  .then(client => {
    console.log("🟢 Connected to PostgreSQL database");
    client.release();
    const buildPath = path.join(__dirname, "../build");
    const indexPath = path.join(buildPath, "index.html");
    if (fs.existsSync(buildPath) && fs.existsSync(indexPath)) {
      console.log("✅ React build folder found. Serving frontend...");
      app.use(express.static(buildPath));
      app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(indexPath);
      });
    } else {
      console.warn("⚠️ React build/index.html not found. Run 'npm run build' (or use frontend dev server).");
    }
    const server = http.createServer(app);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      startAuditArchiveScheduler();
      startMwlAutoPushScheduler();
      if (typeof mwlTargetsRoutes.syncLocalDimseScpState === "function") {
        mwlTargetsRoutes
          .syncLocalDimseScpState()
          .catch((err) =>
            console.error("Failed to sync local DIMSE SCP state:", err.message)
          );
      } else {
        startMwlDimseScp();
      }
    });
  })
  .catch(err => {
    console.error("🔴 Failed to connect to PostgreSQL:", err.message);
  });



