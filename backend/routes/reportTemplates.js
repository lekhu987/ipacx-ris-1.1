// routes/reportTemplates.js
const express = require("express");
const router = express.Router();
const { allowRoles } = require("../middleware/roles");
const reportTemplatesController = require("../controllers/reportTemplatesController");

// ========================
// MODALITIES & BODY PARTS
// ========================

// Get all active modalities
router.get("/modalities", reportTemplatesController.getModalities);

// Get active body parts by modality_id
router.get("/body-parts", reportTemplatesController.getBodyParts);

// ========================
// REPORT TEMPLATES ROUTES
// ========================

// Create a new template
router.post(
  "/report-templates",
  allowRoles("ADMIN", "RADIOLOGIST"),
  reportTemplatesController.createTemplate
);

// Get all templates
router.get("/report-templates", reportTemplatesController.listTemplates);

// Get template by ID
router.get("/report-templates/:id", reportTemplatesController.getTemplate);

// Update template
router.put(
  "/report-templates/:id",
  allowRoles("ADMIN", "RADIOLOGIST"),
  reportTemplatesController.updateTemplate
);

// Filter templates
router.get("/report-templates/filter", reportTemplatesController.filterTemplates);

// Delete template
router.delete(
  "/report-templates/:id",
  allowRoles("ADMIN", "RADIOLOGIST"),
  reportTemplatesController.deleteTemplate
);

module.exports = router;
