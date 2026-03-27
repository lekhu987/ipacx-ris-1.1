const express = require("express");
const router = express.Router();
const auditController = require("../controllers/auditController");

router.post("/event", auditController.logEvent);
router.post("/logout", auditController.logLogout);
router.get("/logs", auditController.getLogs);
router.post("/archive/run", auditController.runArchive);
router.get("/archives", auditController.listArchives);
router.get("/available-dates", auditController.availableDates);
router.get("/archives/:date/download", auditController.downloadArchive);
router.get("/archives/download", auditController.downloadFilteredTxt);

module.exports = router;
