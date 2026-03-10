/* eslint-disable no-restricted-globals */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "../layout/MainLayout";
import axiosInstance from "../services/axiosInstance";
import { toast } from "react-hot-toast";
import {
  Plus,
  UploadCloud,
  Trash2,
  Edit3,
  Search,
  HardDrive,
  Activity,
  Clock,
} from "lucide-react";
import dayjs from "dayjs";
import "./MWLS.css";

const DEFAULT_MODALITIES = ["ALL", "CR", "CT", "MR", "US", "DX", "MG", "NM"];

const toLocalInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const toDisplayTime = (value) => {
  if (!value) return "";
  const d = dayjs(value);
  if (!d.isValid()) return "";
  return d.format("DD-MM-YYYY h:mm A");
};

const fromDisplayTime = (value) => {
  if (!value) return "";
  const d = dayjs(value, "DD-MM-YYYY hh:mm A");
  if (!d.isValid()) return "";
  return d.format("YYYY-MM-DDTHH:mm");
};

const modalityClass = (modality) => {
  const key = String(modality || "").toUpperCase();
  if (key === "CT") return "mwl-modality ct";
  if (key === "MR" || key === "MRI") return "mwl-modality mr";
  if (key === "US") return "mwl-modality us";
  if (key === "DX" || key === "CR") return "mwl-modality dx";
  if (key === "MG") return "mwl-modality mg";
  if (key === "NM") return "mwl-modality nm";
  return "mwl-modality";
};

