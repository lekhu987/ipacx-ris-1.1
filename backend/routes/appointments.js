const express = require("express");
const router = express.Router();
const appointmentsController = require("../controllers/appointmentsController");

router.get("/scheduled-ids", appointmentsController.getScheduledIds);
router.get("/", appointmentsController.listAppointments);
router.post("/", appointmentsController.createAppointment);
router.put("/:id", appointmentsController.updateAppointment);
router.delete("/:id", appointmentsController.deleteAppointment);

module.exports = router;
