const pool = require("../db");

async function createReporter({
  title,
  full_name,
  email,
  qualification,
  signature_url,
}) {
  const result = await pool.query(
    `
    INSERT INTO reporters
    (title, full_name, email, qualification, signature_url)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING *
    `,
    [title || null, full_name, email, qualification || null, signature_url || null]
  );
  return result.rows[0];
}

async function listReporters() {
  const result = await pool.query(
    `
    SELECT * FROM reporters ORDER BY id ASC
    `
  );
  return result.rows;
}

async function findReporterById(id) {
  const result = await pool.query("SELECT * FROM reporters WHERE id=$1", [id]);
  return result.rows[0] || null;
}

async function updateReporter({
  id,
  title,
  full_name,
  email,
  qualification,
  signature_url,
}) {
  const result = await pool.query(
    `
    UPDATE reporters SET
      title=$1,
      full_name=$2,
      email=$3,
      qualification=$4,
      signature_url=$5,
      updated_at=NOW()
    WHERE id=$6
    RETURNING *
    `,
    [title || null, full_name, email, qualification || null, signature_url, id]
  );
  return result.rows[0] || null;
}

async function toggleReporterActive(id) {
  const result = await pool.query(
    `
    UPDATE reporters
    SET is_active = NOT is_active, updated_at = NOW()
    WHERE id=$1
    RETURNING id, is_active
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function deleteReporter(id) {
  const result = await pool.query(
    "DELETE FROM reporters WHERE id=$1 RETURNING id, full_name",
    [id]
  );
  return result.rows[0] || null;
}

async function findReporterByName(name) {
  const result = await pool.query(
    `SELECT full_name, qualification, signature_url
     FROM reporters
     WHERE full_name ILIKE $1 AND is_active = true
     LIMIT 1`,
    [`%${name}%`]
  );
  return result.rows[0] || null;
}

module.exports = {
  createReporter,
  listReporters,
  findReporterById,
  updateReporter,
  toggleReporterActive,
  deleteReporter,
  findReporterByName,
};
