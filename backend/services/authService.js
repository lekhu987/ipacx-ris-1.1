const pool = require("../db");

async function findUserByUsername(username) {
  const result = await pool.query(
    `
    SELECT id, username, role, password_hash, is_active
    FROM users
    WHERE username = $1
    `,
    [username]
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query(
    `
    SELECT id, username, role, email, is_active, title, full_name,
           qualification, designation, signature_url
    FROM users
    WHERE id = $1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function findBasicUserById(id) {
  const result = await pool.query(
    `
    SELECT id, username, role, is_active
    FROM users
    WHERE id = $1
    `,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  findUserByUsername,
  findUserById,
  findBasicUserById,
};
