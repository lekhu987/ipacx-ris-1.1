const pool = require("../db");

async function createUser({
  title,
  full_name,
  username,
  password_hash,
  role,
  email,
  qualification,
  designation,
  signature_url,
}) {
  const result = await pool.query(
    `
    INSERT INTO users
    (title, full_name, username, password_hash, role, email,
     qualification, designation, signature_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING
      id, title, full_name, username, email,
      role, qualification, designation,
      is_active, signature_url
    `,
    [
      title || null,
      full_name || null,
      username,
      password_hash,
      role,
      email,
      qualification || null,
      designation || null,
      signature_url || null,
    ]
  );
  return result.rows[0];
}

async function listUsers() {
  const result = await pool.query(`
    SELECT
      id,
      title,
      full_name,
      username,
      email,
      role,
      qualification,
      designation,
      is_active,
      signature_url,
      created_at
    FROM users
    ORDER BY id ASC
  `);
  return result.rows;
}

async function findUserById(id) {
  const result = await pool.query("SELECT * FROM users WHERE id=$1", [id]);
  return result.rows[0] || null;
}

async function updateUser({
  id,
  title,
  full_name,
  username,
  email,
  role,
  qualification,
  designation,
  password_hash,
  signature_url,
}) {
  const result = await pool.query(
    `
    UPDATE users SET
      title=$1,
      full_name=$2,
      username=$3,
      email=$4,
      role=$5,
      qualification=$6,
      designation=$7,
      password_hash=$8,
      signature_url=$9
    WHERE id=$10
    RETURNING
      id, title, full_name, username, email,
      role, qualification, designation,
      is_active, signature_url
    `,
    [
      title || null,
      full_name || null,
      username,
      email,
      role,
      qualification || null,
      designation || null,
      password_hash,
      signature_url,
      id,
    ]
  );
  return result.rows[0] || null;
}

async function toggleUserActive(id) {
  const result = await pool.query(
    `
    UPDATE users
    SET is_active = NOT is_active
    WHERE id=$1
    RETURNING id, is_active
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function deleteUser(id) {
  const result = await pool.query(
    "DELETE FROM users WHERE id=$1 RETURNING id, username",
    [id]
  );
  return result.rows[0] || null;
}

async function getApprovedBy(username) {
  const result = await pool.query(
    `SELECT full_name, qualification, designation, signature_url
     FROM users
     WHERE username = $1 AND is_active = true`,
    [username]
  );
  return result.rows[0] || null;
}

module.exports = {
  createUser,
  listUsers,
  findUserById,
  updateUser,
  toggleUserActive,
  deleteUser,
  getApprovedBy,
};
