const path = require("path");
const fs = require("fs");
const reportedByService = require("../services/reportedByService");

async function create(req, res) {
  const { title, full_name, email, qualification } = req.body;

  if (!full_name || !email) {
    return res.status(400).json({ error: "Full Name and Email are required" });
  }

  try {
    const signature_path = req.file ? `/uploads/signatures/${req.file.filename}` : null;

    const created = await reportedByService.createReporter({
      title,
      full_name,
      email,
      qualification,
      signature_url: signature_path,
    });

    res.json(created);
  } catch (err) {
    console.error("Create reporter error:", err);
    res.status(500).json({ error: "Failed to create reported by user" });
  }
}

async function list(req, res) {
  try {
    const reporters = await reportedByService.listReporters();
    res.json(reporters);
  } catch (err) {
    console.error("Fetch reporters error:", err);
    res.status(500).json({ error: "Failed to fetch reported by users" });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { title, full_name, email, qualification } = req.body;

  try {
    const user = await reportedByService.findReporterById(id);
    if (!user) return res.status(404).json({ error: "Reported by user not found" });

    const signature_path = req.file ? `/uploads/signatures/${req.file.filename}` : user.signature_url;

    if (req.file && user.signature_url) {
      const oldPath = path.join(__dirname, "..", user.signature_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const updated = await reportedByService.updateReporter({
      id,
      title,
      full_name,
      email,
      qualification,
      signature_url: signature_path,
    });

    res.json(updated);
  } catch (err) {
    console.error("Update reporter error:", err);
    res.status(500).json({ error: "Failed to update reported by user" });
  }
}

async function toggle(req, res) {
  try {
    const result = await reportedByService.toggleReporterActive(req.params.id);
    if (!result) return res.status(404).json({ error: "Reported by user not found" });

    res.json(result);
  } catch (err) {
    console.error("Toggle reporter error:", err);
    res.status(500).json({ error: "Toggle failed" });
  }
}

async function remove(req, res) {
  try {
    const user = await reportedByService.findReporterById(req.params.id);
    if (!user) return res.status(404).json({ error: "Reported by user not found" });

    if (user.signature_url) {
      const filePath = path.join(__dirname, "..", user.signature_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const deleted = await reportedByService.deleteReporter(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    console.error("Delete reporter error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
}

async function byName(req, res) {
  try {
    const { name } = req.params;

    const r = await reportedByService.findReporterByName(name);
    if (!r) {
      return res.status(404).json({ error: "Reporter not found" });
    }

    res.json({
      full_name: r.full_name || "",
      qualification: r.qualification || "",
      signature_url: r.signature_url || null,
      dateTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Reported by fetch error:", err);
    res.status(500).json({ error: "Failed to fetch reporter" });
  }
}

module.exports = {
  create,
  list,
  update,
  toggle,
  remove,
  byName,
};
