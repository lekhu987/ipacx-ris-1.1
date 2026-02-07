require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const app = express();
const PORT = process.env.PORT || 5000;
const generateFinalReportPDF = require("./utils/generateFinalReportPDF");
const uploadSignature = require("./middleware/uploadSignature"); 
app.use(cors({
  origin: true,   
  credentials: true
}));
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
  username: process.env.ORTHANC_USER || "lekhana",
  password: process.env.ORTHANC_PASS || "lekhana",
};

const authRoutes = require("./routes/auth");
app.use("/api", authRoutes);

const usersRoutes = require("./routes/users");
app.use("/api/users", usersRoutes);

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
app.use("/api/mwl", mwlRoutes);

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

//const studiesRoutes = require("./routes/studies");
//app.use("/api/studies", studiesRoutes);

// Test PostgreSQL connection at startup
pool.connect()
  .then(client => {
    console.log("🟢 Connected to PostgreSQL database");
    client.release();
    const buildPath = path.join(__dirname, "../build"); 
    if (fs.existsSync(buildPath)) {
      console.log("✅ React build folder found. Serving frontend...");
      app.use(express.static(buildPath));
      app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(path.join(buildPath, "index.html"));
      });
    } else {
      console.warn("⚠️ React build folder not found. Please run 'npm run build' in frontend.");
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("🔴 Failed to connect to PostgreSQL:", err.message);
  });
