import React, { useState, useEffect } from "react";
import "./PatientRegistration.css";

function PatientRegistration({ onClose, onSave }) {
  const [patientId, setPatientId] = useState("");
  const [form, setForm] = useState({
    firstName: "", lastName: "", gender: "", dob: "",
    mobile: "", address: "", referringDoctor: "",
    visitType: "", modality: "", studyType: ""
  });

  useEffect(() => {
    setPatientId("HIS" + Math.floor(100000 + Math.random() * 900000));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

 const handleSubmit = (e) => {
  e.preventDefault();
  const newPatient = { 
    patientId, 
    ...form, 
    paymentStatus: "Pending" // default
  };

  if (onSave) onSave(newPatient);
  onClose();
};

  return (
    <div className="registration-overlay">
      <div className="registration-card">
        <div className="registration-header">
          <h2>Patient Registration</h2>
          <button className="close-icon" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="registration-body">
          {/* Section 1: Demographics */}
          <div className="form-section">
            <h3><i className="section-dot"></i> Patient Details</h3>
            <div className="grid-row four-cols">
              <div className="input-group">
                <label>Patient ID</label>
                <input value={patientId} disabled className="disabled-field" />
              </div>
              <div className="input-group">
                <label>First Name *</label>
                <input name="firstName" placeholder="Enter First Name" required onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Last Name *</label>
                <input name="lastName" placeholder="Enter Last Name" required onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Gender *</label>
                <select name="gender" required onChange={handleChange}>
                  <option value="">Select</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Clinical */}
          <div className="form-section">
            <h3><i className="section-dot"></i> Contact & Clinical Information</h3>
            <div className="grid-row three-cols">
              <div className="input-group">
                <label>Mobile Number *</label>
                <input name="mobile" placeholder="9999999999" required onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Date of Birth</label>
                <input type="date" name="dob" onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Referring Doctor *</label>
                <input name="referringDoctor" placeholder="Dr. Name" required onChange={handleChange} />
              </div>
            </div>
            <div className="grid-row single-col">
              <div className="input-group">
                <label>Address</label>
                <textarea name="address" placeholder="Complete Address..." onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Section 3: Radiology Details */}
          <div className="form-section">
            <h3><i className="section-dot"></i> Radiology & Visit Details</h3>
            <div className="grid-row three-cols">
              <div className="input-group">
                <label>Visit Type *</label>
                <select name="visitType" required onChange={handleChange}>
                  <option value="">Select Visit Type</option>
                  <option>OPD</option>
                  <option>IPD</option>
                  <option>Emergency</option>
                </select>
              </div>
              <div className="input-group">
                <label>Modality *</label>
                <select name="modality" required onChange={handleChange}>
                  <option value="">Select Modality</option>
                  <option>CT</option>
                  <option>MRI</option>
                  <option>X-Ray</option>
                  <option>US</option>
                </select>
              </div>
              <div className="input-group">
                <label>Study Type *</label>
                <input name="studyType" placeholder="e.g. Chest PA" required onChange={handleChange} />
              </div>
            </div>
          </div>

          <div className="form-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-submit">Register Patient</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PatientRegistration;