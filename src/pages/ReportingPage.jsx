// src/pages/ReportingPage.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import MainLayout from "../layout/MainLayout";
import { useNavigate, useLocation } from "react-router-dom";
import { StudiesContext } from "../context/StudiesContext";
import "./ReportingPage.css";
import ReportPrintLayout from "../components/ReportPrintLayout.jsx";

const rowsPerPage = 20;

function dateInputToYYYYMMDD(v) {
  if (!v) return "";
  return v.replaceAll("-", "");
}

function getTodayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function getPastDateInput(days) {
  const past = new Date();
  past.setDate(past.getDate() - days);
  return past.toISOString().slice(0, 10);
}

function formatDateShort(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function ReportingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { studies: allStudies, loading: loadingStudies } = useContext(StudiesContext);

  const [showTable, setShowTable] = useState(false);
  const [savedReports, setSavedReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterModality, setFilterModality] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [previewReport, setPreviewReport] = useState(null);

  const [selectedReports, setSelectedReports] = useState([]);
const toggleSelectReport = (report) => {
  setSelectedReports([report.id]); // always replace with the clicked report
};

const handlePrintReport = () => {
  if (selectedReports.length === 0) return;

  const reportId = selectedReports[0]; // only one allowed
  window.open(
    `http://localhost:5000/api/reports/${reportId}/pdf/print`,
    "_blank"
  );
};
useEffect(() => {
  // Default filter: last 7 days
  setFilterFromDate(getPastDateInput(7));
  setFilterToDate(getTodayDateInput());
}, []);

const openAddendumPage = async () => {
  if (selectedReports.length === 0) return;

  const originalReport = savedReports.find(r => r.id === selectedReports[0]);
  if (!originalReport) return;

  // Directly navigate to report panel with addendum prefetch
  navigate(`/report-panel?study=${encodeURIComponent(originalReport.study_uid)}`, {
    state: {
      isAddendum: true,
      originalReportId: originalReport.id,
      parentReport: originalReport,
    },
  });
};


  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error("Failed to load reports");
      const reports = await res.json();

      const uniqStudyUIDs = Array.from(new Set(reports.map(r => r.study_uid).filter(Boolean)));
      const studyMap = {};
      await Promise.all(
        uniqStudyUIDs.map(async (uid) => {
          try {
            const sr = await fetch(`/api/studies/${encodeURIComponent(uid)}`);
            if (!sr.ok) return;
            studyMap[uid] = await sr.json();
          } catch {}
        })
      );

      const enriched = reports.map(r => {
  const study = studyMap[r.study_uid];

  // Determine proper status
  let displayStatus = r.status; // default from API
  if (r.addendum_index > 0) displayStatus = "Addendum"; // only override if truly an addendum

  return {
    ...r,
    patient_name: r.addendum_index > 0 ? `${r.patient_name} (${r.addendum_index})` : r.patient_name,
    accession_number: r.accession_number || study?.AccessionNumber || "",
    modality: r.modality || study?.Modality || "",
    study_date: study?.StudyDate || r.created_at,
    status: displayStatus, // <- use computed status
  };
});

      setSavedReports(enriched);
    } catch (err) { console.error(err); } finally { setLoadingReports(false); }
  };

  useEffect(() => { fetchReports(); }, []);
  
  useEffect(() => {
    if (location.state?.refreshReports) {
      fetchReports();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const reportStats = useMemo(() => {
    const totalReports = savedReports.length;
    const draftReports = savedReports.filter(r => r.status === "Draft").length;
    const finalReports = savedReports.filter(r => r.status === "Final").length;
    const addendumReports = savedReports.filter(r => r.status === "Addendum").length;
    const today = new Date().toISOString().slice(0, 10);
    const todayReports = savedReports.filter(r => r.created_at?.startsWith(today)).length;
    return { totalReports, draftReports, finalReports, addendumReports, todayReports };
  }, [savedReports]);

  const currentData = showTable ? allStudies || [] : savedReports || [];
 const filtered = useMemo(() => {
  const lower = searchText.trim().toLowerCase();
  const from = dateInputToYYYYMMDD(filterFromDate);
  const to = dateInputToYYYYMMDD(filterToDate);

  return currentData.filter((s) => {
    // Use created_at for reports, StudyDate for PACS
    const reportDateStr = showTable
      ? s.StudyDate?.replaceAll("-", "") || ""
      : s.created_at?.replaceAll("-", "").slice(0, 8) || "";
    const dateOk = (!from || reportDateStr >= from) && (!to || reportDateStr <= to);

    const searchOk = !lower ||
      (s.PatientName?.toLowerCase().startsWith(lower)) ||
      (s.PatientID?.toString().toLowerCase().startsWith(lower)) ||
      (s.patient_name?.toLowerCase().startsWith(lower)) ||
      (s.patient_id?.toString().toLowerCase().startsWith(lower));

    const modalityOk = !filterModality || (s.Modality === filterModality || s.modality === filterModality);
    const genderOk = !filterGender || (s.PatientSex === filterGender || s.patient_sex === filterGender);
    const statusOk = showTable || !filterStatus || (s.status === filterStatus);

    return dateOk && searchOk && modalityOk && genderOk && statusOk;
  });
}, [currentData, searchText, filterFromDate, filterToDate, filterModality, filterGender, filterStatus, showTable]);


  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleClearFilters = () => {
    setSearchText(""); setFilterFromDate(""); setFilterToDate(""); setFilterModality(""); setFilterGender(""); setFilterStatus(""); setCurrentPage(1);
    setSelectedReports([]);
    if (showTable) { setFilterFromDate(getPastDateInput(30)); setFilterToDate(getTodayDateInput()); }
  };

  const handleSingleDateChange = (e) => {
    const v = e.target.value;
    if (!v) { setFilterFromDate(""); setFilterToDate(""); setCurrentPage(1); return; }
    setFilterFromDate(v); setFilterToDate(v); setCurrentPage(1);
  };

  const modalityOptions = useMemo(() => {
    const set = new Set(["CT", "MR", "CR", "US", "DX"]);
    (allStudies || []).forEach(s => { if (s.Modality && s.Modality !== "N/A") set.add(s.Modality); });
    return [...set].sort();
  }, [allStudies]);

  const toggleViewMode = (isAddingNew = false) => {
    handleClearFilters();
    setShowTable(isAddingNew);
    if (isAddingNew) { setFilterFromDate(getPastDateInput(30)); setFilterToDate(getTodayDateInput()); }
  };

  function ReportPreviewModal({ report, onClose }) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
        <div style={{ background: "#fff", width: "80%", height: "90%", overflowY: "auto", position: "relative", padding: 20 }}>
          <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "#ff4d4d", color: "#fff", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer" }}>✖</button>
          {/* Print Layout will handle status=Addendum label */}
          <ReportPrintLayout report={report} />
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="reporting-page">
        <div className="patient-root">
          <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <h2 style={{ margin: 10 }}>{showTable ? "Select Study for New Report" : "Reports Dashboard"}</h2>
            {!showTable ? (
              <button className="btn add-report-btn" onClick={() => toggleViewMode(true)}>➕ Add New Report</button>
            ) : (
              <button className="btn back-btn" onClick={() => toggleViewMode(false)}>⬅️ Back to Saved Reports</button>
            )}
          </div>

          {!showTable && (
            <>
              <div className="report-summary-cards">
                <div className="card total-card" onClick={() => setFilterStatus("")}><h3>Total reports</h3><p className="count">{reportStats.totalReports}</p></div>
                <div className="card draft-card" onClick={() => setFilterStatus("Draft")}><h3>Drafts</h3><p className="count">{reportStats.draftReports}</p></div>
                <div className="card final-card" onClick={() => setFilterStatus("Final")}><h3>Final</h3><p className="count">{reportStats.finalReports}</p></div>
                
                <div className="card today-card">
    <h3>Today</h3>
    <p className="count">{reportStats.todayReports}</p>
  </div>
              </div>

              <div className="patient-quickbar" style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 6, marginRight: 4 }}>
                  <button className="icon-btn" title="Addendum" disabled={selectedReports.length !== 1} onClick={openAddendumPage}>📝</button>
                  <button className="icon-btn" title="Send/Download" disabled={selectedReports.length === 0}>📥</button>
                  <button
  className="icon-btn"
  title="Print"
  disabled={selectedReports.length === 0}
  onClick={handlePrintReport}
>
  🖨️
</button>

                </div>

                <input type="text" placeholder="Search Patient..." value={searchText} onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }} style={{ padding: '6px 8px', width: 160 }} />
                
                <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} style={{ padding: 6 }}>
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Final">Final</option>
                  <option value="Addendum">Addendum</option>
                </select>

                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: "0.85rem" }}>From:</span>
                  <input type="date" value={filterFromDate} onChange={(e) => { setFilterFromDate(e.target.value); setCurrentPage(1); }} style={{ padding: 5 }} />
                  <span style={{ fontSize: "0.85rem" }}>To:</span>
                  <input type="date" value={filterToDate} onChange={(e) => { setFilterToDate(e.target.value); setCurrentPage(1); }} style={{ padding: 5 }} />
                </div>

                <button className="btn" onClick={handleClearFilters} style={{ padding: '4px 12px', minWidth: '34px', fontWeight: 'bold' }}>✖</button>
              </div>

              <div className="patient-table-wrap">
                <div className="patient-table-scroll">
                  <table className="patient-table">
                    <thead>
                      <tr><th>#</th><th>Patient ID</th><th>Patient Name</th><th>Modality</th><th>Accession No</th><th>Study Date</th><th>Reported Date</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {paginated.map((r, index) => (
                        <tr key={r.id}>
                          <td>
  <input
    type="checkbox"
    checked={selectedReports.includes(r.id)}
    onChange={() => toggleSelectReport(r)}
    style={{ marginRight: 6 }}
  />
  {(currentPage - 1) * rowsPerPage + index + 1}
