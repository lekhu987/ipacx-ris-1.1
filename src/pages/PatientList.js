import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PatientRegistration from "./PatientRegistration";
import api from "../api/axios"; // adjust path if needed
import "./PatientList.css"; // custom styles

function PatientList() {
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState([]);
  const navigate = useNavigate();

  // Load patients on page load
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const res = await api.get("/api/patients");
      setPatients(res.data || []);
    } catch (err) {
      console.error("Failed to load patients", err);
      setPatients([]);
    }
  };

  // After new patient is saved
  const handleAddPatient = (patient) => {
    setPatients((prev) => [patient, ...prev]);
    setShowForm(false); // close modal after save
  };

  // Navigate to scheduling page
  const handleSchedule = (patient) => {
    navigate("/schedule", { state: { patient } });
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

      {/* Patient Table */}
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
                <tr key={p.patient_id}>
                  <td><strong>{p.patient_id}</strong></td>
                  <td>{p.first_name} {p.last_name}</td>
                  <td>{p.gender}</td>
                  <td>{p.dob}</td>
                  <td>{p.mobile}</td>
                  <td>{p.referring_doctor}</td>
                  <td>{p.visit_type}</td>
                  <td>{p.modality}</td>
                  <td>{p.study_type}</td>
                  <td>
                    <button
                      className="schedule-btn"
                      onClick={() => handleSchedule(p)}
                    >
                      Schedule
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

export default PatientList;
