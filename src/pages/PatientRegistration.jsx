import React, { useState, useEffect } from "react";
import "./PatientRegistration.css";
import api from "../api/axios";

function PatientRegistration({ onClose, onSave }) {
  const [patientId, setPatientId] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    countryCode: "+91",
    mobile: Array(10).fill(""),
    address: "",
    referringDoctor: "",
    visitType: "",
    modality: "",
    studyType: "",
    idType: "",
    idProof: null, // file
  });

  // Generate Patient ID
  useEffect(() => {
    setPatientId("HIS" + Math.floor(100000 + Math.random() * 900000));
  }, []);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "id_proof") {
      setForm({ ...form, idProof: files[0] });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  // Handle mobile number
  const handleMobileChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const updated = [...form.mobile];
    updated[index] = value;
    setForm({ ...form, mobile: updated });

    if (value && index < 9) {
      document.getElementById(`mob-${index + 1}`).focus();
    }
  };

  const handleMobileBackspace = (index, e) => {
    if (e.key === "Backspace" && !form.mobile[index] && index > 0) {
      document.getElementById(`mob-${index - 1}`).focus();
    }
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.mobile.some((d) => !d)) {
      alert("Please enter all 10 digits of mobile number");
      return;
    }

    const fullMobile = form.countryCode + form.mobile.join("");

    const formData = new FormData();
    formData.append("patient_id", patientId);
    formData.append("first_name", form.firstName);
    formData.append("last_name", form.lastName);
    formData.append("gender", form.gender);
    formData.append("dob", form.dob || "");
    formData.append("mobile", fullMobile);
    formData.append("address", form.address || "");
    formData.append("referring_doctor", form.referringDoctor || "");
    formData.append("visit_type", form.visitType || "");
    formData.append("modality", form.modality || "");
    formData.append("study_type", form.studyType || "");
    formData.append("id_type", form.idType || "");
    if (form.idProof) formData.append("id_proof", form.idProof); // Must match backend

    try {
      const res = await api.post("/api/patients", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Patient saved:", res.data);
      onSave(res.data);
      onClose();
    } catch (err) {
      console.error("Axios error:", err);
      const backendMessage =
        err.response?.data?.message ||
        JSON.stringify(err.response?.data) ||
        err.message;

      alert("Patient registration failed: " + backendMessage);
    }
  };

  return (
    <div className="registration-overlay">
      <div className="registration-card">
        <div className="registration-header">
          <h2>Patient Registration</h2>
          <button className="close-icon" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="registration-body">
          {/* Patient Details */}
          <div className="form-section">
            <h3>Patient Details</h3>
            <div className="grid-row four-cols">
              <div className="input-group">
                <label>Patient ID</label>
                <input value={patientId} disabled />
              </div>

              <div className="input-group">
                <label>First Name *</label>
                <input name="firstName" required onChange={handleChange} />
              </div>

              <div className="input-group">
                <label>Last Name *</label>
                <input name="lastName" required onChange={handleChange} />
              </div>

              <div className="input-group">
                <label>Gender *</label>
                <select name="gender" required onChange={handleChange}>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact & Clinical */}
          <div className="form-section">
            <h3>Contact & Clinical Info</h3>
            <div className="grid-row two-cols">
              <div className="input-group">
                <label>Mobile *</label>
                <div className="mobile-row">
                  <select
                    value={form.countryCode}
                    onChange={(e) =>
                      setForm({ ...form, countryCode: e.target.value })
                    }
                  >
                    <option value="+91">+91</option>
                    <option value="+1">+1</option>
                  </select>
                  <div className="mobile-box-group">
                    {form.mobile.map((digit, index) => (
                      <input
                        key={index}
                        id={`mob-${index}`}
                        maxLength="1"
                        value={digit}
                        onChange={(e) =>
                          handleMobileChange(index, e.target.value)
                        }
                        onKeyDown={(e) => handleMobileBackspace(index, e)}
                        required
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label>DOB</label>
                <input type="date" name="dob" onChange={handleChange} />
              </div>
            </div>

            <div className="input-group">
              <label>Address</label>
              <textarea name="address" onChange={handleChange} />
            </div>

            <div className="input-group">
              <label>Referring Doctor *</label>
              <input name="referringDoctor" required onChange={handleChange} />
            </div>
          </div>

          {/* Visit Details */}
          <div className="form-section">
            <h3>Visit Details</h3>
            <div className="grid-row three-cols">
              <select name="visitType" required onChange={handleChange}>
                <option value="">Visit Type</option>
                <option>OPD</option>
                <option>IPD</option>
                <option>Emergency</option>
              </select>

              <select name="modality" required onChange={handleChange}>
                <option value="">Modality</option>
                <option>CT</option>
                <option>MRI</option>
                <option>X-Ray</option>
                <option>US</option>
              </select>

              <input
                name="studyType"
                placeholder="Study Type"
                required
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Identity */}
          <div className="form-section">
            <h3>Identity</h3>
            <select name="idType" required onChange={handleChange}>
              <option value="">ID Type</option>
              <option>Aadhaar</option>
              <option>PAN</option>
              <option>Passport</option>
            </select>

            <input type="file" name="id_proof" onChange={handleChange} />
          </div>

          <div className="form-footer">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">Register Patient</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PatientRegistration;