</td>

                          <td>{r.patient_id}</td>
                          <td>{r.patient_name}</td>
                          <td>{r.modality}</td>
                          <td>{r.accession_number}</td>
                          <td>{r.study_date}</td>
                          <td>{formatDateShort(r.created_at)}</td>
                          <td><span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                         <td>
  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
    {r.status === "Draft" ? (
      <button 
        className="icon-btn" 
        title="Edit" 
        onClick={() => navigate(`/report-panel?study=${r.study_uid}`)}
      >
        ✏️
      </button>
    ) : (
      <button
        className="icon-btn"
        title="Preview Report"
        onClick={() => {
          // Changed from /study/:study_uid to /:id
          window.open(
            `http://localhost:5000/api/reports/${r.id}/pdf`,
            "_blank"
          );
        }}
      >
        📄
      </button>
    )}
  </div>
</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length > rowsPerPage && (
                  <div className="pagination-corner">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Prev</button>
                    <span className="page-number">Page {currentPage} of {Math.ceil(filtered.length / rowsPerPage)}</span>
                    <button disabled={currentPage >= Math.ceil(filtered.length / rowsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
                  </div>
                )}
              </div>
            </>
          )}

          {showTable && (
            <>
              <div className="patient-quickbar" style={{ display: "flex", gap: 10, marginBottom: 15, alignItems: "center" }}>
                <input type="text" placeholder="Search PACS..." value={searchText} onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }} style={{ padding: 6, width: 260 }} />
                <button className="btn" onClick={handleClearFilters} style={{ padding: '4px 12px', fontWeight: 'bold' }}>✖</button>
              </div>
              <div className="patient-table-wrap">
                <div className="patient-table-scroll">
                  <table className="patient-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Patient ID</th><th>Patient Name</th><th>Accession</th><th>Study Description</th>
                        <th>Study Date<div className="filter-box"><input type="date" value={filterFromDate} onChange={handleSingleDateChange} /></div></th>
                        <th>Modality<div className="filter-box"><select value={filterModality} onChange={(e) => { setFilterModality(e.target.value); setCurrentPage(1); }}><option value="">All</option>{modalityOptions.map(m => (<option key={m} value={m}>{m}</option>))}</select></div></th>
                        <th>Gender<div className="filter-box"><select value={filterGender} onChange={(e) => { setFilterGender(e.target.value); setCurrentPage(1); }}><option value="">All</option><option value="M">M</option><option value="F">F</option><option value="O">O</option></select></div></th>
                        <th>Age</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((s, idx) => (
                        <tr key={s.StudyInstanceUID || idx}>
                          <td>{(currentPage - 1) * rowsPerPage + idx + 1}</td><td>{s.PatientID}</td><td>{s.PatientName}</td><td>{s.AccessionNumber}</td><td>{s.StudyDescription}</td><td>{s.StudyDate}</td><td>{s.Modality}</td><td>{s.PatientSex}</td><td>{s.PatientAge}</td>
                          <td><button className="icon-btn" onClick={() => navigate(`/report-panel?study=${encodeURIComponent(s.StudyInstanceUID)}`)}>📝</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length > rowsPerPage && (
                  <div className="pagination-corner">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Prev</button>
                    <span className="page-number">Page {currentPage} of {Math.ceil(filtered.length / rowsPerPage)}</span>
                    <button disabled={currentPage >= Math.ceil(filtered.length / rowsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {previewReport && <ReportPreviewModal report={previewReport} onClose={() => setPreviewReport(null)} />}
    </MainLayout>
  );
}