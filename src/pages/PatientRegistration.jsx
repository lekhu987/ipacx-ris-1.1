// src/components/PatientRegistration.jsx
import React, { useState, useEffect } from "react";
import api from "../api/axios";
import "./PatientRegistration.css";

function PatientRegistration({ onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [existingPatient, setExistingPatient] = useState(null);

  const [form, setForm] = useState({
    uhid: "",
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    age: "",
    countryCode: "+91",
    mobile: Array(10).fill(""),
    address: "",
    state: "",
    city: "",
    pinCode: "",
    referringDoctor: "",
    visitType: "",
    clinicalHistory: "",
    provisionalDiagnosis: "",
    modality: "",
    studyType: "",
    contrast: "",
    urgency: "",
    billingType: "",
    insuranceProvider: "",
    consentSigned: false,
    signatureFile: null,
    idType: "",
    idProof: null,
  });

  // Auto-generate UHID
  useEffect(() => {
    setForm(prev => ({ ...prev, uhid: "HIS" + Math.floor(100000 + Math.random() * 900000) }));
  }, []);

  // Age calculation from DOB
  useEffect(() => {
    if (form.dob) {
      const birthDate = new Date(form.dob);
      const ageDifMs = Date.now() - birthDate.getTime();
      const ageDate = new Date(ageDifMs);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      setForm(prev => ({ ...prev, age }));
    }
  }, [form.dob]);

  // Handle general input change
  const handleChange = (e) => {
    const { name, value, files, type, checked } = e.target;
    if (type === "file") {
      setForm({ ...form, [name]: files[0] });
    } else if (type === "checkbox") {
      setForm({ ...form, [name]: checked });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  // Mobile input handling
  const handleMobileChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const updated = [...form.mobile];
    updated[index] = value;
    setForm({ ...form, mobile: updated });
    if (value && index < 9) document.getElementById(`mob-${index + 1}`).focus();
  };

  const handleMobileBackspace = (index, e) => {
    if (e.key === "Backspace" && !form.mobile[index] && index > 0) {
      document.getElementById(`mob-${index - 1}`).focus();
    }
  };

  // Step 1: Search existing patient
  const searchPatient = async () => {
    const fullMobile = form.countryCode + form.mobile.join("");
    if (!fullMobile && (!form.firstName || !form.dob)) {
      alert("Enter Mobile or Name + DOB to search");
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/api/patients/search", {
        params: {
          mobile: fullMobile,
          firstName: form.firstName,
          lastName: form.lastName,
          dob: form.dob,
        },
      });
      setExistingPatient(res.data || null);
      if (res.data) {
        alert("Patient exists. Editing mode enabled.");
        setForm(prev => ({ ...prev, ...res.data }));
      } else {
        alert("No existing patient found. Proceed to registration.");
      }
    } catch (err) {
      console.error(err);
      alert("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Submit full registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    const fullMobile = form.countryCode + form.mobile.join("");

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === "mobile") formData.append(key, fullMobile);
      else if (value instanceof File) formData.append(key, value);
      else formData.append(key, value || "");
    });

    try {
      setLoading(true);
      const res = await api.post("/api/patients", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Patient registered successfully!");
      onSave(res.data);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registration-overlay">
      <div className="registration-card">
        <div className="registration-header">
          <h2>Patient Registration - Step {step}/10</h2>
          <button className="close-icon" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="registration-body">
          {/* Step 1: Search */}
          {step === 1 && (
            <div className="form-section">
              <h3>Search / Verify Patient</h3>
              <input placeholder="First Name" name="firstName" value={form.firstName} onChange={handleChange} />
              <input placeholder="Last Name" name="lastName" value={form.lastName} onChange={handleChange} />
              <input type="date" name="dob" value={form.dob} onChange={handleChange} />
              <div className="mobile-row">
                <select value={form.countryCode} onChange={e => setForm(prev => ({ ...prev, countryCode: e.target.value }))}>
                  <option value="+91">+91</option>
                  <option value="+1">+1</option>
                </select>
                {form.mobile.map((d, i) => (
                  <input key={i} id={`mob-${i}`} maxLength={1} value={d} onChange={e => handleMobileChange(i, e.target.value)} onKeyDown={e => handleMobileBackspace(i, e)} />
                ))}
              </div>
              <button type="button" onClick={searchPatient} disabled={loading}>{loading ? "Searching..." : "Search"}</button>
              <button type="button" onClick={() => setStep(2)}>Next</button>
            </div>
          )}

          {/* Step 2: Demographics */}
          {step === 2 && (
            <div className="form-section">
              <h3>Patient Demographics</h3>
              <input placeholder="UHID" value={form.uhid} disabled />
              <input placeholder="First Name" name="firstName" value={form.firstName} onChange={handleChange} required />
              <input placeholder="Last Name" name="lastName" value={form.lastName} onChange={handleChange} />
              <select name="gender" value={form.gender} onChange={handleChange} required>
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
              <input type="date" name="dob" value={form.dob} onChange={handleChange} />
              <input placeholder="Age" value={form.age} disabled />
              <button type="button" onClick={() => setStep(3)}>Next</button>
              <button type="button" onClick={() => setStep(1)}>Back</button>
            </div>
          )}

          {/* Step 3: Contact & Address */}
          {step === 3 && (
            <div className="form-section">
              <h3>Contact & Address</h3>
              <textarea placeholder="Address" name="address" value={form.address} onChange={handleChange} />
              <input placeholder="City" name="city" value={form.city} onChange={handleChange} />
              <input placeholder="State" name="state" value={form.state} onChange={handleChange} />
              <input placeholder="PIN Code" name="pinCode" value={form.pinCode} onChange={handleChange} />
              <button type="button" onClick={() => setStep(4)}>Next</button>
              <button type="button" onClick={() => setStep(2)}>Back</button>
            </div>
          )}

          {/* Step 4: Visit Type */}
          {step === 4 && (
            <div className="form-section">
              <h3>Visit Type</h3>
              <select name="visitType" value={form.visitType} onChange={handleChange} required>
                <option value="">Select</option>
                <option>OPD</option>
                <option>IPD</option>
                <option>Emergency</option>
              </select>
              <input placeholder="Referring Doctor" name="referringDoctor" value={form.referringDoctor} onChange={handleChange} />
              <button type="button" onClick={() => setStep(5)}>Next</button>
              <button type="button" onClick={() => setStep(3)}>Back</button>
            </div>
          )}

          {/* Step 5: Clinical History */}
          {step === 5 && (
            <div className="form-section">
              <h3>Clinical History & Provisional Diagnosis</h3>
              <textarea placeholder="Clinical History" name="clinicalHistory" value={form.clinicalHistory} onChange={handleChange} />
              <textarea placeholder="Provisional Diagnosis" name="provisionalDiagnosis" value={form.provisionalDiagnosis} onChange={handleChange} />
              <button type="button" onClick={() => setStep(6)}>Next</button>
              <button type="button" onClick={() => setStep(4)}>Back</button>
            </div>
          )}

          {/* Step 6: Modality & Study */}
          {step === 6 && (
            <div className="form-section">
              <h3>Modality & Study</h3>
              <select name="modality" value={form.modality} onChange={handleChange} required>
                <option value="">Select Modality</option>
                <option>CT</option>
                <option>MRI</option>
                <option>X-Ray</option>
                <option>US</option>
              </select>
              <input placeholder="Study Type" name="studyType" value={form.studyType} onChange={handleChange} />
              <select name="contrast" value={form.contrast} onChange={handleChange}>
                <option value="">Contrast</option>
                <option>Yes</option>
                <option>No</option>
              </select>
              <select name="urgency" value={form.urgency} onChange={handleChange}>
                <option value="">Urgency</option>
                <option>Routine</option>
                <option>Urgent</option>
              </select>
              <button type="button" onClick={() => setStep(7)}>Next</button>
              <button type="button" onClick={() => setStep(5)}>Back</button>
            </div>
          )}

          {/* Step 7: Billing */}
          {step === 7 && (
            <div className="form-section">
              <h3>Billing Details</h3>
              <select name="billingType" value={form.billingType} onChange={handleChange} required>
                <option value="">Select Billing Type</option>
                <option>Cash</option>
                <option>Insurance</option>
                <option>Govt Scheme</option>
              </select>
              {form.billingType === "Insurance" && (
                <input placeholder="Insurance Provider" name="insuranceProvider" value={form.insuranceProvider} onChange={handleChange} />
              )}
              <button type="button" onClick={() => setStep(8)}>Next</button>
              <button type="button" onClick={() => setStep(6)}>Back</button>
            </div>
          )}

          {/* Step 8: Consents */}
          {step === 8 && (
            <div className="form-section">
              <h3>Consents</h3>
              <label>
                <input type="checkbox" name="consentSigned" checked={form.consentSigned} onChange={handleChange} />
                Patient Consent Signed
              </label>
              <input type="file" name="signatureFile" onChange={handleChange} />
              <button type="button" onClick={() => setStep(9)}>Next</button>
              <button type="button" onClick={() => setStep(7)}>Back</button>
            </div>
          )}

          {/* Step 9: Identity */}
          {step === 9 && (
            <div className="form-section">
              <h3>Identity Proof</h3>
              <select name="idType" value={form.idType} onChange={handleChange}>
                <option value="">Select ID Type</option>
                <option>Aadhaar</option>
                <option>PAN</option>
                <option>Passport</option>
              </select>
              <input type="file" name="idProof" onChange={handleChange} />
              <button type="button" onClick={() => setStep(8)}>Back</button>
              <button type="button" onClick={() => setStep(10)}>Next</button>
            </div>
          )}

          {/* Step 10: Review & Submit */}
          {step === 10 && (
            <div className="form-section">
              <h3>Review & Submit</h3>
              <pre>{JSON.stringify(form, null, 2)}</pre>
              <button type="button" onClick={() => setStep(9)}>Back</button>
              <button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit Registration"}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default PatientRegistration;
