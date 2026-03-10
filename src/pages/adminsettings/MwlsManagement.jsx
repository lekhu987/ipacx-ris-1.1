import React, { useEffect, useMemo, useState } from "react";
import MainLayout from "../../layout/MainLayout";
import api from "../../api/axios";
import "./PacsManagement.css";

function MwlsManagement() {
  const [modalities, setModalities] = useState([]);
  const [pacsList, setPacsList] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    modality_code: "",
    manual_host: "",
    manual_port: "",
    manual_ae_title: "",
    is_active: true,
  });

  const pacsById = useMemo(() => {
    const map = new Map();
    pacsList.forEach((p) => map.set(Number(p.id), p));
    return map;
  }, [pacsList]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [optionsRes, mappingsRes] = await Promise.all([
        api.get("/api/mwl-targets/options"),
        api.get("/api/mwl-targets"),
      ]);

      setModalities(optionsRes.data?.modalities || []);
      setPacsList(optionsRes.data?.pacs || []);
      setMappings(mappingsRes.data?.data || []);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to load MWLS management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async () => {
    if (!form.modality_code) return alert("Select modality");
    if (!form.manual_host || !form.manual_port) return alert("Enter IP/Hostname and Port");

    try {
      await api.post("/api/mwl-targets", {
        modality_code: form.modality_code,
        manual_host: form.manual_host,
        manual_port: Number(form.manual_port),
        manual_ae_title: form.manual_ae_title || null,
        manual_type: "DCM4CHEE",
        is_active: form.is_active,
      });
      setForm((prev) => ({ ...prev, manual_ae_title: "" }));
      await loadData();
      alert("MWL target mapping saved");
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to save mapping");
    }
  };

  const handleEdit = (row) => {
    setForm({
      modality_code: row.modality_code || "",
      manual_host: row.manual_host || row.ip_address || "",
      manual_port: row.manual_port || row.port || "",
      manual_ae_title: row.manual_ae_title || row.orthanc_modality_name || row.ae_title || "",
      manual_type: "DCM4CHEE",
      is_active: row.is_active !== false,
    });
  };

  const handleDelete = async (modalityCode) => {
    if (!window.confirm(`Delete mapping for ${modalityCode}?`)) return;
    try {
      await api.delete(`/api/mwl-targets/${encodeURIComponent(modalityCode)}`);
      await loadData();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to delete mapping");
    }
  };

  return (
    <MainLayout>
      <h2>MWLS Management</h2>

      <div className="pacs-form mwl-form">
        <h3>Modality to MWL Server Mapping</h3>

        <div className="mwl-form-row">
          <select
            name="modality_code"
            value={form.modality_code}
            onChange={handleChange}
          >
            <option value="">Select Modality</option>
            {modalities.map((m) => (
              <option key={m.id} value={m.code}>
                {m.code} - {m.name}
              </option>
            ))}
          </select>

          <input
            name="manual_host"
            placeholder="IP / Hostname"
            value={form.manual_host}
            onChange={handleChange}
          />

          <input
            name="manual_ae_title"
            placeholder="AE Title (Optional)"
            value={form.manual_ae_title}
            onChange={handleChange}
          />

          <input
            name="manual_port"
            placeholder="Port"
            value={form.manual_port}
            onChange={handleChange}
          />

          <label className="mwl-inline-check">
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
            />
            Active mapping
          </label>
        </div>

        <div className="pacs-form-actions">
          <button className="pacs-save-btn" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Mapping"}
          </button>
        </div>
      </div>

      <div className="pacs-table-wrap">
        <table className="pacs-table">
          <thead>
            <tr>
              <th>Modality</th>
              <th>PACS Name</th>
              <th>IP / Hostname</th>
              <th>Port</th>
              <th>Server</th>
              <th>AE Title</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {mappings.length === 0 ? (
              <tr>
                <td colSpan="8">No mappings configured</td>
              </tr>
            ) : (
              mappings.map((row) => {
                const p = pacsById.get(Number(row.pacs_id));
                return (
                  <tr key={row.id}>
                    <td>{row.modality_code}</td>
                    <td className="mwl-pacs-name" title={row.pacs_name || p?.pacs_name || "Manual"}>
                      {row.pacs_name || p?.pacs_name || "Manual"}
                    </td>
                    <td>{row.manual_host || row.ip_address || p?.ip_address || p?.host || "-"}</td>
                    <td>{row.manual_port || row.port || p?.port || "-"}</td>
                    <td>
                      {(row.manual_host || row.ip_address || p?.ip_address) &&
                      (row.manual_port || row.port || p?.port)
                        ? `${row.manual_host || row.ip_address || p?.ip_address || p?.host}:${row.manual_port || row.port || p?.port}`
                        : "-"}
                    </td>
                    <td>{row.manual_ae_title || row.orthanc_modality_name || row.ae_title || p?.ae_title || "-"}</td>
                    <td>{row.is_active ? "Active" : "Inactive"}</td>
                    <td>
                      <button onClick={() => handleEdit(row)}>Edit</button>
                      <button onClick={() => handleDelete(row.modality_code)}>Delete</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </MainLayout>
  );
}

export default MwlsManagement;
