const modalitiesService = require("../services/modalitiesService");

async function getModalities(req, res) {
  try {
    const modalities = await modalitiesService.listModalities();
    res.json(modalities);
  } catch (err) {
    console.error("Fetch modalities error:", err.message);
    res.status(500).json({ error: "Failed to fetch modalities" });
  }
}

async function getBodyParts(req, res) {
  try {
    const { modality_id } = req.query;
    if (!modality_id) {
      return res.status(400).json({ error: "modality_id is required" });
    }

    const bodyParts = await modalitiesService.listBodyParts(modality_id);
    res.json(bodyParts);
  } catch (err) {
    console.error("Fetch body parts error:", err.message);
    res.status(500).json({ error: "Failed to fetch body parts" });
  }
}

module.exports = {
  getModalities,
  getBodyParts,
};
