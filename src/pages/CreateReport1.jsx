// CreateReport.jsx
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import "./CreateReport.css";

/* ===========================
   RichEditor: sends its DOM node onFocus and calls onSelectionChange
   so parent can track active editor + selection range
   =========================== */
function RichEditor({ value, onChange, onFocus, onSelectionChange, placeholder }) {
  const ref = useRef();

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  // Save selection when user selects inside editor
  const handleSelectionChange = () => {
    try {
      if (typeof onSelectionChange === "function") onSelectionChange();
    } catch {}
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => {
        if (typeof onFocus === "function") onFocus(ref.current);
        // small delay to allow browser selection to settle
        setTimeout(handleSelectionChange, 0);
      }}
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      onMouseUp={handleSelectionChange}
      onKeyUp={handleSelectionChange}
      onTouchEnd={handleSelectionChange}
      style={{
        minHeight: 100,
        padding: 8,
        border: "1px solid #aaa",
        backgroundColor: "#fff",
        fontFamily: "inherit",
        overflowY: "auto",
        whiteSpace: "pre-wrap",
      }}
      data-placeholder={placeholder}
    />
  );
}

/* ===========================
   ReportTitle (small contentEditable)
   =========================== */
function ReportTitle({ value, onChange, onManualEdit }) {
  const ref = useRef();

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value || "";
    }
  }, [value]);

  return (
    <div
      ref={ref}
      className="report-title"
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => {
        onChange(e.currentTarget.innerText);
        onManualEdit(); // ✅ user finished typing
      }}
      style={{
        fontWeight: "bold",
        fontSize: "14px",
        padding: "4px 0",
        minHeight: 24,
      }}
    />
  );
}


/* ===========================
   Helpers
   =========================== */
const cleanPatientName = (name) => (name ? name.replace(/\^/g, " ").trim() : "");
const formatDicomDateTime = (date, time) => {
  if (!date || !time) return "";
  const d = date.trim();
  const t = time.trim().padEnd(6, "0").substring(0, 6);
  const iso = `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(
    6,
    8
  )}T${t.substring(0, 2)}:${t.substring(2, 4)}:${t.substring(4, 6)}`;
  return new Date(iso).toLocaleString();
};
const formatDateTime = (date) => {
  try {
    return new Date(date).toLocaleString();
  } catch {
    return date;
  }
};
const extractAgeGender = (rawName, rawAge, rawSex) => {
  let name = rawName || "";
  let age = "";
  let gender = "";

  // 1️⃣ DICOM style parsing (^ separated)
  if (name.includes("^")) {
    const parts = name.split("^").map(p => p.trim());
    const nameParts = [];

    for (const p of parts) {
      // Match age/gender like 27Y/F
      const agMatch = p.match(/^(\d{1,3})Y?\/([MFO])$/i);
      if (agMatch) {
        age = agMatch[1];
        gender = agMatch[2].toUpperCase();
        continue;
      }

      // Match age only like 27Y
      const ageMatch = p.match(/^(\d{1,3})Y$/i);
      if (ageMatch) {
        age = ageMatch[1];
        continue;
      }

      // Match gender only like M/F/O
      const genderMatch = p.match(/^([MFO])$/i);
      if (genderMatch) {
        gender = genderMatch[1].toUpperCase();
        continue;
      }

      // Otherwise, part of name
      nameParts.push(p);
    }

    name = nameParts.join(" ").trim();
  }

  // 2️⃣ Plain text parsing for formats like "NAME 24Y/M"
  if (!age || !gender) {
    const plainMatch = name.match(/(\d{1,3})Y?\/([MFO])/i);
    if (plainMatch) {
      age = age || plainMatch[1];
      gender = gender || plainMatch[2].toUpperCase();
      name = name.replace(plainMatch[0], "").trim();
    }
  }

  // 3️⃣ Fallback to rawAge/rawSex fields
  if (!age && rawAge) age = rawAge;
  if (!gender && rawSex && rawSex !== "O") gender = rawSex;

  // 4️⃣ Final clean name
  name = name.replace(/\^/g, " ").replace(/\s+/g, " ").trim();
  if (!name) name = "N/A";

  // Return standardized object
  return {
    name,
    age: age || "N/A",
    gender: gender || "N/A",
  };
};


