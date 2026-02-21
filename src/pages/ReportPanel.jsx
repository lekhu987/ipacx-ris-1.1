// src/pages/ReportPanel.jsx 
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import "./ReportPanel.css";
import api from "../api/axios";
import DigitalSignatureField from "../components/DigitalSignatureField"; // adjust path

/* ===========================
      RichEditor component
   ========================== */
function RichEditor({
  value,
  onChange,
  onFocus,
  onSelectionChange,
  onKeyDown,
  placeholder,
  disabled = false,
  editorKey,
  compact = false,
  emptyMinHeight = 80,
  emptyPadding = 8,
  blockIndex,
}) {
  const ref = useRef();

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const empty = isEmptyHtml(value);

  return (
    <div
      className="rich-editor"
      ref={ref}
      data-editor={editorKey} 
      data-block-index={typeof blockIndex === "number" ? blockIndex : undefined}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onFocus={() => {
        if (!disabled && typeof onFocus === "function") {
          onFocus(ref.current);
          setTimeout(onSelectionChange, 0);
        }
      }}
      onInput={(e) => !disabled && onChange(e.currentTarget.innerHTML)}
      onKeyDown={!disabled && typeof onKeyDown === "function" ? (e) => onKeyDown(e, ref.current) : undefined}
      onBeforeInput={!disabled && typeof onKeyDown === "function" ? (e) => onKeyDown(e, ref.current) : undefined}
      onMouseUp={!disabled ? onSelectionChange : undefined}
      onKeyUp={!disabled ? onSelectionChange : undefined}
      style={{
        minHeight: compact ? (empty ? emptyMinHeight : 0) : 100,
        padding: compact ? (empty ? emptyPadding : 0) : 8,
        border: editorKey === "history" || editorKey === "findings" || editorKey === "conclusion" ? "none" : "1px solid #aaa",
        outline: "none",
        boxShadow: "none",
        backgroundColor: disabled ? "#f1f3f5" : "#fff",
        cursor: disabled ? "not-allowed" : "text",
        textAlign: editorKey === "history" || editorKey === "findings" || editorKey === "conclusion" ? "justify" : "left",
        textAlignLast: editorKey === "history" || editorKey === "findings" || editorKey === "conclusion" ? "left" : "auto",
      }}
      data-placeholder={placeholder}
    />
  );
}

function changeCase(caseType) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  if (!selectedText) return;

  let newText = selectedText;
  switch (caseType) {
    case "uppercase":
      newText = selectedText.toUpperCase();
      break;
    case "lowercase":
      newText = selectedText.toLowerCase();
      break;
    case "capitalize":
      newText = selectedText.replace(/\b\w/g, c => c.toUpperCase());
      break;
    default:
      break;
  }

  // Replace selection
  range.deleteContents();
  range.insertNode(document.createTextNode(newText));

  // Move cursor to the end of new text
  selection.removeAllRanges();
  const newRange = document.createRange();
  newRange.setStart(range.endContainer, range.endOffset);
  selection.addRange(newRange);
}

function setLineSpacing(spacing) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  if (!selectedText) return;

  const p = document.createElement("div");
  p.style.lineHeight = spacing;
  p.textContent = selectedText;

  range.deleteContents();
  range.insertNode(p);

  // Keep cursor after inserted text
  selection.removeAllRanges();
  const newRange = document.createRange();
  newRange.setStartAfter(p);
  selection.addRange(newRange);
}

function htmlToBlocks(html) {
  if (!html || !html.trim()) return [""];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstChild;
  if (!container) return [];

  const isEmptyElement = (el) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const text = (el.textContent || "").replace(/\u00a0/g, " ").trim();
    if (text.length > 0) return false;
    const inner = (el.innerHTML || "")
      .replace(/\u00a0/g, " ")
      .replace(/&nbsp;/gi, " ")
      .trim();
    return /^(?:\s|<br\s*\/?>|<wbr\s*\/?>)*$/i.test(inner);
  };

  // Drop leading empty blocks, and collapse multiple empty blocks into one.
  const nodes = [];
  const childNodes = Array.from(container.childNodes);
  let seenContent = false;
  let prevWasEmpty = false;
  for (const n of childNodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = (n.textContent || "").replace(/\u00a0/g, " ").trim();
      if (!t) continue;
      seenContent = true;
      prevWasEmpty = false;
      nodes.push(n);
      continue;
    }

    const emptyEl = isEmptyElement(n);
    if (!seenContent && emptyEl) continue; // skip leading empties (prevents big blank space)
    if (emptyEl && prevWasEmpty) continue; // collapse multiple empties

    if (!emptyEl) seenContent = true;
    prevWasEmpty = emptyEl;
    nodes.push(n);
  }

  if (nodes.length === 0) return [""];

  return nodes.map((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      return `<p>${n.textContent}</p>`;
    }
    return n.outerHTML || "";
  }).filter(Boolean);
}

function isEmptyHtml(html) {
  if (!html) return true;
  const text = html.replace(/<[^>]*>/g, "").replace(/\u00a0/g, " ").trim();
  return text.length === 0;
}

//reporttitle
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
      Helper functions
   ========================== */
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



