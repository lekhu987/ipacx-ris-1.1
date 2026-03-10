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
  const [editingAppointment, setEditingAppointment] = useState(null);

  const loadAppointmentsByDate = async (dateObj) => {
    try {
      const date = toLocalISODate(dateObj);
      const res = await api.get("/api/appointments", { params: { date } });
      const rows = Array.isArray(res.data) ? res.data : res?.data?.appointments || [];
      setAppointments(rows);
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
    });
    setShowForm(true);

    // Clear consumed navigation state so refresh/back doesn't reopen the modal.
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state]);

  const handleAddScheduler = () => {
    setEditingAppointment(null);
    setPrefillData(null);
    setShowForm(true);
  };

  const saveSchedule = async (newData) => {
    try {
      const payload = {
        id: newData.id || "",
        patientId: newData.patientId,
        patientName: newData.patientName,
        contact: newData.contact,
        time: newData.time,
        modality: newData.modality,
        doctor: newData.doctor,
        date: newData.date,
      };
      if (editingAppointment?.id) {
        await api.put(`/api/appointments/${encodeURIComponent(String(editingAppointment.id))}`, payload);
      } else {
        await api.post("/api/appointments", payload);
      }
      setEditingAppointment(null);
      setPrefillData(null);
      setShowForm(false);
      await loadAppointmentsByDate(currentDate);
    } catch (err) {
      console.error("Failed to save appointment:", err);
      alert("Failed to save appointment");
    }
  };

  const editAppointment = (appt) => {
    setEditingAppointment(appt);
    setPrefillData({ ...appt });
    setShowForm(true);
  };

  const deleteAppointment = async (appt) => {
    if (!appt?.id) {
      alert("Unable to delete this appointment (missing id)");
      return;
    }
    if (!window.confirm("Delete this appointment?")) return;
    try {
      await api.delete(`/api/appointments/${encodeURIComponent(String(appt.id))}`);
      await loadAppointmentsByDate(currentDate);
    } catch (err) {
      console.error("Failed to delete appointment:", err);
      alert("Failed to delete appointment");
    }
  };

  const moveToMwl = async (appt) => {
    try {
      const combineDateTime = (dateStr, timeStr) => {
        const date = String(dateStr || "").trim();
        const time = String(timeStr || "").trim();
        if (!date) return "";
        if (!time) return `${date}T00:00`;

        const ampm = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (ampm) {
          let hour = Number(ampm[1]);
          const minute = ampm[2];
          const period = ampm[3].toUpperCase();
          if (period === "PM" && hour < 12) hour += 12;
          if (period === "AM" && hour === 12) hour = 0;
          return `${date}T${String(hour).padStart(2, "0")}:${minute}`;
        }

        const m24 = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (m24) {
          const hour = String(Number(m24[1])).padStart(2, "0");
          return `${date}T${hour}:${m24[2]}`;
        }

        return `${date}T00:00`;
      };

      const scheduledDate = appt.date || toLocalISODate(new Date());
      const scheduledDateTime = combineDateTime(scheduledDate, appt.time || "");

      await api.post("/api/mwl", {
        PatientID: appt.patientId || "",
        PatientName: appt.patientName || "",
        Modality: appt.modality || "",
        SchedulingDate: scheduledDate,
        scheduled_datetime: scheduledDateTime,
        StudyDescription: `Scheduled ${appt.modality || ""}`.trim(),
        ReferringPhysician: appt.doctor || "",
      });
      alert("Moved to MWL successfully");
    } catch (err) {
      console.error("Move to MWL failed:", err);
      alert(err?.response?.data?.error || "Failed to move to MWL");
    }
  };

  const formatDisplayTime = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampm) {
      const h = Number(ampm[1]);
      const hour = h === 0 ? 12 : h > 12 ? ((h - 1) % 12) + 1 : h;
      return `${hour}:${ampm[2]} ${ampm[3].toUpperCase()}`;
    }

    const m24 = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m24) {
      let hour = Number(m24[1]);
      const minute = m24[2];
      const period = hour >= 12 ? "PM" : "AM";
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${minute} ${period}`;
    }

    return raw;
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
            setEditingAppointment(null);
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
            <th>Action</th>
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
                <td>{formatDisplayTime(appt.time)}</td>
                <td>{appt.modality}</td>
                <td>{appt.doctor}</td>
                <td>
                  <div className="sch-actions">
                    <button className="sch-btn-edit" onClick={() => editAppointment(appt)}>Edit</button>
                    <button className="sch-btn-delete" onClick={() => deleteAppointment(appt)}>Delete</button>
                    <button className="sch-btn-mwl" onClick={() => moveToMwl(appt)}>Move to MWL</button>
                  </div>
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
