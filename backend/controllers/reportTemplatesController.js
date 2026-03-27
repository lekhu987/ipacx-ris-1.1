const { logAction } = require("../utils/auditLogger");
const reportTemplatesService = require("../services/reportTemplatesService");

async function getModalities(req, res) {
  try {
    const rows = await reportTemplatesService.listModalities();
    res.json(rows);
  } catch (err) {
    console.error("Fetch modalities error:", err.message);
    res.status(500).json({ error: "Failed to fetch modalities" });
  }
}

async function getBodyParts(req, res) {
  try {
    const modality_id = req.query.modality_id;
    if (!modality_id) return res.status(400).json({ error: "modality_id is required" });

    const rows = await reportTemplatesService.listBodyParts(modality_id);
    res.json(rows);
  } catch (err) {
    console.error("Fetch body parts error:", err.message);
    res.status(500).json({ error: "Failed to fetch body parts" });
  }
}

async function createTemplate(req, res) {
  try {
    const { template_name, modality, body_part, template_type, content, created_by, created_by_role } = req.body;

    if (!content) return res.status(400).json({ error: "Content is required" });

    const finalTemplateName =
      template_name && template_name.trim() !== ""
        ? template_name
        : modality && body_part
        ? `${modality}_${body_part}_${template_type || "plain"}`
        : null;

    const created = await reportTemplatesService.createTemplate({
      template_name: finalTemplateName,
      modality,
      body_part,
      template_type: template_type || "plain",
      content,
      created_by,
      created_by_role,
    });

    created.content = content;

    await logAction(req, {
      event: "TEMPLATE_CREATED",
      details: {
        template_id: created.id,
        template_name: created.template_name,
        modality: created.modality,
        body_part: created.body_part,
      },
    });

    res.json({ success: true, template: created });
  } catch (err) {
    console.error("Create template error:", err.message);
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Template with same Modality + Body Part + Name already exists" });
    }
    res.status(500).json({ error: "Failed to create template" });
  }
}

async function listTemplates(req, res) {
  try {
    const rows = await reportTemplatesService.listTemplates();
    const templates = rows.map((r) => ({ ...r, content: r.content }));
    res.json(templates);
  } catch (err) {
    console.error("Fetch templates error:", err.message);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
}

async function getTemplate(req, res) {
  try {
    const { id } = req.params;
    const template = await reportTemplatesService.getTemplateById(id);
    if (!template) return res.status(404).json({ error: "Template not found" });

    template.content = template.content;
    res.json(template);
  } catch (err) {
    console.error("Fetch template error:", err.message);
    res.status(500).json({ error: "Failed to fetch template" });
  }
}

async function updateTemplate(req, res) {
  try {
    const { id } = req.params;
    const { template_name, modality, body_part, template_type, content, created_by, created_by_role } = req.body;

    if (!content) return res.status(400).json({ error: "Content is required" });

    const finalTemplateName =
      template_name && template_name.trim() !== ""
        ? template_name
        : modality && body_part
        ? `${modality}_${body_part}_${template_type || "plain"}`
        : null;

    const updated = await reportTemplatesService.updateTemplate({
      id,
      template_name: finalTemplateName,
      modality,
      body_part,
      template_type,
      content,
      created_by,
      created_by_role,
    });

    if (!updated) return res.status(404).json({ error: "Template not found" });

    updated.content = content;

    await logAction(req, {
      event: "TEMPLATE_UPDATED",
      details: {
        template_id: updated.id,
        template_name: updated.template_name,
        modality: updated.modality,
        body_part: updated.body_part,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Update template error:", err.message);
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Template with same Modality + Body Part + Name already exists" });
    }
    res.status(500).json({ error: "Failed to update template" });
  }
}

async function filterTemplates(req, res) {
  try {
    const { modality, body_part } = req.query;
    const rows = await reportTemplatesService.filterTemplates({ modality, body_part });
    res.json(rows.map((r) => ({ ...r, content: r.content })));
  } catch (err) {
    console.error("Filter templates error:", err.message);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
}

async function deleteTemplate(req, res) {
  try {
    const { id } = req.params;
    const deleted = await reportTemplatesService.deleteTemplate(id);
    if (!deleted) return res.status(404).json({ error: "Template not found" });

    await logAction(req, {
      event: "TEMPLATE_DELETED",
      details: {
        template_id: deleted.id,
        template_name: deleted.template_name,
      },
    });

    res.json({ success: true, message: "Template deleted", deleted });
  } catch (err) {
    console.error("Delete template error:", err.message);
    res.status(500).json({ error: "Failed to delete template" });
  }
}

module.exports = {
  getModalities,
  getBodyParts,
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  filterTemplates,
  deleteTemplate,
};
