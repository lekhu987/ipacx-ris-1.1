// src/pages/patient/PatientRegistration.jsx
import React, { useState, useEffect } from "react";
import "./PatientRegistration.css";

function PatientRegistration({ onClose }) {
  const [patientId, setPatientId] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    mobile: "",
    address: "",
    referringDoctor: "",
    visitType: "",
    modality: "",
    studyType: ""
  });

  // 🔹 Simulate HIS Patient ID sync
  useEffect(() => {
    // In real case: GET /his/api/new-patient-id
    setPatientId("HIS" + Math.floor(100000 + Math.random() * 900000));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const payload = {
      patientId,
      ...form
    };

    console.log("Registered Patient:", payload);

    alert("Patient Registered Successfully");
    onClose();
  };

  return (
    <div className="reg-form">
      <h2>Patient Registration</h2>

      {/* ▶ Patient Details */}
      <section>
        <h4>Patient Details</h4>
        <div className="row">
          <input value={patientId} disabled />
          <input name="firstName" placeholder="First Name *" onChange={handleChange} />
          <input name="lastName" placeholder="Last Name *" onChange={handleChange} />
          <select name="gender" onChange={handleChange}>
            <option value="">Gender *</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
          <input type="date" name="dob" onChange={handleChange} />
        </div>
      </section>

      {/* ▶ Contact Details */}
      <section>
        <h4>Contact Details</h4>
        <div className="row">
          <input name="mobile" placeholder="Mobile *" onChange={handleChange} />
          <textarea name="address" placeholder="Address" onChange={handleChange} />
        </div>
      </section>

      {/* ▶ Clinical Details */}
      <section>
        <h4>Clinical Details</h4>
        <div className="row">
          <input name="referringDoctor" placeholder="Referring Doctor *" onChange={handleChange} />
        </div>
      </section>

      {/* ▶ Visit Details */}
      <section>
        <h4>Visit Details</h4>
        <div className="row">
          <select name="visitType" onChange={handleChange}>
            <option value="">Visit Type *</option>
            <option>OPD</option>
            <option>IPD</option>
            <option>Emergency</option>
          </select>
        </div>
      </section>

      {/* ▶ Radiology Details */}
      <section>
        <h4>Radiology Details</h4>
        <div className="row">
          <select name="modality" onChange={handleChange}>
            <option value="">Modality *</option>
            <option>CT</option>
            <option>MRI</option>
            <option>X-Ray</option>
            <option>US</option>
          </select>
          <input name="studyType" placeholder="Study Type *" onChange={handleChange} />
        </div>
      </section>

      <div className="actions">
        <button type="submit" onClick={handleSubmit}>Register</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default PatientRegistration;
