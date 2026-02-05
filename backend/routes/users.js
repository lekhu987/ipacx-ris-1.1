const express = require("express");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const pool = require("../db");
const router = express.Router();
const uploadSignature = require("../middleware/uploadSignature");

/* =========================
   CREATE USER (ADMIN)
========================= */
router.post("/", uploadSignature.single("signature"), async (req, res) => {
  const {
    title,
    full_name,
    username,
    password,
    role,
    email,
    qualification,
    designation
  } = req.body;

  if (!username || !password || !role || !email) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const signature_path = req.file
      ? `/uploads/signatures/${req.file.filename}`
      : null;

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
        hash,
        role,
        email,
        qualification || null,
        designation || null,
        signature_path
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

/* =========================
   GET USERS
========================= */
router.get("/", async (req, res) => {
  try {
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

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch users error:", err.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/* =========================
   UPDATE USER
========================= */
router.put("/:id", uploadSignature.single("signature"), async (req, res) => {
  const { id } = req.params;

  try {
    const userRes = await pool.query("SELECT * FROM users WHERE id=$1", [id]);
    if (!userRes.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRes.rows[0];

    const {
      title,
      full_name,
      username,
      password,
      role,
      email,
      qualification,
      designation
    } = req.body;

    const hash = password?.trim()
      ? await bcrypt.hash(password, 10)
      : user.password_hash;

    const signature_path = req.file
      ? `/uploads/signatures/${req.file.filename}`
      : user.signature_url;

    // remove old signature if replaced
    if (req.file && user.signature_url) {
      const oldPath = path.join(__dirname, "..", user.signature_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

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
        hash,
        signature_path,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

/* =========================
   TOGGLE ACTIVE
========================= */
router.put("/:id/toggle", async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE users
      SET is_active = NOT is_active
      WHERE id=$1
      RETURNING id, is_active
      `,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Toggle user error:", err);
    res.status(500).json({ error: "Toggle failed" });
  }
});

/* =========================
   DELETE USER
========================= */
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id=$1 RETURNING id, username",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* =========================
   GET USER OR REPORTER BY USERNAME/EMAIL
========================= */
router.get("/approved-by/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query(
      `SELECT full_name, qualification, designation, signature_url
       FROM users
       WHERE username = $1 AND is_active = true`,
      [username]
    );

    if (!result.rows.length)
      return res.status(404).json({ error: "User not found" });

    const u = result.rows[0];

    res.json({
      full_name: u.full_name || "",
      qualification: u.qualification || "",
      designation: u.designation || "",
      signature_url: u.signature_url || null,
      dateTime: new Date().toISOString()
    });
  } catch (err) {
    console.error("Approved by fetch error:", err);
    res.status(500).json({ error: "Failed to fetch approved by user" });
  }
});


module.exports = router;
