import React, { useEffect, useState } from "react";
import MainLayout from "../layout/MainLayout";
import "./Dashboard.css";
import CustomDatePicker from "../components/CustomDatePicker";
import api from "../api/axios";

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

  const normalizeDate = (dateValue) => {
    if (!dateValue) return "";
    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
      return (
        dateValue.getFullYear() +
        String(dateValue.getMonth() + 1).padStart(2, "0") +
        String(dateValue.getDate()).padStart(2, "0")
      );
    }

    const text = String(dateValue);
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return (
        parsed.getFullYear() +
        String(parsed.getMonth() + 1).padStart(2, "0") +
        String(parsed.getDate()).padStart(2, "0")
      );
    }

    const numeric = text.replace(/\D/g, "");
    return numeric.substring(0, 8);
  };

  const isInRange = (dateValue) => {
    const yyyymmdd = normalizeDate(dateValue);
    if (!yyyymmdd) return false;
    return (
      (!filters.startDate || yyyymmdd >= filters.startDate) &&
      (!filters.endDate || yyyymmdd <= filters.endDate)
    );
  };

  const getRangeDatesISO = () => {
    if (!filters.startDate || !filters.endDate) return [];

    const toDate = (yyyymmdd) =>
      new Date(
        Number(yyyymmdd.slice(0, 4)),
        Number(yyyymmdd.slice(4, 6)) - 1,
        Number(yyyymmdd.slice(6, 8))
      );

    const start = toDate(filters.startDate);
    const end = toDate(filters.endDate);
    const dates = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0");
      dates.push(iso);
    }

    return dates;
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${api.defaults.baseURL}/api/patients`);
      const data = await res.json();
      const rows = Array.isArray(data) ? data : data?.patients || [];

      const count = rows.filter((p) => {
        const candidateDate =
          p.created_at || p.createdAt || p.registration_date || p.registered_at || p.updated_at;
        return isInRange(candidateDate);
      }).length;

      setPatients(count);
    } catch {
      setPatients(0);
    }
  };

  const fetchReportsStats = async () => {
    try {
      const res = await fetch(`${api.defaults.baseURL}/api/reports`);
      const reportsData = await res.json();
      const reports = Array.isArray(reportsData) ? reportsData : reportsData?.reports || [];

      const filtered = reports.filter((r) => isInRange(r.created_at || r.createdAt || r.reported_at));

      setCompletedReports(filtered.filter((r) => r.status === "Final").length);
      setPendingReports(filtered.filter((r) => r.status === "Draft").length);
    } catch {
      setCompletedReports(0);
      setPendingReports(0);
    }
  };

  const fetchAppointments = async () => {
    try {
      const dates = getRangeDatesISO();
      if (dates.length === 0) {
        setAppointments(0);
        return;
      }

      const allRows = [];
      for (const date of dates) {
        const res = await fetch(`${api.defaults.baseURL}/api/appointments?date=${date}`);
        if (!res.ok) continue;
        const data = await res.json();
        const rows = Array.isArray(data) ? data : data?.appointments || [];
        allRows.push(...rows);
      }

      const apiCount = allRows.filter((a) => isInRange(a.appointment_date || a.date || a.created_at)).length;
      setAppointments(apiCount);
    } catch {
      setAppointments(0);
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchReportsStats();
    fetchAppointments();
  }, [filters.startDate, filters.endDate]);

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

