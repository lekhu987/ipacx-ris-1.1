// src/components/PatientList.jsx

import React, { useState, useEffect } from "react";
import { CalendarDays, SquarePen, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PatientRegistration from "./PatientRegistration";
import api from "../api/axios"; // Adjust path to your axios instance
import "./PatientList.css"; // Custom CSS

function PatientList() {
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
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
    api
      .get("/api/appointments/scheduled-ids")
      .then((res) => {
        const ids = Array.isArray(res?.data?.ids) ? res.data.ids : [];
        setScheduledPatientIds(ids);
      })
      .catch(() => {
        setScheduledPatientIds([]);
      });
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
      const sorted = [...data].sort((a, b) => {
        const aId = String(a?.uhid || a?.patient_id || "");
        const bId = String(b?.uhid || b?.patient_id || "");
        return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: "base" });
      });
      setPatients(sorted);
    } catch (err) {
      console.error("Failed to load patients:", err);
      setScheduledPatientIds([]);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const buildPatientPayload = (formData) => {
    const payload = new FormData();
    payload.set("first_name", (formData.firstName || "").trim());
    payload.set("last_name", (formData.lastName || "").trim() || "NA");
    payload.set("gender", formData.gender || "");
    payload.set("dob", formData.dob || "");
    payload.set("age", formData.age || "");
    payload.set("mobile", formData.phone || "");
    payload.set("email", formData.email || "");
    payload.set("address", formData.address || "");
    payload.set("address_line1", formData.address || "");
    payload.set("idType", formData.idType || "");
    payload.set("idNumber", formData.idNumber || "");
    payload.set("biometric_flag", String(Boolean(formData.biometric_flag)));
    payload.set("data_privacy_accepted", String(Boolean(formData.data_privacy_accepted)));
    payload.set("consent_signed", String(Boolean(formData.data_privacy_accepted)));
    payload.set("consent_image_sharing", String(Boolean(formData.consent_image_sharing)));
    payload.set("consent_telemedicine", String(Boolean(formData.consent_telemedicine)));
    payload.set("digital_signature", formData.digital_signature || "");
    payload.set("signature_file", formData.digital_signature || "");
    payload.set("photo_url", formData.photo_url || "");
    payload.set("referring_doctor", formData.referring_doctor || formData.attending_physician || "");
    payload.set("attending_physician", formData.attending_physician || "");
    payload.set("visit_type", formData.visit_type || "");
    payload.set("modality", Array.isArray(formData.modalities) ? formData.modalities.join(", ") : (formData.modality || ""));
    payload.set("study_type", formData.study_type || formData.indication_for_scan || "");
    payload.set("study", formData.study_type || formData.indication_for_scan || "");
    payload.set("abha_number", formData.abha_number || "");
    payload.set("abha_address", formData.abha_address || "");
    payload.set("voter_id", formData.voter_id || "");
    payload.set("registration_channel", formData.registration_channel || "");
    payload.set("title", formData.title || "");
    payload.set("relationship_type", formData.relationship_type || "");
    payload.set("relationship_name", formData.relationship_name || "");
    payload.set("marital_status", formData.marital_status || "");
    payload.set("occupation", formData.occupation || "");
    payload.set("nationality", formData.nationality || "");
    payload.set("language_preference", formData.language_preference || "");
    payload.set("emergency_contact_name", formData.emergency_contact_name || "");
    payload.set("emergency_contact_phone", formData.emergency_contact_phone || "");
    payload.set("emergency_contact_relation", formData.emergency_contact_relation || "");
    payload.set("secondary_contact_name", formData.secondaryContactName || formData.secondary_contact_name || "");
    payload.set("secondary_contact_phone", formData.secondaryContactPhone || formData.secondary_contact_phone || "");
    payload.set("blood_group", formData.blood_group || "");
    payload.set("height_cm", formData.height_cm || "");
    payload.set("weight_kg", formData.weight_kg || "");
    payload.set("allergies", formData.allergies || "");
    payload.set("current_medications", formData.current_medications || "");
    payload.set("medical_history", formData.medical_history || "");
    payload.set("is_pregnant", String(Boolean(formData.isPregnant || formData.is_pregnant)));
    payload.set("menstrual_status", formData.menstrual_status || "");
    payload.set("lmp_date", formData.lmp_date || "");
    payload.set("edd", formData.edd || "");
    payload.set("gestational_age", formData.gestational_age || "");
    payload.set("creatinine_level", formData.creatinine_level || "");
    payload.set("contrast_safety_flag", String(Boolean(formData.contrast_safety_flag)));
    payload.set("modalities", Array.isArray(formData.modalities) ? formData.modalities.join(", ") : (formData.modalities || ""));
    payload.set("patient_type", formData.patient_type || "");
    payload.set("department", formData.department || "");
    payload.set("ward_room_bed", formData.ward_room_bed || "");
    payload.set("billing_category", formData.billing_category || "");
    payload.set("insurance_provider", formData.insurance_provider || "");
    payload.set("consent_research_ai", String(Boolean(formData.consent_research_ai)));
    payload.set("indication_for_scan", formData.indication_for_scan || "");

    Object.entries(formData || {}).forEach(([key, value]) => {
      if (payload.has(key)) return;
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        payload.set(key, value.join(", "));
        return;
      }
      payload.set(key, String(value));
    });
    return payload;
  };

  // After new patient is saved
  const handleAddPatient = async (formData) => {
    const payload = buildPatientPayload(formData);

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
    return createdPatient;
  };

  const handleEditPatient = async (formData) => {
    if (!editingPatient) return null;
    const payload = buildPatientPayload(formData);
    const identifier = editingPatient.uhid || editingPatient.patient_id || editingPatient.mrn || editingPatient.id;
    const response = await api.put(`/api/patients/${encodeURIComponent(identifier)}`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const updatedPatient = response?.data?.patient;
    setPatients((prev) =>
      prev.map((p) =>
        (p.uhid || p.patient_id || p.mrn || p.id) === (editingPatient.uhid || editingPatient.patient_id || editingPatient.mrn || editingPatient.id)
          ? (updatedPatient || p)
          : p
      )
    );
    setEditingPatient(null);
    loadPatients();
    return updatedPatient;
  };

  // Navigate to schedule page
  const handleSchedule = (patient) => {
    navigate("/scheduling", { state: { patient } });
  };

  const handlePrint = (patient) => {
    const identifier = patient?.uhid || patient?.patient_id || patient?.mrn || patient?.id;
    if (!identifier) return;
    const base = (api?.defaults?.baseURL || "").replace(/\/$/, "");
    const printUrl = `${base}/api/patients/print/${encodeURIComponent(identifier)}`;
    window.open(printUrl, "_blank", "noopener,noreferrer");
  };

  const handleEdit = async (patient) => {
    try {
      const identifier = patient?.uhid || patient?.patient_id || patient?.mrn || patient?.id;
      if (!identifier) {
        setEditingPatient(patient);
        return;
      }
      const res = await api.get(`/api/patients/${encodeURIComponent(identifier)}`);
      const fullPatient = res?.data?.patient || patient;
      setEditingPatient(fullPatient);
    } catch (err) {
      console.error("Failed to fetch full patient for edit:", err);
      setEditingPatient(patient);
    }
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
      {(showForm || editingPatient) && (
        <div className="modal-overlay">
          <div className="modal-content">
            <PatientRegistration
              onClose={() => {
                setShowForm(false);
                setEditingPatient(null);
              }}
              onSave={editingPatient ? handleEditPatient : handleAddPatient}
              initialData={editingPatient}
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
                <th className="col-sno">ID</th>
                <th>Patient ID</th>
                <th>Name</th>
                <th className="col-gender">Gender</th>
                <th>DOB</th>
                <th className="col-mobile">Mobile</th>
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
                  <td colSpan={11} className="no-data">
                    No patients found
                  </td>
                </tr>
              ) : (
                patients.map((p, idx) => (
                  <tr key={p.uhid || p.patient_id}>
                    <td className="col-sno">{idx + 1}</td>
                    <td><strong>{p.uhid || p.patient_id}</strong></td>
                    <td>
                      {`${p.first_name || ""} ${p.last_name || ""}`.trim() ||
                        p.full_name ||
                        p.patient_name ||
                        p.name ||
                        "-"}
                    </td>
                    <td className="col-gender">{p.gender}</td>
                    <td>{p.dob ? new Date(p.dob).toLocaleDateString() : "-"}</td>
                    <td className="col-mobile">{p.mobile || "-"}</td>
                    <td>{p.referring_doctor || p.attending_physician || "-"}</td>
                    <td>{p.visit_type || "-"}</td>
                    <td>{p.modality || (Array.isArray(p.modalities) ? p.modalities.join(", ") : "-")}</td>
                    <td>{p.study_type || p.indication_for_scan || "-"}</td>
                    <td>
                      {(() => {
                        const scheduleKey = getPatientScheduleKey(p);
                        const isScheduled = scheduleKey && scheduledPatientIds.includes(scheduleKey);
                        return (
                      <div className="action-wrap">
                        <button
                          className={`schedule-btn ${isScheduled ? "scheduled" : "not-scheduled"}`}
                          onClick={() => handleSchedule(p)}
                          title={isScheduled ? "Scheduled" : "Schedule"}
                          aria-label={isScheduled ? "Scheduled" : "Schedule"}
                        ><CalendarDays size={12} /></button>
                        <button
                          className="schedule-btn edit-action"
                          onClick={() => handleEdit(p)}
                          title="Edit"
                          aria-label="Edit"
                        ><SquarePen size={12} /></button>
                        <button
                          className="schedule-btn print-action"
                          onClick={() => handlePrint(p)}
                          title="Print"
                          aria-label="Print"
                        ><Printer size={12} /></button>
                      </div>
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