/* ===========================
      WordColorPicker
   ========================== */
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
    <div
      className="word-color-menu"
      style={{
        padding: 8,
        background: "#fff",
        border: "1px solid #ccc",
        borderRadius: 6,
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
      }}
    >
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
   ========================== */
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
    ReportedBy: "null",
    ApprovedBy: "null",
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
  const [isManualTitle, setIsManualTitle] = useState(false);
  const [editRefDoctor, setEditRefDoctor] = useState(false);
  const [editBodyPart, setEditBodyPart] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const recognitionRunningRef = useRef(false);
  const printSnapshotRef = useRef(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const focusRequestRef = useRef(null);

  const location = useLocation(); // import from react-router-dom
const [isAddendum, setIsAddendum] = useState(false);
const [noteInput, setNoteInput] = useState("");
const [parentReportId, setParentReportId] = useState(null);
const [addendumConfirmed, setAddendumConfirmed] = useState(false);
const [totalPages, setTotalPages] = useState(1);
const headerRef = useRef(null);
const measureRef = useRef(null);
const firstBodyRef = useRef(null);
const otherBodyRef = useRef(null);
const [headerBlockMm, setHeaderBlockMm] = useState(30);
const [bodyPxFirst, setBodyPxFirst] = useState(0);
const [bodyPxOther, setBodyPxOther] = useState(0);
const [pages, setPages] = useState([]);
const HEADER_FOOTER_MM = 25.4; // 1 inch (letterhead-like)
const PAGE_SIDE_PADDING_MM = 15;
const CONTENT_HEIGHT_MM = 297 - (HEADER_FOOTER_MM * 2);
const CONTENT_SAFE_HEIGHT_MM = CONTENT_HEIGHT_MM - 3;
const OTHER_TOP_OFFSET_MM = 0;
const PAGE_NUMBER_OFFSET_MM = 6;
const firstPageBodyMm = Math.max(20, CONTENT_SAFE_HEIGHT_MM - headerBlockMm);
const otherPageBodyMm = CONTENT_SAFE_HEIGHT_MM;

//report tile
// Auto-update report title based on modality + body part
useEffect(() => {
  if (isManualTitle) return; // do not override manual edits

  const modality = study.Modality?.trim() || "";
  const bodyPart = study.BodyPartExamined?.trim() || "";

  if (!modality) {
    // fallback if modality is missing
    setReportTitle("Report");
    return;
  }

  // Build title: include body part only if present
  const title = bodyPart ? `${modality} ${bodyPart} REPORT` : `${modality} REPORT`;
  setReportTitle(title);
}, [study.Modality, study.BodyPartExamined, isManualTitle]);

// 🎙️ Voice based dictation (insert at cursor)
useEffect(() => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn("Speech recognition not supported");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    recognitionRunningRef.current = true;
  };

  recognition.onend = () => {
    recognitionRunningRef.current = false;
    setListening(false);
  };

  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e);
    recognitionRunningRef.current = false;
    setListening(false);
  };

  recognition.onresult = (event) => {
    let transcript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        transcript += event.results[i][0].transcript;
      }
    }

    if (!transcript.trim()) return;
    if (!activeEditorRef.current) return;

    restoreSelection();

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(" " + transcript);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    sel.removeAllRanges();
    sel.addRange(range);

    saveSelection();

    const editorType = activeEditorRef.current.dataset.editor;
    if (editorType === "history") setHistory(activeEditorRef.current.innerHTML);
    if (editorType === "findings") setFindings(activeEditorRef.current.innerHTML);
    if (editorType === "conclusion") setConclusion(activeEditorRef.current.innerHTML);
  };

  recognitionRef.current = recognition;

  return () => {
    if (recognitionRunningRef.current) {
      recognition.stop();
    }
  };
}, []);
const blocks = useMemo(() => {
  const items = [];

  const historyBlocks = htmlToBlocks(history);
  const findingsBlocks = htmlToBlocks(findings);
  const conclusionBlocks = htmlToBlocks(conclusion);

  items.push({ type: "sectionTitle", text: "History" });
  historyBlocks.forEach((html, i) =>
    items.push({ type: "html", html, section: "history", blockIndex: i, sectionCount: historyBlocks.length, key: `h-${i}` })
  );

  items.push({ type: "sectionTitle", text: "Findings" });
  findingsBlocks.forEach((html, i) =>
    items.push({ type: "html", html, section: "findings", blockIndex: i, sectionCount: findingsBlocks.length, key: `f-${i}` })
  );

  if (showKeyImages) {
    items.push({ type: "keyImages", images: keyImages.slice(), key: "ki" });
  }

  items.push({ type: "sectionTitle", text: "Conclusion" });
  conclusionBlocks.forEach((html, i) =>
    items.push({ type: "html", html, section: "conclusion", blockIndex: i, sectionCount: conclusionBlocks.length, key: `c-${i}` })
  );

 return items;
}, [history, findings, conclusion, showKeyImages, keyImages]);

 const splitGuardRef = useRef(new Set());

 const requestEditorFocus = (section, blockIndex, place = "end") => {
   focusRequestRef.current = { section, blockIndex, place };
 };

 useEffect(() => {
   const req = focusRequestRef.current;
   if (!req) return;

   const el = document.querySelector(
     `#reportPanel [data-editor="${req.section}"][data-block-index="${req.blockIndex}"]`
   );
   if (!el) return;

   focusRequestRef.current = null;
   el.focus();

   try {
     const range = document.createRange();
     range.selectNodeContents(el);
     range.collapse(req.place !== "start");
     const sel = window.getSelection();
     sel?.removeAllRanges();
     sel?.addRange(range);
   } catch {}
 }, [history, findings, conclusion, pages, totalPages]);

useEffect(() => {
  setTotalPages(Math.max(1, pages.length));
}, [pages]);

useLayoutEffect(() => {
  if (headerRef.current) {
    const px = headerRef.current.getBoundingClientRect().height || 0;
    const mm = px / 3.78;
    if (mm > 10 && Math.abs(mm - headerBlockMm) > 0.5) {
      setHeaderBlockMm(mm);
    }
  }
}, [reportTitle, study, headerBlockMm]);

