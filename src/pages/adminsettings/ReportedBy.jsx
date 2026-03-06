import React, { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";
import MainLayout from "../../layout/MainLayout";
import api, { apiUrl } from "../../api/axios";
import "./UserManagement.css";

const EMPTY_FORM = {
  id: null,
  title: "",
  full_name: "",
  email: "",
  qualification: "",
  signature: null,
  signature_url: "",
};

const TITLES = ["Dr", "Mr", "Miss", "Mrs"];
const QUALIFICATIONS = ["MBBS", "MBBS, DMRD", "MBBS, MD (Radiology)", "MBBS, DNB (Radiology)"];

function ReportedBy() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/reported-by");
      if (!Array.isArray(res.data)) throw new Error("Unexpected response from server");
      setUsers(res.data);
    } catch (err) {
      console.error("Fetch reported by users error:", err);
      setError(err.response?.data?.error || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const editUser = (u) => {
    setForm({
      id: u.id,
      title: u.title || "",
      full_name: u.full_name || "",
      email: u.email || "",
      qualification: u.qualification || "",
      signature: null,
      signature_url: u.signature_url || "",
    });
    setShowForm(true);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email) {
      alert("Full Name and Email are required");
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
      fd.append("email", form.email);
      fd.append("qualification", form.qualification);
      if (form.signature) fd.append("signature", form.signature);
      fd.append("is_reporter", "true");

      let res;
      if (form.id) {
        res = await api.put(`/api/reported-by/${form.id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUsers((prev) => prev.map((u) => (u.id === form.id ? { ...u, ...res.data } : u)));
      } else {
        res = await api.post("/api/reported-by", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUsers((prev) => [...prev, res.data]);
      }

      closeForm();
    } catch (err) {
      console.error("Save reported by user failed:", err);
      alert(err.response?.data?.error || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/api/reported-by/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete user");
    }
  };

  return (
    <MainLayout>
      <div className="um-page">
        <div className="um-header">
          <h2>Reported By Users</h2>
          <div className="um-header-actions">
            <button className="um-btn um-btn-primary" onClick={openAddForm}>
              + Add Reported By
            </button>
          </div>
        </div>

        <section className="um-table-shell">
          {loading && <div className="um-state">Loading users...</div>}
          {error && <div className="um-state um-error">{error}</div>}
          {!loading && !error && users.length === 0 && <div className="um-state">No reported by users found.</div>}

          {!loading && users.length > 0 && (
            <div className="um-table-wrap">
              <table className="um-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Qualification</th>
                    <th>Signature</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, index) => (
                    <tr key={u.id}>
                      <td>{index + 1}</td>
                      <td>{u.title || "-"}</td>
                      <td>{u.full_name || "-"}</td>
                      <td>{u.email || "-"}</td>
                      <td>{u.qualification || "-"}</td>
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
                        <div className="um-actions">
                          <button className="um-btn um-btn-small" onClick={() => editUser(u)}>
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
                  <h3>{form.id ? "Edit Reported By" : "Add Reported By"}</h3>
                  <p>{form.id ? "Update reported by details and signature" : "Create a reported by profile"}</p>
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
                    {saving ? "Saving..." : form.id ? "Update" : "Create"}
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

export default function AdminReportedByPage() {
  return (
    <ProtectedRoute roles={["ADMIN"]}>
      <ReportedBy />
    </ProtectedRoute>
  );
}
