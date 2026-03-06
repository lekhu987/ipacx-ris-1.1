import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProtectedRoute from "../../components/ProtectedRoute";
import MainLayout from "../../layout/MainLayout";
import api, { apiUrl } from "../../api/axios";
import "./UserManagement.css";

const EMPTY_FORM = {
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
};

const TITLES = ["Dr", "Mr", "Miss", "Mrs"];
const ROLES = ["ADMIN", "RADIOLOGIST", "TECHNICIAN", "RECEPTIONIST", "NURSE", "SUPERVISOR"];
const QUALIFICATIONS = ["MBBS", "MBBS, DMRD", "MBBS, MD (Radiology)", "MBBS, DNB (Radiology)"];
const DESIGNATIONS = ["PG Resident", "Senior Resident", "Consultant Radiologist", "Senior Consultant"];

function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    fetchUsers();
  }, []);

  const signaturePreview = useMemo(() => {
    if (form.signature) return URL.createObjectURL(form.signature);
    if (form.signature_url) return apiUrl(form.signature_url);
    return "";
  }, [form.signature, form.signature_url]);

  useEffect(() => {
    return () => {
      if (form.signature && signaturePreview.startsWith("blob:")) {
        URL.revokeObjectURL(signaturePreview);
      }
    };
  }, [form.signature, signaturePreview]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/users");
      if (!Array.isArray(res.data)) throw new Error("Unexpected response from server");
      setUsers(res.data);
    } catch (err) {
      console.error("Fetch users error:", err);
      setError(err.response?.data?.error || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (user) => {
    setForm({
      id: user.id,
      title: user.title || "",
      full_name: user.full_name || "",
      username: user.username || "",
      email: user.email || "",
      password: "",
      role: user.role || "",
      qualification: user.qualification || "",
      designation: user.designation || "",
      signature: null,
      signature_url: user.signature_url || "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const toggleUser = async (id) => {
    try {
      const res = await api.put(`/api/users/${id}/toggle`);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, is_active: res.data.is_active } : u)));
    } catch (err) {
      console.error("Toggle failed:", err);
      alert("Failed to toggle user status");
    }
  };

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

  const saveUser = async (e) => {
    e.preventDefault();

    if (!form.username || (!form.password && !form.id) || !form.role || !form.email) {
      alert("Username, email, password (for new users), and role are required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      alert("Invalid email format");
      return;
    }

    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("full_name", form.full_name);
      fd.append("username", form.username);
      fd.append("email", form.email);
      fd.append("role", form.role);
      fd.append("qualification", form.qualification);
      fd.append("designation", form.designation);
      if (form.password) fd.append("password", form.password);
      if (form.signature) fd.append("signature", form.signature);

      let res;
      if (form.id) {
        res = await api.put(`/api/users/${form.id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUsers((prev) => prev.map((u) => (u.id === form.id ? { ...u, ...res.data } : u)));
      } else {
        res = await api.post("/api/users", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUsers((prev) => [...prev, res.data]);
      }

      closeForm();
    } catch (err) {
      console.error("Save user failed:", err);
      alert(err.response?.data?.error || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="um-page">
        <div className="um-header">
          <h2>User Management</h2>
          <div className="um-header-actions">
            <button className="um-btn um-btn-primary" onClick={openAddForm}>
              + Add User
            </button>
            <button className="um-btn" onClick={() => navigate("/admin/reportedby")}>
              + Add Reported By
            </button>
          </div>
        </div>

        <section className="um-table-shell">
          {loading && <div className="um-state">Loading users...</div>}
          {error && <div className="um-state um-error">{error}</div>}
          {!loading && !error && users.length === 0 && <div className="um-state">No users found.</div>}

          {!loading && users.length > 0 && (
            <div className="um-table-wrap">
              <table className="um-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Qualification</th>
                    <th>Designation</th>
                    <th>Signature</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, index) => (
                    <tr key={u.id}>
                      <td>{index + 1}</td>
                      <td>{u.title || "-"}</td>
                      <td>{u.full_name || "-"}</td>
                      <td>{u.username || "-"}</td>
                      <td>{u.email || "-"}</td>
                      <td>{u.role || "-"}</td>
                      <td>{u.qualification || "-"}</td>
                      <td>{u.designation || "-"}</td>
                      <td>
                        {u.signature_url ? (
                          <img
                            className="um-signature-thumb"
                            src={apiUrl(u.signature_url)}
                            alt="signature"
                            onClick={() => window.open(apiUrl(u.signature_url), "_blank")}
                          />
                        ) : (
                          <span className="um-muted">-</span>
                        )}
                      </td>
                      <td>
                        {u.role === "ADMIN" ? (
                          <span className="um-muted">-</span>
                        ) : (
                          <button
                            className={`um-switch ${u.is_active ? "is-on" : "is-off"}`}
                            onClick={() => toggleUser(u.id)}
                            aria-label={u.is_active ? "Set inactive" : "Set active"}
                            title={u.is_active ? "Active" : "Inactive"}
                          >
                            <span className="um-switch-knob" />
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="um-actions">
                          <button className="um-btn um-btn-small" onClick={() => openEditForm(u)}>
                            Edit
                          </button>
                          <button className="um-btn um-btn-small um-btn-danger" onClick={() => deleteUser(u.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showForm && (
          <div className="um-modal-backdrop" onClick={closeForm}>
            <section className="um-form-shell um-modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="um-form-top">
                <div>
                  <h3>{form.id ? "Edit User" : "Add User"}</h3>
                  <p>{form.id ? "Update user details and signature" : "Create a new user account and role"}</p>
                </div>
                <button type="button" className="um-close-link" onClick={closeForm}>
                  Cancel
                </button>
              </div>

              <form onSubmit={saveUser} className="um-form-grid">
              <label>
                <span>Title</span>
                <select value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}>
                  <option value="">Select title</option>
                  {TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Full Name</span>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </label>

              <label>
                <span>Username</span>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>Email</span>
                <input
                  type="email"
                  placeholder="Enter email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </label>

              <label>
                <span>Role</span>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
                  <option value="" disabled>
                    Select role
                  </option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Password {form.id ? "(Optional for edit)" : ""}</span>
                <input
                  type="password"
                  placeholder={form.id ? "Leave blank to keep current password" : "Enter password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>

              <label>
                <span>Qualification</span>
                <select
                  value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                >
                  <option value="">Select qualification</option>
                  {QUALIFICATIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Designation</span>
                <select value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
                  <option value="">Select designation</option>
                  {DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>

              <div className="um-signature-block">
                <span>Signature</span>
                <div className="um-signature-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setForm({ ...form, signature: e.target.files?.[0] || null })}
                  />
                  <small>Upload PNG/JPG signature image</small>
                </div>
                <div className="um-signature-preview">
                  {signaturePreview ? (
                    <img
                      src={signaturePreview}
                      alt="signature preview"
                      onClick={() => window.open(signaturePreview, "_blank")}
                    />
                  ) : (
                    <div className="um-signature-empty">No signature</div>
                  )}
                </div>
              </div>

                <div className="um-form-actions">
                  <button type="submit" className="um-btn um-btn-primary" disabled={saving}>
                    {saving ? "Saving..." : form.id ? "Update User" : "Create User"}
                  </button>
                  <button type="button" className="um-btn" onClick={closeForm} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default function AdminUserManagementPage() {
  return (
    <ProtectedRoute roles={["ADMIN"]}>
      <UserManagement />
    </ProtectedRoute>
  );
}
