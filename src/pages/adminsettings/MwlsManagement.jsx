import React, { useEffect, useState } from "react";
import MainLayout from "../../layout/MainLayout";
import api from "../../api/axios";
import "./MwlsManagement.css";

function MwlsManagement() {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const buildEmptyForm = () => ({
    manual_host: "",
    manual_port: "",
    manual_type: "ORTHANC",
    manual_protocol: "DICOMWEB",
    manual_called_ae: "",
  });

  const [form, setForm] = useState(buildEmptyForm);
  const [editingId, setEditingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const mappingsRes = await api.get("/api/mwl-targets");
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
    if (!form.manual_host || !form.manual_port) return alert("Enter IP/Hostname and Port");
    if (!form.manual_type) return alert("Select server type");

    try {
      await api.post("/api/mwl-targets", {
        id: editingId,
        modality_code: "ALL",
        manual_host: form.manual_host,
        manual_port: Number(form.manual_port),
        manual_type: form.manual_type,
        manual_protocol: form.manual_type === "DIMSE" ? "DIMSE" : "DICOMWEB",
        manual_calling_ae: null,
        manual_called_ae: form.manual_called_ae || null,
        viewer_protocol: null,
        is_active: true,
      });
      setForm(buildEmptyForm());
      setEditingId(null);
      await loadData();
      alert("MWL target mapping saved");
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to save mapping");
    }
  };

  const handleEdit = (row) => {
    setForm({
      manual_host: row.manual_host || row.ip_address || "",
      manual_port: row.manual_port || row.port || "",
      manual_type: row.manual_type || "ORTHANC",
      manual_protocol: row.manual_protocol || "DICOMWEB",
      manual_called_ae: row.manual_called_ae || "",
    });
    setEditingId(row.id || null);
  };

  const handleCancelEdit = () => {
    setForm(buildEmptyForm());
    setEditingId(null);
  };

  const handleToggleActive = async (row) => {
    try {
      await api.post("/api/mwl-targets", {
        id: row.id,
        modality_code: row.modality_code || "ALL",
        pacs_id: row.pacs_id || null,
        orthanc_modality_name: row.orthanc_modality_name || null,
        manual_host: row.manual_host || row.ip_address || null,
        manual_port: row.manual_port || row.port || null,
        manual_ae_title: row.manual_ae_title || row.orthanc_modality_name || row.ae_title || null,
        manual_type: row.manual_type || null,
        manual_protocol: row.manual_protocol || null,
        manual_calling_ae: row.manual_calling_ae || null,
        manual_called_ae: row.manual_called_ae || null,
        viewer_protocol: row.viewer_protocol || null,
        viewer_base_url: row.viewer_base_url || null,
        is_active: !(row.is_active !== false),
      });
      await loadData();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to update status");
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete mapping for ${row.modality_code || "MWL"}?`)) return;
    try {
      await api.delete(`/api/mwl-targets/${encodeURIComponent(String(row.id || ""))}`);
      await loadData();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to delete mapping");
    }
  };

  const runDimseTest = async (row, type) => {
    try {
      if (row.is_active === false) {
        const msg = "This MWL mapping is inactive. Activate it to run tests.";
        setTestStatus(msg);
        alert(msg);
        return;
      }
      const host = row.manual_host || row.ip_address || "127.0.0.1";
      const port = row.manual_port || row.port || undefined;
      const calledAe =
        row.manual_called_ae ||
        row.manual_ae_title ||
        row.ae_title ||
        "IPACX_MWL";
      setTestStatus(`Running ${type.toUpperCase()} for ${row.modality_code || "MWL"}...`);
      const res = await api.post("/api/mwl-dimse/test", {
        type,
        host,
        port,
        called_ae: calledAe,
      });
      const ok = res.data?.success;
      const msg = ok ? `${type.toUpperCase()} OK` : `${type.toUpperCase()} FAILED`;
      setTestStatus(msg);
      alert(msg);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Test failed";
      setTestStatus(msg);
      alert(msg);
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
              <label>Server Type</label>
              <div className="mwl-toggle-group">
                <button
                  type="button"
                  className={`mwl-toggle-btn ${form.manual_type === "ORTHANC" ? "active" : ""}`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      manual_type: "ORTHANC",
                      manual_protocol: "DICOMWEB",
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
                      manual_protocol: "DICOMWEB",
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
              <label>MWL Server AE Title</label>
              <input
                name="manual_called_ae"
                placeholder="e.g. IPACX_MWL"
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
          </div>

          <div className="mwl-form-actions">
            <button className="mwl-save-btn" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : editingId ? "Update Server" : "Save Server"}
            </button>
            {editingId && (
              <button className="mwl-link-btn" onClick={handleCancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="mwl-list">
          {testStatus && <div className="mwl-test-status">{testStatus}</div>}
          {mappings.length === 0 ? (
            <div className="mwl-empty">No mappings configured</div>
          ) : (
            mappings.map((row) => {
              const host = row.manual_host || row.ip_address || row.host || "-";
              const port = row.manual_port || row.port || "-";
              const rawModality = String(row.modality_code || "").trim().toUpperCase();
              const aeTitle = String(
                row.manual_called_ae ||
                  row.manual_ae_title ||
                  row.ae_title ||
                  row.orthanc_modality_name ||
                  ""
              )
                .trim()
                .toUpperCase();
              const aePrefix = aeTitle.split(/[^A-Z0-9]/)[0];
              const aeToModality = {
                CT: "CT",
                MR: "MR",
                MRI: "MR",
                US: "US",
                CR: "CR",
                DX: "DX",
                XRAY: "DX",
                "X-RAY": "DX",
                MG: "MG",
                NM: "NM",
              };
              const modalityCode =
                rawModality && rawModality !== "ALL"
                  ? rawModality
                  : aeToModality[aePrefix] || "";
              const title =
                modalityCode && modalityCode !== "ALL"
                  ? `${modalityCode} Server`
                  : row.pacs_name || "MWL Server";
              const type = row.manual_type || "MANUAL";
              const protocol = row.manual_protocol || "DICOMWEB";
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
                </div>
                    <div className="mwl-list-sub">
                      {host !== "-" && port !== "-"
                        ? `URL: http://${host}:${port}`
                        : "URL: -"}
                    </div>
                  </div>
                  <div className="mwl-list-right">
                    <button
                      type="button"
                      className={`mwl-status ${row.is_active ? "on" : "off"}`}
                      onClick={() => handleToggleActive(row)}
                      title="Toggle Active/Inactive"
                    >
                      {row.is_active ? "Active" : "Inactive"}
                    </button>
                    <div className="mwl-card-actions">
                      <button
                        onClick={() => runDimseTest(row, "find")}
                        className="mwl-link-btn"
                        title="Run findscu (MWL)"
                      >
                        Test MWL
                      </button>
                      <button onClick={() => handleEdit(row)} className="mwl-link-btn">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(row)} className="mwl-link-btn danger">
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
