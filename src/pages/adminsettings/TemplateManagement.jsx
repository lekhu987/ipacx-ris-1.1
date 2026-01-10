// src/pages/adminsettings/TemplateManagement.jsx
import React, { useState, useEffect } from "react";
import MainLayout from "../../layout/MainLayout";
import "./TemplateManagement.css";

const BACKEND_URL = "http://localhost:5000";

export default function TemplateManagement() {
  const activeMain = "Templates";
  const [activeSub, setActiveSub] = useState("View Templates");
  const [editingId, setEditingId] = useState(null);

  const [templates, setTemplates] = useState([]);

  const [templateName, setTemplateName] = useState("");
  const [isTemplateNameManual, setIsTemplateNameManual] = useState(false);

  const [templateModality, setTemplateModality] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateType, setTemplateType] = useState("");

  const [History, setHistory] = useState("");
  const [findings, setFindings] = useState("");
  const [conclusion, setConclusion] = useState("");

  const [modalities, setModalities] = useState([]);
  const [bodyParts, setBodyParts] = useState([]);

  const sections = { Templates: ["View Templates", "Add Template"] };

  /* ============================
     FETCH EXISTING TEMPLATES
  ============================ */
  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/report-templates`);
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  /* ============================
     FETCH MODALITIES
  ============================ */
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/modalities`)
      .then(res => res.json())
      .then(data => setModalities(data))
      .catch(err => console.error(err));
  }, []);

  /* ============================
     FETCH BODY PARTS
  ============================ */
  useEffect(() => {
    if (!templateModality) {
      setBodyParts([]);
      return;
    }

    const selected = modalities.find(m => m.code === templateModality);
    if (!selected) return;

    fetch(`${BACKEND_URL}/api/body-parts?modality_id=${selected.id}`)
      .then(res => res.json())
      .then(data => setBodyParts(data))
      .catch(err => console.error(err));
  }, [templateModality, modalities]);

  /* ============================
     AUTO-GENERATE TEMPLATE NAME
  ============================ */
  useEffect(() => {
    if (!isTemplateNameManual && templateModality && templateBody) {
      const typePart = templateType ? `_${templateType}` : "";
      setTemplateName(`${templateModality}_${templateBody}${typePart}`);
    }
  }, [templateModality, templateBody, templateType, isTemplateNameManual]);

  /* ============================
     DEFAULT TEMPLATE
  ============================ */
  const fillDefaultTemplate = () => {
    setHistory("- Normal clinical history.");
    setFindings("- Normal study.\n- No abnormality detected.");
    setConclusion("- Within normal limits.");
  };

  /* ============================
     ADD / UPDATE TEMPLATE
  ============================ */
  const handleAddTemplate = async () => {
    if (!templateModality || !templateBody) {
      alert("Please fill at least Modality and Body Part");
      return;
    }

    const isEditMode = Boolean(editingId);

    const payload = {
      template_name: templateName.trim() || null,
      modality: templateModality,
      body_part: templateBody,
      template_type: templateType || null,
      content: {
        history: History,
        findings,
        conclusion,
      },
    };

    try {
      const url = isEditMode
        ? `${BACKEND_URL}/api/report-templates/${editingId}`
        : `${BACKEND_URL}/api/report-templates`;

      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        alert("Failed to save template");
        return;
      }

      // Always re-fetch templates
      await fetchTemplates();

      alert(isEditMode ? "Template updated successfully" : "Template added successfully");

      // Reset form
      setEditingId(null);
      setTemplateModality("");
      setTemplateBody("");
      setTemplateType("");
      setTemplateName("");
      setIsTemplateNameManual(false);
      setHistory("");
      setFindings("");
      setConclusion("");
      setActiveSub("View Templates");

    } catch (err) {
      console.error(err);
      alert("Failed to save template");
    }
  };

  /* ============================
     DELETE TEMPLATE
  ============================ */
  const deleteTemplate = async (id) => {
    if (!window.confirm("Delete this template?")) return;

    await fetch(`${BACKEND_URL}/api/report-templates/${id}`, {
      method: "DELETE",
    });

    fetchTemplates(); // Re-fetch after delete
  };

  /* ============================
     EDIT TEMPLATE
  ============================ */
  const handleEditTemplate = (template) => {
    setEditingId(template.id);
    setTemplateModality(template.modality);
    setTemplateBody(template.body_part);
    setTemplateType(template.template_type || "");
    setTemplateName(template.template_name);
    setHistory(template.content?.history || "");
    setFindings(template.content?.findings || "");
    setConclusion(template.content?.conclusion || "");
    setActiveSub("Add Template");
  };

  /* ============================
     UI
  ============================ */
  return (
    <MainLayout>
      <div className="reporting-container">
        <h1 className="page-title">
          {editingId ? "Update Template" : "Add Template"}
        </h1>

        <div className="sub-buttons-container">
          {sections[activeMain].map(sub => (
            <button
              key={sub}
              className={`sub-btn ${activeSub === sub ? "active" : ""}`}
              onClick={() => setActiveSub(sub)}
            >
              {sub}
            </button>
          ))}
        </div>

        {activeSub === "Add Template" && (
          <div className="add-template-container">

            {/* Modality */}
            <label>Modality</label>
            <input
              list="modality-list"
              className="input-box"
              value={templateModality}
              onChange={e => setTemplateModality(e.target.value)}
              placeholder="Select or type modality (e.g., CR, CT, MRI)"
            />
            <datalist id="modality-list">
              {modalities.map(m => (
                <option key={m.id} value={m.code} />
              ))}
            </datalist>

            {/* Body Part */}
            <label>Body Part</label>
            <input
              list="bodypart-list"
              className="input-box"
              value={templateBody}
              onChange={e => setTemplateBody(e.target.value)}
              placeholder="Select or type body part"
            />
            <datalist id="bodypart-list">
              {bodyParts.map(bp => (
                <option key={bp.id} value={bp.name} />
              ))}
            </datalist>

            {/* Template Type */}
            <label>Template Type</label>
            <select
              className="input-box"
              value={templateType}
              onChange={e => setTemplateType(e.target.value)}
            >
              <option value="">Select Type (optional)</option>
              <option value="plain">Plain</option>
              <option value="normal">Normal</option>
            </select>

            {/* Template Name */}
            <label>Template Name</label>
            <input
              type="text"
              className="input-box"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
                setIsTemplateNameManual(true);
              }}
              placeholder="Auto-generated, you can edit"
            />

            <label>History</label>
            <textarea
              className="input-box"
              rows="3"
              value={History}
              onChange={e => setHistory(e.target.value)}
            />

            <label>Findings</label>
            <textarea
              className="input-box"
              rows="4"
              value={findings}
              onChange={e => setFindings(e.target.value)}
            />

            <label>Conclusion</label>
            <textarea
              className="input-box"
              rows="3"
              value={conclusion}
              onChange={e => setConclusion(e.target.value)}
            />

            <div className="button-group">
              <button className="default-btn" onClick={fillDefaultTemplate}>
                Default Template
              </button>
              <button className="add-btn" onClick={handleAddTemplate}>
                {editingId ? "Update Template" : "Save Template"}
              </button>
            </div>
          </div>
        )}

        {activeSub === "View Templates" && (
          <table className="template-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Modality</th>
                <th>Body Part</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id}>
                  <td>{t.template_name}</td>
                  <td>{t.modality}</td>
                  <td>{t.body_part}</td>
                  <td>{t.template_type}</td>
                  <td>
                    <button className="edit-btn" onClick={() => handleEditTemplate(t)}>
                      Edit
                    </button>
                    <button className="delete-btn" onClick={() => deleteTemplate(t.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </MainLayout>
  );
}
