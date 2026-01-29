  // src/pages/PACSpage.js
  import React, { useEffect, useState, useMemo, useRef } from "react";
  import { useNavigate } from "react-router-dom";
  import MainLayout from "../layout/MainLayout";
  import api from "../api/axios";
  import "./PACSpage.css";
  import CustomDatePicker from "../components/CustomDatePicker";
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
      endDate: ""
    });
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 20;
    
    // ===================== LOAD STUDIES =====================
  async function loadStudies(pacs) {
    if (!pacs) return;
    if (activePacs?.id === pacs.id && studies.length > 0) return;
    setActivePacs(pacs);
    localStorage.setItem("activePacs", JSON.stringify(pacs));
    setLoading(true);
    setStudies([]);
    setCurrentPage(1);
    try {
      const res = await api.post("/api/pacs/studies", { pacs_id: pacs.id });
      setStudies([...res.data]); // force re-render
    } catch (err) {
      setError("Failed to load studies");
    } finally {
      setLoading(false);
    }
  }
// ===================== DEFAULT DATE (LAST 7 DAYS) =====================
  useEffect(() => {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    const formatDate = (d) =>
      d.toISOString().split("T")[0].replace(/-/g, "");
    setFilters(prev => ({
      ...prev,
      startDate: formatDate(lastWeek),
      endDate: formatDate(today),
    }));
  }, []);

    // ===================== LOAD PACS SERVERS =====================
  useEffect(() => {
  async function loadPacs() {
    try {
      const res = await api.get("/api/pacs");
      const active = res.data.filter(p => p.is_active);
      setPacsServers(active);

      const savedPacs = localStorage.getItem("activePacs");
      const savedStudies = localStorage.getItem("pacsStudies");

      if (savedPacs && savedStudies) {
        setActivePacs(JSON.parse(savedPacs));
        setStudies(JSON.parse(savedStudies));
        return; // ⛔ stop reload
      }

      if (active.length > 0) {
        loadStudies(active[0]);
      }
    } catch {
      setError("Failed to load PACS servers");
    }
  }
  loadPacs();
}, []);

    // ===================== FILTER LOGIC =====================
  const filteredStudies = useMemo(() => {
  return studies.filter(s => {
    const matchId = (s.PatientID || "").toLowerCase().startsWith((filters.patientId || "").toLowerCase());
    const matchName = (s.PatientName || "").toLowerCase().startsWith((filters.patientName || "").toLowerCase());
    const matchAcc = (s.AccessionNumber || "").toLowerCase().startsWith((filters.accession || "").toLowerCase());
    const matchMod = !filters.modality || s.Modality === filters.modality;
    const matchGender = !filters.gender || s.PatientSex === filters.gender;

    let matchDate = true;
    if (filters.startDate) {
      const sDate = String(s.StudyDate).replace(/-/g, "");
      if (sDate < filters.startDate) matchDate = false;
      if (filters.endDate && sDate > filters.endDate) matchDate = false;
    }

    return matchId && matchName && matchAcc && matchMod && matchGender && matchDate;
  });
}, [studies, filters]);


  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const pagedStudies = filteredStudies.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const uniqueModalities = [...new Set(studies.map(s => s.Modality))].filter(Boolean);
    return (
      <MainLayout>
        <div className="pacs-page-header">
          <h2>PACS Viewer</h2>
        </div>

        {/* ===================== PACS SERVER BUTTONS ===================== */}
        <div className="pacs-button-container">
          {pacsServers.map((p) => (
            <button 
              key={p.id} 
              className={`pacs-nav-btn ${activePacs?.id === p.id ? "active" : ""}`} 
              onClick={() => loadStudies(p)}
            >
              {p.pacs_name}
            </button>
          ))}
        </div>

        {/* ===================== ACTIVE PACS INFO ===================== */}
        {activePacs && (
          <div className="active-server-banner">
            Connected to: <strong>{activePacs.pacs_name}</strong> ({activePacs.ip_address}:{activePacs.port})
          </div>
        )}

        {/* ===================== STUDIES TABLE ===================== */}
        <div className="patient-table-scroll">
          <table className="patient-table">
            <thead>
              <tr>
                <th>#</th>
                <th>
                  <div className="th-title">Patient ID</div>
                  <input name="patientId" className="header-filter" value={filters.patientId} onChange={handleFilterChange} placeholder="ID..." />
                </th>
                <th>
                  <div className="th-title">Patient Name</div>
                  <input name="patientName" className="header-filter" value={filters.patientName} onChange={handleFilterChange} placeholder="Name..." />
                </th>
                <th>
                  <div className="th-title">Accession</div>
                  <input name="accession" className="header-filter" value={filters.accession} onChange={handleFilterChange} placeholder="Acc..." />
                </th>
                <th>Study Description</th>
               <th>
  <CustomDatePicker filters={filters} setFilters={setFilters} />
</th>


                <th>
                  <div className="th-title">Modality</div>
                  <select name="modality" className="header-filter" value={filters.modality} onChange={handleFilterChange}>
                    <option value="">All</option>
                    {uniqueModalities.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </th>
                <th>
                  <div className="th-title">Gender</div>
                  <select name="gender" className="header-filter" value={filters.gender} onChange={handleFilterChange}>
                    <option value="">All</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </th>
                <th>Age</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="loading-row">Loading studies...</td></tr>
              ) : filteredStudies.length === 0 ? (
                <tr><td colSpan="10" className="no-data-row">No matching studies found</td></tr>
              ) : (
                pagedStudies.map((s, idx) => (
                  <tr key={s.StudyInstanceUID || idx}>
                    <td>{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                    <td>{s.PatientID}</td>
                    <td>{s.PatientName}</td>
                    <td>{s.AccessionNumber}</td>
                    <td className="break">{s.StudyDescription || "No Description"}</td>
                    <td>{s.StudyDate}</td>
                    <td>{s.Modality}</td>
                    <td>{s.PatientSex}</td>
                    <td>{s.PatientAge}</td>
                    <td className="actions">
                      <button className="icon-btn" onClick={() => window.open(`http://192.168.1.34:8042/ohif/viewer?StudyInstanceUIDs=${s.StudyInstanceUID}`, "_blank")}>👁️</button>
                      <button className="icon-btn" onClick={() => navigate(`/create-report?study=${s.StudyInstanceUID}`)}>📝</button>
                      <button className="icon-btn" onClick={() => navigate("/add-patient", { state: { editEntry: s, fromPage: "pacspage" } })}>📤</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ===================== PAGINATION ===================== */}
        {filteredStudies.length > rowsPerPage && (
          <div className="pagination-corner">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>◀ Prev</button>
            <span className="page-number">
              Page {currentPage} / {Math.ceil(filteredStudies.length / rowsPerPage)}
            </span>
            <button 
              disabled={currentPage === Math.ceil(filteredStudies.length / rowsPerPage)}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next ▶
            </button>
          </div>
        )}
      </MainLayout>
    );
  }
