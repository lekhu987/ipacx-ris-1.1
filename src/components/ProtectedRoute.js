// src/components/ProtectedRoute.jsx
import React from "react";

// This version allows access to any page, ignores login/auth check
export default function ProtectedRoute({ children }) {
  // Simply render the children, no redirect
  return children;
}
