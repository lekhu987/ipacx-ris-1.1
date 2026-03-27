const express = require("express");
const router = express.Router();
const modalitiesController = require("../controllers/modalitiesController");

router.get("/modalities", modalitiesController.getModalities);
router.get("/body-parts", modalitiesController.getBodyParts);

module.exports = router;
