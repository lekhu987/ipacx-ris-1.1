// src/pages/PatientList.js
import React, { useContext, useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../layout/MainLayout";
import "./PACSpage.css";
import { StudiesContext } from "../context/StudiesContext";

// Helper to get today in YYYYMMDD
function todayYYYYMMDD() {
  const d = new Date();
  return (
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

// Convert date input (YYYY-MM-DD) to YYYYMMDD
function dateInputToYYYYMMDD(value) {
  if (!value) return "";
  return value.replaceAll("-", "");
}

export default function PatientList() {
  const navigate = useNavigate();
  const { studies, loading } = useContext(StudiesContext);

  const [visibleStudies, setVisibleStudies] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // Filters
  const [filterPatientID, setFilterPatientID] = useState("");
  const [filterPatientName, setFilterPatientName] = useState("");
  const [filterAccession, setFilterAccession] = useState("");
  const [filterDescription, setFilterDescription] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterModality, setFilterModality] = useState("");
  const [sortDir, setSortDir] = useState("asc");
const TODAY_FILTER_KEY = "patientlist_auto_today_applied";


  // Only apply today’s filter on **first login** / first load
 useEffect(() => {
  if (loading || studies.length === 0) return;

  const alreadyApplied = sessionStorage.getItem(TODAY_FILTER_KEY);

  if (!alreadyApplied) {
    const today = todayYYYYMMDD();

    setVisibleStudies(studies.filter((s) => s.StudyDate === today));
    setFilterFromDate(new Date().toISOString().split("T")[0]);
    setFilterToDate(new Date().toISOString().split("T")[0]);

    sessionStorage.setItem(TODAY_FILTER_KEY, "true");
  } else {
    // user already interacted → keep ALL
    setVisibleStudies(studies);
  }
}, [studies, loading]);

function handleDateChange(e) {
  const v = e.target.value;

  // Clear date → show ALL (session only)
  if (!v) {
    setVisibleStudies(studies);
    setFilterFromDate("");
    setFilterToDate("");
    setCurrentPage(1);
    return;
  }

  // Select specific date
  setVisibleStudies(
    studies.filter((s) => s.StudyDate === dateInputToYYYYMMDD(v))
  );
  setFilterFromDate(v);
  setFilterToDate(v);
  setCurrentPage(1);
}

  // Quick helper: open AddPatient prefilled
  function openAddPatientPrefill(study) {
    const editEntry = {
      id: null,
      PatientID: study.PatientID || "",
      PatientName: study.PatientName || "",
      PatientSex: study.PatientSex || "",
      PatientAge: study.PatientAge || "",
      AccessionNumber: study.AccessionNumber || "",
      StudyDescription: study.StudyDescription || "",
      SchedulingDate: new Date().toISOString().split("T")[0],
      Modality: study.Modality || "",
      BodyPartExamined: (study.__raw && study.__raw.BodyPartExamined) || "",
      ReferringPhysician:
        (study.__raw && (study.__raw.ReferringPhysicianName || study.__raw.ReferringPhysician)) || "",
    };

    navigate("/add-patient", { state: { editEntry, fromPage: "patientlist" } });
  }

  // Filter + sorting
  const filtered = useMemo(() => {
    const from = dateInputToYYYYMMDD(filterFromDate);
    const to = dateInputToYYYYMMDD(filterToDate);

    const out = visibleStudies.filter((s) => {
      const dateOk = (!from || s.StudyDate >= from) && (!to || s.StudyDate <= to);

      return (
        s.PatientID.toLowerCase().includes(filterPatientID.toLowerCase()) &&
        s.PatientName.toLowerCase().includes(filterPatientName.toLowerCase()) &&
        s.AccessionNumber.toLowerCase().includes(filterAccession.toLowerCase()) &&
        s.StudyDescription.toLowerCase().includes(filterDescription.toLowerCase()) &&
        (filterGender === "" || s.PatientSex === filterGender) &&
        dateOk &&
        (filterModality === "" || s.Modality === filterModality)
      );
    });

    out.sort((a, b) => {
      const x = a.PatientName.toLowerCase();
      const y = b.PatientName.toLowerCase();
      return sortDir === "asc" ? x.localeCompare(y) : y.localeCompare(x);
    });

    return out;
  }, [
    visibleStudies,
    filterPatientID,
    filterPatientName,
    filterAccession,
    filterDescription,
    filterGender,
    filterFromDate,
    filterToDate,
    filterModality,
    sortDir,
  ]);

  // Viewer actions
  function openViewer(uid) {
    if (!uid) return;
    window.open(`http://192.168.1.34:8042/ohif/viewer?StudyInstanceUIDs=${uid}`, "_blank");
  }

  function openReport(uid) {
    if (!uid) return;
    navigate(`/create-report?study=${uid}`);
  }

  const goToAddPatient = () => navigate("/add-patient");

  function startResize(e, th) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = th.offsetWidth;

    function onMouseMove(eMove) {
      const diff = eMove.clientX - startX;
      th.style.width = `${Math.max(60, startWidth + diff)}px`;
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <MainLayout>
      <div className="patient-root">
        <div className="patient-quickbar">
          <button className="btn add-patient-btn" onClick={goToAddPatient}>
            ➕ Add Patient
          </button>
        </div>

        <div className="patient-table-wrap">
          {loading ? (
            <div className="patient-loading">Loading studies…</div>
          ) : (
            <div className="patient-table-scroll">
              <table className="patient-table">
                <thead>
                  <tr>
                    <th>#<div className="resize-handle" onMouseDown={(e) => startResize(e, e.currentTarget.parentElement)} /></th>
                    <th>Patient ID<div className="filter-box"><input value={filterPatientID} onChange={(e) => setFilterPatientID(e.target.value)} placeholder="Filter ID" /></div><div className="resize-handle" onMouseDown={(e) => startResize(e, e.currentTarget.parentElement)} /></th>
                    <th><span className="sortable" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}>Patient Name {sortDir === "asc" ? "▲" : "▼"}</span><div className="filter-box"><input value={filterPatientName} onChange={(e) => setFilterPatientName(e.target.value)} placeholder="Filter name" /></div><div className="resize-handle" onMouseDown={(e) => startResize(e, e.currentTarget.parentElement)} /></th>
                    <th>Accession<div className="resize-handle" onMouseDown={(e) => startResize(e, e.currentTarget.parentElement)} /></th>
                    <th>Study Description<div className="resize-handle" onMouseDown={(e) => startResize(e, e.currentTarget.parentElement)} /></th>
                    <th>Study Date<div className="filter-box"><input type="date" value={filterFromDate} onChange={handleDateChange} /></div><div className="resize-handle" onMouseDown={(e) => startResize(e, e.currentTarget.parentElement)} /></th>
                    <th>Modality<div className="filter-box"><select value={filterModality} onChange={(e) => setFilterModality(e.target.value)}><option value="">All</option><option>CT</option><option>MR</option><option>CR</option><option>US</option><option>DX</option></select></div><div className="resize-handle" onMouseDown={(e) => startResize(e, e.currentTarget.parentElement)} /></th>
                    <th>Gender<div className="filter-box"><select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}><option value="">All</option><option value="M">M</option><option value="F">F</option><option value="O">O</option></select></div><div className="resize-handle" onMouseDown={(e) => startResize(e, e.currentTarget.parentElement)} /></th>
                    <th>Age<div className="resize-handle" onMouseDown={(e) => startResize(e, e.currentTarget.parentElement)} /></th>
                    <th>Actions<div className="resize-handle" onMouseDown={(e) => startResize(e, e.currentTarget.parentElement)} /></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan="10" className="empty-row">No studies found</td></tr>
                  ) : (
                    filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((s, idx) => (
                      <tr key={s.StudyInstanceUID || idx}>
                        <td>{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                        <td>{s.PatientID}</td>
                        <td className="break">{s.PatientName}</td>
                        <td>{s.AccessionNumber}</td>
                        <td className="break">{s.StudyDescription}</td>
                        <td>{s.StudyDate || "N/A"}</td>
                        <td>{s.Modality}</td>
                        <td>{s.PatientSex}</td>
                        <td>{s.PatientAge}</td>
                        <td className="actions">
                          <button className="icon-btn" onClick={() => openViewer(s.StudyInstanceUID)}>👁️</button>
                          <button className="icon-btn" onClick={() => openReport(s.StudyInstanceUID)}>📝</button>
                          <button className="icon-btn" onClick={() => openAddPatientPrefill(s)}>📤</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="pagination-corner">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Prev</button>
              <span className="page-number">Page {currentPage} / {Math.ceil(filtered.length / rowsPerPage)}</span>
              <button disabled={currentPage === Math.ceil(filtered.length / rowsPerPage)} onClick={() => setCurrentPage(currentPage + 1)}>Next</button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}