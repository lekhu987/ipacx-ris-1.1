import React, { useState } from "react";
import MainLayout from "../layout/MainLayout";
import AddScheduler from "./AddScheduler";
import "./Scheduling.css";

function Scheduling() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [appointments, setAppointments] = useState([]);

  const handleAddScheduler = () => {
    setShowForm(true);
  };

  const saveSchedule = (newData) => {
    setAppointments([...appointments, newData]);
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
          onSave={saveSchedule}
          onClose={() => setShowForm(false)}
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
            filteredAppointments.map((appt) => (
              <tr key={appt.patientId}>
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
