// src/pages/AddPatient.js
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import MainLayout from "../layout/MainLayout";
import "./AddPatient.css";

const API_ROOT = process.env.REACT_APP_API_ROOT || "http://localhost:5000";

export default function AddPatient() {
  const navigate = useNavigate();
  const location = useLocation(); // receives state.editEntry
  

  const [formData, setFormData] = useState({
    id: null,
    PatientID: "",
    PatientName: "",
    PatientSex: "",
    PatientAge: "",
    AccessionNumber: "",
    StudyDescription: "",
    SchedulingDate: "",
    Modality: "",
    BodyPartExamined: "",
    ReferringPhysician: "",
  });

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    // accept ISO dates or YYYYMMDD
    if (/^\d{8}$/.test(dateString)) {
      // YYYYMMDD -> YYYY-MM-DD
      return `${dateString.slice(0,4)}-${dateString.slice(4,6)}-${dateString.slice(6,8)}`;
    }
    const d = new Date(dateString);
    if (isNaN(d)) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Generate new patient default
  const generateNewPatient = () => {
    const random = Math.floor(100 + Math.random() * 900);
    const today = new Date().toISOString().split("T")[0];
    const newId = `PT-${today.replace(/-/g, "")}-${random}`;
    setFormData({
      id: null,
      PatientID: newId,
      PatientName: "",
      PatientSex: "",
      PatientAge: "",
      AccessionNumber: "",
      StudyDescription: "",
      SchedulingDate: today,
      Modality: "",
      BodyPartExamined: "",
      ReferringPhysician: "",
    });
  };

  // Load edit data if passed via state
  useEffect(() => {
    if (location.state && location.state.editEntry) {
      const entry = location.state.editEntry;
      setFormData({
        id: entry.id || null,
        PatientID: entry.PatientID || "",
        PatientName: entry.PatientName || "",
        PatientSex: entry.PatientSex || "",
        PatientAge: entry.PatientAge || "",
        AccessionNumber: entry.AccessionNumber || "",
        StudyDescription: entry.StudyDescription || "",
        SchedulingDate: formatDateForInput(entry.SchedulingDate) || new Date().toISOString().split("T")[0],
        Modality: entry.Modality || "",
        BodyPartExamined: entry.BodyPartExamined || "",
        ReferringPhysician: entry.ReferringPhysician || "",
      });
    } else {
      generateNewPatient();
    }
  }, [location.state]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    if (!formData.PatientName || !formData.Modality || !formData.BodyPartExamined) {
      setErrorMsg("Patient Name, Modality, and Body Part Examined are required");
      setLoading(false);
      return;
    }

    try {
      const url = formData.id ? `${API_ROOT}/api/mwl/${formData.id}` : `${API_ROOT}/api/mwl`;
      const method = formData.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save patient to MWL");
      }

      await res.json();

      setSuccessMsg(formData.id ? "Patient updated!" : "Patient added!");
      // after add, you might choose to navigate back to MWL listing
      // navigate("/mwl"); // optional
      if (!formData.id) generateNewPatient();
    } catch (err) {
      setErrorMsg(err.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const todayDate = new Date().toISOString().split("T")[0];

  return (
    <MainLayout>
      <div className="add-patient-root">
        <h2 className="add-patient-header">
          {formData.id ? "Edit Patient" : "Add New Patient"}
        </h2>

        <form className="add-patient-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Patient ID</label>
            <input name="PatientID" value={formData.PatientID} readOnly disabled />
          </div>

          <div className="form-row">
            <label>Patient Name</label>
            <input name="PatientName" value={formData.PatientName} onChange={handleChange} required />
          </div>

          <div className="form-row small-field">
            <label>Gender</label>
            <select name="PatientSex" value={formData.PatientSex} onChange={handleChange}>
              <option value="">Select</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </div>

          <div className="form-row small-field">
            <label>Age</label>
            <input type="number" name="PatientAge" value={formData.PatientAge} onChange={handleChange} min="0" />
          </div>

          <div className="form-row">
            <label>Accession Number</label>
            <input name="AccessionNumber" value={formData.AccessionNumber} onChange={handleChange} />
          </div>

          <div className="form-row">
            <label>Study Description</label>
            <input name="StudyDescription" value={formData.StudyDescription} onChange={handleChange} />
          </div>

          <div className="form-row">
            <label>Scheduling Date</label>
            <input type="date" name="SchedulingDate" value={formData.SchedulingDate} onChange={handleChange} min={todayDate} required />
          </div>

          <div className="form-row">
            <label>Modality</label>
            <select name="Modality" value={formData.Modality} onChange={handleChange} required>
              <option value="">Select Modality</option>
              <option value="CT">CT</option>
              <option value="MR">MRI</option>
              <option value="XR">X-Ray</option>
              <option value="US">Ultrasound</option>
              <option value="MG">Mammography</option>
              <option value="NM">Nuclear Medicine</option>
              <option value="PT">PET</option>
              <option value="DX">Digital X-Ray</option>
              <option value="RF">Radiography/Fluoroscopy</option>
              <option value="OT">Other</option>
            </select>
          </div>

          <div className="form-row">
            <label>Body Part Examined</label>
            <select name="BodyPartExamined" value={formData.BodyPartExamined} onChange={handleChange} required>
              <option value="">Select Body Part</option>
              <option value="Head">Head</option>
              <option value="Chest">Chest</option>
              <option value="Abdomen">Abdomen</option>
              <option value="Pelvis">Pelvis</option>
              <option value="Spine">Spine</option>
              <option value="Extremities">Extremities</option>
              <option value="Neck">Neck</option>
              <option value="Knee">Knee</option>
              <option value="Shoulder">Shoulder</option>
              <option value="Whole Body">Whole Body</option>
            </select>
          </div>

          <div className="form-row">
            <label>Referring Physician</label>
            <input name="ReferringPhysician" value={formData.ReferringPhysician} onChange={handleChange} />
          </div>

          <div className="add-patient-buttons">
            <button type="submit" className="btn save" disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </button>
            <button
  type="button"
  className="btn cancel"
  onClick={() => {
    const from = location.state?.fromPage;
    switch(from) {
      case "patientlist":
        navigate(-1);
        break;
      case "mwls":
        navigate("/mwls");
        break;
      default:
        navigate("/mwls");
    }
  }}
>
  Cancel
</button>

          </div>

          {successMsg && <p className="success-msg">{successMsg}</p>}
          {errorMsg && <p className="error-msg">{errorMsg}</p>}
        </form>
      </div>
    </MainLayout>
  );
}