useLayoutEffect(() => {
  if (firstBodyRef.current) {
    const h = firstBodyRef.current.getBoundingClientRect().height || 0;
    if (h > 0 && Math.abs(h - bodyPxFirst) > 1) {
      setBodyPxFirst(h);
    }
  }
  if (otherBodyRef.current) {
    const h = otherBodyRef.current.getBoundingClientRect().height || 0;
    if (h > 0 && Math.abs(h - bodyPxOther) > 1) {
      setBodyPxOther(h);
    }
  }
}, [headerBlockMm, bodyPxFirst, bodyPxOther]);

 useLayoutEffect(() => {
   if (!measureRef.current) return;
   const container = measureRef.current;
   container.innerHTML = "";

  const PX_PER_MM = 3.78;
  const firstBodyPx = bodyPxFirst || (firstPageBodyMm * PX_PER_MM);
  const otherBodyPx = bodyPxOther || (otherPageBodyMm * PX_PER_MM);
  const otherTopOffsetPx = OTHER_TOP_OFFSET_MM * PX_PER_MM;

  const PAGE_BUFFER_PX = 2; // small safety buffer to avoid 1px clipping

  const makePageBox = (pageHeightPx, paddingTopPx) => {
    const pageBox = document.createElement("div");
    pageBox.style.width = "100%";
    pageBox.style.height = `${pageHeightPx}px`;
    pageBox.style.overflow = "hidden";
    pageBox.style.boxSizing = "border-box";

    const flow = document.createElement("div");
    flow.className = "page-flow";
    flow.style.position = "relative";
    flow.style.paddingTop = `${paddingTopPx}px`;
    flow.style.boxSizing = "border-box";

    pageBox.appendChild(flow);
    container.appendChild(pageBox);

    return { pageBox, flow };
  };

  const makeSectionEl = (block) => {
    const section = document.createElement("section");
    section.className = "section";

    if (block.type === "sectionTitle") {
      const h3 = document.createElement("h3");
      h3.style.fontSize = "12px";
      h3.style.margin = "0 0 8px";
      h3.textContent = block.text;
      section.appendChild(h3);
      return section;
    }

    if (block.type === "keyImages") {
      const h3 = document.createElement("h3");
      h3.style.fontSize = "12px";
      h3.style.margin = "0 0 8px";
      h3.textContent = "Key Images";
      section.appendChild(h3);

      const wrap = document.createElement("div");
      wrap.className = "key-images ghost-key-images";
      (block.images || []).forEach(() => {
        const box = document.createElement("div");
        box.style.width = "120px";
        box.style.height = "120px";
        wrap.appendChild(box);
      });
      section.appendChild(wrap);
      return section;
    }

    // html block (compact RichEditor look)
    const editor = document.createElement("div");
    editor.setAttribute("data-editor", block.section || "");
    editor.style.minHeight = "0px";
    editor.style.padding = "0px";
    editor.style.border = "none";
    editor.style.outline = "none";
    editor.style.boxShadow = "none";
    editor.style.backgroundColor = "#fff";
    editor.style.cursor = "text";
    editor.style.textAlign =
      block.section === "history" || block.section === "findings" || block.section === "conclusion"
        ? "justify"
        : "left";
    editor.style.textAlignLast =
      block.section === "history" || block.section === "findings" || block.section === "conclusion"
        ? "left"
        : "auto";

    const html = block.html || "";
    editor.innerHTML = html || "<div><br/></div>";

    if (isEmptyHtml(html)) {
      const isOnlyBlock = block.blockIndex === 0 && block.sectionCount === 1;
      editor.style.minHeight = isOnlyBlock ? "80px" : "18px";
      editor.style.padding = isOnlyBlock ? "8px" : "0px";
    }

    section.appendChild(editor);
    return section;
  };

  const newPages = [];
  let current = [];
  let { pageBox, flow } = makePageBox(firstBodyPx, 0);

   const wouldOverflow = () =>
     flow.scrollHeight > (pageBox.clientHeight - PAGE_BUFFER_PX);

   const escapeHtml = (s) =>
     String(s)
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;");

   const getPlainTextSplitCandidate = (html) => {
     if (!html) return null;
     try {
       const parsed = new DOMParser().parseFromString(html, "text/html").body.firstChild;
       if (!parsed || parsed.nodeType !== Node.ELEMENT_NODE) return null;
       if (parsed.tagName !== "P" && parsed.tagName !== "DIV") return null;
       if (parsed.children && parsed.children.length > 0) return null; // only plain text
       const tag = parsed.tagName.toLowerCase();
       const text = (parsed.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
       if (!text) return null;
       return { tag, text };
     } catch {
       return null;
     }
   };

   for (let i = 0; i < blocks.length; i += 1) {
     const el = makeSectionEl(blocks[i]);
     flow.appendChild(el);

     if (wouldOverflow() && current.length > 0) {
       flow.removeChild(el);

       // Optional smart split: only do this during print so editing/backspace isn't fighting auto-splits.
       if (isPrinting) {
         // If a single (plain) paragraph doesn't fit, split it so we can use the remaining space
         // instead of pushing the entire paragraph to the next page.
         const block = blocks[i];
         const remainingPx = (pageBox.clientHeight - PAGE_BUFFER_PX) - flow.scrollHeight;
         if (block?.type === "html" && remainingPx > 80) {
           const candidate = getPlainTextSplitCandidate(block.html);
           if (candidate) {
             const words = candidate.text.split(" ").filter(Boolean);
             const guardKey = `${block.section}:${block.blockIndex}:${words.length}`;
             if (!splitGuardRef.current.has(guardKey) && words.length > 35) {
               const fits = (count) => {
                 const partText = words.slice(0, count).join(" ");
                 const partHtml = `<${candidate.tag}>${escapeHtml(partText)}</${candidate.tag}>`;
                 const testEl = makeSectionEl({ ...block, html: partHtml });
                 flow.appendChild(testEl);
                 const ok = !wouldOverflow();
                 flow.removeChild(testEl);
                 return ok;
               };

               let lo = 5;
               let hi = words.length - 5;
               let best = 0;
               while (lo <= hi) {
                 const mid = (lo + hi) >> 1;
                 if (fits(mid)) {
                   best = mid;
                   lo = mid + 1;
                 } else {
                   hi = mid - 1;
                 }
               }

               if (best >= 10 && best <= words.length - 10) {
                 const firstHtml = `<${candidate.tag}>${escapeHtml(words.slice(0, best).join(" "))}</${candidate.tag}>`;
                 const secondHtml = `<${candidate.tag}>${escapeHtml(words.slice(best).join(" "))}</${candidate.tag}>`;
                 splitGuardRef.current.add(guardKey);
                 if (splitSectionBlock(block.section, block.blockIndex, firstHtml, secondHtml)) {
                   return;
                 }
               }
             }
           }
         }
       }

       // Avoid leaving a section title alone at the bottom of a page.
       let carryTitle = null;
       let carryTitleIndex = null;
       const lastIdx = current[current.length - 1];
      if (blocks[lastIdx]?.type === "sectionTitle") {
        carryTitleIndex = current.pop();
        carryTitle = flow.lastChild;
        if (carryTitle) flow.removeChild(carryTitle);
      }

      newPages.push(current);
      current = [];

      ({ pageBox, flow } = makePageBox(otherBodyPx, otherTopOffsetPx));
      if (carryTitle) {
        flow.appendChild(carryTitle);
        current.push(carryTitleIndex);
      }
       flow.appendChild(el);
     }

     current.push(i);
   }

  if (current.length > 0) newPages.push(current);
  setPages(newPages);
}, [blocks, bodyPxFirst, bodyPxOther, firstPageBodyMm, otherPageBodyMm, isPrinting]);

// template
useEffect(() => {
  if (!study.Modality || !study.BodyPartExamined) return;

  fetch("/api/report-templates")
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

const replaceSectionBlock = (section, blockIndex, html) => {
  const get = (s) => (s === "history" ? history : s === "findings" ? findings : conclusion);
  const set = (s, v) => (s === "history" ? setHistory(v) : s === "findings" ? setFindings(v) : setConclusion(v));
  const blocks = htmlToBlocks(get(section));
  if (blockIndex < 0 || blockIndex >= blocks.length) {
    blocks.push(html);
    set(section, blocks.join(""));
    return;
  }
  blocks[blockIndex] = html;
  set(section, blocks.join(""));
};

const splitSectionBlock = (section, blockIndex, firstHtml, secondHtml) => {
  const get = (s) => (s === "history" ? history : s === "findings" ? findings : conclusion);
  const set = (s, v) => (s === "history" ? setHistory(v) : s === "findings" ? setFindings(v) : setConclusion(v));
  const sectionBlocks = htmlToBlocks(get(section));
  if (blockIndex < 0 || blockIndex >= sectionBlocks.length) return false;
  sectionBlocks.splice(blockIndex, 1, firstHtml, secondHtml);
  set(section, sectionBlocks.join(""));
  return true;
};

const mergeWithPrevSectionBlock = (section, blockIndex) => {
  const get = (s) => (s === "history" ? history : s === "findings" ? findings : conclusion);
  const set = (s, v) => (s === "history" ? setHistory(v) : s === "findings" ? setFindings(v) : setConclusion(v));
  const sectionBlocks = htmlToBlocks(get(section));
  if (blockIndex <= 0 || blockIndex >= sectionBlocks.length) return false;

  const prev = sectionBlocks[blockIndex - 1] || "";
  const cur = sectionBlocks[blockIndex] || "";

  // If the previous block is empty, backspace-at-start should simply remove it.
  if (isEmptyHtml(prev)) {
    sectionBlocks.splice(blockIndex - 1, 1);
    set(section, sectionBlocks.join(""));
    requestEditorFocus(section, blockIndex - 1, "start");
    return true;
  }

  // Merge into a single block so `htmlToBlocks()` doesn't immediately split it again.
  // Wrapping ensures we get exactly one top-level node.
  const merged = `<div>${prev}${cur}</div>`;
  sectionBlocks.splice(blockIndex - 1, 2, merged);
  set(section, sectionBlocks.join(""));
  requestEditorFocus(section, blockIndex - 1, "end");
  return true;
};

const isCaretAtStart = (editorEl) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  if (!editorEl || !editorEl.contains(range.startContainer)) return false;

  try {
    const pre = range.cloneRange();
    pre.selectNodeContents(editorEl);
    pre.setEnd(range.startContainer, range.startOffset);

    const frag = pre.cloneContents();
    const hasMeaningfulContent = (node) => {
      if (!node) return false;
      if (node.nodeType === Node.TEXT_NODE) {
        const t = (node.textContent || "")
          .replace(/\u00a0/g, " ")
          .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
          .trim();
        return t.length > 0;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return false;

      const tag = node.tagName?.toLowerCase?.() || "";
      if (tag === "br" || tag === "wbr") return false;
      if (tag === "img" || tag === "svg" || tag === "table") return true;

      for (const child of Array.from(node.childNodes || [])) {
        if (hasMeaningfulContent(child)) return true;
      }
      return false;
    };

    for (const child of Array.from(frag.childNodes || [])) {
      if (hasMeaningfulContent(child)) return false;
    }
    return true;
  } catch {
    return false;
  }
};

const handleEditorKeyDown = (section, blockIndex) => (e, editorEl) => {
  const isBackspace =
    e?.key === "Backspace" || e?.nativeEvent?.inputType === "deleteContentBackward" || e?.inputType === "deleteContentBackward";
  if (!isBackspace) return;
  if (blockIndex <= 0) return;
  if (!editorEl) return;
  if (!isCaretAtStart(editorEl)) return;

  e.preventDefault();
  mergeWithPrevSectionBlock(section, blockIndex);
};

useEffect(() => {
  if (refDoctorRef.current && refDoctorRef.current.innerText !== study.ReferringPhysicianName) {
    refDoctorRef.current.innerText = study.ReferringPhysicianName || "";
  }
}, [study.ReferringPhysicianName]);

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

  /* ===========================
        Load report and prefill
     ========================== */
 useEffect(() => {
  if (!studyUID) return;

  const loadStudyAndReport = async () => {
    try {
      // 1️⃣ Load study info
      const studyRes = await fetch(`/api/studies/${encodeURIComponent(studyUID)}`);
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
      // ✅ ALWAYS set parentReportId from backend report
if (reportData?.id) {
  setParentReportId(reportData.id);
}

// 3️⃣ Check if opening as Addendum from location.state
if (location.state?.isAddendum && location.state?.parentReportData) {
  const parent = location.state.parentReportData;

  setHistory(parent.history || "");
  setFindings(parent.findings || "");
  setConclusion(parent.conclusion || "");
  setStudy((prev) => ({
    ...prev,
    BodyPartExamined: parent.body_part || prev.BodyPartExamined,
    Modality: parent.modality || prev.Modality,
    ReferringPhysicianName: parent.referring_doctor || prev.ReferringPhysicianName,
  }));
  setParentReportId(parent.id);
  setIsAddendum(true);
  setNoteInput(location.state.addendumReason || "");
} else if (reportData?.status === "Addendum" && reportData?.addendum_reason) {
  // <-- NEW: populate noteInput from database
  setIsAddendum(true);
  setNoteInput(reportData.addendum_reason);
}
 else {
        // normal report
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
          ReportedBy: reportData?.reported_by_signature || null,
          ApprovedBy: reportData?.approved_by_signature || null,
          ReportStatus: reportData?.status || "",
        });

        setHistory(reportContent.history || "");
        setFindings(reportContent.findings || "");
        setConclusion(reportContent.conclusion || "");
      }

      // 4️⃣ Load key images if present
      if (Array.isArray(reportData?.images) && reportData.images.length > 0) {
        const loadedImages = reportData.images.map(img =>
          img.image_path
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
}, [studyUID, location.state]);


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
        ...data.paths,
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
    reported_by_signature: study.ReportedBy,
approved_by_signature: study.ApprovedBy,
    status, // <- send current status to backend
    history,
    findings,
    conclusion,
    reportTitle,
    referring_doctor: study.ReferringPhysicianName,
    body_part: study.BodyPartExamined,
    image_paths: keyImages,
    parent_report_id: isAddendum ? parentReportId : null, // reference to original report
  addendum_reason: isAddendum ? noteInput : null,      // reason for addendum
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

useEffect(() => {
  if (location.state?.isAddendum) {
    setIsAddendum(true);
  }
}, [location.state]);
// ✅ SYNC FINAL REPORT CONTENT (IMPORTANT)
useEffect(() => {
  if (!studyUID) return;

  const syncFinalReport = async () => {
    try {
      const res = await fetch(`/api/reports/by-study/${studyUID}`);
      if (!res.ok) return;

      const data = await res.json();
      if (!data) return;

      // ✅ USE FLATTENED DATA (FINAL FIX)
      if (data.history !== undefined) setHistory(data.history);
      if (data.findings !== undefined) setFindings(data.findings);
      if (data.conclusion !== undefined) setConclusion(data.conclusion);

      // ✅ IMAGES
      if (Array.isArray(data.images)) {
        const imgs = data.images;
        setKeyImages(imgs);
        setShowKeyImages(imgs.length > 0);
      }

      // ✅ STATUS + ADDENDUM
      if (data.status) {
        setStudy(prev => ({ ...prev, ReportStatus: data.status }));
      }

      if (data.addendum_reason) {
        setIsAddendum(true);
        setNoteInput(data.addendum_reason);
        setAddendumConfirmed(true);
      }

    } catch (err) {
      console.error("Final report sync failed", err);
    }
  };

  syncFinalReport();
}, [studyUID]);


  /* ===========================
        PDF export
     ========================== */
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
     ... (Selection utility functions remain unchanged) ...
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
    if (activeEditorRef.current) {
      activeEditorRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const syncActiveEditorToState = () => {
    if (!activeEditorRef.current) return;
    activeEditorRef.current.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const handlePrint = () => {
    // Snapshot state before opening print dialog. Restored in `afterprint` to
    // prevent content loss if the browser triggers unexpected layout/event quirks.
    printSnapshotRef.current = {
      history,
      findings,
      conclusion,
      keyImages,
      showKeyImages,
    };
    setIsPrinting(true);
    window.requestAnimationFrame(() => window.print());
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      const snap = printSnapshotRef.current;
      if (!snap) return;
      printSnapshotRef.current = null;

      setHistory(snap.history);
      setFindings(snap.findings);
      setConclusion(snap.conclusion);
      setKeyImages(snap.keyImages);
      setShowKeyImages(snap.showKeyImages);
      setIsPrinting(false);
    };

    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

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
  activeEditorRef.current = domNode; // store actual DOM node
  saveSelection();                   // save cursor
};


  const handleEditorSelectionChange = () => {
    // whenever selection inside an editor changes, capture it
    saveSelection();
  };
const insertTextAtCursor = (text) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);

  // Remove selected text (if any)
  range.deleteContents();

  // Insert text node
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);

  // Move cursor AFTER inserted text
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  sel.removeAllRanges();
  sel.addRange(range);

  // Save updated selection
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

  const applyPixelFontSize = (size) => {
  restoreSelection();
  // 1. Force the browser to use CSS instead of <font> tags
  document.execCommand("styleWithCSS", false, true);
  
  // 2. We use a temporary size to "mark" the selection
  document.execCommand("fontSize", false, "1");
  
  // 3. Find the elements we just created and change '1' to our actual pixel size
  const fontElements = document.getElementsByTagName("font");
  for (let i = 0; i < fontElements.length; i++) {
    if (fontElements[i].size === "1") {
      fontElements[i].removeAttribute("size");
      fontElements[i].style.fontSize = size + "px";
    }
  }
  
  // Alternative for modern browsers: find spans with size 1
  const spanElements = document.getElementsByTagName("span");
  for (let i = 0; i < spanElements.length; i++) {
    if (spanElements[i].style.fontSize === "x-small" || spanElements[i].getAttribute("size") === "1") {
       spanElements[i].style.fontSize = size + "px";
    }
  }
  saveSelection();
};
  return (
    
    <div className="split-layout" style={{ display: "flex", height: "100vh", position: "relative", fontFamily: "'Times New Roman', Times, serif" }}>
    
{/* Report Panel */}

<div
  id="reportPanel"
  style={{
    width: "100%",
    padding: 12,
    boxSizing: "border-box",
    height: "100%",
    overflowY: "auto",
    position: "relative", // needed for overlay
  }}
>
{/* Addendum Section */}
{/* ====================== */}
{isAddendum && (
  <>
    {/* STEP 1: Ask for reason if not yet confirmed */}
    {!addendumConfirmed && (
      <div style={{ marginBottom: 12, position: "relative", zIndex: 600 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Enter addendum reason"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            style={{ padding: "4px 6px", minWidth: 250 }}
          />
          <button
            onClick={() => {
              if (!noteInput.trim()) {
                alert("Please enter a reason");
                return;
              }
              setAddendumConfirmed(true); // ✅ mark as confirmed
            }}
          >
            OK
          </button>
        </div>
      </div>
    )}

    {/* STEP 2: Show reason after confirmation */}
    {addendumConfirmed && (
      <div
        style={{
          padding: "6px 8px",
          background: "#f1f3f5",
          borderLeft: "4px solid #0d6efd",
          fontSize: 13,
          marginBottom: 12,
          zIndex: 600,
          position: "relative",
        }}
      >
        <strong>Addendum Reason:</strong> {noteInput}
      </div>
    )}

    {/* Overlay to block the entire report until reason is entered */}
    {!addendumConfirmed && (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(255,255,255,0.6)",
          zIndex: 500,
          pointerEvents: "all", // block interactions
        }}
      />
    )}
  </>
)}
       {/* Refined Professional Toolbar - Rounded Rectangle Style */}
<div 
  className="report-toolbar-wrapper" 
  style={{
    display: "flex", 
    alignItems: "center", 
    justifyContent: "space-between", 
    gap: "8px", 
    padding: "4px 12px", 
    marginBottom: "10px", 
    backgroundColor: "#587dbc", 
    borderRadius: "25px", // Professional round-shape rectangle
    border: "1px solid #d1d9e0", // Subtle highlight border
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)", // Fit-to-text shadow
    height: "42px", // Fixed height to prevent shaking
    width: "100%",
    boxSizing: "border-box"
  }}
>
  {/* LEFT: EDITING TOOLS */}
  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
    
   {/* 🔢 Font Size: 8-72px (Word Style) */}
<select 
  title="Font Size" 
  onChange={(e) => applyPixelFontSize(e.target.value)} 
  defaultValue="14"
  style={{ 
    height: "28px", 
    width: "50px", 
    borderRadius: "15px", 
    border: "1px solid #ccc", 
    paddingLeft: "4px", 
    cursor: "pointer" 
  }}
>
  {[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map(size => (
    <option key={size} value={size}>{size}</option>
  ))}
</select>

    {/* 🔤 Small Font Family */}
    <select 
      title="Font Family" 
      onChange={(e) => exec("fontName", e.target.value)} 
      defaultValue="Arial"
      style={{ height: "28px", width: "70px", borderRadius: "15px", border: "1px solid #ccc", fontSize: "11px", cursor: "pointer" }}
    >
      <option value="Arial">Arial</option>
      <option value="Times New Roman">TNR</option>
      <option value="Calibri">Calibri</option>
      <option value="Georgia">Georgia</option>
      <option value="Verdana">Verdana</option>
      <option value="Courier New">Courier</option>
      <option value="Tahoma">Tahoma</option>
      <option value="Trebuchet MS">Trebuchet</option>
      <option value="Impact">Impact</option>
      <option value="Segoe UI">Segoe</option>
    </select>

    {/* 🅱 Format Dropdown */}
    <select 
      title="Format" 
      onChange={(e) => { if(e.target.value) exec(e.target.value); e.target.value = ""; }} 
      style={{ height: "28px", width: "75px", borderRadius: "15px", border: "1px solid #ccc", cursor: "pointer" }}
    >
      <option value="">Format</option>
      <option value="bold">Bold</option>
      <option value="italic">Italic</option>
      <option value="underline">Underline</option>
      <option value="insertUnorderedList">Bullets</option>
      <option value="insertOrderedList">Numbers</option>
    </select>

    {/* 📐 Align Dropdown */}
    <select 
      title="Align" 
      onChange={(e) => { if(e.target.value) exec(e.target.value); e.target.value = ""; }} 
      style={{ height: "28px", width: "65px", borderRadius: "15px", border: "1px solid #ccc", cursor: "pointer" }}
    >
      <option value="">Align</option>
      <option value="justifyLeft">Left</option>
      <option value="justifyCenter">Center</option>
      <option value="justifyRight">Right</option>
      <option value="justifyFull">Justify</option>
    </select>

<select
  title="Change Case"
  onChange={(e) => {
    const val = e.target.value;
    if (!val) return;
    changeCase(val); // ✅ call your working function
    syncActiveEditorToState();
    e.target.value = "";
  }}
  style={{ height: "28px", width: "90px", borderRadius: "15px", border: "1px solid #ccc", cursor: "pointer", fontSize: "11px" }}
>
  <option value="">Case</option>
  <option value="uppercase">UPPERCASE</option>
  <option value="lowercase">lowercase</option>
  <option value="capitalize">Capitalize</option>
</select>
<select
  title="Line Spacing"
  onChange={(e) => {
    const spacing = e.target.value;
    if (!spacing) return;
    setLineSpacing(spacing); // ✅ call your working function
    syncActiveEditorToState();
    e.target.value = "";
  }}
  style={{ height: "28px", width: "90px", borderRadius: "15px", border: "1px solid #ccc", cursor: "pointer", fontSize: "11px" }}
>
  <option value="">Line Spacing</option>
  <option value="1">1.0</option>
  <option value="1.15">1.15</option>
  <option value="1.5">1.5</option>
  <option value="2">2.0</option>
</select>

    {/* 🎨 Color Palette */}
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { saveSelection(); setShowColorPalette(!showColorPalette); }}
        style={{ height: "28px", width: "32px", borderRadius: "50%", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
      >
        🎨
      </button>
      {showColorPalette && (
        <div style={{ position: "absolute", top: "32px", left: 0, zIndex: 3000 }}>
          <WordColorPicker onSelect={(color) => { applyColor(color); setShowColorPalette(false); }} />
        </div>
      )}
    </div>

    {/* 📂 Templates (Fixed Dropdown Logic) */}
    <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setShowTemplateMenu(!showTemplateMenu)}
          style={{ height: "28px", padding: "0 10px", borderRadius: "15px", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "11px" }}
        >
          Templates ▼
        </button>
        {showTemplateMenu && (
            <div style={{ position: "absolute", top: "32px", left: 0, background: "#fff", border: "1px solid #ccc", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", borderRadius: "8px", width: "220px", zIndex: 3000, maxHeight: "200px", overflowY: "auto" }}>
                {templates.length === 0 ? (
                  <div style={{ padding: "10px", fontSize: "11px", color: "#888" }}>No templates available</div>
                ) : (
                  templates.map(t => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
                        <span style={{ fontSize: "11px", fontWeight: "500" }}>{t.template_name}</span>
                        <button onClick={() => { applyTemplate(t); setShowTemplateMenu(false); }} style={{ background: "#198754", color: "#fff", border: "none", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}>+</button>
                    </div>
                  ))
                )}
            </div>
        )}
    </div>

    {/* 🖼 RESTORED: Key Images */}
    <button
      type="button"
      onClick={() => {
        if (!showKeyImages) {
          setShowKeyImages(true);
          setTimeout(() => fileInputRef.current?.click(), 50);
        } else {
          fileInputRef.current?.click();
        }
      }}
      style={{ height: "28px", padding: "0 10px", borderRadius: "15px", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "11px" }}
    >
      Key Images
    </button>
  </div>

  {/* RIGHT: VOICE & ACTIONS */}
  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
    
    {/* 🎙 Dictation (Icon Only) */}
    <button
      type="button"
      onClick={() => {
        const rec = recognitionRef.current;
        if (!rec) return;
        listening ? rec.stop() : rec.start();
        setListening(!listening);
      }}
      style={{
        height: "30px", width: "30px", borderRadius: "50%", border: "none",
        background: listening ? "#dc3545" : "#f1f3f5",
        color: listening ? "#fff" : "#444",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
      }}
    >
      {listening ? "⏹" : "🎙️"}
    </button>

    <div style={{ display: "flex", gap: "6px" }}>
      {!isAddendum ? (
        <>
          {/* 🟡 Highlighted Draft */}
          <button
            onClick={() => handleSaveReport("Draft")}
            style={{
              padding: "4px 12px", borderRadius: "15px", border: "none", cursor: "pointer",
              background: "#ffc107", color: "#000", fontWeight: "bold", fontSize: "11px"
            }}
          >
            DRAFT
          </button>

          {/* 🟢 Highlighted Final */}
          <button
            onClick={() => handleSaveReport("Final")}
            disabled={!study.ApprovedBy}
            style={{
              padding: "4px 12px", borderRadius: "15px", border: "none",
              cursor: study.ApprovedBy ? "pointer" : "not-allowed",
              background: study.ApprovedBy ? "#198754" : "#adb5bd",
              color: "#fff", fontWeight: "bold", fontSize: "11px"
            }}
          >
            FINAL
          </button>
        </>
      ) : (
        <button
          onClick={() => handleSaveReport("Addendum")}
          style={{ padding: "4px 12px", borderRadius: "15px", border: "none", background: "#0d6efd", color: "#fff", fontWeight: "bold", fontSize: "11px" }}
        >
          ADDENDUM
        </button>
      )}

      {/* ✕ Close */}
      <button 
        onClick={() => navigate("/pacspage")} 
        style={{ height: "28px", width: "28px", borderRadius: "50%", border: "none", background: "#343a40", color: "#fff", cursor: "pointer", fontWeight: "bold" }}
      >
        ✕
      </button>
    </div>
  </div>

        </div>
{/* ===================== */}
{/* A4 CONTAINER */}
{/* ===================== */}
<div
  className="a4-container"
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "30px 0",
    background: "#e6e9ebd6", // Darker background to simulate PDF viewer
    minHeight: "100vh",
    gap: "20px"
  }}
>
  {/* Hidden measurement container */}
  <div
    ref={measureRef}
    className="page-measure"
    style={{
      position: "absolute",
      top: "-9999px",
      width: `calc(210mm - ${PAGE_SIDE_PADDING_MM * 2}mm)`,
      visibility: "hidden",
      pointerEvents: "none",
      boxSizing: "border-box",
    }}
  />

  {/* RENDERED A4 PAGES */}
  {Array.from({ length: totalPages }).map((_, index) => (
    <div
      key={index}
      className="a4-page"
      ref={index === 0 ? reportRef : null} // Keep ref for page 1
      style={{
        width: "210mm",
        height: "297mm",
        background: "#fff",
        padding: `${HEADER_FOOTER_MM}mm ${PAGE_SIDE_PADDING_MM}mm`,
        boxShadow: "0 0 12px rgba(0,0,0,0.15)",
        position: "relative",
        overflow: "hidden", // Important: Keeps content inside current sheet
        boxSizing: "border-box",
      }}
    >
      {index === 0 && (
        <div
          ref={headerRef}
          className="page-header"
          style={{ minHeight: `${headerBlockMm}mm` }}
        >
          <>
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
                    <strong>Study Date/Time:</strong> {formatDicomDateTime(study.StudyDate, study.StudyTime)}
                  </td>
                  <td style={{ padding: 6, border: "1px solid #000" }}>
                    <strong>Ref. Doctor:</strong>{" "}
                    {editRefDoctor ? (
                      <input
                        autoFocus
                        value={study.ReferringPhysicianName || ""}
                        onChange={(e) => setStudy((p) => ({ ...p, ReferringPhysicianName: e.target.value }))}
                        onBlur={() => setEditRefDoctor(false)}
                        onKeyDown={(e) => e.key === "Enter" && setEditRefDoctor(false)}
                        style={{ width: "70%" }}
                      />
                    ) : (
                      <span onClick={() => setEditRefDoctor(true)} style={{ cursor: 'pointer' }}>
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
                        onChange={(e) => setStudy((p) => ({ ...p, BodyPartExamined: e.target.value }))}
                        onBlur={() => setEditBodyPart(false)}
                        onKeyDown={(e) => e.key === "Enter" && setEditBodyPart(false)}
                        style={{ width: "70%" }}
                      />
                    ) : (
                      <span onClick={() => setEditBodyPart(true)} style={{ cursor: 'pointer' }}>
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
          </>
        </div>
      )}

      <div
        ref={index === 0 ? firstBodyRef : (index === 1 ? otherBodyRef : null)}
        style={{
          height: index === 0
            ? (bodyPxFirst ? `${bodyPxFirst}px` : `${firstPageBodyMm}mm`)
            : (bodyPxOther ? `${bodyPxOther}px` : `${otherPageBodyMm}mm`),
          overflow: "hidden",
        }}
      >
        <div
          className="page-flow"
          style={{
            position: "relative",
            paddingTop: index === 0 ? 0 : `${OTHER_TOP_OFFSET_MM}mm`,
          }}
        >
          {(pages[index] || []).map((blockIdx) => {
            const block = blocks[blockIdx];
            if (!block) return null;
             if (block.type === "sectionTitle") {
               return (
                 <section key={`t-${blockIdx}`} className="section" style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 12, margin: "0 0 8px" }}>{block.text}</h3>
                 </section>
               );
             }
             if (block.type === "keyImages") {
               return (
                 <section key={`k-${blockIdx}`} className="section" style={{ marginBottom: 20 }}>
                  <h3 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, margin: "0 0 8px" }}>
                    Key Images
                    <button
                      className="no-print"
                      style={{ background: "transparent", border: "none", fontSize: 12, cursor: "pointer", color: "#555" }}
                      onClick={(e) => { e.stopPropagation(); setShowKeyImages(false); }}
                    >
                      ✕
                    </button>
                  </h3>
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
                    onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      border: "2px dashed #aaa",
                      minHeight: 120,
                      padding: 10,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {keyImages.length === 0 && <div style={{ color: "#666", fontSize: 11 }}>Click to add images or drag & drop</div>}
                    {keyImages.map((src, i) => (
                      <div key={i} style={{ position: "relative", width: 120, height: 120 }}>
                        <img src={src} alt={`ki-${i}`} style={{ width: "100%", height: "100%", objectFit: "contain", border: "1px solid #ddd", borderRadius: 6 }} />
                        <button
                          className="remove-btn no-print"
                          onClick={(e) => { e.stopPropagation(); setKeyImages((prev) => prev.filter((_, idx) => idx !== i)); }}
                          style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer" }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            const placeholderText =
              block.section === "history"
                ? "Enter history..."
                : block.section === "findings"
                ? "Enter findings..."
                : "Enter conclusion...";

            return (
              <section key={`b-${blockIdx}`} className="section" style={{ marginBottom: 20 }}>
                <RichEditor
                  value={block.html}
                  onChange={(html) => replaceSectionBlock(block.section, block.blockIndex, html)}
                  onFocus={handleEditorFocus}
                  onSelectionChange={handleEditorSelectionChange}
                  onKeyDown={handleEditorKeyDown(block.section, block.blockIndex)}
                  placeholder={block.blockIndex === 0 ? placeholderText : ""}
                  disabled={isAddendum && !addendumConfirmed}
                  editorKey={block.section}
                  compact
                  emptyMinHeight={block.blockIndex === 0 && block.sectionCount === 1 ? 80 : 18}
                  emptyPadding={block.blockIndex === 0 && block.sectionCount === 1 ? 8 : 0}
                  blockIndex={block.blockIndex}
                />
              </section>
            );
          })}

          {/* Footer (Only on the Last Page) */}
          {index === totalPages - 1 && (
            <footer className="footer-row" style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
              <div style={{ fontWeight: "bold", fontSize: 11 }}>
                Reported By:
                <DigitalSignatureField
                  type="reported"
                  value={study.ReportedBy}
                  onSelect={(data) => setStudy((prev) => ({ ...prev, ReportedBy: data }))}
                />
              </div>
              <div style={{ fontWeight: "bold", fontSize: 11 }}>
                Approved By:
                <DigitalSignatureField
                  type="approved"
                  value={study.ApprovedBy}
                  onSelect={(data) => setStudy((prev) => ({ ...prev, ApprovedBy: data }))}
                />
              </div>
            </footer>
          )}
        </div>
      </div>

      {/* Page Number (Bottom Center) */}
      <div style={{ position: "absolute", bottom: `${Math.max(4, HEADER_FOOTER_MM - PAGE_NUMBER_OFFSET_MM)}mm`, left: 0, right: 0, textAlign: "center", fontSize: "10px", color: "#999" }}>
        Page {index + 1} of {totalPages}
      </div>
    </div>
  ))}

  {/* Toolbar Buttons (Bottom) */}
  <div className="buttons toolbar no-print" style={{ marginTop: 12 }}>
    <button 
      onClick={handlePrint} 
      style={{ padding: "8px 20px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
    >
      Print Final Report
    </button>
  </div>
</div>
    </div>
</div>

    
  );
}