export default function MWLS() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [activeModality, setActiveModality] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalities] = useState(DEFAULT_MODALITIES);
  const [reviewItem, setReviewItem] = useState(null);
  const [autoPush, setAutoPush] = useState(false);
  const [autoPushLoaded, setAutoPushLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axiosInstance.get("/mwl");
      const rows = Array.isArray(r.data?.data) ? r.data.data : [];
      setList(rows);
    } catch (err) {
      console.error("load mwl", err);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const loadSetting = async () => {
      try {
        const res = await axiosInstance.get("/mwl-settings");
        setAutoPush(Boolean(res.data?.autopush_enabled));
      } catch (err) {
        console.error("load mwl settings", err);
      } finally {
        setAutoPushLoaded(true);
      }
    };
    loadSetting();
  }, []);

  const filtered = useMemo(() => {
    let result = list;
    if (activeModality !== "ALL") {
      result = result.filter((m) => m.modality === activeModality);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (m) =>
          (m.patient_name || "").toLowerCase().includes(q) ||
          (m.patient_id || "").toLowerCase().includes(q) ||
          (m.accession_number || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [list, query, activeModality]);

  const stats = {
    total: list.length,
    new: list.filter((m) => (m.status || "NEW") === "NEW").length,
    synced: list.filter(
      (m) => m.status === "SYNCED" || m.status === "COMPLETED"
    ).length,
  };

  const openNew = () => {
    setEditing({
      pacs_id: null,
      accession_number: "",
      study_instance_uid: "",
      patient_id: "",
      patient_name: "",
      modality: "CT",
      scheduled_datetime: dayjs().format("YYYY-MM-DDTHH:mm"),
    });
    setShowModal(true);
  };

  const onPushNow = async (row) => {
    if (!autoPush) {
      setReviewItem(row);
      return;
    }
    await commitPush(row);
  };

  const commitPush = async (row) => {
    if (!row?.id) return;
    const tid = toast.loading("Broadcasting to Modality...");
    try {
      await axiosInstance.post(`/mwl/${row.id}/send`, {
        modality: row.modality,
      });
      toast.success("Study Transmitted Successfully", { id: tid });
      load();
    } catch (err) {
      console.error("push mwl", err);
      toast.error("Transmission Failed", { id: tid });
    }
  };

  const onDelete = async (row) => {
    if (!row.id) return;
    if (!confirm("Remove this entry from active Worklist?")) return;
    try {
      await axiosInstance.delete(`/mwl/${row.id}`);
      load();
    } catch (err) {
      console.error("delete mwl", err);
    }
  };

  return (
    <MainLayout>
      <div className="mwl-page">
        <div className="mwl-header-row">
          <div>
            <h1 className="page-header">Modality WorkList Page</h1>

          </div>
          <div className="mwl-header-actions">
            <div className="mwl-toggle-card">
              <div className="mwl-toggle-text">
                <div className="mwl-toggle-label">Automation</div>
                <div className="mwl-toggle-value">Auto-Push</div>
              </div>
              <button
                onClick={async () => {
                  const next = !autoPush;
                  setAutoPush(next);
                  try {
                    await axiosInstance.post("/mwl-settings", {
                      autopush_enabled: next,
                    });
                  } catch (err) {
                    console.error("save mwl settings", err);
                  }
                }}
                className={`mwl-toggle ${autoPush ? "on" : "off"}`}
              >
                <span className="mwl-toggle-knob" />
              </button>
              {!autoPushLoaded && <span style={{ fontSize: 10 }}>Loading...</span>}
            </div>

            <div className="mwl-stats">
              <div className="mwl-stat">
                <div className="mwl-stat-label">System Load</div>
                <div className="mwl-stat-value">{stats.total}</div>
              </div>
              <div className="mwl-stat">
                <div className="mwl-stat-label">Awaiting Sync</div>
                <div className="mwl-stat-value warn">{stats.new}</div>
              </div>
              <div className="mwl-stat">
                <div className="mwl-stat-label">Live Nodes</div>
                <div className="mwl-stat-value ok">{stats.synced}</div>
              </div>
            </div>

            <button className="mwl-new-btn" onClick={openNew}>
              <Plus size={18} />
              New Study
            </button>
          </div>
        </div>

        <div className="mwl-filter-row">
          <div className="mwl-chips">
            {DEFAULT_MODALITIES.map((m) => (
              <button
                key={m}
                onClick={() => setActiveModality(m)}
                className={`mwl-chip ${activeModality === m ? "active" : ""}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="mwl-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search Patient Name or Accession..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="mwl-list">
          {loading ? (
            <div className="mwl-empty">Synchronizing with Modality...</div>
          ) : filtered.length === 0 ? (
            <div className="mwl-empty">
              No Active Worklist Entries for {activeModality}
            </div>
          ) : (
            filtered.map((m) => (
              <div key={m.id} className="mwl-card">
                <div className="mwl-card-left">
                  <div className={modalityClass(m.modality)}>{m.modality}</div>
                  <div className="mwl-card-details">
                    <div className="mwl-card-name">{m.patient_name}</div>
                    <div className="mwl-card-meta">
                      <span className="mwl-card-id">ID: {m.patient_id}</span>
                      <span className="mwl-card-sep">|</span>
                      <span className="mwl-card-acc">
                        {m.accession_number}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mwl-card-info">
                  <div className="mwl-info-block">
                    <div className="mwl-info-label">Schedule Sync</div>
                    <div className="mwl-info-value">
                      <Clock size={14} />
                        {m.scheduled_datetime
                          ? dayjs(m.scheduled_datetime).format("DD MMM h:mm A")
                          : "-"}
                    </div>
                  </div>
                  <div className="mwl-info-block">
                    <div className="mwl-info-label">Sync Status</div>
                    <div className="mwl-info-value">
                      <span
                        className={`mwl-status-dot ${
                          (m.status || "NEW") === "NEW" ? "warn" : "ok"
                        }`}
                      />
                      <span
                        className={`mwl-status-text ${
                          (m.status || "NEW") === "NEW" ? "warn" : "ok"
                        }`}
                      >
                        {m.status || "NEW"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mwl-card-actions">
                  <button
                    onClick={() => onPushNow(m)}
                    className="mwl-icon-btn"
                    title="Push to Modality"
                  >
                    <UploadCloud size={16} />
                  </button>
                  <button
                    className="mwl-icon-btn"
                    title="Edit"
                    onClick={() => {
                      setEditing({
                        id: m.id,
                        pacs_id: m.pacs_id ?? null,
                        accession_number: m.accession_number || "",
                        study_instance_uid: m.study_instance_uid || "",
                        patient_id: m.patient_id || "",
                        patient_name: m.patient_name || "",
                        modality: m.modality || "CT",
                        scheduled_datetime: toLocalInput(m.scheduled_datetime),
                      });
                      setShowModal(true);
                    }}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(m)}
                    className="mwl-icon-btn danger"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>



        {showModal && editing && (
          <div className="mwl-modal-backdrop">
            <div className="mwl-modal">
              <div className="mwl-modal-header">
                <div className="mwl-modal-title">
                  <HardDrive size={18} />
                  Modality Worklist Registry
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="mwl-modal-close"
                >
                  X
                </button>
              </div>

              <MwlEditor
                initial={editing}
                modalities={modalities.filter((m) => m !== "ALL")}
                onSaved={async () => {
                  setShowModal(false);
                  setEditing(null);
                  await load();
                }}
                onCancel={() => {
                  setShowModal(false);
                  setEditing(null);
                }}
              />
            </div>
          </div>
        )}

        {reviewItem && (
          <div className="mwl-modal-backdrop">
            <div className="mwl-modal">
              <div className="mwl-modal-header">
                <div className="mwl-modal-title">
                  <Activity size={18} />
                  Confirm Study Broadcast
                </div>
                <button
                  onClick={() => setReviewItem(null)}
                  className="mwl-modal-close"
                >
                  X
                </button>
              </div>

              <div className="mwl-review">
                <div className="mwl-review-card">
                  <div className="mwl-review-title">Study Manifest</div>
                  <div className="mwl-review-grid">
                    <div>
                      <div className="mwl-review-label">Patient Name</div>
                      <div className="mwl-review-value">
                        {reviewItem.patient_name}
                      </div>
                    </div>
                    <div>
                      <div className="mwl-review-label">Patient ID</div>
                      <div className="mwl-review-value mono">
                        {reviewItem.patient_id}
                      </div>
                    </div>
                    <div>
                      <div className="mwl-review-label">Accession</div>
                      <div className="mwl-review-value ok">
                        {reviewItem.accession_number}
                      </div>
                    </div>
                    <div>
                      <div className="mwl-review-label">Modality</div>
                      <div className="mwl-review-value warn">
                        {reviewItem.modality}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mwl-review-note">
                  This study will be registered as NEW in the target worklist.
                </div>
              </div>

              <div className="mwl-modal-actions">
                <button
                  onClick={() => setReviewItem(null)}
                  className="mwl-btn ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    commitPush(reviewItem);
                    setReviewItem(null);
                  }}
                  className="mwl-btn primary"
                >
                  Confirm and Broadcast
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function MwlEditor({ initial, modalities, onSaved, onCancel }) {
  const [form, setForm] = useState(initial);

  const save = async () => {
    try {
      if (form.id) {
        await axiosInstance.put(`/mwl/${form.id}`, form);
      } else {
        await axiosInstance.post("/mwl/register", form);
      }
      onSaved();
    } catch (err) {
      console.error("save mwl", err);
    }
  };

  return (
    <div className="mwl-editor">
      <div className="mwl-field">
        <label>Patient ID</label>
        <input
          value={form.patient_id ?? ""}
          onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
          placeholder="Enterprise MRN..."
        />
      </div>

      <div className="mwl-field">
        <label>Patient Name</label>
        <input
          value={form.patient_name ?? ""}
          onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
          placeholder="Full Name..."
        />
      </div>

      <div className="mwl-field">
        <label>Source Modality</label>
        <select
          value={form.modality}
          onChange={(e) => setForm({ ...form, modality: e.target.value })}
        >
          {modalities.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="mwl-field">
        <label>Schedule Time</label>
        <input
          type="text"
          value={toDisplayTime(form.scheduled_datetime)}
          onChange={(e) =>
            setForm({ ...form, scheduled_datetime: fromDisplayTime(e.target.value) })
          }
          placeholder="DD-MM-YYYY hh:mm AM/PM"
        />
      </div>

      <div className="mwl-field wide">
        <label>Accession Identifier</label>
        <input
          value={form.accession_number ?? ""}
          onChange={(e) =>
            setForm({ ...form, accession_number: e.target.value })
          }
          placeholder="Unique Accession ID..."
        />
      </div>

      <div className="mwl-editor-actions">
        <button onClick={onCancel} className="mwl-btn ghost">
          Cancel
        </button>
        <button onClick={save} className="mwl-btn primary">
          Save
        </button>
      </div>
    </div>
  );
}
