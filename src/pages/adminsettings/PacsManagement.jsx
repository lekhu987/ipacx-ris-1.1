import React, { useEffect, useState } from "react";
import MainLayout from "../../layout/MainLayout";
import api from "../../api/axios";
import "./PacsManagement.css";

function PacsManagement() {
  const [pacsList, setPacsList] = useState([]);
  const [selectedPacsId, setSelectedPacsId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    pacs_name: "",
    ae_title: "",
    ip_address: "",
    port: "",
  });

  /* ================= FETCH ================= */
  const fetchPacsList = async () => {
    try {
      const res = await api.get("/api/pacs");
      // Sort by created order to show first added at top
      const sortedList = res.data.sort((a, b) => a.id - b.id);
      setPacsList(sortedList);
    } catch {
      setError("Failed to fetch PACS servers");
    }
  };

  useEffect(() => {
    fetchPacsList();
  }, []);

  /* ================= FORM ================= */
  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const selectedPacs = pacsList.find((p) => p.id === selectedPacsId);

  /* ================= SAVE (ADD / UPDATE) ================= */
  const handleSave = async () => {
    if (!form.pacs_name || !form.ae_title || !form.ip_address || !form.port) {
      return alert("All fields are required");
    }

    try {
      setLoading(true);
      setError("");

      await api.post("/api/pacs", {
        ...form,
        id: selectedPacsId || undefined,
      });

      alert("PACS saved successfully");
      setShowForm(false);
      setSelectedPacsId(null);
      setForm({ pacs_name: "", ae_title: "", ip_address: "", port: "" });
      fetchPacsList();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save PACS");
    } finally {
      setLoading(false);
    }
  };

  /* ================= EDIT ================= */
  const handleEdit = () => {
    if (!selectedPacsId) return alert("Select one PACS to edit");

    setForm({
      pacs_name: selectedPacs.pacs_name,
      ae_title: selectedPacs.ae_title,
      ip_address: selectedPacs.ip_address,
      port: selectedPacs.port,
    });
    setShowForm(true);
  };

  /* ================= DELETE ================= */
  const handleDelete = async () => {
    if (!selectedPacsId) return alert("Select a PACS");
    if (!window.confirm("Are you sure?")) return;

    try {
      await api.delete(`/api/pacs/${selectedPacsId}`);
      setSelectedPacsId(null);
      fetchPacsList();
    } catch {
      setError("Failed to delete PACS");
    }
  };

  /* ================= ENABLE ================= */
  const handleEnable = async () => {
    if (!selectedPacsId) return alert("Select a PACS");

    await api.post(`/api/pacs/${selectedPacsId}/activate`);
    fetchPacsList();
  };

  /* ================= DISABLE ================= */
  const handleDisable = async () => {
    if (!selectedPacsId) return alert("Select a PACS");

    await api.post(`/api/pacs/${selectedPacsId}/deactivate`);
    fetchPacsList();
  };

  /* ================= TEST ================= */
  const handleTest = async () => {
    if (!selectedPacsId) return alert("Select a PACS");

    try {
      await api.post("/api/pacs/connect", {
        ip_address: selectedPacs.ip_address,
        port: selectedPacs.port,
        protocol: "http",
      });
      alert("PACS connection successful");
    } catch {
      alert("Unable to connect to PACS");
    }
  };

  /* ================= UI ================= */
  return (
    <MainLayout>
      <h2>PACS Management</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* TOOLBAR */}
      <div className="toolbar">
        <button
          onClick={() => {
            setShowForm(true);
            setSelectedPacsId(null);
          }}
        >
          Add
        </button>
        <button onClick={handleEdit}>Edit</button>
        <button onClick={handleDelete}>Delete</button>
        <button onClick={handleEnable}>Enable</button>
        <button onClick={handleDisable}>Disable</button>
        <button onClick={handleTest}>Test</button>
      </div>

      {/* FORM */}
      {showForm && (
        <div className="pacs-form">
          <h3>{selectedPacsId ? "Edit PACS" : "Add PACS"}</h3>
          <input
            name="pacs_name"
            placeholder="PACS Name"
            value={form.pacs_name}
            onChange={handleFormChange}
          />
          <input
            name="ae_title"
            placeholder="AE Title"
            value={form.ae_title}
            onChange={handleFormChange}
          />
          <input
            name="ip_address"
            placeholder="IP Address"
            value={form.ip_address}
            onChange={handleFormChange}
          />
          <input
            name="port"
            type="number"
            placeholder="Port"
            value={form.port}
            onChange={handleFormChange}
          />

          <button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}

      {/* TABLE */}
      <table border="1" width="100%">
        <thead>
          <tr>
            <th>Select</th>
            <th>ID</th> {/* Serial Number */}
            <th>PACS Name</th>
            <th>AE Title</th>
            <th>IP</th>
            <th>Port</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {pacsList.map((p, index) => (
            <tr key={p.id}>
              <td>
                <input
                  type="radio"
                  checked={selectedPacsId === p.id}
                  onChange={() => setSelectedPacsId(p.id)}
                />
              </td>
              <td>{index + 1}</td> {/* Serial Number */}
              <td>{p.pacs_name}</td>
              <td>{p.ae_title}</td>
              <td>{p.ip_address}</td>
              <td>{p.port}</td>
              <td>{p.is_active ? "Active" : "Inactive"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </MainLayout>
  );
}

export default PacsManagement;
