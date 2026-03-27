const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const speechController = require("../controllers/speechController");

const router = express.Router();

const tmpDir = path.join(__dirname, "../uploads/audio_tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const upload = multer({
  dest: tmpDir,
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post("/transcribe", upload.single("audio"), speechController.transcribe);

module.exports = router;
