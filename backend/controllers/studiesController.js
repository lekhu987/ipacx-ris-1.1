const studiesService = require("../services/studiesService");

async function listStudies(req, res) {
  try {
    const pacs = await studiesService.getActiveDcm4cheePacs();
    if (!pacs) {
      return res.json([]);
    }

    const studies = await studiesService.fetchStudiesFromDcm4chee(pacs);
    res.json(studies);
  } catch (err) {
    console.error("❌ DCM4CHEE fetch failed:", err.message);
    res.status(500).json({ error: "Failed to fetch studies from DCM4CHEE" });
  }
}

module.exports = { listStudies };
