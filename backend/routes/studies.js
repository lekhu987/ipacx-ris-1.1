const express = require("express");
const axios = require("axios");
const router = express.Router();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "",
  database: process.env.POSTGRES_DB || "RIS",
});

router.get("/", async (req, res) => {
  try {
    const pacsResult = await pool.query(
      "SELECT * FROM pacs WHERE pacs_type = 'DCM4CHEE' AND is_active = true"
    );

    if (pacsResult.rows.length === 0) {
      return res.json([]);
    }

    const pacs = pacsResult.rows[0];

    const qidoUrl = `http://${pacs.ip_address}:${pacs.port}/dcm4chee-arc/aets/${pacs.ae_title}/rs/studies`;

    console.log("📡 Fetching studies from:", qidoUrl);

    const response = await axios.get(qidoUrl, {
      headers: {
        Accept: "application/dicom+json",
      },
      timeout: 10000,
    });

    const studies = response.data.map(study => ({
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

    res.json(studies);
  } catch (err) {
    console.error("❌ DCM4CHEE fetch failed:", err.message);
    res.status(500).json({ error: "Failed to fetch studies from DCM4CHEE" });
  }
});

module.exports = router;
