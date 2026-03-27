const { validateReportSheetToken } = require("../services/publicReportSheetService");

function validate(req, res) {
  const providedToken = String(req.query.k || req.headers["x-report-key"] || "").trim();
  const result = validateReportSheetToken(providedToken);

  if (!result.ok) {
    return res.status(result.status).json({
      success: false,
      message: result.message,
    });
  }

  return res.json({ success: true });
}

module.exports = { validate };
