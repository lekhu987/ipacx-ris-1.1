// src/pages/patient/Billing.jsx
import React from "react";
import { usePatients } from "../context/PatientContext";

function Billing() {
  const { patients = [], completePayment } = usePatients();

  const pendingPatients = patients.filter(
    p => p.paymentStatus === "Pending"
  );

  return (
    <div className="billing-container">
      <h2>Billing</h2>

      {pendingPatients.length === 0 ? (
        <p>No pending payments.</p>
      ) : (
        <table className="billing-table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Name</th>
              <th>Amount</th>
              <th>Insurance</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pendingPatients.map(p => (
              <tr key={p.patientId}>
                <td>{p.patientId}</td>
                <td>{p.firstName} {p.lastName}</td>
                <td>₹1000</td>
                <td>{p.insurance || "No"}</td>
                <td>
                  <button onClick={() => completePayment(p.patientId)}>
                    Clear Bill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Billing;
