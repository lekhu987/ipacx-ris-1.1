// src/pages/patient/PatientList.jsx
import React, { useState, useEffect } from "react";
import PatientRegistration from "./PatientRegistration";
import "./PatientList.css";

function PatientList() {
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    // Simulate HIS sync
    setPatients([
      { id: "HIS100001", name: "Ramesh Kumar", mobile: "9999999999" },
      { id: "HIS100002", name: "Sita Devi", mobile: "8888888888" }
    ]);
  }, []);

  return (
    <div className="patient-list">
      <div className="header">
        <h2>Patient List</h2>
        <button onClick={() => setShowForm(true)}>+ Register Patient</button>
      </div>

      {showForm && (
        <div className="modal">
          <PatientRegistration onClose={() => setShowForm(false)} />
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Patient ID</th>
            <th>Name</th>
            <th>Mobile</th>
          </tr>
        </thead>
        <tbody>
          {patients.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>{p.mobile}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PatientList;
