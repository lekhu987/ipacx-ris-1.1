function validateReportSheetToken(providedToken) {
  const configuredToken = String(process.env.REPORT_SHEET_TOKEN || "").trim();
  if (!configuredToken) {
    return {
      ok: false,
      status: 500,
      message: "REPORT_SHEET_TOKEN is not configured on server.",
    };
  }

  if (!providedToken || String(providedToken).trim() !== configuredToken) {
    return {
      ok: false,
      status: 401,
      message: "Invalid access key.",
    };
  }

  return { ok: true };
}

module.exports = { validateReportSheetToken };
