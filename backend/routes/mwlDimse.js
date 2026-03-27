const express = require("express");
const router = express.Router();
const mwlDimseController = require("../controllers/mwlDimseController");

router.get("/health", mwlDimseController.health);
router.post("/test", mwlDimseController.test);

module.exports = router;
