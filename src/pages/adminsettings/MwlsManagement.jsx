import React, { useEffect, useState } from "react";
import MainLayout from "../../layout/MainLayout";
import api from "../../api/axios";
import "./MwlsManagement.css";

function MwlsManagement() {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalityOptions, setModalityOptions] = useState([{ code: "ALL", name: "All Modalities" }]);

  const [form, setForm] = useState({
    modality_code: "ALL",
    manual_host: "",
    manual_port: "",
    manual_ae_title: "",
    manual_type: "ORTHANC",
    manual_protocol: "DICOMWEB",
    manual_calling_ae: "",
    manual_called_ae: "",
    viewer_protocol: "OHIF (Web-based)",
    is_active: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const mappingsRes = await api.get("/api/mwl-targets");
      setMappings(mappingsRes.data?.data || []);

      try {
        const optionsRes = await api.get("/api/mwl-targets/options");
        const options = Array.isArray(optionsRes.data?.modalities) ? optionsRes.data.modalities : [];
        const normalized = options.map((m) => ({
          code: String(m.code || "").toUpperCase(),
          name: m.name || m.code || "Unknown",
        }));
        const withAll = [{ code: "ALL", name: "All Modalities" }, ...normalized];
        setModalityOptions(withAll);
      } catch (err) {
        // Fallback to default option if modal list is unavailable.
        setModalityOptions([{ code: "ALL", name: "All Modalities" }]);
      }
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
    if (!form.manual_host || !form.manual_port) return alert("Enter IP/Hostname and Port");
    if (!form.manual_type) return alert("Select server type");

    try {
      await api.post("/api/mwl-targets", {
        modality_code: form.modality_code || "ALL",
        manual_host: form.manual_host,
        manual_port: Number(form.manual_port),
        manual_ae_title: form.manual_ae_title || null,
        manual_type: form.manual_type,
        manual_protocol: form.manual_protocol || null,
        manual_calling_ae: form.manual_calling_ae || null,
        manual_called_ae: form.manual_called_ae || null,
        viewer_protocol: form.viewer_protocol || null,
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
      modality_code: row.modality_code || "ALL",
      manual_host: row.manual_host || row.ip_address || "",
      manual_port: row.manual_port || row.port || "",
      manual_ae_title: row.manual_ae_title || row.orthanc_modality_name || row.ae_title || "",
      manual_type: row.manual_type || "ORTHANC",
      manual_protocol: row.manual_protocol || "DICOMWEB",
      manual_calling_ae: row.manual_calling_ae || "",
      manual_called_ae: row.manual_called_ae || "",
      viewer_protocol: row.viewer_protocol || "OHIF (Web-based)",
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
      <div className="mwl-management">
        <div className="mwl-page-title">
          <h2>MWL Management</h2>
        </div>

        <div className="mwl-card-form">
          <div className="mwl-card-header">
            <div className="mwl-card-title">Add New MWL / DICOM Server</div>
            <div className="mwl-card-sub">
              Configure external nodes for Worklist broadcast and archival.
            </div>
          </div>

          <div className="mwl-form-grid">
            <div className="mwl-field">
              <label>Modality</label>
              <select
                name="modality_code"
                value={form.modality_code}
                onChange={handleChange}
              >
                {modalityOptions.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="mwl-field">
              <label>Server Type</label>
              <div className="mwl-toggle-group">
                <button
                  type="button"
                  className={`mwl-toggle-btn ${form.manual_type === "ORTHANC" ? "active" : ""}`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      manual_type: "ORTHANC",
                      manual_protocol: prev.manual_protocol === "DIMSE" ? "DICOMWEB" : prev.manual_protocol,
                    }))
                  }
                >
                  Orthanc
                </button>
                <button
                  type="button"
                  className={`mwl-toggle-btn ${form.manual_type === "DCM4CHEE" ? "active" : ""}`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      manual_type: "DCM4CHEE",
                      manual_protocol: prev.manual_protocol === "DIMSE" ? "DICOMWEB" : prev.manual_protocol,
                    }))
                  }
                >
                  DCM4CHEE
                </button>
                <button
                  type="button"
                  className={`mwl-toggle-btn ${form.manual_type === "DICOMWEB" ? "active" : ""}`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      manual_type: "DICOMWEB",
                      manual_protocol: "DICOMWEB",
                    }))
                  }
                >
                  DICOMWEB
                </button>
                <button
                  type="button"
                  className={`mwl-toggle-btn ${form.manual_type === "DIMSE" ? "active" : ""}`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      manual_type: "DIMSE",
                      manual_protocol: "DIMSE",
                    }))
                  }
                >
                  DIMSE
                </button>
              </div>
            </div>

            <div className="mwl-field">
              <label>Protocol</label>
              <div className="mwl-toggle-group">
                <button
                  type="button"
                  className={`mwl-toggle-btn ${form.manual_protocol === "DICOMWEB" ? "active" : ""}`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      manual_protocol: "DICOMWEB",
                      manual_type: prev.manual_type === "DIMSE" ? "DICOMWEB" : prev.manual_type,
                    }))
                  }
                >
                  DICOMWEB
                </button>
                <button
                  type="button"
                  className={`mwl-toggle-btn ${form.manual_protocol === "DIMSE" ? "active" : ""}`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      manual_protocol: "DIMSE",
                      manual_type: prev.manual_type === "DICOMWEB" ? "DIMSE" : prev.manual_type,
                    }))
                  }
                >
                  DIMSE
                </button>
              </div>
            </div>

            <div className="mwl-field">
              <label>Server Display Name</label>
              <input
                name="manual_ae_title"
                placeholder="e.g. Main Hospital MWL"
                value={form.manual_ae_title}
                onChange={handleChange}
              />
            </div>

            <div className="mwl-field">
              <label>MWL Server AE Title</label>
              <input
                name="manual_called_ae"
                placeholder="e.g. MWL_SERVER"
                value={form.manual_called_ae}
                onChange={handleChange}
              />
            </div>

            <div className="mwl-field">
              <label>Host / IP Address</label>
              <input
                name="manual_host"
                placeholder="Hostname or IP"
                value={form.manual_host}
                onChange={handleChange}
              />
            </div>

            <div className="mwl-field">
              <label>Port</label>
              <input
                name="manual_port"
                placeholder="Port"
                value={form.manual_port}
                onChange={handleChange}
              />
            </div>

            <div className="mwl-field">
              <label>Base URL</label>
              <input
                value={
                  form.manual_host && form.manual_port
                    ? `http://${form.manual_host}:${form.manual_port}`
                    : ""
                }
                placeholder="http://host:port"
                readOnly
              />
            </div>

            <div className="mwl-field">
              <label>Viewer Protocol</label>
              <select
                name="viewer_protocol"
                value={form.viewer_protocol}
                onChange={handleChange}
              >
                <option value="OHIF (Web-based)">OHIF (Web-based)</option>
              </select>
            </div>

            <div className="mwl-field mwl-field-inline">
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
          </div>

          <div className="mwl-form-actions">
            <button className="mwl-save-btn" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Server"}
            </button>
          </div>
        </div>

        <div className="mwl-list">
          {mappings.length === 0 ? (
            <div className="mwl-empty">No mappings configured</div>
          ) : (
            mappings.map((row) => {
              const host = row.manual_host || row.ip_address || row.host || "-";
              const port = row.manual_port || row.port || "-";
              const title =
                row.manual_ae_title ||
                row.pacs_name ||
                `${row.modality_code || "MWL"} Server`;
              const type = row.manual_type || "MANUAL";
              const protocol = row.manual_protocol || "DICOMWEB";
              const viewerProtocol = row.viewer_protocol || "OHIF (Web-based)";
              return (
                <div key={row.id} className="mwl-list-card">
                  <div className="mwl-list-left">
                    <div className="mwl-list-title">{title}</div>
                <div className="mwl-list-meta">
                  <span>HOST: {host}</span>
                  <span>PORT: {port}</span>
                  <span>TYPE: {type}</span>
                  <span>PROTOCOL: {protocol}</span>
                  <span>AE: {row.manual_called_ae || row.manual_ae_title || "-"}</span>
                  <span>VIEWER: {viewerProtocol}</span>
                </div>
                    <div className="mwl-list-sub">
                      {host !== "-" && port !== "-"
                        ? `URL: http://${host}:${port}`
                        : "URL: -"}
                    </div>
                  </div>
                  <div className="mwl-list-right">
                    <div className={`mwl-status ${row.is_active ? "on" : "off"}`}>
                      {row.is_active ? "Active" : "Inactive"}
                    </div>
                    <div className="mwl-card-actions">
                      <button onClick={() => handleEdit(row)} className="mwl-link-btn">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(row.modality_code)} className="mwl-link-btn danger">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </MainLayout>
  );
}

export default MwlsManagement;
