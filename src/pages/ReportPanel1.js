// src/pages/ReportPanel.jsx 
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { createPortal } from "react-dom";
import "./ReportPanel.css";
import api from "../api/axios";
import DigitalSignatureField from "../components/DigitalSignatureField"; 

/* ===========================
      RichEditor component
   ========================== */
function RichEditor({
  value,
  onChange,
  onFocus,
  onSelectionChange,
  onKeyDown,
  onPaste,
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
    const isFocused = () => document.activeElement === ref.current;
    if (ref.current && !isFocused() && ref.current.innerHTML !== value) {
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
      onInput={(e) => {
        if (disabled) return;
        onChange(e.currentTarget.innerHTML);
        if (typeof onSelectionChange === "function") setTimeout(onSelectionChange, 0);
      }}
      onPaste={
        !disabled
          ? (e) => {
              if (typeof onPaste === "function") onPaste(e, ref.current);
              if (typeof onSelectionChange === "function") setTimeout(onSelectionChange, 0);
            }
          : undefined
      }
      onKeyDown={!disabled && typeof onKeyDown === "function" ? (e) => onKeyDown(e, ref.current) : undefined}
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
      }}
      data-placeholder={placeholder}
    />
  );
}

function changeCase(caseType) {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
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
        newText = selectedText.replace(/\b\w/g, (c) => c.toUpperCase());
        break;
      default:
        break;
    }

    range.deleteContents();
    const textNode = document.createTextNode(newText);
    range.insertNode(textNode);

    const newRange = document.createRange();
    newRange.setStartAfter(textNode);
    newRange.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } catch {}
}

function setLineSpacing(spacing) {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText) return;
    const p = document.createElement("div");
    p.style.lineHeight = spacing;
    p.textContent = selectedText;
    range.deleteContents();
    range.insertNode(p);
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.setStartAfter(p);
    newRange.setEndAfter(p);
    selection.addRange(newRange);
  } catch {}
}

const BLOCK_MARKER = "<!--BLOCK-->";

