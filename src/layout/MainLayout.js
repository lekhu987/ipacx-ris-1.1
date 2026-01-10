// src/layout/MainLayout.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./MainLayout.css";

function MainLayout({ children }) {
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const navigate = useNavigate();

  const { user, logout } = useAuth();
  const username = user?.username || "User";
  const role = user?.role || "N/A";
  const tokenExpiry = user?.tokenExpiry
    ? new Date(user.tokenExpiry).toLocaleString()
    : "N/A";

  const handleLogout = () => {
    logout(); // clears user from context
    navigate("/"); // go to login page
  };

  return (
    <div className="layout-container">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="app-name">iPacx RIS</div>

        {/* Main Menu */}
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/patient-list">Patient List</Link>
        <Link to="/billing">Billing</Link>
        <Link to="/scheduling">Scheduling</Link>
         <Link to="/inventory">Inventory</Link>
        <Link to="/mwls">Modality WorkList</Link>
         <Link to="/pacspage">PACS page</Link>
        <Link to="/reporting">Reporting</Link>
       

        {/* ADMIN SETTINGS (only ADMIN sees this) */}
        {role === "ADMIN" && (
          <>
            <div
              className="admin-section-title"
              onClick={() => setShowAdminMenu(!showAdminMenu)}
            >
              Admin Settings
            </div>

            {showAdminMenu && (
              <div className="admin-submenu">
                <Link to="/admin/user-management">User Management</Link>
                <Link to="/admin/templates">Template Management</Link>
                <Link to="/admin/pacs-management">PACS Management</Link>
                <Link to="/admin/mwls-management">MWLS Management</Link>
              </div>
            )}
          </>
        )}

        {/* USERNAME CLICK TO SHOW ROLE & TOKEN */}
        <div
          className="bottom-username"
          onClick={() => setShowUserInfo(!showUserInfo)}
          style={{ cursor: "pointer" }}
        >
          <div>{username}</div>

          {showUserInfo && (
            <div className="user-info" style={{ marginTop: "5px", fontSize: "0.85rem", color: "#0b0909ff" }}>
              <div>Role: {role}</div>
              <div>Token expires: {tokenExpiry}</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                style={{ marginTop: "5px" }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="content">{children}</div>
    </div>
  );
}

export default MainLayout;