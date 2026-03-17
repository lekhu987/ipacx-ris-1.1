import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarDays,
  Boxes,
  ClipboardList,
  Monitor,
  FileText,
  Settings,
  Menu,
  ChevronLeft,
} from "lucide-react";
import "./MainLayout.css";
import { getClickLabel, logAuditEvent } from "../utils/auditClient";

function MainLayout({ children }) {
  // Initialize collapsed state from sessionStorage
  const [collapsed, setCollapsed] = useState(() => {
    const saved = sessionStorage.getItem("sidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const username = user?.username || "User";
  const role = user?.role || "N/A";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Save collapsed state in sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem("sidebarCollapsed", JSON.stringify(collapsed));
  }, [collapsed]);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const menuItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={18} />, path: "/dashboard" },
    { name: "Patient List", icon: <Users size={18} />, path: "/patient-list" },
   // { name: "Billing", icon: <CreditCard size={18} />, path: "/billing" },
    { name: "Scheduling", icon: <CalendarDays size={18} />, path: "/scheduling" },
   // { name: "Inventory", icon: <Boxes size={18} />, path: "/inventory" },
    { name: "Modality WorkList", icon: <ClipboardList size={18} />, path: "/mwls" },
    { name: "PACS Page", icon: <Monitor size={18} />, path: "/pacspage" },
    { name: "Reporting", icon: <FileText size={18} />, path: "/reporting" },
  ];

  useEffect(() => {
    if (!user) return;
    if (location.pathname.startsWith("/admin/audit-logs")) return;
    logAuditEvent("PAGE_VIEW", { pathname: location.pathname });
  }, [location.pathname, user]);

  useEffect(() => {
    if (!user) return;

    const handler = (evt) => {
      if (window.location.pathname.startsWith("/admin/audit-logs")) return;
      const node = evt.target?.closest?.("button, a, [role='button']");
      if (!node) return;
      const label = getClickLabel(node);
      logAuditEvent("CLICK", {
        label: label || "unknown",
        tag: node.tagName || "",
      });
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [user]);

  return (
    <div className="ris-layout">
      {/* SIDEBAR */}
      <aside className={`ris-sidebar ${collapsed ? "collapsed" : ""}`}>
        {/* HEADER */}
        <div className="ris-sidebar-header">
          {!collapsed && <div className="ris-app-name">iPacx RIS</div>}
          <button
            className="ris-toggle-btn"
            onClick={toggleSidebar}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* MENU */}
        <nav className="ris-menu">
          {menuItems.map((item) => (
            <div key={item.name} className="ris-menu-item-wrapper">
              <Link
                to={item.path}
                className={`ris-menu-item ${
                  location.pathname === item.path ? "active" : ""
                }`}
              >
                {item.icon}
                {!collapsed && <span>{item.name}</span>}
              </Link>
              {collapsed && <div className="ris-tooltip">{item.name}</div>}
            </div>
          ))}

          {/* ADMIN */}
          {role === "ADMIN" && (
            <div className="ris-menu-item-wrapper">
              <button
                type="button"
                className="ris-menu-item ris-admin-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdminMenu(!showAdminMenu);
                }}
              >
                <Settings size={16} />
                {!collapsed && <span>Admin Settings</span>}
              </button>
              {collapsed && <div className="ris-tooltip">Admin Settings</div>}

              {showAdminMenu && (
                <div className={`ris-admin-submenu ${collapsed ? "collapsed" : ""}`}>
                  <Link to="/admin/user-management">User Management</Link>
                  <Link to="/admin/templates">Template Management</Link>
                  <Link to="/admin/pacs-management">PACS Management</Link>
                  <Link to="/admin/mwls-management">MWLS Management</Link>
                  <Link to="/admin/audit-logs">Audit Logs</Link>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* USER */}
        <div
          className="ris-user"
          onClick={() => !collapsed && setShowUserInfo(!showUserInfo)}
        >
          {!collapsed && <div className="ris-username">{username}</div>}
          {!collapsed && showUserInfo && (
            <div className="ris-user-info">
              <div>Role: {role}</div>
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </aside>

      {/* CONTENT */}
      <main className="ris-content">{children}</main>
    </div>
  );
}

export default MainLayout;
