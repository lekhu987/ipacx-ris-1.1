// src/pages/adminsettings/UserManagement.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ProtectedRoute from "../../components/ProtectedRoute";
import MainLayout from "../../layout/MainLayout";
import api from "../../api/axios";
import "./UserManagement.css";

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
const navigate = useNavigate();


  // Form state for Add/Edit
  const [form, setForm] = useState({
  id: null,
  title: "",
  full_name: "",
  username: "",
  email: "",
  password: "",
  role: "",
  qualification: "",
  designation: "",
  signature: null,
  signature_url: "",
});

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const TITLES = ["Dr", "Mr", "Miss", "Mrs"];

  // Roles list
 const ROLES = [
  "ADMIN",
  "RADIOLOGIST",
  "TECHNICIAN",
  "RECEPTIONIST",
  "NURSE",
  "SUPERVISOR",
];

const QUALIFICATIONS = [
  "MBBS",
  "MBBS, DMRD",
  "MBBS, MD (Radiology)",
  "MBBS, DNB (Radiology)",
];

const DESIGNATIONS = [
  "PG Resident",
  "Senior Resident",
  "Consultant Radiologist",
  "Senior Consultant",
];


  // Fetch users
 const fetchUsers = async () => {
  try {
    setLoading(true);
    setError("");

    const res = await api.get("/api/users");

    if (!Array.isArray(res.data)) {
      throw new Error("Unexpected response from server");
    }

    setUsers(res.data);
  } catch (err) {
    console.error("Fetch users error:", err);
    setError(err.response?.data?.error || "Failed to fetch users");
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    fetchUsers();
  }, []);

  // Toggle active/inactive
  const toggleUser = async (id) => {
    try {
      const res = await api.put(`/api/users/${id}/toggle`);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_active: res.data.is_active } : u))
      );
    } catch (err) {
      console.error("Toggle failed:", err);
      alert("Failed to toggle user status");
    }
  };

  // Delete user
  const deleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/api/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete user");
    }
  };

  // Open form for edit
 const editUser = (u) => {
  setForm({
    id: u.id,
    title: u.title || "",
    full_name: u.full_name || "",
    username: u.username,
    email: u.email || "",
    password: "",
    role: u.role,
    qualification: u.qualification || "",
    designation: u.designation || "",
    signature: null,
    signature_url: u.signature_url || "",
  });
  setShowForm(true);
};


