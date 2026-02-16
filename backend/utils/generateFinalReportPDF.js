const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

module.exports = async function generateFinalReportPDF(
  report,
  images = [],
  options = { printMode: false }
) {
  return new Promise((resolve, reject) => {
    try {
      const outputDir = path.join(__dirname, "..", "generated_pdfs");
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const pdfPath = path.join(outputDir, `REPORT_${report.id}_${Date.now()}.pdf`);
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const pageWidth = 595;
      const pageHeight = 842;
      let currentY = 30;

      /* -----------------------------
         UTILITY: Clean HTML
      ----------------------------- */
      const stripHTML = (text) => {
        if (!text) return "-";
        return text
          .replace(/<\/div>/g, "\n")
          .replace(/<div>/g, "")
          .replace(/<\/?p[^>]*>/g, "\n")
          .replace(/<br\s*\/?>/g, "\n")
          .replace(/&nbsp;/g, " ")
          .replace(/<[^>]+>/g, "")
          .replace(/\n\s*\n/g, "\n")
          .trim();
      };

      /* -----------------------------
         HEADER (Optional)
      ----------------------------- */
      if (!options.printMode) {
        doc.font("Times-Bold").fontSize(15).text("Akash Institute of Medical Sciences &", 0, currentY, { align: "center" });
        currentY += 18;
        doc.text("Research Centre (AIMSRC)", { align: "center" });
        currentY += 20;
        doc.moveTo(40, currentY).lineTo(pageWidth - 40, currentY).stroke();
        currentY += 12;
      }

      /* -----------------------------
         PATIENT INFO TABLE
      ----------------------------- */
      const startX = 40;
      const totalWidth = 515;
      const colW = totalWidth / 3;

      const drawRow = (data) => {
        let maxRowHeight = 20;
        const valueOffset = 75;

        data.forEach(item => {
          const height = doc.font("Times-Roman").fontSize(9).heightOfString(String(item.value || "N/A"), { width: colW - valueOffset - 5 }) + 8;
          if (height > maxRowHeight) maxRowHeight = height;
        });

        data.forEach((item, i) => {
          const x = startX + i * colW;
          doc.rect(x, currentY, colW, maxRowHeight).stroke();
          doc.font("Times-Bold").fontSize(9).text(item.label, x + 4, currentY + 5);
          doc.font("Times-Roman").fontSize(9).text(String(item.value || "N/A"), x + valueOffset, currentY + 5, { width: colW - valueOffset - 5 });
        });

        currentY += maxRowHeight;
      };

      /* -----------------------------
         AGE/GENDER EXTRACTION
      ----------------------------- */
      let rawName = (report.patient_name || "N/A").replace(/\^/g, " ").trim();
      let cleanName = rawName;

      // Default from report fields
      let age = report.patient_age || report.age || "N/A";
      let gender = report.patient_gender || report.gender || "N/A";

      // Extract Age/Gender from patient_name if missing
      const ageGenderPattern = /\s(\d+Y)\/([MF])$/i;
      const match = rawName.match(ageGenderPattern);
      if (match) {
        if (age === "N/A") age = match[1];
        if (gender === "N/A") gender = match[2];
        cleanName = rawName.replace(ageGenderPattern, "").trim();
      }

      const studyDate = report.study_date || report.study_date_time || "N/A";

      drawRow([
        { label: "Patient Name:", value: cleanName },
        { label: "Age/Gender:", value: `${age}/${gender}` },
        { label: "Patient ID:", value: report.patient_id || "N/A" },
      ]);

      drawRow([
        { label: "Study Date:", value: studyDate },
        { label: "Ref. Doctor:", value: report.referring_doctor || "N/A" },
        { label: "Accession No:", value: report.accession_number || "N/A" },
      ]);

      drawRow([
        { label: "Reported Date:", value: new Date().toLocaleString("en-IN") },
        { label: "Modality:", value: report.modality || "N/A" },
        { label: "Body Part:", value: report.body_part || "N/A" },
      ]);

      currentY += 20;

      /* -----------------------------
         REPORT TITLE
      ----------------------------- */
      const reportTitle = `${report.modality || ""} ${report.body_part || ""} REPORT`.toUpperCase();
      doc.font("Times-Bold").fontSize(12).text(reportTitle, 40, currentY, { align: "center" });
      currentY = doc.y + 10;

      /* -----------------------------
         HISTORY + FINDINGS
      ----------------------------- */
      const sections = [
        { label: "History:", val: report.report_content?.history },
        { label: "Findings:", val: report.report_content?.findings },
      ];

      sections.forEach(s => {
        if (currentY > pageHeight - 150) { doc.addPage(); currentY = 40; }
        doc.font("Times-Bold").fontSize(11).text(s.label, 40, currentY);
        currentY += 14;
        doc.font("Times-Roman").fontSize(11).text(stripHTML(s.val), 40, currentY, { width: totalWidth, lineGap: 4, align: "justify" });
        currentY = doc.y + 10;
      });

      /* -----------------------------
         KEY IMAGES
      ----------------------------- */
      if (images?.length > 0) {
        if (currentY > pageHeight - 150) { doc.addPage(); currentY = 40; }
        doc.font("Times-Bold").fontSize(11).text("Key Images:", 40, currentY);
        currentY += 15;

        let xPos = 40;
        images.forEach((img, i) => {
          const imgPath = path.join(__dirname, "..", img.image_path);
          if (fs.existsSync(imgPath)) {
            if (i > 0 && i % 4 === 0) { xPos = 40; currentY += 95; }
            if (currentY > pageHeight - 150) { doc.addPage(); currentY = 40; }
            doc.image(imgPath, xPos, currentY, { width: 90, height: 80 });
            xPos += 100;
          }
        });
        currentY += 90;
      }

      /* -----------------------------
         CONCLUSION
      ----------------------------- */
      if (currentY > pageHeight - 180) { doc.addPage(); currentY = 40; }
      doc.font("Times-Bold").fontSize(11).text("Conclusion:", 40, currentY);
      currentY += 14;
      doc.font("Times-Roman").fontSize(11).text(stripHTML(report.report_content?.conclusion), 40, currentY, { width: totalWidth, lineGap: 4, align: "justify" });
      currentY = doc.y + 30;

      /* -----------------------------
         SIGNATURES
      ----------------------------- */
      const formatSignature = (sig) => {
        if (!sig) return null;
        return {
          imagePath: sig.signature_url ? path.join(__dirname, "..", sig.signature_url) : null,
          fullName: sig.full_name,
          qualification: sig.qualification,
          signedOn: sig.dateTime ? new Date(sig.dateTime).toLocaleString("en-IN") : "",
        };
      };

      const reported = formatSignature(report.reported_by_signature);
      const approved = formatSignature(report.approved_by_signature);

      if (currentY > pageHeight - 180) { doc.addPage(); currentY = 50; }

      if (reported) {
        doc.font("Times-Bold").fontSize(10).text("Reported By:", 60, currentY);
        let sigY = currentY + 12;
        if (reported.imagePath && fs.existsSync(reported.imagePath)) { doc.image(reported.imagePath, 60, sigY, { width: 100, height: 40 }); sigY += 45; }
        doc.font("Times-Roman").fontSize(9).text(reported.fullName || "", 60, sigY);
        doc.text(reported.qualification || "", 60);
        doc.text(reported.signedOn ? `Signed on ${reported.signedOn}` : "", 60);
      }

      if (approved) {
        doc.font("Times-Bold").fontSize(10).text("Approved By:", 350, currentY);
        let sigY = currentY + 12;
        if (approved.imagePath && fs.existsSync(approved.imagePath)) { doc.image(approved.imagePath, 350, sigY, { width: 100, height: 40 }); sigY += 45; }
        doc.font("Times-Roman").fontSize(9).text(approved.fullName || "", 350, sigY);
        doc.text(approved.qualification || "", 350);
        doc.text(approved.signedOn ? `Signed on ${approved.signedOn}` : "", 350);
      }

      /* -----------------------------
         FOOTER (~1.5 inch from bottom)
      ----------------------------- */
      if (!options.printMode) {
        const footerText = "Akash Institute of Medical Sciences & Research Centre (AIMSRC)";
        doc.font("Times-Roman").fontSize(9).text(footerText, 0, pageHeight - 108, { align: "center" });
      }

      doc.end();
      stream.on("finish", () => resolve(pdfPath));
      stream.on("error", reject);

    } catch (err) {
      reject(err);
    }
  });
};
