const fsp = require("fs/promises");
const speechService = require("../services/speechService");

async function transcribe(req, res) {
  let tempPath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Audio file is required" });
    }
    tempPath = req.file.path;

    const language = String(req.body?.language || "en").trim();
    const mimeType = req.file.mimetype || "audio/webm";
    const filename = req.file.originalname || "dictation.webm";

    const result = await speechService.transcribeAudio({
      filePath: tempPath,
      mimeType,
      filename,
      language,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.message });
    }

    return res.json({ text: result.text });
  } catch (err) {
    console.error("Speech transcribe error:", err);
    return res.status(500).json({ error: "Failed to transcribe audio" });
  } finally {
    if (tempPath) {
      await fsp.unlink(tempPath).catch(() => {});
    }
  }
}

module.exports = { transcribe };
