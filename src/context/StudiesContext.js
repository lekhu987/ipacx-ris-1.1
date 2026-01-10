// src/context/StudiesContext.jsx
import React, { createContext, useState, useEffect } from "react";

export const StudiesContext = createContext();

export function StudiesProvider({ children }) {
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("http://localhost:5000/api/studies") // adjust your endpoint
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        const normalized = data.map((s) => ({
          PatientID: s.PatientID || "N/A",
          PatientName: s.PatientName || "N/A",
          PatientSex: (() => {
            const sex = s.PatientSex || "O";
            if (sex.toLowerCase() === "male" || sex.toLowerCase() === "m") return "M";
            if (sex.toLowerCase() === "female" || sex.toLowerCase() === "f") return "F";
            return "O";
          })(),
          PatientAge: s.PatientAge || "N/A",
          AccessionNumber: s.AccessionNumber || "N/A",
          StudyDescription: s.StudyDescription || "N/A",
          StudyDate: s.StudyDate || "",
          Modality: s.Modality || "N/A",
          StudyInstanceUID: s.StudyInstanceUID || s.ID || "",
          __raw: s,
        }));
        setStudies(normalized);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    return () => (mounted = false);
  }, []);

  return (
    <StudiesContext.Provider value={{ studies, loading }}>
      {children}
    </StudiesContext.Provider>
  );
}
