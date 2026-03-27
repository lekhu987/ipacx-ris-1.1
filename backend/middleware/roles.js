function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

const ROLE_ALIASES = {
  ADMIN: "ADMIN",
  RADIOLOGIST: "RADIOLOGIST",
  DOCTOR: "RADIOLOGIST",
  TECHNICIAN: "TECHNICIAN",
};

function resolveRole(role) {
  const normalized = normalizeRole(role);
  return ROLE_ALIASES[normalized] || normalized;
}

function allowRoles(...roles) {
  const allowed = new Set(roles.flat().map(resolveRole));

  return function requireRole(req, res, next) {
    const userRole = resolveRole(req.user?.role);
    if (!userRole) {
      return res.status(403).json({ message: "Role missing" });
    }
    if (allowed.has(userRole)) {
      return next();
    }
    return res.status(403).json({ message: "Forbidden" });
  };
}

module.exports = { allowRoles, normalizeRole, resolveRole };
