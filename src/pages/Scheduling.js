import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import MainLayout from "../layout/MainLayout";
import AddScheduler from "./AddScheduler";
import "./Scheduling.css";

const APPOINTMENTS_KEY = "appointments";
const SCHEDULED_PATIENT_IDS_KEY = "scheduledPatientIds";

function Scheduling() {
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [prefillData, setPrefillData] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(APPOINTMENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setAppointments(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAppointments([]);
    }
  }, []);

  useEffect(() => {
    const patient = location.state?.patient;
    if (!patient) return;

    const patientName =
      `${patient.first_name || ""} ${patient.last_name || ""}`.trim() ||
      patient.full_name ||
      patient.patient_name ||
      patient.name ||
      "";
    const patientId = patient.uhid || patient.patient_id || patient.mrn || "";
    const today = new Date().toISOString().split("T")[0];

    setPrefillData({
      patientId: String(patientId),
      patientName,
      contact: patient.mobile || patient.phone || "",
      modality: patient.modality || "",
      date: today,
      status: "Pending",
    });
    setShowForm(true);
  }, [location.state]);

  const handleAddScheduler = () => {
    setPrefillData(null);
    setShowForm(true);
  };

  const saveSchedule = (newData) => {
    setAppointments((prev) => {
      const next = [...prev, newData];
      localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(next));
      return next;
    });

    const patientId = String(newData.patientId || "");
    if (patientId) {
      const raw = localStorage.getItem(SCHEDULED_PATIENT_IDS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed) ? parsed : [];
      if (!ids.includes(patientId)) {
        localStorage.setItem(SCHEDULED_PATIENT_IDS_KEY, JSON.stringify([...ids, patientId]));
      }
    }

    setPrefillData(null);
    setShowForm(false);
  };

  const formatDate = (d) => d.toISOString().split("T")[0]; // yyyy-mm-dd

  const filteredAppointments = appointments.filter(
    (appt) => appt.date === formatDate(currentDate)
  );

  const changeDay = (days) => {
    setCurrentDate(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() + days
      )
    );
  };

  // Compare only year, month, and date (ignore time)
  const today = new Date();
  const isPast =
    currentDate.getFullYear() < today.getFullYear() ||
    (currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() < today.getMonth()) ||
    (currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getDate() < today.getDate());

  return (
    <MainLayout>
      <div className="scheduling-top">
        <h2>Scheduling Page</h2>

        {/* Show Add Scheduler ONLY for today or future */}
        {!isPast && (
          <button className="add-btn" onClick={handleAddScheduler}>
            Add New Scheduler
          </button>
        )}
      </div>

      {showForm && (
        <AddScheduler
          initialData={prefillData}
          onSave={saveSchedule}
          onClose={() => {
            setShowForm(false);
            setPrefillData(null);
          }}
        />
      )}

      <div className="date-nav">
        <button onClick={() => changeDay(-1)}>←</button>
        <span>{currentDate.toDateString()}</span>
        <button onClick={() => changeDay(1)}>→</button>
      </div>

      <table className="schedule-table">
        <thead>
          <tr>
            <th>Patient ID</th>
            <th>Date</th>
            <th>Patient Name</th>
            <th>Contact</th>
            <th>Time</th>
            <th>Modality</th>
            <th>Doctor</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {filteredAppointments.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: "center" }}>
                No Appointments
              </td>
            </tr>
          ) : (
            filteredAppointments.map((appt, idx) => (
              <tr key={`${appt.patientId}-${appt.date}-${appt.time}-${idx}`}>
                <td>{appt.patientId}</td>
                <td>{appt.date}</td>
                <td>{appt.patientName}</td>
                <td>{appt.contact}</td>
                <td>{appt.time}</td>
                <td>{appt.modality}</td>
                <td>{appt.doctor}</td>
                <td>{appt.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </MainLayout>
  );
}

export default Scheduling;
