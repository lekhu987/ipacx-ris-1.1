import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../layout/MainLayout";
import api from "../api/axios";
import "./PACSpage.css";

export default function PACSpage() {
  const navigate = useNavigate();
  const [pacsServers, setPacsServers] = useState([]);
  const [activePacs, setActivePacs] = useState(null);
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filter States
  const [filters, setFilters] = useState({
    patientId: "",
    patientName: "",
    accession: "",
    modality: "",
    gender: "",
    startDate: "", 
    endDate: ""
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef(null);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  useEffect(() => {
    async function loadPacs() {
      try {
        const res = await api.get("/api/pacs");
        setPacsServers(res.data.filter((p) => p.is_active));
      } catch { setError("Failed to load PACS servers"); }
    }
    loadPacs();
  }, []);

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadStudies(pacs) {
    setActivePacs(pacs);
    setLoading(true);
    setStudies([]);
    setCurrentPage(1);
    try {
      const res = await api.post("/api/pacs/studies", { pacs_id: pacs.id });
      setStudies(res.data || []);
    } catch { setError("Failed to load studies"); }
    finally { setLoading(false); }
  }

  /* ================= DATE PICKER SHORTCUTS ================= */
  const applyDateFilter = (type) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    const formatDate = (d) => d.toISOString().split('T')[0].replace(/-/g, "");

    switch(type) {
      case 'today': break;
      case 'yesterday': 
        start.setDate(today.getDate() - 1); 
        end.setDate(today.getDate() - 1); 
        break;
      case 'this_week':
        start.setDate(today.getDate() - today.getDay());
        break;
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last_12':
        start.setFullYear(today.getFullYear() - 1);
        break;
      default: break;
    }

    setFilters(prev => ({ ...prev, startDate: formatDate(start), endDate: formatDate(end) }));
    setShowDatePicker(false);
  };

  /* ================= FILTER LOGIC (STARTS WITH) ================= */
  const filteredStudies = useMemo(() => {
    return studies.filter((s) => {
      // Prefix matching logic: only show results starting with the input
      const matchId = s.PatientID.toLowerCase().startsWith(filters.patientId.toLowerCase());
      const matchName = s.PatientName.toLowerCase().startsWith(filters.patientName.toLowerCase());
      const matchAcc = s.AccessionNumber.toLowerCase().startsWith(filters.accession.toLowerCase());
      
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

  const pagedStudies = filteredStudies.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const uniqueModalities = [...new Set(studies.map(s => s.Modality))].filter(Boolean);

  return (
    <MainLayout>
      <div className="pacs-page-header">
        <h2>PACS Viewer</h2>
      </div>

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

      {activePacs && (
        <div className="active-server-banner">
            Connected to: <strong>{activePacs.pacs_name}</strong> ({activePacs.ip_address}:{activePacs.port})
        </div>
      )}

      <div className="patient-table-scroll">
        <table className="patient-table">
          <thead>
            <tr>
              <th>#</th>
              <th>
                <div>Patient ID</div>
                <input name="patientId" className="header-filter" value={filters.patientId} onChange={handleFilterChange} placeholder="ID..." />
              </th>
              <th>
                <div>Patient Name</div>
                <input name="patientName" className="header-filter" value={filters.patientName} onChange={handleFilterChange} placeholder="Name..." />
              </th>
              <th>
                <div>Accession</div>
                <input name="accession" className="header-filter" value={filters.accession} onChange={handleFilterChange} placeholder="Acc..." />
              </th>
              <th>Study Description</th>
              <th className="date-header-cell">
                <div onClick={() => setShowDatePicker(!showDatePicker)} className="date-trigger">
                  Study Date 📅
                </div>
                {showDatePicker && (
                  <div className="custom-date-picker" ref={datePickerRef}>
                    <div className="date-sidebar">
                      <div onClick={() => applyDateFilter('today')}>Today</div>
                      <div onClick={() => applyDateFilter('yesterday')}>Yesterday</div>
                      <div onClick={() => applyDateFilter('this_week')}>This week</div>
                      <div onClick={() => applyDateFilter('this_month')}>This month</div>
                      <div onClick={() => applyDateFilter('last_12')}>Last 12 months</div>
                    </div>
                    <div className="date-calendar-view">
                      <input 
                        type="date" 
                        className="manual-date" 
                        onChange={(e) => setFilters(prev => ({...prev, startDate: e.target.value.replace(/-/g,"")}))} 
                      />
                      <div className="datepicker-footer">
                        <button onClick={() => setShowDatePicker(false)}>Cancel</button>
                        <button className="select-btn" onClick={() => setShowDatePicker(false)}>Select</button>
                      </div>
                    </div>
                  </div>
                )}
              </th>
              <th>
                <div>Modality</div>
                <select name="modality" className="header-filter" value={filters.modality} onChange={handleFilterChange}>
                  <option value="">All</option>
                  {uniqueModalities.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </th>
              <th>
                <div>Gender</div>
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
            )))}
          </tbody>
        </table>
      </div>
    </MainLayout>
  );
}