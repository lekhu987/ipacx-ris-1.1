// src/components/PatientList.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PatientRegistration from "./PatientRegistration";
import api from "../api/axios"; // Adjust path to your axios instance
import "./PatientList.css"; // Custom CSS

const SCHEDULED_PATIENT_IDS_KEY = "scheduledPatientIds";

function PatientList() {
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduledPatientIds, setScheduledPatientIds] = useState([]);
  const navigate = useNavigate();

  // Load patients on page load
  useEffect(() => {
    loadPatients();
    loadScheduledPatientIds();
  }, []);

  useEffect(() => {
    const onFocus = () => loadScheduledPatientIds();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const loadScheduledPatientIds = () => {
    try {
      const raw = localStorage.getItem(SCHEDULED_PATIENT_IDS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setScheduledPatientIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setScheduledPatientIds([]);
    }
  };

  const getPatientScheduleKey = (patient) =>
    String(patient?.uhid || patient?.patient_id || patient?.mrn || "");

  const loadPatients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/patients");
      // Support both backend response shapes:
      // 1) { patients: [...] } and 2) [...]
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data && Array.isArray(res.data.patients) ? res.data.patients : []);
      setPatients(data);
    } catch (err) {
      console.error("Failed to load patients:", err);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  // After new patient is saved
  const handleAddPatient = async (formData) => {
    const payload = new FormData();
    payload.append("first_name", (formData.firstName || "").trim());
    payload.append("last_name", (formData.lastName || "").trim() || "NA");
    payload.append("gender", formData.gender || "");
    payload.append("dob", formData.dob || "");
    payload.append("age", formData.age || "");
    payload.append("mobile", formData.phone || "");
    payload.append("email", formData.email || "");
    payload.append("address", formData.address || "");
    payload.append("idType", formData.idType || "");
    payload.append("idNumber", formData.idNumber || "");
    payload.append("biometric_flag", String(Boolean(formData.biometric_flag)));
    payload.append("data_privacy_accepted", String(Boolean(formData.data_privacy_accepted)));
    payload.append("consent_image_sharing", String(Boolean(formData.consent_image_sharing)));
    payload.append("consent_telemedicine", String(Boolean(formData.consent_telemedicine)));
    payload.append("digital_signature", formData.digital_signature || "");

    const response = await api.post("/api/patients", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const createdPatient = response?.data?.patient;
    if (!createdPatient) {
      throw new Error("Patient was not returned by backend");
    }

    setPatients((prev) => [createdPatient, ...prev]);
    setShowForm(false);
    loadPatients();
  };

  // Navigate to schedule page
  const handleSchedule = (patient) => {
    navigate("/scheduling", { state: { patient } });
  };

  return (
    <div className="patient-page">

      {/* Header */}
      <div className="patient-header">
        <h2>Patient List</h2>
        <button
          className="add-patient-btn"
          onClick={() => setShowForm(true)}
        >
          + Register Patient
        </button>
      </div>

      {/* Modal for Patient Registration */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <PatientRegistration
              onClose={() => setShowForm(false)}
              onSave={handleAddPatient}
            />
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <p className="loading-text">Loading patients...</p>
      ) : (
        <div className="table-wrapper">
          <table className="patient-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Gender</th>
                <th>DOB</th>
                <th>Mobile</th>
                <th>Referring Doctor</th>
                <th>Visit Type</th>
                <th>Modality</th>
                <th>Study Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="no-data">
                    No patients found
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.uhid || p.patient_id}>
                    <td><strong>{p.uhid || p.patient_id}</strong></td>
                    <td>
                      {`${p.first_name || ""} ${p.last_name || ""}`.trim() ||
                        p.full_name ||
                        p.patient_name ||
                        p.name ||
                        "-"}
                    </td>
                    <td>{p.gender}</td>
                    <td>{p.dob ? new Date(p.dob).toLocaleDateString() : "-"}</td>
                    <td>{p.mobile || "-"}</td>
                    <td>{p.referring_doctor || "-"}</td>
                    <td>{p.visit_type || "-"}</td>
                    <td>{p.modality || "-"}</td>
                    <td>{p.study_type || "-"}</td>
                    <td>
                      {(() => {
                        const scheduleKey = getPatientScheduleKey(p);
                        const isScheduled = scheduleKey && scheduledPatientIds.includes(scheduleKey);
                        return (
                      <button
                        className={`schedule-btn ${isScheduled ? "scheduled" : "not-scheduled"}`}
                        onClick={() => handleSchedule(p)}
                      >
                        {isScheduled ? "Scheduled" : "Schedule"}
                      </button>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PatientList;