function htmlToBlocks(html) {
  // Single-block mode by default.
  // We only split into multiple blocks when we previously inserted a marker
  // (during pagination overflow splitting).
  if (!html || !html.trim()) return [""];
  if (!html.includes(BLOCK_MARKER)) return [html];
  return html
    .split(BLOCK_MARKER)
    .map((s) => s ?? "")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 || s === "");
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
}
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
  if (name.includes("^")) {
    const parts = name.split("^").map(p => p.trim());
    const nameParts = [];
    for (const p of parts) {
      const agMatch = p.match(/^(\d{1,3})Y?\/([MFO])$/i);
      if (agMatch) {
        age = agMatch[1];
        gender = agMatch[2].toUpperCase();
        continue;
      }
      const ageMatch = p.match(/^(\d{1,3})Y$/i);
      if (ageMatch) {
        age = ageMatch[1];
        continue;
      }
      const genderMatch = p.match(/^([MFO])$/i);
      if (genderMatch) {
        gender = genderMatch[1].toUpperCase();
        continue;
      }
      nameParts.push(p);
    }
    name = nameParts.join(" ").trim();
  }
  if (!age || !gender) {
    const plainMatch = name.match(/(\d{1,3})Y?\/([MFO])/i);
    if (plainMatch) {
      age = age || plainMatch[1];
      gender = gender || plainMatch[2].toUpperCase();
      name = name.replace(plainMatch[0], "").trim();
    }
  }
  if (!age && rawAge) age = rawAge;
  if (!gender && rawSex && rawSex !== "O") gender = rawSex;
  name = name.replace(/\^/g, " ").replace(/\s+/g, " ").trim();
  if (!name) name = "N/A";
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
  const activeTiptapEditorRef = useRef(null);
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
  const dictationWantedRef = useRef(false);
  const printSnapshotRef = useRef(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const focusRequestRef = useRef(null);
  const selectionTooltipRafRef = useRef(null);
  const [selectionTooltip, setSelectionTooltip] = useState({ open: false, left: 0, top: 0 });
  const location = useLocation(); // import from react-router-dom
const [isAddendum, setIsAddendum] = useState(false);
const [noteInput, setNoteInput] = useState("");
const [parentReportId, setParentReportId] = useState(null);
const [addendumConfirmed, setAddendumConfirmed] = useState(false);
const headerRef = useRef(null);
const measureRef = useRef(null);
const firstBodyRef = useRef(null);
const otherBodyRef = useRef(null);
const [headerBlockMm, setHeaderBlockMm] = useState(30);
const [bodyPxFirst, setBodyPxFirst] = useState(0);
const [bodyPxOther, setBodyPxOther] = useState(0);
const [pages, setPages] = useState([]);
const renderedPages = pages.length ? pages : [[]];
const totalPages = renderedPages.length;
const HEADER_FOOTER_MM = 25.4; // 1 inch (letterhead-like)
const PAGE_SIDE_PADDING_MM = 15;
const CONTENT_HEIGHT_MM = 297 - (HEADER_FOOTER_MM * 2);
const CONTENT_SAFE_HEIGHT_MM = CONTENT_HEIGHT_MM - 1;
const OTHER_TOP_OFFSET_MM = 0;
const PAGE_NUMBER_OFFSET_MM = 6;
const firstPageBodyMm = Math.max(20, CONTENT_SAFE_HEIGHT_MM - headerBlockMm - PAGE_NUMBER_OFFSET_MM);
const otherPageBodyMm = CONTENT_SAFE_HEIGHT_MM - PAGE_NUMBER_OFFSET_MM;


// Auto-update report title based on modality + body part
useEffect(() => {
  if (isManualTitle) return; // do not override manual edits
  const modality = study.Modality?.trim() || "";
  const bodyPart = study.BodyPartExamined?.trim() || "";
  if (!modality) {
    setReportTitle("Report");
    return;
  }
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
    setListening(true);
  };
  recognition.onend = () => {
    recognitionRunningRef.current = false;
    setListening(false);
    if (dictationWantedRef.current) {
      window.setTimeout(() => {
        try {
          recognition.start();
        } catch {}
      }, 250);
    }
  };
  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e);
    recognitionRunningRef.current = false;
    setListening(false);
    const err = e?.error || "";
    if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture") {
      dictationWantedRef.current = false;
    }
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
    dictationWantedRef.current = false;
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
  const PAGE_BUFFER_PX = 10; // safety buffer to avoid footer/descender clipping
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
    editor.className = "ghost-editor";
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
   const parseRootEl = (html) => {
     if (!html) return null;
     try {
       // Wrap to ensure we always get a single root element even when `html`
       // contains multiple top-level nodes.
       const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
       const container = doc.body.firstChild;
       if (!container || container.nodeType !== Node.ELEMENT_NODE) return null;
       return container;
     } catch {
       return null;
     }
   };
   const getMeaningfulChildNodes = (el) =>
     Array.from(el?.childNodes || []).filter((n) => {
       if (!n) return false;
       if (n.nodeType === Node.TEXT_NODE) return (n.textContent || "").trim().length > 0;
       return true;
     });
   const getTextNodes = (node) => {
     const nodes = [];
     try {
       const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
       let cur = walker.nextNode();
       while (cur) {
         const t = (cur.textContent || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
         if (t.length > 0) nodes.push(cur);
         cur = walker.nextNode();
       }
     } catch {}
     return nodes;
   };
   const locateTextOffset = (nodes, offset) => {
     let remaining = offset;
     for (const n of nodes) {
       const len = (n.textContent || "").length;
       if (remaining <= len) return { node: n, offset: Math.max(0, remaining) };
       remaining -= len;
     }
     const last = nodes[nodes.length - 1];
     return { node: last, offset: (last.textContent || "").length };
   };
    function splitByTextRange(block, rootEl) {
      if (!rootEl) return null;
      const tagName = rootEl.tagName?.toUpperCase?.() || "";
      if (tagName !== "P" && tagName !== "DIV" && tagName !== "LI") return null;

     const nodes = getTextNodes(rootEl);
     if (nodes.length === 0) return null;
     const totalLen = nodes.reduce((a, n) => a + (n.textContent || "").length, 0);
     if (totalLen < 40) return null;
     const buildPrefixHtml = (keepChars) => {
       const clone = rootEl.cloneNode(true);
       const cloneNodes = getTextNodes(clone);
       const pos = locateTextOffset(cloneNodes, keepChars);
       const r = document.createRange();
       r.selectNodeContents(clone);
       r.setStart(pos.node, pos.offset);
       r.deleteContents(); // delete from pos -> end
       return clone.outerHTML || "";
     };
     const buildSuffixHtml = (keepChars) => {
       const clone = rootEl.cloneNode(true);
       const cloneNodes = getTextNodes(clone);
       const pos = locateTextOffset(cloneNodes, keepChars);
       const r = document.createRange();
       r.selectNodeContents(clone);
       r.setEnd(pos.node, pos.offset);
       r.deleteContents(); // delete from start -> pos
       return clone.outerHTML || "";
     };
     const min = 15;
     const max = totalLen - 15;
     if (max <= min) return null;
     const fits = (count) => {
       const partHtml = buildPrefixHtml(count);
       const testEl = makeSectionEl({ ...block, html: partHtml });
       flow.appendChild(testEl);
       const ok = !wouldOverflow();
       flow.removeChild(testEl);
       return ok;
     };
     let lo = min;
     let hi = max;
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
      if (best < min || best > max) return null;
      let safeBest = best;
      try {
        const fullText = nodes.map((n) => n.textContent || "").join("");
        const isWordChar = (ch) => {
          if (!ch) return false;
          try {
            return /[\p{L}\p{N}]/u.test(ch);
          } catch {
            return /[A-Za-z0-9]/.test(ch);
          }
        };
        const isBoundary = (offset) => {
          const prev = fullText[offset - 1] || "";
          const next = fullText[offset] || "";
          return !(isWordChar(prev) && isWordChar(next));
        };
        const SEARCH_BACK = 60;
        const lower = Math.max(min, best - SEARCH_BACK);
        for (let o = best; o >= lower; o -= 1) {
          if (o <= min || o >= max) continue;
          if (isBoundary(o)) {
            safeBest = o;
            break;
          }
        }
      } catch {}
      const firstHtml = buildPrefixHtml(safeBest);
      const secondHtml = buildSuffixHtml(safeBest);
      if (isEmptyHtml(firstHtml) || isEmptyHtml(secondHtml)) return null;
      return { firstHtml, secondHtml, totalLen, key: `range:${totalLen}` };
    }
   const splitByListItems = (block, root) => {
     let listEl = null;
     let wrapper = null;
     const tag = root.tagName?.toUpperCase?.() || "";
     if (tag === "UL" || tag === "OL") {
       listEl = root;
     } else if (tag === "DIV") {
       const kids = getMeaningfulChildNodes(root);
       if (kids.length === 1 && kids[0]?.nodeType === Node.ELEMENT_NODE) {
         const only = kids[0];
         const onlyTag = only.tagName?.toUpperCase?.() || "";
         if (onlyTag === "UL" || onlyTag === "OL") {
           wrapper = root;
           listEl = only;
         }
       }
     }
     if (!listEl) return null;
     const items = Array.from(listEl.children || []).filter((el) => (el?.tagName?.toUpperCase?.() || "") === "LI");
      if (items.length < 2) return null;
      const buildListHtml = (from, to) => {
        const isOrdered = (listEl.tagName?.toUpperCase?.() || "") === "OL";
        const origStart = (() => {
          if (!isOrdered) return 1;
          const raw = listEl.getAttribute?.("start");
          const n = Number.parseInt(raw || "1", 10);
          return Number.isFinite(n) && n > 0 ? n : 1;
        })();
        const listClone = listEl.cloneNode(false);
        if (isOrdered && from > 0) {
          // Continue numbering across pages (otherwise OL restarts at 1 on the next page).
          listClone.setAttribute("start", String(origStart + from));
        }
        for (let i = from; i < to; i += 1) listClone.appendChild(items[i].cloneNode(true));
        if (wrapper) {
          const w = wrapper.cloneNode(false);
          w.appendChild(listClone);
          return w.outerHTML || "";
       }
       return listClone.outerHTML || "";
     };

     const fits = (count) => {
       const partHtml = buildListHtml(0, count);
       const testEl = makeSectionEl({ ...block, html: partHtml });
       flow.appendChild(testEl);
       const ok = !wouldOverflow();
       flow.removeChild(testEl);
       return ok;
     };

     let lo = 1;
     let hi = items.length - 1;
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

     if (best >= 1 && best <= items.length - 1) {
       return {
         firstHtml: buildListHtml(0, best),
         secondHtml: buildListHtml(best, items.length),
         key: `list:${items.length}`,
       };
     }

     // If even the first <li> doesn't fit, split inside that <li>.
     const li0 = items[0];
     const li0Split = splitByTextRange(block, li0);
     if (!li0Split) return null;
     const list1 = listEl.cloneNode(false);
     const list2 = listEl.cloneNode(false);
     const liFirst = new DOMParser().parseFromString(li0Split.firstHtml, "text/html").body.firstChild;
     const liSecond = new DOMParser().parseFromString(li0Split.secondHtml, "text/html").body.firstChild;
     if (!liFirst || !liSecond) return null;
     list1.appendChild(liFirst);
     list2.appendChild(liSecond);
     for (let i = 1; i < items.length; i += 1) list2.appendChild(items[i].cloneNode(true));
     const wrapIfNeeded = (listNode) => {
       if (!wrapper) return listNode.outerHTML || "";
       const w = wrapper.cloneNode(false);
       w.appendChild(listNode);
       return w.outerHTML || "";
     };
     return {
       firstHtml: wrapIfNeeded(list1),
       secondHtml: wrapIfNeeded(list2),
       key: `listli0:${items.length}:${li0Split.totalLen}`,
     };
   };
   const splitByDivChildren = (block, rootDiv) => {
     if (!rootDiv || (rootDiv.tagName?.toUpperCase?.() || "") !== "DIV") return null;
     const children = getMeaningfulChildNodes(rootDiv);
     if (children.length < 2) return null;
     const fits = (count) => {
       const clone = rootDiv.cloneNode(false);
       for (let j = 0; j < count; j += 1) clone.appendChild(children[j].cloneNode(true));
       const testEl = makeSectionEl({ ...block, html: clone.outerHTML });
       flow.appendChild(testEl);
       const ok = !wouldOverflow();
       flow.removeChild(testEl);
       return ok;
     };
     let lo = 1;
     let hi = children.length - 1;
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
     if (best < 1 || best > children.length - 1) return null;
     const firstEl = rootDiv.cloneNode(false);
     const secondEl = rootDiv.cloneNode(false);
     for (let j = 0; j < children.length; j += 1) {
       (j < best ? firstEl : secondEl).appendChild(children[j].cloneNode(true));
     }
     return { firstHtml: firstEl.outerHTML, secondHtml: secondEl.outerHTML, key: `divchildren:${children.length}` };
   };
   const splitPlainTextByWords = (block, rootEl) => {
     if (!rootEl) return null;
     const tagName = rootEl.tagName?.toUpperCase?.() || "";
     if (tagName !== "P" && tagName !== "DIV" && tagName !== "LI") return null;
     if (rootEl.children && rootEl.children.length > 0) return null;

     const tag = tagName.toLowerCase();
     const text = (rootEl.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
     if (!text) return null;
     const words = text.split(" ").filter(Boolean);
     if (words.length < 12) return null;
     const fits = (count) => {
       const partText = words.slice(0, count).join(" ");
       const partHtml = `<${tag}>${escapeHtml(partText)}</${tag}>`;
       const testEl = makeSectionEl({ ...block, html: partHtml });
       flow.appendChild(testEl);
       const ok = !wouldOverflow();
       flow.removeChild(testEl);
       return ok;
     };
     let lo = 1;
     let hi = words.length - 1;
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
     if (best < 3 || best > words.length - 3) return null;
     const firstHtml = `<${tag}>${escapeHtml(words.slice(0, best).join(" "))}</${tag}>`;
     const secondHtml = `<${tag}>${escapeHtml(words.slice(best).join(" "))}</${tag}>`;
     return { firstHtml, secondHtml, key: `words:${words.length}` };
   };
   for (let i = 0; i < blocks.length; i += 1) {
     const el = makeSectionEl(blocks[i]);
     flow.appendChild(el);
     if (wouldOverflow() && current.length > 0) {
       flow.removeChild(el);
        const block = blocks[i];
        const remainingPx = (pageBox.clientHeight - PAGE_BUFFER_PX) - flow.scrollHeight;
        if (block?.type === "html" && remainingPx > 18) {
          const root = parseRootEl(block.html);
          if (root) {
            const attempts = [
              splitByListItems(block, root),
              splitByDivChildren(block, root),
              splitByTextRange(block, root),
              splitPlainTextByWords(block, root),
            ].filter(Boolean);
            for (const a of attempts) {
              const guardKey = `${block.section}:${block.blockIndex}:${a.key}`;
              if (splitGuardRef.current.has(guardKey)) continue;
              splitGuardRef.current.add(guardKey);
              if (splitSectionBlock(block.section, block.blockIndex, a.firstHtml, a.secondHtml)) {
                const active = activeEditorRef.current;
                const activeSection = active?.dataset?.editor;
                const activeBlockIndex = Number(active?.dataset?.blockIndex);
                if (active && activeSection === block.section && activeBlockIndex === block.blockIndex) {
                  requestEditorFocus(block.section, block.blockIndex + 1, "end");
                }
                return;
              }
            }
          }
        }
        let carryTitle = null;
        let carryTitleIndex = null;
        const lastIdx = current[current.length - 1];
       if (blocks[lastIdx]?.type === "sectionTitle") {
         carryTitleIndex = current.pop();
         carryTitle = flow.lastChild;
         if (carryTitle) flow.removeChild(carryTitle);
       }
       if (current.length > 0) newPages.push(current);
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
      const plainTemplate = data.filter(t =>
        t.modality === modality &&
        t.body_part.toLowerCase() === `${bodyPart}_plain` &&
        t.is_active
      );
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
    set(section, blocks.join(BLOCK_MARKER));
    return;
  }
  blocks[blockIndex] = html;
  set(section, blocks.join(BLOCK_MARKER));
};

const splitSectionBlock = (section, blockIndex, firstHtml, secondHtml) => {
  const get = (s) => (s === "history" ? history : s === "findings" ? findings : conclusion);
  const set = (s, v) => (s === "history" ? setHistory(v) : s === "findings" ? setFindings(v) : setConclusion(v));
  const sectionBlocks = htmlToBlocks(get(section));
  if (blockIndex < 0 || blockIndex >= sectionBlocks.length) return false;
  sectionBlocks.splice(blockIndex, 1, firstHtml, secondHtml);
  set(section, sectionBlocks.join(BLOCK_MARKER));
  return true;
};

const mergeWithPrevSectionBlock = (section, blockIndex) => {
  const get = (s) => (s === "history" ? history : s === "findings" ? findings : conclusion);
  const set = (s, v) => (s === "history" ? setHistory(v) : s === "findings" ? setFindings(v) : setConclusion(v));
  const sectionBlocks = htmlToBlocks(get(section));
  if (blockIndex <= 0 || blockIndex >= sectionBlocks.length) return false;

  const prev = sectionBlocks[blockIndex - 1] || "";
  const cur = sectionBlocks[blockIndex] || "";
  if (isEmptyHtml(prev)) {
    sectionBlocks.splice(blockIndex - 1, 1);
    set(section, sectionBlocks.join(BLOCK_MARKER));
    requestEditorFocus(section, blockIndex - 1, "start");
    return true;
  }
  const merged = `<div>${prev}${cur}</div>`;
  sectionBlocks.splice(blockIndex - 1, 2, merged);
  set(section, sectionBlocks.join(BLOCK_MARKER));
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
      const studyRes = await fetch(`/api/studies/${encodeURIComponent(studyUID)}`);
      const studyData = (await studyRes.json()) || {};
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
if (reportData?.id) {
  setParentReportId(reportData.id);
}
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
  setIsAddendum(true);
  setNoteInput(reportData.addendum_reason);
}
 else {
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
  const cleanHtml = (s) => String(s || "").replaceAll(BLOCK_MARKER, "");
  const payload = {
    study_uid: studyUID,
    accession_number: study.AccessionNumber,
    patient_id: study.PatientID,
    patient_name: study.PatientName,
    modality: study.Modality,
    reported_by_signature: study.ReportedBy,
    approved_by_signature: study.ApprovedBy,
    status, // <- send current status to backend
    history: cleanHtml(history),
    findings: cleanHtml(findings),
    conclusion: cleanHtml(conclusion),
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
    if (activeTiptapEditorRef.current) {
      // execCommand doesn't work reliably with TipTap/ProseMirror.
      console.warn("execCommand is disabled for TipTap editor:", cmd);
      return;
    }
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
    if (activeTiptapEditorRef.current) return;
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

  useEffect(() => {
    const update = () => {
      selectionTooltipRafRef.current = null;

      try {
        if (isPrinting) {
          setSelectionTooltip((p) => (p.open ? { ...p, open: false } : p));
          return;
        }

        const editorEl = activeEditorRef.current;
        const sel = window.getSelection();
        if (!editorEl || !sel || sel.rangeCount === 0) {
          setSelectionTooltip((p) => (p.open ? { ...p, open: false } : p));
          return;
        }

        const range = sel.getRangeAt(0);
        if (!range || range.collapsed) {
          setSelectionTooltip((p) => (p.open ? { ...p, open: false } : p));
          return;
        }

        const container =
          range.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
            ? range.commonAncestorContainer
            : range.commonAncestorContainer?.parentElement;

        if (!container || !editorEl.contains(container)) {
          setSelectionTooltip((p) => (p.open ? { ...p, open: false } : p));
          return;
        }

        // If editor is disabled (e.g. addendum confirm overlay), don't show tooltip.
        if (isAddendum && !addendumConfirmed) {
          setSelectionTooltip((p) => (p.open ? { ...p, open: false } : p));
          return;
        }

        const rect = range.getBoundingClientRect();
        const r =
          rect && (rect.width > 0 || rect.height > 0) ? rect : (range.getClientRects?.()[0] || null);
        if (!r) {
          setSelectionTooltip((p) => (p.open ? { ...p, open: false } : p));
          return;
        }

        setSelectionTooltip({
          open: true,
          left: r.left + r.width / 2,
          top: r.top - 10,
        });
      } catch {
        setSelectionTooltip((p) => (p.open ? { ...p, open: false } : p));
      }
    };

    const schedule = () => {
      if (selectionTooltipRafRef.current) return;
      selectionTooltipRafRef.current = window.requestAnimationFrame(update);
    };

    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (selectionTooltipRafRef.current) {
        window.cancelAnimationFrame(selectionTooltipRafRef.current);
        selectionTooltipRafRef.current = null;
      }
    };
  }, [isAddendum, addendumConfirmed, isPrinting]);

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
  if (domNode?.editor) {
    activeTiptapEditorRef.current = domNode.editor;
    activeEditorRef.current = domNode.dom || domNode.editor?.view?.dom || null;
  } else {
    activeEditorRef.current = domNode; // store actual DOM node
  }
  saveSelection(); // save cursor (used by legacy helpers)
};


  const handleEditorSelectionChange = () => {
    // whenever selection inside an editor changes, capture it
    saveSelection();
  };
const insertTextAtCursor = (text) => {
  if (activeTiptapEditorRef.current) {
    activeTiptapEditorRef.current.chain().focus().insertContent(text).run();
    return;
  }
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
    if (activeTiptapEditorRef.current) {
      alert("Color formatting is not enabled for TipTap editor yet.");
      setShowColorPalette(false);
      return;
    }
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

  const applyCaseToSelection = (caseType) => {
    const ed = activeTiptapEditorRef.current;
    if (!ed) {
      changeCase(caseType);
      syncActiveEditorToState();
      return;
    }

    const sel = ed.state?.selection;
    const from = sel?.from;
    const to = sel?.to;
    const empty = sel?.empty;
    if (empty || typeof from !== "number" || typeof to !== "number" || to <= from) return;

    const selectedText = ed.state.doc.textBetween(from, to, "\n");
    if (!selectedText) return;

    let newText = selectedText;
    if (caseType === "uppercase") newText = selectedText.toUpperCase();
    if (caseType === "lowercase") newText = selectedText.toLowerCase();
    if (caseType === "capitalize") newText = selectedText.replace(/\b\w/g, (c) => c.toUpperCase());

    ed.chain().focus().insertContentAt({ from, to }, newText).run();
  };

  const applyFormatCommand = (cmd) => {
    const ed = activeTiptapEditorRef.current;
    if (!ed) {
      exec(cmd);
      return;
    }
    if (cmd === "bold") ed.chain().focus().toggleBold().run();
    if (cmd === "italic") ed.chain().focus().toggleItalic().run();
    if (cmd === "underline") ed.chain().focus().toggleUnderline().run();
    if (cmd === "insertUnorderedList") ed.chain().focus().toggleBulletList().run();
    if (cmd === "insertOrderedList") ed.chain().focus().toggleOrderedList().run();
  };

  const applyAlignCommand = (cmd) => {
    const ed = activeTiptapEditorRef.current;
    if (!ed) {
      exec(cmd);
      return;
    }
    if (cmd === "justifyLeft") ed.chain().focus().setTextAlign("left").run();
    if (cmd === "justifyCenter") ed.chain().focus().setTextAlign("center").run();
    if (cmd === "justifyRight") ed.chain().focus().setTextAlign("right").run();
    if (cmd === "justifyFull") ed.chain().focus().setTextAlign("justify").run();
  };

  const applyPixelFontSize = (size) => {
    if (activeTiptapEditorRef.current) {
      alert("Font size formatting is not enabled for TipTap editor yet.");
      return;
    }
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
{selectionTooltip.open &&
  createPortal(
    <div
      className="no-print"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        left: selectionTooltip.left,
        top: selectionTooltip.top,
        transform: "translate(-50%, -100%)",
        zIndex: 9999,
        display: "flex",
        gap: 6,
        padding: "6px 8px",
        background: "#111827",
        color: "#fff",
        borderRadius: 8,
        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        fontSize: 12,
      }}
    >
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormatCommand("bold")} style={{ color: "#fff", background: "transparent", border: "none", cursor: "pointer", fontWeight: "bold" }}>
        B
      </button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormatCommand("italic")} style={{ color: "#fff", background: "transparent", border: "none", cursor: "pointer", fontStyle: "italic" }}>
        I
      </button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormatCommand("underline")} style={{ color: "#fff", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>
        U
      </button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormatCommand("insertUnorderedList")} style={{ color: "#fff", background: "transparent", border: "none", cursor: "pointer" }}>
        •
      </button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormatCommand("insertOrderedList")} style={{ color: "#fff", background: "transparent", border: "none", cursor: "pointer" }}>
        1.
      </button>
    </div>,
    document.body
  )}
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
      onChange={(e) => {
        if (activeTiptapEditorRef.current) {
          alert("Font family formatting is not enabled for TipTap editor yet.");
        } else {
          exec("fontName", e.target.value);
        }
      }} 
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
{/* formate */}
    <select 
      title="Format" 
      onChange={(e) => { if(e.target.value) applyFormatCommand(e.target.value); e.target.value = ""; }} 
      style={{ height: "28px", width: "75px", borderRadius: "15px", border: "1px solid #ccc", cursor: "pointer" }}
    >
      <option value="">Format</option>
      <option value="bold">Bold</option>
      <option value="italic">Italic</option>
      <option value="underline">Underline</option>
      <option value="insertUnorderedList">Bullets</option>
      <option value="insertOrderedList">Numbers</option>
    </select>
{/* alignment */}
    <select 
      title="Align" 
      onChange={(e) => { if(e.target.value) applyAlignCommand(e.target.value); e.target.value = ""; }} 
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
    applyCaseToSelection(val);
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
    if (activeTiptapEditorRef.current) {
      alert("Line spacing formatting is not enabled for TipTap editor yet.");
    } else {
      setLineSpacing(spacing); // ✅ call your working function
      syncActiveEditorToState();
    }
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
{/* template */}
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
  {/* voice */}
  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
    <button
      type="button"
      onClick={() => {
        const rec = recognitionRef.current;
        if (!rec) {
          alert("Speech recognition not supported in this browser.");
          return;
        }
        const ensureEditorFocusedForDictation = () => {
          if (activeEditorRef.current) return;
          const el = document.querySelector(`#reportPanel [data-editor="history"][data-block-index="0"]`);
          if (!el) return;
          el.focus();
          try {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            saveSelection();
          } catch {}
          activeEditorRef.current = el;
        };
        const nextWanted = !dictationWantedRef.current;
        dictationWantedRef.current = nextWanted;
        if (nextWanted) {
          setListening(true);
          ensureEditorFocusedForDictation();
          try {
            rec.start();
          } catch (e) {
            const msg = String(e?.message || "");
            const name = String(e?.name || "");
            if (!/invalidstate/i.test(msg) && name !== "InvalidStateError") {
              console.error("Speech start failed:", e);
              dictationWantedRef.current = false;
              setListening(false);
            }
          }
        } else {
          setListening(false);
          try {
            rec.stop();
          } catch (e) {
            console.error("Speech stop failed:", e);
          }
        }
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
          <button
            onClick={() => handleSaveReport("Draft")}
            style={{
              padding: "4px 12px", borderRadius: "15px", border: "none", cursor: "pointer",
              background: "#ffc107", color: "#000", fontWeight: "bold", fontSize: "11px"
            }}
          >
            DRAFT
          </button>
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
  {renderedPages.map((pageBlockIdxs, index) => (
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
          {(pageBlockIdxs || []).map((blockIdx) => {
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
      <div style={{ position: "absolute", bottom: `${Math.max(4, PAGE_NUMBER_OFFSET_MM)}mm`, left: 0, right: 0, textAlign: "center", fontSize: "10px", color: "#999" }}>
        Page {index + 1} of {totalPages}
      </div>
    </div>
  ))}

  {/* Toolbar Buttons (Bottom) */}
  <div className="buttons toolbar no-print" style={{ marginTop: 12 }}>
    <button 
      onClick={handlePrint} 
      style={{ padding: "8px 20px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
    > Print Final Report
    </button>
  </div>
</div>
    </div>
</div>
  );
}


