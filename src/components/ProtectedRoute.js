// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return <div>Loading...</div>;
  }

  // If no user is logged in, redirect to login page
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (Array.isArray(roles) && roles.length > 0) {
    const allowed = new Set(roles.map(resolveRole));
    const userRole = resolveRole(user.role);
    if (!allowed.has(userRole)) {
      return <div>Not authorized for this page.</div>;
    }
  }

  // If user is authenticated, render the protected content
  return children;
}
