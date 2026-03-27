const express = require("express");
const router = express.Router();
const mwlSettingsController = require("../controllers/mwlSettingsController");

router.get("/", mwlSettingsController.getSettings);
router.post("/", mwlSettingsController.saveSettings);

module.exports = router;
