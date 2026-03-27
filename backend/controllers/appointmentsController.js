const appointmentsService = require("../services/appointmentsService");

async function getScheduledIds(req, res) {
  try {
    const ids = await appointmentsService.getScheduledIds();
    return res.json({ success: true, ids });
  } catch (err) {
    console.error("Error fetching scheduled ids:", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch scheduled ids" });
  }
}

async function listAppointments(req, res) {
  const { date } = req.query;
  try {
    const rows = await appointmentsService.listAppointments(date);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching appointments:", err.message);
    return res.status(500).json({ error: "Failed to fetch appointments" });
  }
}

async function createAppointment(req, res) {
  try {
    const result = await appointmentsService.saveAppointment(req.body);
    return res.json({ success: true, appointment: result.appointment, mwl_updated: result.mwl_updated });
  } catch (err) {
    console.error("Error saving appointment:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ success: false, error: err.message || "Failed to save appointment" });
  }
}

async function updateAppointment(req, res) {
  try {
    const result = await appointmentsService.updateAppointment(req.params.id, req.body);
    return res.json({ success: true, appointment: result.appointment, mwl_updated: result.mwl_updated });
  } catch (err) {
    console.error("Error updating appointment:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ success: false, error: err.message || "Failed to update appointment" });
  }
}

async function deleteAppointment(req, res) {
  try {
    const deleted = await appointmentsService.deleteAppointment(req.params.id);
    return res.json({ success: true, deleted });
  } catch (err) {
    console.error("Error deleting appointment:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ success: false, error: err.message || "Failed to delete appointment" });
  }
}

module.exports = {
  getScheduledIds,
  listAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
};
