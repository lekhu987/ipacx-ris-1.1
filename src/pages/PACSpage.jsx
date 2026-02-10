// src/pages/PACSpage.js
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../layout/MainLayout";
import api from "../api/axios";
import "./PACSpage.css";
import CustomDatePicker from "../components/CustomDatePicker";
import StudiesTable from "../components/StudiesTable";

// 🔐 helper to avoid toLowerCase crashes
const safeLower = (v) => String(v ?? "").toLowerCase();

export default function PACSpage() {
  const navigate = useNavigate();

  const [pacsServers, setPacsServers] = useState([]);
  const [activePacs, setActivePacs] = useState(null);
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    patientId: "",
    patientName: "",
    accession: "",
    modality: "",
    gender: "",
    startDate: "",
    endDate: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // ===================== LOAD STUDIES =====================
  async function loadStudies(pacs, dateFilters = filters) {
    if (!pacs) return;

    setActivePacs(pacs);
    sessionStorage.setItem("activePacs", JSON.stringify(pacs));

    setLoading(true);
    setStudies([]);
    setCurrentPage(1);

    try {
      const res = await api.get("/api/pacs/studies", {
  params: {
    pacs_id: pacs.id,
    startDate: dateFilters.startDate || undefined,
    endDate: dateFilters.endDate || undefined,
  },
});

console.log("Studies received:", res.data.length);

 console.log("Studies received:", res.data.length, res.data); // ✅ ADD
      const studiesWithPacs = Array.isArray(res.data)
  ? res.data.map((s) => ({
      ...s,
      PACS: pacs.pacs_name, // 👈 THIS IS THE KEY LINE
    }))
  : [];

setStudies(studiesWithPacs);

    } catch {
      setError("Failed to load studies");
    } finally {
      setLoading(false);
    }
  }

  
  // ===================== LOAD PACS SERVERS =====================
  useEffect(() => {
    async function loadPacs() {
      try {
        const res = await api.get("/api/pacs");
        const active = res.data.filter((p) => p.is_active);
        setPacsServers(active);

        const savedPacs = sessionStorage.getItem("activePacs");
        const savedFilters = sessionStorage.getItem("pacsDateFilters");

        let initialFilters;

        if (savedFilters) {
          initialFilters = JSON.parse(savedFilters);
        } else {
          // Default last 7 days
          const today = new Date();
          const lastWeek = new Date();
          lastWeek.setDate(today.getDate() - 7);

          const formatDate = (d) =>
            d.toISOString().split("T")[0].replace(/-/g, "");

          initialFilters = {
            patientId: "",
            patientName: "",
            accession: "",
            modality: "",
            gender: "",
            startDate: formatDate(lastWeek),
            endDate: formatDate(today),
          };

          sessionStorage.setItem(
            "pacsDateFilters",
            JSON.stringify(initialFilters)
          );
        }

        setFilters(initialFilters);

        if (savedPacs) {
          const pacs = JSON.parse(savedPacs);
          setActivePacs(pacs);
          loadStudies(pacs, initialFilters);
        } else if (active.length > 0) {
          loadStudies(active[0], initialFilters);
        }
      } catch {
        setError("Failed to load PACS servers");
      }
    }

    loadPacs();
  }, []);

  // ===================== FILTER LOGIC =====================
  const filteredStudies = useMemo(() => {
    return studies.filter((s) => {
      const matchId = safeLower(s.PatientID).startsWith(
        safeLower(filters.patientId)
      );

      const matchName = safeLower(s.PatientName).startsWith(
        safeLower(filters.patientName)
      );

      const matchAcc = safeLower(s.AccessionNumber).startsWith(
        safeLower(filters.accession)
      );

      const matchMod =
        !filters.modality || s.Modality === filters.modality;

      const matchGender =
        !filters.gender || s.PatientSex === filters.gender;

      let matchDate = true;
      if (filters.startDate && s.StudyDate) {
        const sDate = String(s.StudyDate).replace(/-/g, "");
        if (sDate < filters.startDate) matchDate = false;
        if (filters.endDate && sDate > filters.endDate) matchDate = false;
      }

      return (
        matchId &&
        matchName &&
        matchAcc &&
        matchMod &&
        matchGender &&
        matchDate
      );
    });
  }, [studies, filters]);
  

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleDateChange = (newFilters) => {
    setFilters(newFilters);
    sessionStorage.setItem(
      "pacsDateFilters",
      JSON.stringify(newFilters)
    );

    if (activePacs) {
      loadStudies(activePacs, newFilters);
    }
  };

  const pagedStudies = filteredStudies.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const uniqueModalities = useMemo(() => {
    return [...new Set(studies.map((s) => s.Modality))].filter(Boolean);
  }, [studies]);

  return (
    <MainLayout>
      <div className="pacs-page-header">
        <h2>PACS Viewer</h2>
      </div>

      <button
        className="add-report-btn"
        onClick={() => navigate("/add-new-report")}
      >
        ➕ Add New Report
      </button>

      {/* PACS SERVER BUTTONS */}
      <div className="pacs-button-container">
        {pacsServers.map((p) => (
          <button
            key={p.id}
            className={`pacs-nav-btn ${
              activePacs?.id === p.id ? "active" : ""
            }`}
            onClick={() => loadStudies(p)}
          >
            {p.pacs_name}
          </button>
        ))}
      </div>

      {/* STUDIES TABLE */}
      <div className="patient-table-scroll">
        <table className="patient-table">
          <thead>
            <tr>
              <th>#</th>

              <th>
                <div className="th-title">Patient ID</div>
                <input
                  name="patientId"
                  className="header-filter"
                  value={filters.patientId}
                  onChange={handleFilterChange}
                  placeholder="ID..."
                />
              </th>

              <th>
                <div className="th-title">Patient Name</div>
                <input
                  name="patientName"
                  className="header-filter"
                  value={filters.patientName}
                  onChange={handleFilterChange}
                  placeholder="Name..."
                />
              </th>

              <th>
                <div className="th-title">Accession</div>
                <input
                  name="accession"
                  className="header-filter"
                  value={filters.accession}
                  onChange={handleFilterChange}
                  placeholder="Acc..."
                />
              </th>

              <th>Study Description</th>

              <th>
                <CustomDatePicker
                  filters={filters}
                  setFilters={handleDateChange}
                />
              </th>

              <th>
                <div className="th-title">Modality</div>
                <select
                  name="modality"
                  className="header-filter"
                  value={filters.modality}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  {uniqueModalities.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </th>

              <th>
                <div className="th-title">Gender</div>
                <select
                  name="gender"
                  className="header-filter"
                  value={filters.gender}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  <option value="M">Male</option>
<option value="F">Female</option>
<option value="O">Other</option>

                </select>
              </th>

              <th>Age</th>
              <th>Actions</th>
            </tr>
          </thead>

          <StudiesTable
            studies={pagedStudies}
            filters={filters}
            mode="pacs"
            navigate={navigate}
            currentPage={currentPage}
  rowsPerPage={rowsPerPage}
          />
        </table>
      </div>

      {/* PAGINATION */}
      {filteredStudies.length > rowsPerPage && (
        <div className="pagination-corner">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            ◀ Prev
          </button>

          <span className="page-number">
            Page {currentPage} /{" "}
            {Math.ceil(filteredStudies.length / rowsPerPage)}
          </span>

          <button
            disabled={
              currentPage ===
              Math.ceil(filteredStudies.length / rowsPerPage)
            }
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next ▶
          </button>
        </div>
      )}
    </MainLayout>
  );
}