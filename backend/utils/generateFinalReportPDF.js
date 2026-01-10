const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

module.exports = async function generateFinalReportPDF(
  report,
  images = [],
  options = { printMode: false } // 👈 IMPORTANT
) {
  return new Promise((resolve, reject) => {
    try {
      const outputDir = path.join(__dirname, "..", "generated_pdfs");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const pdfPath = path.join(
        outputDir,
        `REPORT_${report.id}_${Date.now()}.pdf`
      );

      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      /* ======================================================
         1. PATIENT NAME CLEANUP
      ====================================================== */
      let rawName = (report.patient_name || "N/A")
        .replace(/\^/g, " ")
        .trim();

      let cleanName = rawName;
      let extractedAgeGender =
        `${report.patient_age || "N/A"}/${report.patient_gender || "N/A"}`;

      const ageGenderPattern = /\s\d+Y(?:\/[MF])?$/i;

      if (ageGenderPattern.test(rawName)) {
        const match = rawName.match(ageGenderPattern);
        extractedAgeGender = match[0].trim();
        cleanName = rawName.replace(ageGenderPattern, "").trim();
      }

      /* ======================================================
         2. STATUS (VISIBLE IN VIEW, HIDDEN IN PRINT)
      ====================================================== */
      const statusText = (report.status || "FINAL").toUpperCase();
      const reasonText = report.addendum_reason || "N/A";

      if (!options.printMode) {
        doc.font("Times-Bold").fontSize(10);

        if (statusText === "ADDENDUM") {
          doc.text(
            `Status: ADDENDUM | Reason: ${reasonText}`,
            40,
            30
          );
        } else {
          doc.text(`Status: FINAL`, 40, 30);
        }
      }

      /* ======================================================
         3. HEADER TABLE
      ====================================================== */
      const startX = 40;
      const totalWidth = 515;
      const colW = totalWidth / 3;
      let currentY = 50;

      const drawRow = (data) => {
        let maxRowHeight = 24;
        const valueOffset = 65;

        data.forEach((item) => {
          const availableWidth = colW - valueOffset - 5;
          const height =
            doc.font("Times-Roman").fontSize(9).heightOfString(
              String(item.value || "N/A"),
              { width: availableWidth }
            ) + 14;

          if (height > maxRowHeight) maxRowHeight = height;
        });

        data.forEach((item, i) => {
          const x = startX + i * colW;
          doc.rect(x, currentY, colW, maxRowHeight).stroke();

          doc
            .font("Times-Bold")
            .fontSize(9)
            .text(item.label, x + 4, currentY + 7, {
              width: valueOffset - 5,
            });

          doc
            .font("Times-Roman")
            .fontSize(9)
            .text(String(item.value || "N/A"), x + valueOffset, currentY + 7, {
              width: colW - valueOffset - 5,
            });
        });

        currentY += maxRowHeight;
      };

      drawRow([
        { label: "Patient Name:", value: cleanName },
        { label: "Age/Gender:", value: extractedAgeGender },
        { label: "Patient ID:", value: report.patient_id },
      ]);

      drawRow([
        { label: "Study Date:", value: report.study_date },
        { label: "Ref. Doctor:", value: report.referring_doctor },
        { label: "Accession No:", value: report.accession_number },
      ]);

      const reportDate = report.updated_at
        ? new Date(report.updated_at).toLocaleString("en-IN")
        : "N/A";

      drawRow([
        { label: "Reported Date:", value: reportDate },
        { label: "Modality:", value: report.modality },
        { label: "Body Part:", value: report.body_part },
      ]);

      /* ======================================================
         4. REPORT TITLE & CONTENT
      ====================================================== */
      currentY += 20;

      const reportTitle = `${report.modality || ""} ${report.body_part || ""} REPORT`.toUpperCase();

      doc
        .font("Times-Bold")
        .fontSize(12)
        .text(reportTitle, 40, currentY, { align: "center" });

      currentY += 25;

      const c = report.report_content || {};
      const sections = [
        { label: "History:", val: c.history },
        { label: "Findings:", val: c.findings },
        { label: "Conclusion:", val: c.conclusion },
      ];

      sections.forEach((s) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 40;
        }

        doc.font("Times-Bold").fontSize(10).text(s.label, 40, currentY);
        currentY += 15;

        doc
          .font("Times-Roman")
          .fontSize(10)
          .text(s.val || "-", 40, currentY);

        currentY = doc.y + 15;
      });

      /* ======================================================
         5. IMAGES
      ====================================================== */
      if (images.length > 0) {
        if (currentY > 550) {
          doc.addPage();
          currentY = 40;
        }

        doc.font("Times-Bold").fontSize(10).text("Key Images:", 40, currentY);
        currentY += 20;

        let xPos = 40;

        images.forEach((img, i) => {
          const imgPath = path.join(__dirname, "..", img.image_path);
          if (fs.existsSync(imgPath)) {
            if (i > 0 && i % 3 === 0) {
              xPos = 40;
              currentY += 110;
            }

            doc.image(imgPath, xPos, currentY, { width: 100 });
            xPos += 115;
          }
        });
      }

      /* ======================================================
         6. SIGNATURES
      ====================================================== */
      doc.font("Times-Bold").fontSize(10);
      doc.text(`Reported By: ${report.reported_by || "N/A"}`, 40, 750);
      doc.text(`Approved By: ${report.approved_by || "N/A"}`, 400, 750);

      doc.end();

      stream.on("finish", () => resolve(pdfPath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};
