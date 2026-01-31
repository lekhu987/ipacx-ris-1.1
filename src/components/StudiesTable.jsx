import React from "react";

export default function StudiesTable({
  studies = [],
  mode = "pacs", // "pacs" | "report"
  navigate,
}) {
  return (
    <tbody>
      {studies.length === 0 ? (
        <tr>
          <td colSpan="10" className="no-data-row">
            No matching studies found
          </td>
        </tr>
      ) : (
        studies.map((s, idx) => (
          <tr key={s.StudyInstanceUID || idx}>
            <td>{idx + 1}</td>
            <td>{s.PatientID || "-"}</td>
            <td>{s.PatientName || "-"}</td>
            <td>{s.AccessionNumber || "-"}</td>
            <td>{s.StudyDescription || "No Description"}</td>
            <td>{s.StudyDate || "-"}</td>
            <td>{s.Modality || "-"}</td>
            <td>{s.PatientSex || "-"}</td>
            <td>{s.PatientAge || "-"}</td>

            {/* ACTIONS */}
            
            <td className="actions">
  <div className="action-button-group">
    {mode === "pacs" && (
      <>
        <button
          className="icon-btn"
          title="View Study"
          onClick={() => window.open(`http://192.168.1.34:8042/ohif/viewer?StudyInstanceUIDs=${s.StudyInstanceUID}`, "_blank")}
        >
          👁️
        </button>

        <button
          className="icon-btn"
          title="Create Report"
          onClick={() => navigate(`/create-report?study=${s.StudyInstanceUID}`)}
        >
          📝
        </button>

        <button
          className="icon-btn"
          title="Add / Update Patient"
          onClick={() => navigate("/add-patient", { state: { editEntry: s } })}
        >
          📤
        </button>
      </>
    )}
    
    {mode === "report" && (
      <button
        className="icon-btn"
        title="Open Report Panel"
        onClick={() => navigate(`/report-panel?study=${s.StudyInstanceUID}`)}
      >
        📝
      </button>
    )}
  </div>
</td>
          </tr>
        ))
      )}
    </tbody>
  );
}
