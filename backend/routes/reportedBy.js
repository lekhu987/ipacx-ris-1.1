const express = require("express");
const router = express.Router();
const uploadSignature = require("../middleware/uploadSignature");
const reportedByController = require("../controllers/reportedByController");

router.post("/", uploadSignature.single("signature"), reportedByController.create);
router.get("/", reportedByController.list);
router.put("/:id", uploadSignature.single("signature"), reportedByController.update);
router.put("/:id/toggle", reportedByController.toggle);
router.delete("/:id", reportedByController.remove);
router.get("/by-name/:name", reportedByController.byName);

module.exports = router;