// Add or update user
const saveUser = async (e) => {
  e.preventDefault();

  // Basic validation
  if (!form.username || (!form.password && !form.id) || !form.role || !form.email) {
    alert("Username, email, password (for new users), and role are required");
    return;
  }

  // Optional: validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(form.email)) {
    alert("Invalid email format");
    return;
  }

  try {
    setSaving(true);
    let res;

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("username", form.username);
    fd.append("email", form.email);
    fd.append("role", form.role);
fd.append("full_name", form.full_name);
fd.append("qualification", form.qualification);
fd.append("designation", form.designation);

    // Only append password if provided
    if (form.password) fd.append("password", form.password);

    // Handle signature upload:
    // - If user selected a new file, append it
    // - If editing and no new file, we skip it (backend keeps old signature)
    if (form.signature) {
      fd.append("signature", form.signature);
    }

    if (form.id) {
      // UPDATE
      res = await api.put(`/api/users/${form.id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === form.id ? { ...u, ...res.data } : u))
      );
    } else {
      // CREATE
      res = await api.post("/api/users", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUsers((prev) => [...prev, res.data]);
    }

    // Reset form
    setForm({
     id: null,
  title: "",
  full_name: "",
  username: "",
  email: "",
  password: "",
  role: "",
  qualification: "",
  designation: "",
  signature: null,
  signature_url: "",
});

    setShowForm(false);
  } catch (err) {
    console.error("Save user failed:", err);
    alert(err.response?.data?.error || "Failed to save user");
  } finally {
    setSaving(false);
  }
};

  return (
    <MainLayout>
      <div style={{ padding: "0px" }}>
        <h2>User Management</h2>
<button
  onClick={() => {
    setFormKey((k) => k + 1);   // 🔥 force remount
    setForm({
  id: null,
  title: "",
  username: "",
  email: "",
  password: "",
  role: "",
  full_name: "",
  qualification: "",
  designation: "",
  signature: null,
  signature_url: "",
});

    setShowForm(true);
  }}
>
  + Add User
</button>
<button
  style={{ float: "right", marginBottom: "10px" }}
  onClick={() => navigate("/admin/reportedby")}
>
  + Add Reported By
</button>

{showForm && (
  <form
    key={formKey}  
    onSubmit={saveUser}
    style={{
      border: "1px solid #ccc",
      padding: "10px",
      marginBottom: "15px",
      borderRadius: "6px",
    }}
  >
<select
  value={form.title}
  onChange={(e) => setForm({ ...form, title: e.target.value })}
  style={{ marginRight: "10px", padding: "4px", height: "28px" }}
>
  <option value="">Title</option>
  {TITLES.map((t) => (
    <option key={t} value={t}>{t}</option>
  ))}
</select>
<input
  type="text"
  placeholder="Full Name"
  value={form.full_name}
  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
  style={{ marginRight: "10px", padding: "4px" }}
/>

            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              style={{ marginRight: "10px", padding: "4px" }}
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={{ marginRight: "10px", padding: "4px" }}
            />
            {["RADIOLOGIST", "SUPERVISOR"].includes(form.role) && (
  <select
    value={form.qualification}
    onChange={(e) => setForm({ ...form, qualification: e.target.value })}
    style={{ marginRight: "10px", padding: "4px", height: "28px" }}
  >
    <option value="">Qualification</option>
    {QUALIFICATIONS.map((q) => (
      <option key={q} value={q}>{q}</option>
    ))}
  </select>
)}
{["RADIOLOGIST", "SUPERVISOR"].includes(form.role) && (
  <select
    value={form.designation}
    onChange={(e) => setForm({ ...form, designation: e.target.value })}
    style={{ marginRight: "10px", padding: "4px", height: "28px" }}
  >
    <option value="">Designation</option>
    {DESIGNATIONS.map((d) => (
      <option key={d} value={d}>{d}</option>
    ))}
  </select>
)}

            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              style={{ marginRight: "10px", padding: "4px" }}
            />
            <input
            key={formKey + "-signature"}
  type="file"
  accept="image/*"
  onChange={(e) =>
    setForm({ ...form, signature: e.target.files[0] })
  }
  style={{ marginRight: "10px" }}
/>

{/* show existing signature while editing */}
{form.signature_url && (
  <span style={{ fontSize: "12px", color: "green" }}>
    Signature uploaded
  </span>
)}

            <select
  value={form.role}
  onChange={(e) => setForm({ ...form, role: e.target.value })}
  required
  style={{
    marginRight: "10px",
    padding: "4px",
    height: "28px",        // match input height
  }}
>
  <option value="" disabled>
    -- Select Role --
  </option>

  {ROLES.map((r) => (
    <option key={r} value={r}>
      {r}
    </option>
  ))}
</select>

            <button type="submit" style={{ marginRight: "5px", padding: "4px 8px" }} disabled={saving}>
              {saving ? "Saving..." : form.id ? "Update" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
               setForm({
  id: null,
  title: "",
  username: "",
  email: "",
  password: "",
  role: "",
  signature: null,
  signature_url: "",
});

              }}
              style={{ padding: "4px 8px" }}
            >
              Cancel
            </button>
          </form>
        )}

        {loading && <div>Loading users...</div>}
        {error && <div style={{ color: "red" }}>{error}</div>}
        {!loading && users.length === 0 && <div>No users found.</div>}

        {!loading && users.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Full Name</th>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                <th style={thStyle}>Qualification</th>
<th style={thStyle}>Designation</th>
           
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
             {users.map((u, index) => (
                <tr key={u.id}>
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={tdStyle}>{u.title || "-"}</td>
                  <td style={tdStyle}>{u.full_name || "-"}</td>
                  <td style={tdStyle}>{u.username}</td>
                  <td style={tdStyle}>{u.email || "-"}</td>
                  <td style={tdStyle}>{u.qualification || "-"}</td>
<td style={tdStyle}>{u.designation || "-"}</td>
                  <td style={tdStyle}>{u.role}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        color: "#fff",
                        backgroundColor: u.is_active ? "green" : "gray",
                      }}
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => toggleUser(u.id)}
                      style={{
                        padding: "4px 4px",
                        marginRight: "4px",
                        backgroundColor: u.is_active ? "#e74c3c" : "#27ae60",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        borderRadius: "4px",
                      }}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => editUser(u)}
                      style={{
                        padding: "4px 8px",
                        marginRight: "4px",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: "#e74c3c",
                        color: "#fff",
                      }}
                    >
                      Delete
                    </button>
                    {u.signature_url && (
  <img
    src={u.signature_url}
    alt="signature"
    title="View signature"
    style={{
      height: "22px",
      marginRight: "6px",
      cursor: "pointer",
      verticalAlign: "middle",
    }}
    onClick={() => window.open(u.signature_url, "_blank")}
  />
)}

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </MainLayout>
  );
}

const thStyle = { padding: "10px", border: "1px solid #ccc", textAlign: "left" };
const tdStyle = { padding: "8px", border: "1px solid #ccc" };

export default function AdminUserManagementPage() {
  return (
    <ProtectedRoute roles={["ADMIN"]}>
      <UserManagement />
    </ProtectedRoute>
  );
}
