import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../layout/MainLayout";
import "./MWLS.css";

const API_ROOT = process.env.REACT_APP_API_ROOT || "http://localhost:5000";

export default function MWLS() {
  const [mwl, setMwl] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  const [filterId, setFilterId] = useState("");
  const [filterName, setFilterName] = useState("");

  const navigate = useNavigate();

  // ============================
  // Load MWL
  // ============================
  const loadMwl = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/api/mwl`);
      const data = await res.json();

      const normalized = data.map((e) => ({
        id: e.id,
        PatientID: e.patientid,
        PatientName: e.patientname,
        PatientSex: e.patientsex,
        PatientAge: e.patientage,
        AccessionNumber: e.accessionnumber || "",
        StudyDescription: e.studydescription || "",
        SchedulingDate: e.schedulingdate,
        Modality: e.modality,
        BodyPartExamined: e.bodypartexamined,
        ReferringPhysician: e.referringphysician,
        PatientSexDisplay:
          e.patientsex === "M"
            ? "Male"
            : e.patientsex === "F"
            ? "Female"
            : "Other",
      }));

      setMwl(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMwl();
  }, []);

  // ============================
  // Checkbox Handling
  // ============================
  const handleCheckbox = (id, checked) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? mwl.map((p) => p.id) : []);
  };

  // ============================
  // Delete Multiple
  // ============================
  const handleDelete = async () => {
    if (!selectedIds.length) return alert("Select at least one patient");

    if (!window.confirm("Delete selected MWL entries?")) return;

    await Promise.all(
      selectedIds.map((id) =>
        fetch(`${API_ROOT}/api/mwl/${id}`, { method: "DELETE" })
      )
    );

    setSelectedIds([]);
    loadMwl();
  };

  // ============================
  // SEND to Modality (directly using stored modality)
  // ============================
  const handleSendToPacs = async () => {
    if (!selectedIds.length) return alert("Select patient(s)");

    try {
      await Promise.all(
        selectedIds.map((id) => {
          const entry = mwl.find((p) => p.id === id);
          const modality = entry.Modality; // ✅ use stored modality
          if (!modality) {
            alert(`MWL entry ${entry.PatientName} has no modality`);
            return null;
          }

          return fetch(`${API_ROOT}/api/mwl/${id}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modality }),
          });
        })
      );

      alert(`Patient(s) sent to their respective modality successfully.`);
      setSelectedIds([]);
      loadMwl();
    } catch (err) {
      alert("Send failed: " + err.message);
    }
  };

  // ============================
  // Edit Entry
  // ============================
  const handleEdit = () => {
    if (selectedIds.length !== 1)
      return alert("Select exactly one patient to edit");

    const entry = mwl.find((p) => p.id === selectedIds[0]);

    navigate("/add-patient", { state: { editEntry: entry, fromPage: "mwls" } });
  };

  // ============================
  // Filtering
  // ============================
  const filteredMwl = mwl.filter(
    (p) =>
      p.PatientID.toLowerCase().includes(filterId.toLowerCase()) &&
      p.PatientName.toLowerCase().includes(filterName.toLowerCase())
  );

  // ============================
  // Render
  // ============================
  return (
    <MainLayout>
      <div className="mwl-root">
        <h1 className="page-header">Modality WorkList Page</h1>

        {/* Toolbar */}
        <div className="mwl-toolbar">
          <button className="btn primary" onClick={() => navigate("/add-patient")}>➕</button>
          <button className="btn primary" onClick={handleEdit}>✎</button>
          <button className="btn danger" onClick={handleDelete}>🗑</button>
          <button
            className="btn secondary"
            onClick={handleSendToPacs} // ✅ send directly
          >
            📤
          </button>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          {loading ? (
            <div className="mwl-loading">Loading…</div>
          ) : (
            <table className="mwl-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedIds.length === mwl.length && mwl.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th>
                    Patient ID
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Filter"
                      value={filterId}
                      onChange={(e) => setFilterId(e.target.value)}
                    />
                  </th>
                  <th>
                    Patient Name
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Filter"
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                    />
                  </th>
                  <th>Accession</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>Modality</th>
                  <th>Scheduling Date</th>
                  <th>Body Part</th>
                  <th>Ref. Physician</th>
                </tr>
              </thead>

              <tbody>
                {filteredMwl.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="empty">No MWL Items</td>
                  </tr>
                ) : (
                  filteredMwl.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(e.id)}
                          onChange={(ev) => handleCheckbox(e.id, ev.target.checked)}
                        />
                      </td>
                      <td>{e.PatientID}</td>
                      <td>{e.PatientName}</td>
                      <td>{e.AccessionNumber || "-"}</td>
                      <td>{e.PatientSexDisplay}</td>
                      <td>{e.PatientAge}</td>
                      <td>{e.Modality}</td>
                      <td>
                        {e.SchedulingDate
                          ? new Date(e.SchedulingDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>{e.BodyPartExamined}</td>
                      <td>{e.ReferringPhysician}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
