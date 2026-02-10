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
    pacs_type: "ORTHANC", // ORTHANC | DCM4CHEE
    ae_title: "",
    ip_address: "",
    port: "",
  });

  /* ================= FETCH PACS ================= */
  const fetchPacsList = async () => {
    try {
      const res = await api.get("/api/pacs");
      setPacsList(res.data || []);
    } catch (err) {
      setError("Failed to fetch PACS list");
    }
  };

  useEffect(() => {
    fetchPacsList();
  }, []);

  const selectedPacs = pacsList.find((p) => p.id === selectedPacsId);

  /* ================= FORM HANDLING ================= */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /* ================= SAVE ================= */
  const handleSave = async () => {
    if (
      !form.pacs_name ||
      !form.pacs_type ||
      !form.ae_title ||
      !form.ip_address ||
      !form.port
    ) {
      alert("All fields are required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await api.post("/api/pacs", {
        id: selectedPacsId || undefined,
        ...form,
      });

      alert("PACS saved successfully");
      setShowForm(false);
      setSelectedPacsId(null);
      setForm({
        pacs_name: "",
        pacs_type: "ORTHANC",
        ae_title: "",
        ip_address: "",
        port: "",
      });
      fetchPacsList();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save PACS");
    } finally {
      setLoading(false);
    }
  };

  /* ================= EDIT ================= */
  const handleEdit = () => {
    if (!selectedPacs) {
      alert("Select a PACS to edit");
      return;
    }

    setForm({
      pacs_name: selectedPacs.pacs_name,
      pacs_type: selectedPacs.pacs_type,
      ae_title: selectedPacs.ae_title,
      ip_address: selectedPacs.ip_address,
      port: selectedPacs.port,
    });
    setShowForm(true);
  };

  /* ================= DELETE ================= */
  const handleDelete = async () => {
    if (!selectedPacsId) {
      alert("Select a PACS to delete");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this PACS?")) return;

    try {
      await api.delete(`/api/pacs/${selectedPacsId}`);
      setSelectedPacsId(null);
      fetchPacsList();
    } catch {
      setError("Failed to delete PACS");
    }
  };

  /* ================= ENABLE / DISABLE ================= */
  const handleEnable = async () => {
    if (!selectedPacsId) return alert("Select a PACS");
    await api.post(`/api/pacs/${selectedPacsId}/activate`);
    fetchPacsList();
  };

  const handleDisable = async () => {
    if (!selectedPacsId) return alert("Select a PACS");
    await api.post(`/api/pacs/${selectedPacsId}/deactivate`);
    fetchPacsList();
  };

  /* ================= TEST CONNECTION ================= */
  const handleTest = async () => {
    if (!selectedPacs) return alert("Select a PACS");

    try {
      await api.post("/api/pacs/test", {
        pacs_type: selectedPacs.pacs_type,
        ip_address: selectedPacs.ip_address,
        port: selectedPacs.port,
        ae_title: selectedPacs.ae_title,
      });

      alert(`${selectedPacs.pacs_type} connection successful`);
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
        <button onClick={() => setShowForm(true)}>Add</button>
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
            onChange={handleChange}
          />

          <select
            name="pacs_type"
            value={form.pacs_type}
            onChange={handleChange}
          >
            <option value="ORTHANC">ORTHANC</option>
            <option value="DCM4CHEE">DCM4CHEE</option>
          </select>

          <input
            name="ae_title"
            placeholder="AE Title"
            value={form.ae_title}
            onChange={handleChange}
          />

          <input
            name="ip_address"
            placeholder="IP Address"
            value={form.ip_address}
            onChange={handleChange}
          />

          <input
            type="number"
            name="port"
            placeholder="Port"
            value={form.port}
            onChange={handleChange}
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
            <th>#</th>
            <th>PACS Name</th>
            <th>Type</th>
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
              <td>{index + 1}</td>
              <td>{p.pacs_name}</td>
              <td>{p.pacs_type}</td>
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
