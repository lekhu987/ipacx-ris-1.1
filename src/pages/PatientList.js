import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PatientRegistration from "./PatientRegistration";
import "./PatientList.css";
import api from "../api/axios"; // adjust path if needed

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
      // Add /api prefix to match your backend route
      const res = await api.get("/api/patients"); 

      // Your backend returns result.rows directly, which is an array
      setPatients(res.data); 
    } catch (err) {
      console.error("Failed to load patients", err);
      setPatients([]);
    }
  };

  // After new patient is saved
  const handleAddPatient = (patient) => {
    setPatients((prev) => [patient, ...prev]);
  };

  // Navigate to scheduling page
  const handleSchedule = (patient) => {
    navigate("/schedule", { state: { patient } });
  };

  return (
    <div className="patient-list-container">
      <div className="header">
        <h2>Patient List</h2>
        <button
          className="add-patient-btn"
          onClick={() => setShowForm(true)}
        >
          + Register Patient
        </button>
      </div>

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
                <td colSpan="10" style={{ textAlign: "center" }}>
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
