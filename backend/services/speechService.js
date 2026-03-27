const fsp = require("fs/promises");
const { Blob } = require("buffer");

async function transcribeAudio({ filePath, mimeType, filename, language }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      message: "Speech transcription is not configured (missing OPENAI_API_KEY)",
    };
  }

  const model = process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe";
  const audioBuffer = await fsp.readFile(filePath);

  const form = new FormData();
  form.append("model", model);
  if (language) form.append("language", language);
  form.append("file", new Blob([audioBuffer], { type: mimeType }), filename);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = payload?.error?.message || "Transcription request failed";
    return { ok: false, status: 500, message: msg };
  }

  return { ok: true, text: String(payload?.text || "").trim() };
}

module.exports = { transcribeAudio };
