const express = require("express");
const router = express.Router();
const studiesController = require("../controllers/studiesController");

router.get("/", studiesController.listStudies);

module.exports = router;
