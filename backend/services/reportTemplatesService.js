const pool = require("../db");

async function listModalities() {
  const result = await pool.query(
    "SELECT id, code, name FROM modalities WHERE is_active = true ORDER BY id"
  );
  return result.rows;
}

async function listBodyParts(modality_id) {
  const result = await pool.query(
    "SELECT id, name FROM body_parts WHERE modality_id = $1 AND is_active = true ORDER BY id",
    [modality_id]
  );
  return result.rows;
}

async function createTemplate({
  template_name,
  modality,
  body_part,
  template_type,
  content,
  created_by,
  created_by_role,
}) {
  const result = await pool.query(
    `INSERT INTO report_templates
      (template_name, modality, body_part, template_type, content, created_by, created_by_role, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
     RETURNING *`,
    [
      template_name,
      modality || null,
      body_part || null,
      template_type || "plain",
      JSON.stringify(content),
      created_by || null,
      created_by_role || null,
    ]
  );
  return result.rows[0];
}

async function listTemplates() {
  const result = await pool.query(
    "SELECT * FROM report_templates ORDER BY updated_at DESC"
  );
  return result.rows;
}

async function getTemplateById(id) {
  const result = await pool.query(
    "SELECT * FROM report_templates WHERE id=$1",
    [id]
  );
  return result.rows[0] || null;
}

async function updateTemplate({
  id,
  template_name,
  modality,
  body_part,
  template_type,
  content,
  created_by,
  created_by_role,
}) {
  const result = await pool.query(
    `UPDATE report_templates
     SET
       template_name = COALESCE($1, template_name),
       modality = COALESCE($2, modality),
       body_part = COALESCE($3, body_part),
       template_type = COALESCE($4, template_type),
       content = $5::jsonb,
       created_by = COALESCE($6, created_by),
       created_by_role = COALESCE($7, created_by_role),
       updated_at = NOW()
     WHERE id=$8
     RETURNING *`,
    [
      template_name,
      modality || null,
      body_part || null,
      template_type || null,
      JSON.stringify(content),
      created_by || null,
      created_by_role || null,
      id,
    ]
  );
  return result.rows[0] || null;
}

async function filterTemplates({ modality, body_part }) {
  const conditions = [];
  const values = [];

  if (modality) {
    values.push(modality);
    conditions.push(`modality = $${values.length}`);
  }
  if (body_part) {
    values.push(body_part);
    conditions.push(`body_part = $${values.length}`);
  }

  const query = `SELECT * FROM report_templates ${
    conditions.length ? "WHERE " + conditions.join(" AND ") : ""
  } ORDER BY updated_at DESC`;
  const result = await pool.query(query, values);
  return result.rows;
}

async function deleteTemplate(id) {
  const result = await pool.query(
    "DELETE FROM report_templates WHERE id=$1 RETURNING *",
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  listModalities,
  listBodyParts,
  createTemplate,
  listTemplates,
  getTemplateById,
  updateTemplate,
  filterTemplates,
  deleteTemplate,
};
