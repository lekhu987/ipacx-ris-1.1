const pool = require("../db");

async function listModalities() {
  const result = await pool.query(
    "SELECT id, code, name FROM modalities WHERE is_active = true ORDER BY id"
  );
  return result.rows;
}

async function listBodyParts(modality_id) {
  const result = await pool.query(
    `SELECT id, name
     FROM body_parts
     WHERE modality_id = $1 AND is_active = true
     ORDER BY id`,
    [modality_id]
  );
  return result.rows;
}

module.exports = {
  listModalities,
  listBodyParts,
};
