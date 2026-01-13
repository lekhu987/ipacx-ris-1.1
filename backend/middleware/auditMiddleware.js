const logAudit = require("../utils/auditLogger");

const ignoredPaths = ["/favicon.ico", "/robots.txt", "/static/", "/public/"];

module.exports = function auditMiddleware(req, res, next) {
  const start = Date.now();

  // Skip OPTIONS or ignored paths
  if (req.method === "OPTIONS" || ignoredPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  // Once response finishes, log audit
  res.once("finish", () => {
    if (res.auditLogged) return;
    res.auditLogged = true;

    const duration = Date.now() - start;

    const auditData = {
      user_id: req.user?.id || null,
      username: req.user?.username || "guest",
      session_id: req.sessionID || null,
      action: req.auditAction || `${req.method} ${req.originalUrl}`,
      method: req.method,
      path: req.originalUrl,
      status_code: res.statusCode,
      ip_address: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      user_agent: req.headers["user-agent"] || "unknown",
      duration_ms: duration,
      success: res.statusCode < 400,
    };

    // Terminal log with color
    console.log(
      `[AUDIT] ${new Date().toISOString()} | ${auditData.username} | ` +
      `${auditData.action} | ${auditData.method} ${auditData.path} | ` +
      `${auditData.status_code} | ${duration}ms | ` +
      (auditData.success ? "\x1b[32mSUCCESS\x1b[0m" : "\x1b[31mFAILED\x1b[0m")
    );

    // Save to database
    logAudit(auditData);
  });

  next();
};
