import React, { useEffect, useState } from "react";
import "./AddScheduler.css";

export default function AddScheduler({ onSave, onClose, initialData }) {
  const formatTime12 = (hour, minute, period) => `${hour}:${minute} ${period}`;
  const parseTo12Hour = (input) => {
    const raw = String(input || "").trim();
    if (!raw) return { hour: "10", minute: "00", period: "AM" };

    const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampm) {
      let hour = Number(ampm[1]);
      if (hour === 0) hour = 12;
      if (hour > 12) hour = ((hour - 1) % 12) + 1;
      return {
        hour: String(hour),
        minute: ampm[2],
        period: ampm[3].toUpperCase(),
      };
    }

    const m24 = raw.match(/^(\d{1,2}):(\d{2})/);
    if (m24) {
      let h = Number(m24[1]);
      const minute = m24[2];
      const period = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      return { hour: String(h), minute, period };
    }

    return { hour: "10", minute: "00", period: "AM" };
  };

  const [form, setForm] = useState({
    id: "",
    patientId: "",
    patientName: "",
    contact: "",
    time: "10:00 AM",
    timeHour: "10",
    timeMinute: "00",
    timePeriod: "AM",
    modality: "",
    doctor: "",
    date: ""
  });

  useEffect(() => {
    if (!initialData) return;
    const t = parseTo12Hour(initialData?.time);
    setForm((prev) => ({
      ...prev,
      ...initialData,
      time: formatTime12(t.hour, t.minute, t.period),
      timeHour: t.hour,
      timeMinute: t.minute,
      timePeriod: t.period,
    }));
  }, [initialData]);

  const modalities = ["CT", "MRI", "X-Ray", "Ultrasound", "DEXA"];
  const doctors = ["Dr. Smith", "Dr. Johnson", "Dr. Rakesh", "Dr. Priya", "Dr. Karthik"];
  const modalityOptions = form.modality && !modalities.includes(form.modality)
    ? [form.modality, ...modalities]
    : modalities;
  const doctorOptions = form.doctor && !doctors.includes(form.doctor)
    ? [form.doctor, ...doctors]
    : doctors;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleTimePartChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    const time12 = formatTime12(next.timeHour, next.timeMinute, next.timePeriod);
    setForm({
      ...next,
      time: time12,
    });
  };

  const handleManualTimeChange = (e) => {
    const raw = e.target.value;
    const parsed = parseTo12Hour(raw);
    setForm((prev) => ({
      ...prev,
      time: raw,
      timeHour: parsed.hour,
      timeMinute: parsed.minute,
      timePeriod: parsed.period,
    }));
  };

  const isFormValid = () => {
    const patientId = String(form.patientId || "").trim();
    const patientName = String(form.patientName || "").trim();
    const time = String(form.time || "").trim();
    const modality = String(form.modality || "").trim();
    const doctor = String(form.doctor || "").trim();
    const date = String(form.date || "").trim();
    return Boolean(patientId && patientName && time && modality && doctor && date);
  };

  const submitForm = () => {
    if (!isFormValid()) {
      alert("Please fill all fields including date");
      return;
    }
    onSave(form);
  };

  return (
    <div className="add-scheduler-box">
      <h3>{form.id ? "Edit Scheduler" : "Add New Scheduler"}</h3>

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
          <div className="time-wrap">
            <div className="time-select-wrap">
              <select name="timeHour" value={form.timeHour} onChange={handleTimePartChange}>
                {[12,1,2,3,4,5,6,7,8,9,10,11].map((h) => (
                  <option key={h} value={String(h)}>{h}</option>
                ))}
              </select>
              <span>:</span>
              <select name="timeMinute" value={form.timeMinute} onChange={handleTimePartChange}>
                {["00","05","10","15","20","25","30","35","40","45","50","55"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select name="timePeriod" value={form.timePeriod} onChange={handleTimePartChange}>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <input
              name="time"
              placeholder="e.g. 11:30 AM"
              value={form.time}
              onChange={handleManualTimeChange}
            />
          </div>
        </div>
      </div>

      <div className="row-2col">
        <div className="row">
          <label>Modality</label>
          <select name="modality" value={form.modality} onChange={handleChange}>
            <option value="">Select</option>
            {modalityOptions.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div className="row">
          <label>Doctor</label>
          <select name="doctor" value={form.doctor} onChange={handleChange}>
            <option value="">Select</option>
            {doctorOptions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="btn-area">
        <button className="save-btn" onClick={submitForm} disabled={!isFormValid()}>
          {form.id ? "Update" : "Save"}
        </button>
        <button className="close-btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
