import React, { useEffect, useState } from "react";
import MainLayout from "../layout/MainLayout";
import "./Dashboard.css";

const SummaryCard = ({ title, value, onClick, selectedDate, onDateChange }) => {
  return (
    <div className="card" onClick={onClick}>
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => onDateChange(e.target.value)}
        className="card-date-picker"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="card-value">{value}</div>
      <div className="card-title">{title}</div>
    </div>
  );
};

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [appointmentsToday, setAppointmentsToday] = useState(0);
  const [completedReportsToday, setCompletedReportsToday] = useState(0);
  const [pendingReportsToday, setPendingReportsToday] = useState(0);
  const [patientsRegisteredToday, setPatientsRegisteredToday] = useState(0);

  /* ---------------- Patients ---------------- */
  const fetchPatients = async (date) => {
    try {
      const res = await fetch(`/api/patients?date=${date}`);
      const data = await res.json();
      setPatientsRegisteredToday(data.count || 0);
    } catch {
      setPatientsRegisteredToday(0);
    }
  };

  /* ---------------- Reports (FIXED LOGIC) ---------------- */
  const fetchReportsStats = async (date) => {
    try {
      const res = await fetch(`/api/reports?from=${date}&to=${date}`);
      const reports = await res.json();

      const draftsToday = reports.filter(
        (r) =>
          r.status === "Draft" &&
          r.created_at &&
          r.created_at.startsWith(date)
      ).length;

      const finalsToday = reports.filter(
        (r) =>
          r.status === "Final" &&
          r.created_at &&
          r.created_at.startsWith(date)
      ).length;

      setPendingReportsToday(draftsToday);
      setCompletedReportsToday(finalsToday);
    } catch {
      setPendingReportsToday(0);
      setCompletedReportsToday(0);
    }
  };

  /* ---------------- Appointments ---------------- */
  const fetchAppointments = async (date) => {
    try {
      const res = await fetch(`/api/appointments?date=${date}`);
      const data = await res.json();
      setAppointmentsToday(data.count || 0);
    } catch {
      setAppointmentsToday(0);
    }
  };

  /* ---------------- Auto Refresh ---------------- */
  useEffect(() => {
    const fetchAll = () => {
      fetchPatients(selectedDate);
      fetchReportsStats(selectedDate);
      fetchAppointments(selectedDate);
    };

    fetchAll(); // initial load

    const interval = setInterval(fetchAll, 5000); // auto-refresh every 5 sec

    return () => clearInterval(interval);
  }, [selectedDate]);

  const kpis = [
    { title: "Today's Appointments", value: appointmentsToday },
    { title: "Completed Reports Today", value: completedReportsToday },
    { title: "Pending Reports Today", value: pendingReportsToday },
    { title: "Patients Registered Today", value: patientsRegisteredToday },
  ];

  return (
    <MainLayout>
      <div className="dashboard-root">
        <div className="dashboard-header">
          <div className="header-left">
            <h2>Dashboard</h2>
          </div>
        </div>

        <div className="cards-row">
          {kpis.map((k) => (
            <SummaryCard
              key={k.title}
              title={k.title}
              value={k.value}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onClick={() => {}}
            />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
