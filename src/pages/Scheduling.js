import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MainLayout from "../layout/MainLayout";
import AddScheduler from "./AddScheduler";
import api from "../api/axios";
import "./Scheduling.css";

function Scheduling() {
  const toLocalISODate = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const location = useLocation();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [prefillData, setPrefillData] = useState(null);

  const loadAppointmentsByDate = async (dateObj) => {
    try {
      const date = toLocalISODate(dateObj);
      const res = await api.get("/api/appointments", { params: { date } });
      const rows = Array.isArray(res.data) ? res.data : res?.data?.appointments || [];
      const normalized = rows.map((a) => ({
        ...a,
        status: a.status || "Pending",
      }));
      setAppointments(normalized);
    } catch (err) {
      console.error("Failed to load appointments:", err);
      setAppointments([]);
    }
  };

  useEffect(() => {
    loadAppointmentsByDate(currentDate);
  }, [currentDate]);

  useEffect(() => {
    const patient = location.state?.patient;
    if (!patient) return;

    const normalizeModality = (value) => {
      const raw = String(value || "").trim().toUpperCase();
      const modalityMap = {
        USG: "Ultrasound",
        "X-RAY": "X-Ray",
        XRAY: "X-Ray",
        MR: "MRI",
      };
      return modalityMap[raw] || (value || "");
    };

    const patientName =
      `${patient.first_name || ""} ${patient.last_name || ""}`.trim() ||
      patient.full_name ||
      patient.patient_name ||
      patient.name ||
      "";
    const patientId = patient.uhid || patient.patient_id || patient.mrn || "";
    const today = toLocalISODate(new Date());

    setPrefillData({
      patientId: String(patientId),
      patientName,
      contact: patient.mobile || patient.phone || "",
      modality: normalizeModality(patient.modality),
      doctor: patient.referring_doctor || patient.attending_physician || "",
      date: today,
      status: "Pending",
    });
    setShowForm(true);

    // Clear consumed navigation state so refresh/back doesn't reopen the modal.
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state]);

  const handleAddScheduler = () => {
    setPrefillData(null);
    setShowForm(true);
  };

  const saveSchedule = async (newData) => {
    try {
      await api.post("/api/appointments", {
        patientId: newData.patientId,
        patientName: newData.patientName,
        contact: newData.contact,
        time: newData.time,
        modality: newData.modality,
        doctor: newData.doctor,
        status: newData.status || "Pending",
        date: newData.date,
      });
      setPrefillData(null);
      setShowForm(false);
      await loadAppointmentsByDate(currentDate);
    } catch (err) {
      console.error("Failed to save appointment:", err);
      alert("Failed to save appointment");
    }
  };

  const updateAppointmentStatus = async (index, status) => {
    const appt = appointments[index];
    if (!appt) return;
    try {
      await api.post("/api/appointments", {
        patientId: appt.patientId,
        patientName: appt.patientName,
        contact: appt.contact,
        time: appt.time,
        modality: appt.modality,
        doctor: appt.doctor,
        status,
        date: appt.date,
      });
      await loadAppointmentsByDate(currentDate);
    } catch (err) {
      console.error("Failed to update appointment status:", err);
    }
  };

  const statusClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed") return "status-pill completed";
    if (s === "accepted") return "status-pill accepted";
    return "status-pill pending";
  };

  const cycleStatus = (index, currentStatus) => {
    const order = ["Pending", "Accepted", "Completed"];
    const currentIndex = order.findIndex((s) => s.toLowerCase() === String(currentStatus || "").toLowerCase());
    const nextStatus = order[(currentIndex + 1) % order.length];
    updateAppointmentStatus(index, nextStatus);
  };

  const filteredAppointments = appointments;

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
            filteredAppointments.map((appt, idx) => {
              return (
              <tr key={`${appt.patientId}-${appt.date}-${appt.time}-${appt.doctor}`}>
                <td>{appt.patientId}</td>
                <td>{appt.date}</td>
                <td>{appt.patientName}</td>
                <td>{appt.contact}</td>
                <td>{appt.time}</td>
                <td>{appt.modality}</td>
                <td>{appt.doctor}</td>
                <td>
                  {String(appt.status || "").toLowerCase() === "completed" ? (
                    <span className={statusClass(appt.status)}>{appt.status || "Completed"}</span>
                  ) : (
                    <label className="status-toggle-wrap" title="Click to change status">
                      <input
                        type="checkbox"
                        className="status-toggle-input"
                        checked={String(appt.status || "").toLowerCase() !== "pending"}
                        onChange={() => cycleStatus(idx, appt.status)}
                      />
                      <span className={statusClass(appt.status)}>{appt.status || "Pending"}</span>
                    </label>
                  )}
                </td>
              </tr>
              );
            })
          )}
        </tbody>
      </table>
    </MainLayout>
  );
}

export default Scheduling;