const viewer = document.getElementById("viewerPanel");
const arrows = document.querySelector(".panel-arrows");

function updateArrowPosition() {
  const viewerWidth = viewer.offsetWidth;
  arrows.style.left = `${viewerWidth - 10}px`; // always stick to boundary
}


function WordColorPicker({ onSelect }) {
  const automaticColor = "#000000";

  const themeColors = [
    ["#ffffff", "#f2f2f2", "#d9d9d9", "#bfbfbf", "#7f7f7f"],
    ["#000000", "#7f7f7f", "#595959", "#3f3f3f", "#262626"],
    ["#4472c4", "#8eaadb", "#b4c6e7", "#c9daf8", "#ddebf7"],
    ["#ed7d31", "#f4b183", "#f7caac", "#f8dfd0", "#fce5cd"],
    ["#ffc000", "#ffd966", "#ffe699", "#fff2cc", "#fff3cd"],
    ["#70ad47", "#a9d18e", "#c6e0b4", "#e2efda", "#e9f7ef"],
  ];

  const standardColors = [
    "#c00000",
    "#ff0000",
    "#ffc000",
    "#ffff00",
    "#92d050",
    "#00b050",
    "#00b0f0",
    "#0070c0",
    "#002060",
    "#7030a0",
  ];

  return (
    
    <div className="word-color-menu" style={{ padding: 8, background: "#fff", border: "1px solid #ccc", borderRadius: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.12)" }}>
      <div
        className="color-option automatic"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(automaticColor)}
        style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, cursor: "pointer" }}
      >
        <div style={{ width: 18, height: 14, background: automaticColor, border: "1px solid #999" }} />
        <div style={{ fontSize: 12 }}>Automatic</div>
      </div>

      <div style={{ fontSize: 11, marginBottom: 6 }}>Theme Colors</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {themeColors.map((col, ci) => (
          <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {col.map((color, ri) => (
              <div
                key={ri}
                className="swatch"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(color)}
                style={{
                  width: 20,
                  height: 14,
                  backgroundColor: color,
                  border: "1px solid #ccc",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, marginBottom: 6 }}>Standard Colors</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {standardColors.map((c, i) => (
          <div
            key={i}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(c)}
            style={{
              width: 20,
              height: 20,
              backgroundColor: c,
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ===========================
   Main CreateReport component
   =========================== */
export default function CreateReport() {
  const [searchParams] = useSearchParams();
  const studyUID = searchParams.get("study");
  const navigate = useNavigate();
const defaultStudy = {
    PatientName: "",
    PatientAge: "",
    PatientSex: "",
    ReferringPhysicianName: "",
    BodyPartExamined: "",
    PatientID: "",
    StudyDate: "",
    StudyTime: "",
    Modality: "",
    AccessionNumber: "",
    History: "",
    Findings: "",
    Conclusion: "",
    ReportedBy: "",
    ApprovedBy: "",
    ReportStatus: "",
  };
   const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [study, setStudy] = useState(defaultStudy);
  const [history, setHistory] = useState("");
  const [findings, setFindings] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [keyImages, setKeyImages] = useState([]);
  const [showKeyImages, setShowKeyImages] = useState(false);
  const [reportTitle, setReportTitle] = useState("CT REPORT");
  const [loading, setLoading] = useState(true);
  const reportRef = useRef(null);
  const fileInputRef = useRef(null);
  const reportedByRef = useRef(null);
  const approvedByRef = useRef(null);
  const activeEditorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const refDoctorRef = useRef(null);
const bodyPartRef = useRef(null);
const [viewerMinimized, setViewerMinimized] = useState(false);
const [reportMinimized, setReportMinimized] = useState(false);
const [isManualTitle, setIsManualTitle] = useState(false);
const [editRefDoctor, setEditRefDoctor] = useState(false);
const [editBodyPart, setEditBodyPart] = useState(false);
const [templates, setTemplates] = useState([]);
const [showTemplateMenu, setShowTemplateMenu] = useState(false);

// template
useEffect(() => {
  if (!study.Modality || !study.BodyPartExamined) return;

  fetch("http://localhost:5000/api/report-templates")
    .then(res => res.json())
    .then(data => {
      const bodyPart = study.BodyPartExamined.trim().toLowerCase();
      const modality = study.Modality.trim();

      // 1️⃣ First look for exact "plain" template
      const plainTemplate = data.filter(t =>
        t.modality === modality &&
        t.body_part.toLowerCase() === `${bodyPart}_plain` &&
        t.is_active
      );

      // 2️⃣ If no "plain" template, fall back to normal template
      const filtered = plainTemplate.length > 0
        ? plainTemplate
        : data.filter(t =>
            t.modality === modality &&
            t.body_part.toLowerCase() === bodyPart &&
            t.is_active
          );

      setTemplates(filtered);
    })
    .catch(err => console.error("Template load error", err));
}, [study.Modality, study.BodyPartExamined]);

const applyTemplate = (template) => {
  if (!template || !template.content) return;

  // Apply history, findings, conclusion if present
  if (template.content.history) setHistory(template.content.history);
  if (template.content.findings) setFindings(template.content.findings);
  if (template.content.conclusion) setConclusion(template.content.conclusion);

  alert(`Template applied: ${template.template_name}`);
  setShowTemplateMenu(false);
};


  // Sync ReportedBy span after study state changes
useEffect(() => {
  if (reportedByRef.current && reportedByRef.current.textContent !== study.ReportedBy) {
    reportedByRef.current.textContent = study.ReportedBy || "";
  }
}, [study.ReportedBy]);

// Sync ApprovedBy span after study state changes
useEffect(() => {
  if (approvedByRef.current && approvedByRef.current.textContent !== study.ApprovedBy) {
    approvedByRef.current.textContent = study.ApprovedBy || "";
  }
}, [study.ApprovedBy]);

  const endpoints = [
    (u) => `/api/studies/${u}`,
    (u) => `/api/study/${u}`,
    (u) => `/studies/${u}`,
    (u) => `/api/studies?id=${u}`,
    (u) => `http://localhost:5000/api/studies/${u}`,
    (u) => `http://localhost:5000/api/study/${u}`,
  ];

 /* ===========================
        Load report and prefill
     ========================== */
 useEffect(() => {
   if (!studyUID) return;
 
   const loadStudyAndReport = async () => {
     try {
       // 1️⃣ Load study info
       const studyRes = await fetch(`http://localhost:5000/api/studies/${studyUID}`);
       const studyData = (await studyRes.json()) || {};
 
       // 2️⃣ Load report (draft/final)
       const reportRes = await fetch(`/api/reports/by-study/${studyUID}`);
       let reportData = null;
       if (reportRes.ok) {
         try {
           reportData = await reportRes.json();
         } catch {
           reportData = null;
         }
       }
 
       const reportContent = reportData?.report_content || {};
 
       // 3️⃣ Update state
       setStudy({
         PatientName: studyData.PatientName || studyData.patient_name || "",
         PatientAge: studyData.PatientAge || studyData.patient_age || "",
         PatientSex: studyData.PatientSex || studyData.patient_sex || "",
         PatientID: studyData.PatientID || studyData.patient_id || "",
         AccessionNumber: studyData.AccessionNumber || studyData.accession_number || "",
         Modality: studyData.Modality || studyData.modality || "",
         StudyDate: studyData.StudyDate || studyData.study_date || "",
         StudyTime: studyData.StudyTime || studyData.study_time || "",
         ReferringPhysicianName: reportData?.referring_doctor || studyData.ReferringPhysicianName || studyData.referring_physician || "",
         BodyPartExamined: reportData?.body_part || studyData.BodyPartExamined || studyData.body_part || "",
         ReportedBy: reportData?.reported_by || "",
         ApprovedBy: reportData?.approved_by || "",
         ReportStatus: reportData?.status || "",
       });
       setIsLoadingReport(false);
 
       setHistory(reportContent.history || "");
       setFindings(reportContent.findings || "");
       setConclusion(reportContent.conclusion || "");
 
       // 4️⃣ Load key images if present
       if (Array.isArray(reportData?.images) && reportData.images.length > 0) {
         const loadedImages = reportData.images.map(img =>
           img.image_path.startsWith("http") ? img.image_path : `http://localhost:5000${img.image_path}`
         );
         setKeyImages(loadedImages);
         setShowKeyImages(true);
       } else {
         setKeyImages([]);
         setShowKeyImages(false);
       }
 
     } catch (err) {
       console.error("Failed to load study/report", err);
 
       // fallback to empty/defaults
       setStudy(prev => ({
         ...prev,
         ReportStatus: "Draft",
         ReportedBy: prev.ReportedBy || "",
         ApprovedBy: prev.ApprovedBy || "",
       }));
       setReportTitle("CT REPORT");
       setHistory("");
       setFindings("");
       setConclusion("");
       setKeyImages([]);
       setShowKeyImages(false);
     } finally {
       setLoading(false);
     }
   };
 
   loadStudyAndReport();
 }, [studyUID]);
 
 useEffect(() => {
   if (isLoadingReport) return;        // 🔴 STOP during load
   if (isManualTitle) return;
 
   const modality = study.Modality?.trim();
   const bodyPart = study.BodyPartExamined?.trim();
 
   if (!modality) return;
 
   const title = `${modality}${bodyPart ? " " + bodyPart : ""} REPORT`;
   setReportTitle(title);
 }, [study.Modality, study.BodyPartExamined, isManualTitle, isLoadingReport]);
 
  /* ===========================
        Handle file uploads
     ========================== */
 const handleFiles = async (files) => {
  const imageFiles = [...files].filter((f) => f.type.startsWith("image/"));
  if (!imageFiles.length) return;

  const formData = new FormData();

  // 🔑 REQUIRED
  formData.append("studyUID", studyUID);

  imageFiles.forEach((f) => formData.append("images", f));

  try {
    const res = await fetch("/api/reports/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      setKeyImages((prev) => [
        ...prev,
        ...data.paths.map(
          (p) => `http://localhost:5000${p}`
        ),
      ]);
       
    }
  } catch (err) {
    console.error("Image upload failed", err);
    alert("Failed to upload images");
  }
};

  /* ===========================
        Save report (Draft / Final)
     ========================== */
const handleSaveReport = async (status) => {
  setStudy((prev) => ({ ...prev, ReportStatus: status })); // update immediately

  const payload = {
    study_uid: studyUID,
    accession_number: study.AccessionNumber,
    patient_id: study.PatientID,
    patient_name: study.PatientName,
    modality: study.Modality,
    reported_by: study.ReportedBy,
    approved_by: study.ApprovedBy,
    status, // <- send current status to backend
    history,
    findings,
    conclusion,
    referring_doctor: study.ReferringPhysicianName,
    body_part: study.BodyPartExamined,
    image_paths: keyImages.map((url) => url.replace("http://localhost:5000", "")),
  };

  try {
    const res = await fetch("/api/reports/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      alert(`Report saved as ${status}`);
    }
  } catch (err) {
    console.error("Save report error", err);
    alert("Failed to save report");
  }
};

  /* ==============
     PDF export
     ============== */
  const savePDF = async () => {
    if (!reportRef.current) return;

    const el = reportRef.current;
    const origHeight = el.style.height;
    const origOverflow = el.style.overflow;
    el.style.height = "auto";
    el.style.overflow = "visible";

    const imgs = [...el.querySelectorAll("img")];
    await Promise.all(
      imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => (i.onload = i.onerror = r))))
    );

    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, "PNG", 0, 0, w, h);

    const pageHeight = pdf.internal.pageSize.getHeight();
    if (h > pageHeight) {
      let remaining = h;
      let offset = 0;
      pdf.deletePage(1);
      while (remaining > 0) {
        pdf.addPage();
        pdf.addImage(img, "PNG", 0, -offset, w, h);
        offset += pageHeight;
        remaining -= pageHeight;
      }
    }

    pdf.save(`${study?.PatientName || "Report"}.pdf`);

    el.style.height = origHeight;
    el.style.overflow = origOverflow;
  };

  /* ============
     Selection utilities
     ============ */
  const saveSelection = () => {
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.rangeCount > 0) {
      try {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      } catch (e) {
        savedRangeRef.current = null;
      }
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    if (savedRangeRef.current) {
      try {
        sel.addRange(savedRangeRef.current);
      } catch {
        // ignore
      }
    }
  };

  // exec with selection restore (works for foreColor etc)
  const exec = (cmd, val = null) => {
    // try to restore selection first
    restoreSelection();
    // ensure styleWithCSS so color uses inline style
    try {
      document.execCommand("styleWithCSS", false, true);
    } catch {}
    try {
      document.execCommand(cmd, false, val);
    } catch (e) {
      console.warn("exec failed", cmd, val, e);
    }
    // after exec, update savedRangeRef (so future ops keep correct range)
    saveSelection();
  };

  // toolbar definition
  const toolbar = [
    { type: "bold", icon: "B" },
    { type: "italic", icon: "I" },
    { type: "underline", icon: "U" },
    { type: "insertOrderedList", icon: "OL" },
    { type: "insertUnorderedList", icon: "UL" },
  ];

  /* ================
     Active editor handlers passed to RichEditor
     ================ */
  const handleEditorFocus = (domNode) => {
    activeEditorRef.current = domNode;
    // save selection at focus
    setTimeout(saveSelection, 0);
  };

  const handleEditorSelectionChange = () => {
    // whenever selection inside an editor changes, capture it
    saveSelection();
  };

  /* ====================
     Color picker apply handler
     ==================== */
  const applyColor = (color) => {
    // restore selection and apply
    restoreSelection();
    try {
      document.execCommand("styleWithCSS", false, true);
    } catch {}
    try {
      document.execCommand("foreColor", false, color);
    } catch (e) {
      console.warn("foreColor failed:", e);
    }
    setShowColorPalette(false);
    // update saved selection
    saveSelection();
  };

  if (loading) return <p style={{ padding: 12 }}>Loading…</p>;

  const { name: patientName, age, gender } = extractAgeGender(
    study.PatientName,
    study.PatientAge,
    study.PatientSex
  );

  return (
    <div className="split-layout" style={{ display: "flex", height: "100vh", position: "relative", fontFamily: "'Times New Roman', Times, serif" }}>
      {/* Viewer Panel */}
      <div
        id="viewerPanel"
        style={{
          width: viewerMinimized ? "10%" : reportMinimized ? "90%" : "50%",
          transition: "width 0.3s ease",
          height: "100%",
          borderRight: "2px solid #ccc",
        }}
      >
        <iframe
          title="OHIF Viewer"
          src={
            studyUID
              ? `http://192.168.1.34:8042/ohif/viewer?StudyInstanceUIDs=${encodeURIComponent(studyUID)}`
              : ""
          }
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </div>

      {/* Middle controls (arrows) - left here but you told you moved focus to KeyImages so can hide or keep */}
      <div
  className="panel-arrows"
  style={{
    position: "absolute",
    top: "50%",
    left: viewerMinimized ? "10%" : reportMinimized ? "90%" : "50%", // dynamic based on widths
    transform: "translate(-50%, -50%)",
    zIndex: 10,
    display: "flex",
    gap: 4
  }}
>

        <button className="arrow" onClick={() => { setReportMinimized(false); setViewerMinimized(true); }} style={{ fontSize: 12, padding: "4px 6px" }}>&lt;&lt;</button>
        <button className="arrow" onClick={() => { setReportMinimized(false); setViewerMinimized(false); }} style={{ fontSize: 12, padding: "4px 6px", margin: 4 }}>&lt; &gt;</button>
        <button className="arrow" onClick={() => { setReportMinimized(true); setViewerMinimized(false); }} style={{ fontSize: 12, padding: "4px 6px" }}>&gt;&gt;</button>
      </div>

      {/* Report Panel */}
      <div
        ref={reportRef}
        id="reportPanel"
        style={{
          width: reportMinimized ? "10%" : viewerMinimized ? "90%" : "50%",
          transition: "width 0.3s ease",
          padding: 12,
          boxSizing: "border-box",
          height: "100%",
          overflowY: "auto",
        }}
      >
        <header style={{ display: "none" }} />

        {/* Toolbar row */}
        <div className="top-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <div className="editor-toolbar toolbar" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select title="Font size" onChange={(e) => exec("fontSize", e.target.value)} defaultValue="3" style={{ height: 28 }}>
              <option value="1">H6</option>
              <option value="2">H5</option>
              <option value="3">H4</option>
              <option value="4">H3</option>
              <option value="5">H2</option>
              <option value="6">H1</option>
              <option value="7">H0</option>
            </select>

            <select title="Font family" onChange={(e) => exec("fontName", e.target.value)} defaultValue="Times New Roman" style={{ height: 28 }}>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Arial">Arial</option>
              <option value="Calibri">Calibri</option>
              <option value="Georgia">Georgia</option>
            </select>

            {/* Color picker button + palette */}
            <div style={{ position: "relative" }} onMouseLeave={() => {/* keep open/closing handled by click*/} }>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Save current selection before opening palette
                  saveSelection();
                  setShowColorPalette((s) => !s);
                }}
                style={{ height: 28 }}
              >
                A ▼
              </button>

              {showColorPalette && (
                <div style={{ position: "absolute", top: 34, left: 0 }}>
                  <WordColorPicker onSelect={(color) => applyColor(color)} />
                </div>
              )}
            </div>

            {/* toolbar buttons */}
            {toolbar.map((t) => (
              <button key={t.type} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec(t.type)} style={{ height: 28 }}>
                {t.icon}
              </button>
            ))}

            <div style={{ position: "relative" }}>
  <button
    type="button"
    className="template-btn"
    style={{ height: 28 }}
    onClick={() => setShowTemplateMenu(s => !s)}
  >
    Templates ▼
  </button>

  {showTemplateMenu && (
    <div
      style={{
        position: "absolute",
        top: 34,
        left: 0,
        background: "#fff",
        border: "1px solid #ccc",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        borderRadius: 6,
        width: 260,
        zIndex: 1000,
        maxHeight: 250,
        overflowY: "auto",
      }}
    >
      {templates.length === 0 ? (
        <div style={{ padding: 10, fontSize: 12, color: "#777" }}>
          No templates for {study.Modality} / {study.BodyPartExamined}
        </div>
      ) : (
        templates.map(t => (
          <div
            key={t.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              borderBottom: "1px solid #eee",
            }}
          >
            <span style={{ fontSize: 12 }}>
              {t.template_name}
            </span>

            <button
              title="Apply template"
              onClick={() => applyTemplate(t)}
              style={{
                background: "#198754",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "2px 8px",
                cursor: "pointer",
              }}
            >
              +
            </button>
          </div>
        ))
      )}
    </div>
  )}
</div>


            <button
              type="button"
              onClick={() => {
                // If not shown previously, show and open file dialog
                if (!showKeyImages) {
                  setShowKeyImages(true);
                  // open file dialog after a tick (so section is visible)
                  setTimeout(() => fileInputRef.current?.click(), 50);
                } else {
                  // if shown, open file dialog directly
                  fileInputRef.current?.click();
                }
              }}
              style={{ height: 28 }}
            >
              Key Images
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div style={{ fontWeight: "bold" }}>Status = {study.ReportStatus || ""}</div>

          <div className="status-buttons" style={{ display: "flex", gap: 6 }}>
            {/* DRAFT BUTTON: Calls handleSaveReport with "Draft" status */}
            <button 
              className="status-btn draft" 
              onClick={() => handleSaveReport("Draft")}
              style={{ padding: "6px 6px", borderRadius: 4, background: "#6c757d", color: "#fff" }}
            >
              Draft
            </button>
            
          {/* FINAL BUTTON: Calls handleSaveReport with "Final" status */}
           <button
  onClick={() => handleSaveReport("Final")}
  disabled={!study.ApprovedBy} // safe check
  style={{
    cursor: study.ApprovedBy ? "pointer" : "not-allowed",
    background: study.ApprovedBy ? "#198754" : "#6c757d", padding: "6px 6px", borderRadius: 4,
  }}
>
  Final
</button>
<button
  className="status-btn close"
  onClick={() => navigate(-1)} // go back one step in history
  style={{
    padding: "6px 6px",
    borderRadius: 4,
    background: "#dc3545",
    color: "#fff"
  }}
>
  X
</button>

          </div>
        </div>
        </div>
         

       {/* Patient table */}
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
          <tbody>
            <tr>
              <td style={{ padding: 6, border: "1px solid #000" }}>
                <strong>Patient Name:</strong> {cleanPatientName(patientName)}
              </td>
              <td style={{ padding: 6, border: "1px solid #000" }}>
                <strong>Age/Gender:</strong> {age}/{gender}
              </td>
              <td style={{ padding: 6, border: "1px solid #000" }}>
                <strong>Patient ID:</strong> {study.PatientID}
              </td>
            </tr>

            <tr>
              <td style={{ padding: 6, border: "1px solid #000" }}>
                <strong>Study Date/Time:</strong>{" "}
                {formatDicomDateTime(study.StudyDate, study.StudyTime)}
              </td>
    <td style={{ padding: 6, border: "1px solid #000" }}>
  <strong>Ref. Doctor:</strong>{" "}
  {editRefDoctor ? (
    <input
      autoFocus
      value={study.ReferringPhysicianName || ""}
      onChange={(e) =>
        setStudy((p) => ({ ...p, ReferringPhysicianName: e.target.value }))
      }
      onBlur={() => setEditRefDoctor(false)}
      onKeyDown={(e) => e.key === "Enter" && setEditRefDoctor(false)}
      style={{ width: "70%" }}
    />
  ) : (
    <span
      onClick={() => setEditRefDoctor(true)}
      
    >
      {study.ReferringPhysicianName || "—"}
    </span>
  )}
</td>
              <td style={{ padding: 6, border: "1px solid #000" }}>
                <strong>Accession No:</strong> {study.AccessionNumber}
              </td>
            </tr>

            <tr>
              <td style={{ padding: 6, border: "1px solid #000" }}>
                <strong>Reported Date/Time:</strong> {formatDateTime(new Date())}
              </td>
              <td style={{ padding: 6, border: "1px solid #000" }}>
                <strong>Modality:</strong> {study.Modality}
              </td>
               
             <td style={{ padding: 6, border: "1px solid #000" }}>
  <strong>Body Part:</strong>{" "}
  {editBodyPart ? (
    <input
      autoFocus
      value={study.BodyPartExamined || ""}
      onChange={(e) =>
        setStudy((p) => ({ ...p, BodyPartExamined: e.target.value }))
      }
      onBlur={() => setEditBodyPart(false)}
      onKeyDown={(e) => e.key === "Enter" && setEditBodyPart(false)}
      style={{ width: "70%" }}
    />
  ) : (
    <span
      onClick={() => setEditBodyPart(true)}
      
    >
      {study.BodyPartExamined || "—"}
    </span>
  )}
</td>
            </tr>
          </tbody>
        </table>
<ReportTitle
  value={reportTitle}
  onChange={setReportTitle}
  onManualEdit={() => setIsManualTitle(true)}
/>
         {/* History */}
        <section className="section" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 12, marginBottom: 8 }}>History</h3>
          <RichEditor
            value={history}
            onChange={setHistory}
            onFocus={handleEditorFocus}
            onSelectionChange={handleEditorSelectionChange}
            placeholder="Enter history..."
          />
        </section>

        {/* Findings */}
        <section className="section" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 12, marginBottom: 8 }}>Findings</h3>
          <RichEditor
            value={findings}
            onChange={setFindings}
            onFocus={handleEditorFocus}
            onSelectionChange={handleEditorSelectionChange}
            placeholder="Enter findings..."
          />
        </section>

        {/* Key Images */}
        {showKeyImages && (
          <section className="section" style={{ marginBottom: 20 }}>
            <h3 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Key Images
              <button
                style={{ background: "transparent", border: "none", fontSize: 12, cursor: "pointer", color: "#555" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowKeyImages(false);
                  // keep current images or clear them depending on desired behaviour
                }}
              >
                ✕
              </button>
            </h3>

            {/* hidden input (will open when container clicked or "Key Images" clicked) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />

            <div
              className="key-images"
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
              onDragOver={(e) => e.preventDefault()}
              style={{
                border: "2px dashed #aaa",
                minHeight: 120,
                padding: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              {keyImages.length === 0 && <div style={{ color: "#666" }}>Click to add images or drag & drop</div>}
           {keyImages.map((src, i) => (
  <div
    key={i}
    className="key-image-item"
    style={{ position: "relative", width: 120, height: 120 }}
  >
   <img
  src={src}
  alt={`ki-${i}`}
  style={{
    width: "100%",
    height: "100%",
    objectFit: "contain",
    border: "1px solid #ddd",
    borderRadius: 6,
  }}
/>

    <button
      className="remove-btn"
      onClick={(e) => {
        e.stopPropagation();
        setKeyImages((prev) => prev.filter((_, idx) => idx !== i));
      }}
      style={{
        position: "absolute",
        top: 4,
        right: 4,
        background: "rgba(0,0,0,0.6)",
        color: "#fff",
        border: "none",
        borderRadius: "50%",
        width: 22,
        height: 22,
        cursor: "pointer",
      }}
    >
      ✕
    </button>
  </div>
))}

            </div>
          </section>
        )}

        {/* Conclusion */}
        <section className="section" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 12, marginBottom: 8 }}>Conclusion</h3>
          <RichEditor
            value={conclusion}
            onChange={setConclusion}
            onFocus={handleEditorFocus}
            onSelectionChange={handleEditorSelectionChange}
            placeholder="Enter conclusion..."
          />
        </section>

      <footer className="footer-row" style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
  <div style={{ fontWeight: "bold", fontSize: 11 }}>
    Reported By:
    <span
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => setStudy(prev => ({ ...prev, ReportedBy: e.target.textContent || "" }))}
      style={{
        borderBottom: "1px solid #000",
        minWidth: 200,
        display: "inline-block",
        padding: "2px 5px",
      }}
    >
      {study.ReportedBy}
    </span>
  </div>

  <div style={{ fontWeight: "bold", fontSize: 11 }}>
    Approved By:
    <span
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => setStudy(prev => ({ ...prev, ApprovedBy: e.target.textContent || "" }))}
      style={{
        borderBottom: "1px solid #000",
        minWidth: 200,
        display: "inline-block",
        padding: "2px 5px",
      }}
    >
      {study.ApprovedBy}
    </span>
  </div>
</footer>


        <div className="buttons toolbar" style={{ marginTop: 12 }}>
          <button onClick={savePDF} style={{ padding: "8px 12px" }}>Save PDF</button>
          <button onClick={() => window.print()} style={{ padding: "8px 12px", marginLeft: 8 }}>Print</button>
        </div>
      </div>
    </div>
  );
}