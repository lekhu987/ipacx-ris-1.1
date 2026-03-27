const express = require("express");
const router = express.Router();
const publicReportSheetController = require("../controllers/publicReportSheetController");

router.get("/validate", publicReportSheetController.validate);

module.exports = router;
