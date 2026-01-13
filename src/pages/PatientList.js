// src/pages/patient/PatientList.jsx
import React, { useState } from "react";
import PatientRegistration from "./PatientRegistration";
import "./PatientList.css";

function PatientList() {
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState([]);

  // Function to add the COMPLETE patient object to the list
  const handleAddPatient = (newPatient) => {
    setPatients((prevPatients) => [...prevPatients, newPatient]);
  };
const handlePaymentComplete = (patientId) => {
  setPatients(prev =>
    prev.map(p =>
      p.patientId === patientId ? { ...p, paymentStatus: "Complete" } : p
    )
  );
};

  return (
    <div className="patient-list-container">
      <div className="header">
        <h2>Patient List</h2>
        <button className="add-patient-btn" onClick={() => setShowForm(true)}>
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
    <th>Payment Status</th> {/* New Column */}
  </tr>
</thead>
<tbody>
  {patients.map((p) => (
    <tr key={p.patientId}>
      <td><strong>{p.patientId}</strong></td>
      <td>{p.firstName} {p.lastName}</td>
      <td>{p.gender}</td>
      <td>{p.dob}</td>
      <td>{p.mobile}</td>
      <td>{p.referringDoctor}</td>
      <td>{p.visitType}</td>
      <td>{p.modality}</td>
      <td>{p.studyType}</td>
      <td>{p.paymentStatus}</td> {/* Show status */}
    </tr>
  ))}
</tbody>

        </table>
      </div>
    </div>
  );
}

export default PatientList;