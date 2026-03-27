const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const usersService = require("../services/usersService");
const { logAction } = require("../utils/auditLogger");

async function createUser(req, res) {
  const {
    title,
    full_name,
    username,
    password,
    role,
    email,
    qualification,
    designation,
  } = req.body;

  if (!username || !password || !role || !email) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const signature_path = req.file
      ? `/uploads/signatures/${req.file.filename}`
      : null;

    const created = await usersService.createUser({
      title,
      full_name,
      username,
      password_hash: hash,
      role,
      email,
      qualification,
      designation,
      signature_url: signature_path,
    });

    await logAction(req, {
      event: "USER_CREATED",
      details: {
        target_user_id: created.id,
        target_username: created.username,
        target_role: created.role,
      },
    });

    res.json(created);
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
}

async function listUsers(req, res) {
  try {
    const users = await usersService.listUsers();
    res.json(users);
  } catch (err) {
    console.error("Fetch users error:", err.message);
    res.status(500).json({ error: "Failed to fetch users" });
  }
}

async function updateUser(req, res) {
  const { id } = req.params;

  try {
    const user = await usersService.findUserById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const {
      title,
      full_name,
      username,
      password,
      role,
      email,
      qualification,
      designation,
    } = req.body;

    const hash = password?.trim()
      ? await bcrypt.hash(password, 10)
      : user.password_hash;

    const signature_path = req.file
      ? `/uploads/signatures/${req.file.filename}`
      : user.signature_url;

    if (req.file && user.signature_url) {
      const oldPath = path.join(__dirname, "..", user.signature_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const updated = await usersService.updateUser({
      id,
      title,
      full_name,
      username,
      email,
      role,
      qualification,
      designation,
      password_hash: hash,
      signature_url: signature_path,
    });

    const changed = [];
    if ((user.title || null) !== (updated.title || null)) changed.push("title");
    if ((user.full_name || null) !== (updated.full_name || null)) changed.push("full_name");
    if ((user.username || null) !== (updated.username || null)) changed.push("username");
    if ((user.email || null) !== (updated.email || null)) changed.push("email");
    if ((user.role || null) !== (updated.role || null)) changed.push("role");
    if ((user.qualification || null) !== (updated.qualification || null)) changed.push("qualification");
    if ((user.designation || null) !== (updated.designation || null)) changed.push("designation");
    if ((user.signature_url || null) !== (updated.signature_url || null)) changed.push("signature_url");
    if (password?.trim()) changed.push("password_hash");

    await logAction(req, {
      event: "USER_UPDATED",
      details: {
        target_user_id: updated.id,
        target_username: updated.username,
        changed_fields: changed,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
}

async function toggleUser(req, res) {
  try {
    const result = await usersService.toggleUserActive(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }

    await logAction(req, {
      event: "USER_STATUS_TOGGLED",
      details: {
        target_user_id: result.id,
        is_active: result.is_active,
      },
    });

    res.json(result);
  } catch (err) {
    console.error("Toggle user error:", err);
    res.status(500).json({ error: "Toggle failed" });
  }
}

async function deleteUser(req, res) {
  try {
    const deleted = await usersService.deleteUser(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }

    await logAction(req, {
      event: "USER_DELETED",
      details: {
        target_user_id: deleted.id,
        target_username: deleted.username,
      },
    });

    res.json({ success: true, deleted });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
}

async function approvedBy(req, res) {
  const { username } = req.params;

  try {
    const u = await usersService.getApprovedBy(username);
    if (!u) return res.status(404).json({ error: "User not found" });

    res.json({
      full_name: u.full_name || "",
      qualification: u.qualification || "",
      designation: u.designation || "",
      signature_url: u.signature_url || null,
      dateTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Approved by fetch error:", err);
    res.status(500).json({ error: "Failed to fetch approved by user" });
  }
}

module.exports = {
  createUser,
  listUsers,
  updateUser,
  toggleUser,
  deleteUser,
  approvedBy,
};
