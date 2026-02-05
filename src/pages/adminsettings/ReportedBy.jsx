// src/pages/adminsettings/ReportedBy.jsx
import React, { useEffect, useState } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";
import MainLayout from "../../layout/MainLayout";
import api from "../../api/axios";

function ReportedBy() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const [form, setForm] = useState({
    id: null,
    title: "",
    full_name: "",
    email: "",
    qualification: "",
    signature: null,
    signature_url: "",
  });

  const TITLES = ["Dr", "Mr", "Miss", "Mrs"];
  const QUALIFICATIONS = [
    "MBBS",
    "MBBS, DMRD",
    "MBBS, MD (Radiology)",
    "MBBS, DNB (Radiology)",
  ];

  // Fetch reported by users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      // ✅ Correct backend route
      const res = await api.get("/api/reported-by")
      if (!Array.isArray(res.data)) throw new Error("Unexpected response from server");
      setUsers(res.data);
    } catch (err) {
      console.error("Fetch reported by users error:", err);
      setError(err.response?.data?.error || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Save user (Add/Edit)
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
      fd.append("is_reporter", "true"); // important flag

      let res;
      if (form.id) {
        // ✅ Update via reportedBy route
        res = await api.put(`/api/reported-by/${form.id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === form.id ? { ...u, ...res.data } : u))
        );
      } else {
        // ✅ Create via reportedBy route
        res = await api.post("/api/reported-by", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUsers((prev) => [...prev, res.data]);
      }

      setForm({
        id: null,
        title: "",
        full_name: "",
        email: "",
        qualification: "",
        signature: null,
        signature_url: "",
      });
      setShowForm(false);
    } catch (err) {
      console.error("Save reported by user failed:", err);
      alert(err.response?.data?.error || "Failed to save user");
    } finally {
      setSaving(false);
    }
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
      <div style={{ padding: "0px" }}>
        <h2>Reported By Users</h2>
        <button
          style={{ float: "right", marginBottom: "10px" }}
          onClick={() => {
            setFormKey((k) => k + 1);
            setForm({
              id: null,
              title: "",
              full_name: "",
              email: "",
              qualification: "",
              signature: null,
              signature_url: "",
            });
            setShowForm(true);
          }}
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
                <option key={t} value={t}>
                  {t}
                </option>
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
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={{ marginRight: "10px", padding: "4px" }}
            />

            <select
              value={form.qualification}
              onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              style={{ marginRight: "10px", padding: "4px", height: "28px" }}
            >
              <option value="">Qualification</option>
              {QUALIFICATIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>

            <input
              key={formKey + "-signature"}
              type="file"
              accept="image/*"
              onChange={(e) => setForm({ ...form, signature: e.target.files[0] })}
              style={{ marginRight: "10px" }}
            />

            {form.signature_url && (
              <span style={{ fontSize: "12px", color: "green" }}>Signature uploaded</span>
            )}

            <button type="submit" disabled={saving} style={{ marginRight: "5px", padding: "4px 8px" }}>
              {saving ? "Saving..." : form.id ? "Update" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm({
                  id: null,
                  title: "",
                  full_name: "",
                  email: "",
                  qualification: "",
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
        {!loading && users.length === 0 && <div>No reported by users found.</div>}

        {!loading && users.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Full Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Qualification</th>
                <th style={thStyle}>Signature</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, index) => (
                <tr key={u.id}>
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={tdStyle}>{u.title || "-"}</td>
                  <td style={tdStyle}>{u.full_name || "-"}</td>
                  <td style={tdStyle}>{u.email || "-"}</td>
                  <td style={tdStyle}>{u.qualification || "-"}</td>
                  <td style={tdStyle}>
                    {u.signature_url && (
                      <img
                        src={u.signature_url}
                        alt="signature"
                        title="View signature"
                        style={{ height: "22px", cursor: "pointer" }}
                        onClick={() => window.open(u.signature_url, "_blank")}
                      />
                    )}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => editUser(u)}
                      style={{ padding: "4px 8px", marginRight: "4px" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
                      style={{ padding: "4px 8px", backgroundColor: "#e74c3c", color: "#fff" }}
                    >
                      Delete
                    </button>
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

export default function AdminReportedByPage() {
  return (
    <ProtectedRoute roles={["ADMIN"]}>
      <ReportedBy />
    </ProtectedRoute>
  );
}
