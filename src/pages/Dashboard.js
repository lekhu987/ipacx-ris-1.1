import React, { useEffect, useState } from "react";
import MainLayout from "../layout/MainLayout";
import "./Dashboard.css";
import CustomDatePicker from "../components/CustomDatePicker";

const SummaryCard = ({ title, value }) => (
  <div className="card">
    <div className="card-value">{value}</div>
    <div className="card-title">{title}</div>
  </div>
);

export default function Dashboard() {
  const getTodayYYYYMMDD = () => {
    const d = new Date();
    return (
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0")
    );
  };

  const today = getTodayYYYYMMDD();

  const [filters, setFilters] = useState({
    startDate: today,
    endDate: today,
  });

  const [appointments, setAppointments] = useState(0);
  const [completedReports, setCompletedReports] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);
  const [patients, setPatients] = useState(0);

  /* ---------- Normalize Date ---------- */
  const normalizeDate = (dateString) => {
    if (!dateString) return "";
    const numeric = dateString.replace(/\D/g, ""); // remove all non-numeric
    return numeric.substring(0, 8); // YYYYMMDD
  };

  /* ---------- Date Filtering ---------- */
  const isInRange = (dateString) => {
    const yyyymmdd = normalizeDate(dateString);
    if (!yyyymmdd) return false;
    return (
      (!filters.startDate || yyyymmdd >= filters.startDate) &&
      (!filters.endDate || yyyymmdd <= filters.endDate)
    );
  };

  /* ---------- API Calls ---------- */
  const fetchPatients = async () => {
    try {
      const res = await fetch("/api/patients");
      const data = await res.json();
      setPatients(data.filter((p) => isInRange(p.created_at)).length);
    } catch {
      setPatients(0);
    }
  };

  const fetchReportsStats = async () => {
    try {
      const res = await fetch("/api/reports");
      const reports = await res.json();

      const filtered = reports.filter((r) => isInRange(r.created_at));

      setCompletedReports(filtered.filter((r) => r.status === "Final").length);
      setPendingReports(filtered.filter((r) => r.status === "Draft").length);
    } catch {
      setCompletedReports(0);
      setPendingReports(0);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch("/api/appointments");
      const data = await res.json();
      setAppointments(data.filter((a) => isInRange(a.appointment_date)).length);
    } catch {
      setAppointments(0);
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchReportsStats();
    fetchAppointments();
  }, [filters]);

  /* ---------- KPIs ---------- */
  const kpis = [
    { title: "Appointments", value: appointments },
    { title: "Completed Reports", value: completedReports },
    { title: "Pending Reports", value: pendingReports },
    { title: "Patients Registered", value: patients },
  ];

  return (
    <MainLayout>
      <div className="dashboard-root">
        <div className="dashboard-header">
          <h2>Dashboard</h2>
          <CustomDatePicker filters={filters} setFilters={setFilters} />
        </div>

        <div className="cards-row">
          {kpis.map((k) => (
            <SummaryCard key={k.title} {...k} />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
