const express = require("express");
const router = express.Router();
const auditController = require("../controllers/auditController");
const { allowRoles } = require("../middleware/roles");

router.post("/event", auditController.logEvent);
router.post("/logout", auditController.logLogout);
router.get("/logs", allowRoles("ADMIN"), auditController.getLogs);
router.post("/archive/run", allowRoles("ADMIN"), auditController.runArchive);
router.get("/archives", allowRoles("ADMIN"), auditController.listArchives);
router.get("/available-dates", allowRoles("ADMIN"), auditController.availableDates);
router.get("/archives/:date/download", allowRoles("ADMIN"), auditController.downloadArchive);
router.get("/archives/download", allowRoles("ADMIN"), auditController.downloadFilteredTxt);

module.exports = router;
