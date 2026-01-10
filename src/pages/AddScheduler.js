import React, { useState } from "react";
import "./AddScheduler.css";

export default function AddScheduler({ onSave, onClose }) {
  const [form, setForm] = useState({
    patientId: "",
    patientName: "",
    contact: "",
    time: "",
    modality: "",
    doctor: "",
    status: "Pending",
    date: ""
  });

  const modalities = ["CT", "MRI", "X-Ray", "Ultrasound", "DEXA"];
  const doctors = ["Dr. Smith", "Dr. Johnson", "Dr. Rakesh", "Dr. Priya", "Dr. Karthik"];
  const statuses = ["Pending", "Accepted", "Completed"];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submitForm = () => {
    if (!form.patientId ||!form.patientName || !form.time || !form.modality || !form.doctor || !form.date) {
      alert("Please fill all fields including date");
      return;
    }
    onSave(form);
  };

  return (
    <div className="add-scheduler-box">
      <h3>Add New Scheduler</h3>

      {/* Row full width */}
      <div className="row">
        <label>Patient ID</label>
        <input  name="patientId" value={form.patientId}  onChange={handleChange}  />
      </div>

      {/* TWO COLUMN SECTION */}
      <div className="row-2col">
        <div className="row">
          <label>Patient Name</label>
          <input name="patientName" value={form.patientName} onChange={handleChange} />
        </div>

        <div className="row">
          <label>Contact Number</label>
          <input
            name="contact"
            value={form.contact}
            onChange={handleChange}
            placeholder="Enter mobile number"
          />
        </div>
      </div>

      <div className="row-2col">
        <div className="row">
          <label>Appointment Date</label>
          <input type="date" name="date" value={form.date} onChange={handleChange} />
        </div>

        <div className="row">
          <label>Time</label>
          <input
            name="time"
            placeholder="10:30 AM / 14:00"
            value={form.time}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="row-2col">
        <div className="row">
          <label>Modality</label>
          <select name="modality" value={form.modality} onChange={handleChange}>
            <option value="">Select</option>
            {modalities.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div className="row">
          <label>Doctor</label>
          <select name="doctor" value={form.doctor} onChange={handleChange}>
            <option value="">Select</option>
            {doctors.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="row">
        <label>Status</label>
        <select name="status" value={form.status} onChange={handleChange}>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="btn-area">
        <button className="save-btn" onClick={submitForm}>Save</button>
        <button className="close-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
