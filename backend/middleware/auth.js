const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !String(secret).trim()) {
    return null;
  }
  return String(secret);
}

function isPublicPath(pathname = "") {
  if (!pathname) return false;
  return (
    pathname === "/login" ||
    pathname === "/logout" ||
    pathname === "/verify" ||
    pathname.startsWith("/public/")
  );
}

module.exports = function requireAuth(req, res, next) {
  if (isPublicPath(req.path)) return next();

  const secret = getJwtSecret();
  if (!secret) {
    return res.status(500).json({ message: "JWT_SECRET is not configured" });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Authorization token missing" });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
