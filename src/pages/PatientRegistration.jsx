import React, { useState, useRef, useEffect } from "react";
import "./PatientRegistration.css";
import dayjs from "dayjs";
import cn from 'classnames';
import { toast } from "react-hot-toast";


import {
    User, Phone, Calendar, Heart, Activity, FileText,
    CreditCard, CheckCircle, Search, ChevronRight, ChevronLeft,
    AlertCircle, ShieldCheck, Stethoscope, Users, MapPin,
    Camera, Fingerprint, Building, PenTool
} from "lucide-react";

// Add this helper to the top of your file
const Button = ({ children, className, variant, size, ...props }) => {
  const baseStyles = "px-4 py-2 rounded-md font-medium transition-all flex items-center justify-center";
  const variants = {
    ghost: "bg-transparent hover:bg-slate-100 text-slate-600",
    default: "bg-indigo-600 text-white hover:bg-indigo-700",
  };
  const sizes = {
    sm: "text-xs px-2 py-1",
    default: "text-sm px-4 py-2",
  };

  const variantClass = variants[variant] || variants.default;
  const sizeClass = sizes[size] || sizes.default;

  return (
    <button 
      className={`${baseStyles} ${variantClass} ${sizeClass} ${className || ""}`} 
      {...props}
    >
      {children}
    </button>
  );
};
const STEPS = [
  { id: 1, title: "Identity" },
  { id: 2, title: "Demographics" },
  { id: 3, title: "Clinical" },
  { id: 4, title: "Workflow" },
  { id: 5, title: "Billing" },
  { id: 6, title: "Consent" },
];

export default function PatientRegistration({ onClose, onSave, initialData = null }) {
  const [step, setStep] = useState(1);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
// Form Data State
    const [formData, setFormData] = useState({
        // Identity
        phone: "",
        abha_number: "",
        abha_address: "",
        idType: "AADHAAR",
        idNumber: "",
        voter_id: "",
        biometric_flag: false,
        registration_channel: "DESK",
        photo_url: "",

        // Demographics
        title: "", // Dr., Mr., Ms. etc
        firstName: "",
        lastName: "",
        // firstName & lastName handled at bottom with initialData
        name: "", // Computed
        dob: "",
        age: "",
        gender: "Male",
        relationship_type: "S/O",
        relationship_name: "",
        marital_status: "Single",
        occupation: "",
        nationality: "Indian",
        language_preference: "English",
        address: "",
        email: "",

        // Emergency & Secondary Contact
        emergency_contact_name: "",
        emergency_contact_phone: "",
        emergency_contact_relation: "",
        secondaryContactName: "",
        secondaryContactPhone: "",

        // Clinical
        blood_group: "",
        height_cm: "",
        weight_kg: "",
        allergies: "",
        current_medications: "",
        medical_history: "",
        isPregnant: false, // Female only
        isFormFLocked: false,
        husband_name: "",
        menstrual_status: "", // e.g. Regular, Irregular, Menopause
        lmp_date: "", // Female only
        edd: "", // Calculated
        gestational_age: "", // Calculated
        creatinine_level: "",
        contrast_safety_flag: true,
        modalities: [], // e.g. ["CT", "MRI"]
        study_type: "",

        // Workflow
        patient_type: "OPD",
        visit_type: "NEW",
        department: "General Medicine",
        attending_physician: "",
        ward_room_bed: "",

        // Billing
        billing_category: "Self-Pay",
        insurance_provider: "",
        insurance_id: "",

        // Consent
        consent_image_sharing: false,
        consent_research_ai: false,
        consent_telemedicine: false,
        data_privacy_accepted: true,
        digital_signature: "",
        indication_for_scan: "",
    });

    useEffect(() => {
        if (!initialData) return;
        const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
        const isNumericOnly = (v) => /^\d+$/.test(String(v || "").trim());
        const fullName = pick(initialData.full_name, initialData.patient_name, initialData.name, "");
        const modalitiesFromDb = pick(initialData.modality, initialData.modalities, "");
        const prefetchedIdNumber = pick(initialData.id_number, initialData.idNumber, initialData.id_proof, initialData.voter_id, "");
        const prefetchedOccupation = pick(initialData.occupation, "");
        const sanitizedOccupation =
          prefetchedOccupation &&
          prefetchedIdNumber &&
          String(prefetchedOccupation).trim() === String(prefetchedIdNumber).trim() &&
          isNumericOnly(prefetchedOccupation)
            ? ""
            : prefetchedOccupation;
        setFormData((prev) => ({
            ...prev,
            phone: pick(initialData.mobile, initialData.phone, prev.phone),
            abha_number: pick(initialData.abha_number, prev.abha_number),
            abha_address: pick(initialData.abha_address, prev.abha_address),
            voter_id: pick(initialData.voter_id, prev.voter_id),
            idType: pick(initialData.id_type, initialData.idType, prev.idType),
            idNumber: pick(initialData.id_number, initialData.idNumber, initialData.id_proof, initialData.voter_id, prev.idNumber),
            registration_channel: pick(initialData.registration_channel, prev.registration_channel),
            title: pick(initialData.title, prev.title),
            firstName: pick(initialData.first_name, fullName.split(" ")[0], prev.firstName),
            lastName: pick(initialData.last_name, fullName.split(" ").slice(1).join(" "), prev.lastName),
            gender: pick(initialData.gender, prev.gender),
            dob: initialData.dob ? dayjs(initialData.dob).format("YYYY-MM-DD") : prev.dob,
            age: pick(initialData.age, prev.age),
            relationship_type: pick(initialData.relationship_type, prev.relationship_type),
            relationship_name: pick(initialData.relationship_name, prev.relationship_name),
            marital_status: pick(initialData.marital_status, prev.marital_status),
            occupation: pick(sanitizedOccupation, prev.occupation),
            nationality: pick(initialData.nationality, prev.nationality),
            language_preference: pick(initialData.language_preference, prev.language_preference),
            email: pick(initialData.email, initialData.email_address, prev.email),
            address: pick(
                initialData.address,
                initialData.address_line1,
                [initialData.city, initialData.district, initialData.state, initialData.pincode].filter(Boolean).join(", "),
                prev.address
            ),
            emergency_contact_name: pick(initialData.emergency_contact_name, prev.emergency_contact_name),
            emergency_contact_phone: pick(initialData.emergency_contact_phone, prev.emergency_contact_phone),
            emergency_contact_relation: pick(initialData.emergency_contact_relation, prev.emergency_contact_relation),
            secondaryContactName: pick(initialData.secondaryContactName, initialData.secondary_contact_name, prev.secondaryContactName),
            secondaryContactPhone: pick(initialData.secondaryContactPhone, initialData.secondary_contact_phone, prev.secondaryContactPhone),
            biometric_flag: typeof initialData.biometric_flag === "boolean" ? initialData.biometric_flag : prev.biometric_flag,
            blood_group: (() => {
                const bg = pick(initialData.blood_group, initialData.bloodGroup, prev.blood_group);
                return String(bg || "").toUpperCase() === "UNK" ? "" : bg;
            })(),
            height_cm: pick(initialData.height_cm, prev.height_cm),
            weight_kg: pick(initialData.weight_kg, prev.weight_kg),
            allergies: pick(initialData.allergies, prev.allergies),
            current_medications: pick(initialData.current_medications, prev.current_medications),
            medical_history: pick(initialData.medical_history, initialData.clinical_history, prev.medical_history),
            isPregnant: typeof initialData.isPregnant === "boolean" ? initialData.isPregnant : prev.isPregnant,
            menstrual_status: pick(initialData.menstrual_status, prev.menstrual_status),
            lmp_date: initialData.lmp_date ? dayjs(initialData.lmp_date).format("YYYY-MM-DD") : prev.lmp_date,
            edd: initialData.edd ? dayjs(initialData.edd).format("YYYY-MM-DD") : prev.edd,
            gestational_age: pick(initialData.gestational_age, prev.gestational_age),
            creatinine_level: pick(initialData.creatinine_level, prev.creatinine_level),
            contrast_safety_flag: typeof initialData.contrast_safety_flag === "boolean"
              ? initialData.contrast_safety_flag
              : (typeof initialData.contrast === "boolean" ? initialData.contrast : prev.contrast_safety_flag),
            modalities: modalitiesFromDb
              ? String(modalitiesFromDb).split(",").map((m) => m.trim()).filter(Boolean)
              : prev.modalities,
            study_type: pick(initialData.study_type, initialData.study, initialData.indication_for_scan, prev.study_type),
            patient_type: pick(initialData.patient_type, prev.patient_type),
            visit_type: pick(initialData.visit_type, prev.visit_type),
            department: pick(initialData.department, prev.department),
            attending_physician: pick(initialData.attending_physician, initialData.referring_doctor, prev.attending_physician),
            referring_doctor: pick(initialData.referring_doctor, initialData.attending_physician, prev.referring_doctor),
            ward_room_bed: pick(initialData.ward_room_bed, prev.ward_room_bed),
            billing_category: pick(initialData.billing_category, initialData.billing_type, prev.billing_category),
            insurance_provider: pick(initialData.insurance_provider, prev.insurance_provider),
            insurance_id: pick(initialData.insurance_id, prev.insurance_id),
            data_privacy_accepted: typeof initialData.data_privacy_accepted === "boolean" ? initialData.data_privacy_accepted : prev.data_privacy_accepted,
            consent_image_sharing: typeof initialData.consent_image_sharing === "boolean" ? initialData.consent_image_sharing : prev.consent_image_sharing,
            consent_telemedicine: typeof initialData.consent_telemedicine === "boolean" ? initialData.consent_telemedicine : prev.consent_telemedicine,
            consent_research_ai: typeof initialData.consent_research_ai === "boolean" ? initialData.consent_research_ai : prev.consent_research_ai,
            digital_signature: pick(initialData.digital_signature, initialData.signature_file, prev.digital_signature),
            photo_url: pick(initialData.photo_url, prev.photo_url),
            indication_for_scan: pick(initialData.indication_for_scan, initialData.study, prev.indication_for_scan),
        }));
    }, [initialData]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!formData.digital_signature) return;
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = formData.digital_signature;
    }, [formData.digital_signature]);

    // Calculate Age from DOB
    useEffect(() => {
        if (formData.dob) {
            const years = dayjs().diff(dayjs(formData.dob), 'year');
            if (years >= 0) setFormData((prev) => ({ ...prev, age: years }));
        }
    }, [formData.dob]);

    // Calculate EDD and GA from LMP
    useEffect(() => {
        if (formData.lmp_date) {
            const lmp = dayjs(formData.lmp_date);
            const edd = lmp.add(280, 'day'); // 40 weeks
            const now = dayjs();

            const diffDays = now.diff(lmp, 'day');
            const weeks = Math.floor(diffDays / 7);
            const days = diffDays % 7;

            // Only calc if positive and reasonable (< 44 weeks)
            if (diffDays >= 0 && diffDays < 308) {
                setFormData((prev) => ({
                    ...prev,
                    edd: edd.format('YYYY-MM-DD'),
                    gestational_age: `${weeks} Weeks ${days} Days`
                }));
            }
        }
    }, [formData.lmp_date]);

    // Auto-trigger Pregnancy for Obstetric Modalities
    useEffect(() => {
        const obsModalities = ['USG', 'MAMO']; // Add more if specific codes exist like 'OB_USG'
        // Simple logic: If USG is selected and patient is female/age appropriate, suggest pregnancy
        // For now, we just auto-check if "Pregnant" isn't already checked?
        // Or maybe just leave it manual but ensure fields are shown?
        // Let's being conservative: If Modality is USG, we ensure the Pregnancy Section is VISIBLE (which is handled by render logic),
        // but let's strictly check "isPregnant" if they explicitly select an OB Scan if we had that granularity.
        // For now, let's just ensure the fields update correctly.
    }, [formData.modalities]);

   const handleChange = (e) => {
  const { name, value, type, checked } = e.target;
  const val = type === "checkbox" ? checked : value;

  setFormData((prev) => ({
    ...prev,
    [name]: val,
  }));
};

    const handleMultiSelectChange = (e) => {
  const { name, options } = e.target;
  const value = [];

  for (let i = 0; i < options.length; i++) {
    if (options[i].selected) {
      value.push(options[i].value);
    }
  }
        setFormData((prev) => ({ ...prev, [name]: value }));

        // Trigger Pregnancy Check if USG selected for Female
        if (name === 'modalities' && value.includes('USG') && formData.gender === 'Female') {
            // Optional: could auto-set isPregnant, but better to let user confirm.
            // We will settle for ensuring the section is visible.
        }
    };

    const nextStep = () => setStep(prev => Math.min(prev + 1, STEPS.length));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = async () => {
        // Construct full name
        const fullName = `${formData.firstName} ${formData.lastName}`.trim();
        const isNumericOnly = (v) => /^\d+$/.test(String(v || "").trim());
        const occupationLooksLikeId =
          formData.occupation &&
          formData.idNumber &&
          String(formData.occupation).trim() === String(formData.idNumber).trim() &&
          isNumericOnly(formData.occupation);
        const finalData = {
          ...formData,
          name: fullName,
          occupation: occupationLooksLikeId ? "" : formData.occupation,
        };

        if (!finalData.name || !finalData.phone || !finalData.gender) {
            toast.error("Please fill mandatory fields (Name, Phone, Gender)");
            return;
        }

        // PCPNDT Compliance Check
        const effectiveHusbandName = (finalData.husband_name || finalData.relationship_name || "").trim();
        if (finalData.isPregnant && effectiveHusbandName.length < 3) {
            toast.error("PCPNDT Compliance: Husband's Name is mandatory for pregnant patients.");
            // Optionally jump to Step 3
            setStep(3);
            return;
        }

        if (finalData.isPregnant && !finalData.indication_for_scan) {
            toast.error("PCPNDT Compliance: Indication for scan is mandatory for pregnant patients.");
            setStep(3);
            return;
        }

        if (!finalData.digital_signature && !finalData.data_privacy_accepted) {
            toast.error("Signature and Privacy Acceptance required");
            return;
        }
        if (typeof onSave !== "function") {
            toast.error("Save handler is not configured");
            return;
        }

        try {
            setIsSubmitting(true);
            await onSave(finalData);
            toast.success("Patient registered successfully");
        } catch (error) {
            const message =
                error?.response?.data?.error ||
                error?.response?.data?.message ||
                "Failed to register patient";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Signature Canvas Logic
    const startDrawing = (e) => {

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        setIsDrawing(true);
        const rect = canvas.getBoundingClientRect();
        const x = ('clientX' in e ? e.clientX : e.touches[0].clientX) - rect.left;
        const y = ('clientY' in e ? e.clientY : e.touches[0].clientY) - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {

        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = ('clientX' in e ? e.clientX : e.touches[0].clientX) - rect.left;
        const y = ('clientY' in e ? e.clientY : e.touches[0].clientY) - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            setFormData((prev) => ({ ...prev, digital_signature: canvas.toDataURL() }));
        }
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            setFormData((prev) => ({ ...prev, digital_signature: "" }));
        }
    }

    const generatePregnancyCertificate = () => {
        const patientName = `${formData.firstName || ""} ${formData.lastName || ""}`.trim() || "N/A";
        const guardian = formData.husband_name || formData.relationship_name || "N/A";
        const dob = formData.dob ? dayjs(formData.dob).format("DD MMM YYYY") : "N/A";
        const lmp = formData.lmp_date ? dayjs(formData.lmp_date).format("DD MMM YYYY") : "N/A";
        const edd = formData.edd ? dayjs(formData.edd).format("DD MMM YYYY") : "N/A";
        const now = dayjs().format("DD MMM YYYY, hh:mm A");
        const age = formData.age || "N/A";
        const indication = formData.indication_for_scan || "N/A";
        const doctorName = formData.attending_physician || "Radiology Consultant";

        const printWindow = window.open("", "_blank", "width=900,height=700");
        if (!printWindow) {
            toast.error("Popup blocked. Please allow popups to print certificate.");
            return;
        }

        const html = `
          <!doctype html>
          <html>
          <head>
            <title>Pregnancy Certificate</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
              .card { border: 1px solid #d1d5db; border-radius: 10px; padding: 20px; }
              h1 { margin: 0 0 8px 0; font-size: 24px; }
              h2 { margin: 0 0 18px 0; font-size: 14px; color: #4b5563; font-weight: 600; }
              .grid { display: grid; grid-template-columns: 220px 1fr; row-gap: 8px; column-gap: 8px; margin-top: 12px; }
              .label { font-weight: 700; color: #374151; }
              .footer { margin-top: 36px; display: flex; justify-content: space-between; }
              .sign { border-top: 1px solid #6b7280; padding-top: 6px; width: 240px; text-align: center; font-size: 12px; }
              @media print { body { padding: 8px; } }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Pregnancy Certificate</h1>
              <h2>Generated from Patient Registration</h2>
              <div class="grid">
                <div class="label">Patient Name</div><div>${patientName}</div>
                <div class="label">Age / Gender</div><div>${age} / ${formData.gender || "N/A"}</div>
                <div class="label">DOB</div><div>${dob}</div>
                <div class="label">Husband/Guardian Name</div><div>${guardian}</div>
                <div class="label">LMP</div><div>${lmp}</div>
                <div class="label">EDD</div><div>${edd}</div>
                <div class="label">Gestational Age</div><div>${formData.gestational_age || "N/A"}</div>
                <div class="label">Indication</div><div>${indication}</div>
                <div class="label">Generated On</div><div>${now}</div>
              </div>
              <div class="footer">
                <div class="sign">Patient / Guardian Signature</div>
                <div class="sign">${doctorName}</div>
              </div>
            </div>
            <script>
              window.onload = function () {
                window.focus();
                window.print();
              };
            </script>
          </body>
          </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

  /* ================== STEP CONTENT ================== */
  const renderStep = () => {
    switch (step) {
      /* ---------- STEP 1 ---------- */
    case 1: // IDENTITY
  return (
    <div className="pr-step-horizontal">
      
      {/* Info Box */}
      <div className="pr-info-box">
        <div className="pr-info-icon">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h4 className="pr-info-title">Patient Identity Check</h4>
          <p className="pr-info-text">
            Capture Photo, scan ABHA, or enter ID details (Voter ID/Aadhaar) to prevent duplicates.
          </p>
        </div>
      </div>

      {/* Photo Upload */}
      <div className="pr-photo-wrapper">
        <div className="pr-photo-upload">
          {formData.photo_url ? (
            <img src={formData.photo_url} alt="Patient" className="pr-photo-img" />
          ) : (
            <>
              <Camera className="pr-icon-gray" />
              <span className="pr-photo-text">Add Photo</span>
            </>
          )}
          <input
            type="file"
            className="pr-photo-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () =>
                  setFormData((prev) => ({ ...prev, photo_url: reader.result }));
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>
      </div>

      {/* Mobile & ABHA */}
      <div className="pr-grid pr-grid-2 pr-grid-gap">
        <div>
          <label className="pr-label">
            Mobile Number <span className="pr-required">*</span>
          </label>
          <div className="pr-input-with-icon">
            <Phone className="pr-icon" size={16} />
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="10-digit Mobile"
              className="pr-input"
              maxLength={10}
            />
          </div>
        </div>
        <div>
          <label className="pr-label">ABHA Number</label>
          <div className="pr-input-with-icon">
            <Activity className="pr-icon-orange" size={16} />
            <input
              name="abha_number"
              value={formData.abha_number}
              onChange={handleChange}
              placeholder="XX-XXXX-XXXX-XXXX"
              className="pr-input pr-input-with-padding"
            />
          </div>
        </div>
      </div>

     {/* Govt ID Section */}
<div className="pr-grid-3">

  {/* Govt ID Type */}
  <div className="pr-field">
    <label className="pr-label">Govt ID Type</label>
    <select
      name="idType"
      value={formData.idType}
      onChange={handleChange}
      className="pr-select"
    >
      <option value="AADHAAR">Aadhaar Card</option>
      <option value="VOTER_ID">Voter ID</option>
      <option value="PAN">PAN Card</option>
      <option value="DRIVING_LICENSE">Driving License</option>
      <option value="PASSPORT">Passport</option>
    </select>
  </div>

  {/* ID Number */}
  <div className="pr-field">
    <label className="pr-label">ID Number</label>
    <input
      name="idNumber"
      value={formData.idNumber}
      onChange={handleChange}
      placeholder="Enter ID Number"
      className="pr-input"
      autoComplete="off"
    />
  </div>

  {/* Checkbox */}
  <div className="pr-field pr-checkbox-field">
    <input
      type="checkbox"
      id="biometric_flag"
      name="biometric_flag"
      checked={formData.biometric_flag}
      onChange={handleChange}
      className="pr-checkbox"
    />
    <label htmlFor="biometric_flag" className="pr-checkbox-label">
      <Fingerprint size={16} />
      <span>Biometric Verified</span>
    </label>
  </div>

</div>



    </div>
  );



      /* ---------- STEP 2 ---------- */
       case 2: // DEMOGRAPHICS
  return (
    <div className="pr-step-horizontal">

      {/* Row 1: Title | First Name | Last Name */}
      <div className="pr-grid pr-grid-12 pr-grid-gap">
        <div className="pr-col-span-2">
          <label className="pr-label">Title</label>
          <select
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="pr-select"
          >
            <option value="">Select</option>
            <option value="Dr.">Dr.</option>
            <option value="Mr.">Mr.</option>
            <option value="Mrs.">Mrs.</option>
            <option value="Ms.">Ms.</option>
            <option value="Prof.">Prof.</option>
            <option value="Baby">Baby</option>
            <option value="Master">Master</option>
          </select>
        </div>

        <div className="pr-col-span-5">
          <label className="pr-label">First Name <span style={{ color: "red" }}>*</span></label>
          <input
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="First Name"
            className="pr-input"
          />
        </div>

        <div className="pr-col-span-5">
          <label className="pr-label">Last Name</label>
          <input
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Surname"
            className="pr-input"
          />
        </div>
      </div>

      {/* Row 2: Relation */}
      <div className="pr-grid pr-grid-12 pr-grid-gap" style={{ marginTop: "1rem" }}>
        <div className="pr-col-span-3">
          <label className="pr-label">Relation</label>
          <select
            name="relationship_type"
            value={formData.relationship_type}
            onChange={handleChange}
            className="pr-select"
          >
            <option value="Self">Self</option>
            <option value="S/O">S/O (Son of)</option>
            <option value="D/O">D/O (Daughter of)</option>
            <option value="W/O">W/O (Wife of)</option>
            <option value="H/O">H/O (Husband of)</option>
            <option value="C/O">C/O (Care of)</option>
          </select>
        </div>

        <div className="pr-col-span-9">
          <label className="pr-label">Relation Name</label>
          <input
            name="relationship_name"
            value={formData.relationship_name}
            onChange={handleChange}
            placeholder={formData.relationship_type === 'Self' ? "Not Applicable" : "Father/Husband Name"}
            disabled={formData.relationship_type === 'Self'}
            className="pr-input"
          />
        </div>
      </div>

      {/* Row 3: Gender | DOB | Age */}
      <div className="pr-grid pr-grid-12 pr-grid-gap" style={{ marginTop: "1rem" }}>
        <div className="pr-col-span-3">
          <label className="pr-label">Gender <span style={{ color: "red" }}>*</span></label>
          <select
            name="gender"
            value={formData.gender}
            onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
            className="pr-select"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="pr-col-span-6">
          <label className="pr-label">Date of Birth</label>
          <input
            type="date"
            name="dob"
            value={formData.dob}
            onChange={handleChange}
            className="pr-input"
          />
        </div>

        <div className="pr-col-span-3">
          <label className="pr-label">Age</label>
          <input
            name="age"
            value={formData.age}
            onChange={handleChange}
            placeholder="Yrs"
            type="number"
            className="pr-input"
          />
        </div>
      </div>

      {/* Row 4: Marital Status & Occupation */}
      <div className="pr-grid pr-grid-2 pr-grid-gap" style={{ marginTop: "1rem" }}>
        <div>
          <label className="pr-label">Marital Status</label>
          <select
            name="marital_status"
            value={formData.marital_status}
            onChange={handleChange}
            className="pr-select"
          >
            <option>Single</option>
            <option>Married</option>
            <option>Divorced</option>
            <option>Widowed</option>
          </select>
        </div>
        <div>
          <label className="pr-label">Occupation</label>
          <input
            name="occupation"
            value={formData.occupation}
            onChange={handleChange}
            placeholder="e.g. Engineer, Farmer"
            className="pr-input"
            autoComplete="organization-title"
          />
        </div>
      </div>

      {/* Row 5: Language & Nationality */}
      <div className="pr-grid pr-grid-2 pr-grid-gap" style={{ marginTop: "1rem" }}>
        <div>
          <label className="pr-label">Preferred Language</label>
          <select
            name="language_preference"
            value={formData.language_preference}
            onChange={handleChange}
            className="pr-select"
          >
            <option>English</option>
            <option>Hindi</option>
            <option>Kannada</option>
            <option>Marathi</option>
            <option>Telugu</option>
            <option>Tamil</option>
          </select>
        </div>
        <div>
          <label className="pr-label">Nationality</label>
          <input
            name="nationality"
            value={formData.nationality}
            onChange={handleChange}
            className="pr-input"
          />
        </div>
      </div>

      {/* Row 6: Address */}
      <div className="pr-section" style={{ marginTop: "1rem" }}>
        <label className="pr-label">Postal Address</label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="pr-textarea"
          rows={2}
          placeholder="House No, Street, City, State, Pincode"
        />
      </div>

      {/* Row 7: Secondary Contact */}
      <div className="pr-section" style={{ marginTop: "1rem" }}>
        <h5 className="pr-section-title">Secondary Contact</h5>
        <div className="pr-grid pr-grid-2 pr-grid-gap">
          <div>
            <label className="pr-label">Contact Name</label>
            <input
              name="secondaryContactName"
              value={formData.secondaryContactName}
              onChange={handleChange}
              placeholder="Name"
              className="pr-input"
            />
          </div>
          <div>
            <label className="pr-label">Contact Mobile</label>
            <input
              name="secondaryContactPhone"
              value={formData.secondaryContactPhone}
              onChange={handleChange}
              placeholder="Mobile Number"
              className="pr-input"
              maxLength={10}
            />
          </div>
        </div>
      </div>

    </div>
  );


      /* ---------- STEP 3 ---------- */
      case 3: // CLINICAL (ADVANCED)
  return (
    <div className="pr-step-horizontal">

      {/* Vitals */}
      <div className="pr-section">
        <h5 className="pr-section-title"><Activity size={16} /> Vitals & Measurements</h5>
       <div className="pr-grid pr-grid-2 pr-grid-gap">

          <div>
            <label className="pr-label">Blood Group</label>
            <select
              name="blood_group"
              value={formData.blood_group}
              onChange={handleChange}
              className="pr-select"
            >
              <option value="">Unknown</option>
              <option>A+</option><option>A-</option>
              <option>B+</option><option>B-</option>
              <option>AB+</option><option>AB-</option>
              <option>O+</option><option>O-</option>
            </select>
          </div>
          <div>
            <label className="pr-label">Height (cm)</label>
            <input
              name="height_cm"
              type="number"
              value={formData.height_cm}
              onChange={handleChange}
              className="pr-input"
            />
          </div>
          <div>
            <label className="pr-label">Weight (kg)</label>
            <input
              name="weight_kg"
              type="number"
              value={formData.weight_kg}
              onChange={handleChange}
              className="pr-input"
            />
          </div>
        </div>
      </div>

      {/* Radiology Specifics */}
      <div className="pr-section" style={{ backgroundColor: "#eef2ff", borderColor: "#c7d2fe" }}>
        <h5 className="pr-section-title" style={{ color: "#4f46e5" }}><Stethoscope size={16} /> Radiology Context</h5>
        <div className="pr-grid pr-grid-3 pr-grid-gap">
          <div>
            <label className="pr-label" style={{ color: "#4338ca" }}>Planned Modalities</label>
            <select
              multiple
              name="modalities"
              value={formData.modalities}
              onChange={handleMultiSelectChange}
              className="pr-select"
              style={{ height: "6rem" }}
            >
              <option value="CT">CT Scan</option>
              <option value="MRI">MRI</option>
              <option value="X-RAY">X-Ray / DR</option>
              <option value="USG">Ultrasound</option>
              <option value="MAMO">Mammography</option>
              <option value="DEXA">BMD / DEXA</option>
            </select>
            <p style={{ fontSize: "10px", color: "#4338ca", marginTop: "0.25rem" }}>Hold Ctrl/Cmd to select multiple</p>

            <div style={{ marginTop: "0.75rem" }}>
              <label className="pr-label" style={{ color: "#4338ca" }}>Study Type</label>
              <input
                name="study_type"
                value={formData.study_type}
                onChange={handleChange}
                placeholder="e.g. Abdomen with Contrast"
                className="pr-input"
              />
            </div>
          </div>

        <div className="pr-grid pr-grid-2 pr-grid-gap">

            <div>
              <label className="pr-label" style={{ color: "#4338ca" }}>Creatinine (mg/dL)</label>
              <input
                name="creatinine_level"
                type="number"
                value={formData.creatinine_level}
                onChange={handleChange}
                placeholder="e.g. 0.9"
                className="pr-input"
              />
            </div>

            {(formData.gender === 'Female' && parseInt(formData.age || '0') > 12 && parseInt(formData.age || '0') < 60) && (
              <>
                <div>
                  <label className="pr-label" style={{ color: "#db2777" }}>LMP Date</label>
                  <input
                    type="date"
                    name="lmp_date"
                    value={formData.lmp_date}
                    onChange={handleChange}
                    className="pr-input"
                    style={{ backgroundColor: "#fdf2f8", borderColor: "#fbcfe8" }}
                  />
                  {formData.lmp_date && formData.gestational_age && (
                    <div className="pr-section" style={{ backgroundColor: "#fce7f3", borderColor: "#fbcfe8", fontSize: "0.75rem" }}>
                      <div className="pr-grid pr-grid-2 pr-grid-gap">
                        <div>EDD:</div>
                        <div>{dayjs(formData.edd).format('DD MMM YYYY')}</div>
                      </div>
                      <div className="pr-grid pr-grid-2 pr-grid-gap">
                        <div>Gestational Age:</div>
                        <div>{formData.gestational_age}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="pr-label">
                    <input type="checkbox" name="isPregnant" checked={formData.isPregnant} onChange={handleChange} />
                    Confirm Pregnancy?
                  </label>

                  {formData.isPregnant && (
                    <div>
                      <div>
                        <label className="pr-label">Husband's Name <span style={{ color: "red" }}>*</span></label>
                        <input
                          name="husband_name"
                          value={formData.husband_name || (['W/O','H/O'].includes(formData.relationship_type) ? formData.relationship_name : '')}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            husband_name: e.target.value,
                            ...(prev.relationship_type !== 'W/O' ? { relationship_type: 'H/O' } : {}),
                            relationship_name: e.target.value
                          }))}
                          disabled={formData.isFormFLocked}
                          className="pr-input"
                          style={{ backgroundColor: "#fdf2f8", borderColor: "#fbcfe8" }}
                        />
                      </div>

                      <div>
                        <label className="pr-label">Indication for Scan <span style={{ color: "red" }}>*</span></label>
                        <select
                          name="indication_for_scan"
                          value={formData.indication_for_scan || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, indication_for_scan: e.target.value }))}
                          disabled={formData.isFormFLocked}
                          className="pr-select"
                          style={{ backgroundColor: "#fdf2f8", borderColor: "#fbcfe8" }}
                        >
                          <option value="">Select Indication...</option>
                          <option value="To diagnose intra-uterine and/or extra-uterine pregnancy and confirm viability">Diagnose Pregnancy/Viability</option>
                          <option value="Estimation of gestational age (dating)">Dating Scan</option>
                          <option value="Detection of number of fetuses and their chorionicity">Twin/Multiple Pregnancy</option>
                          <option value="Suspected pregnancy with IUCD position determination">IUCD Position</option>
                          <option value="Vaginal bleeding / leaking">Bleeding/Leaking</option>
                          <option value="Follow-up cases of abortion">Follow-up Abortion</option>
                          <option value="Assessment of cervical canal and diameter of internal os">Cervical Assessment</option>
                          <option value="Discrepancy between uterine size and period of amenorrhea">Size/Date Discrepancy</option>
                          <option value="Any other (Specify)">Any other</option>
                        </select>
                      </div>

                      <div style={{ marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="pr-btn-primary"
                          onClick={generatePregnancyCertificate}
                        >
                          Generate Pregnancy Certificate
                        </button>
                      </div>

                      <div style={{ marginTop: "0.5rem" }}>
                        {(() => {
                          const effectiveHusbandName =
                            (formData.husband_name || (['W/O', 'H/O'].includes(formData.relationship_type) ? formData.relationship_name : '') || "").trim();
                          const isReady = Boolean(effectiveHusbandName && formData.indication_for_scan);

                          return (
                            <>
                              <button
                                type="button"
                                className="pr-btn-primary"
                                style={{
                                  width: "100%",
                                  backgroundColor: formData.isFormFLocked ? "#475569" : (isReady ? "#dc2626" : "#94a3b8"),
                                  cursor: formData.isFormFLocked || !isReady ? "not-allowed" : "pointer",
                                }}
                                disabled={formData.isFormFLocked || !isReady}
                                onClick={() => {
                                  if (!isReady) {
                                    toast.error("Please fill Husband Name and Indication first");
                                    return;
                                  }
                                  setFormData((prev) => ({
                                    ...prev,
                                    isFormFLocked: true,
                                    husband_name: effectiveHusbandName,
                                  }));
                                  toast.success("Form F generated and record locked");
                                }}
                              >
                                {formData.isFormFLocked
                                  ? "Record Locked (Form F Generated)"
                                  : isReady
                                  ? "Generate Form F & Lock"
                                  : `Missing: ${!effectiveHusbandName ? "Husband Name" : "Indication"}`}
                              </button>

                              {formData.isFormFLocked && (
                                <button
                                  type="button"
                                  style={{
                                    marginTop: "8px",
                                    width: "100%",
                                    border: "1px solid #fecaca",
                                    background: "#fff1f2",
                                    color: "#be123c",
                                    borderRadius: "8px",
                                    padding: "8px 12px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                  onClick={() => {
                                    const ok = window.confirm("Confirm unlock and delete Form F?");
                                    if (!ok) return;
                                    setFormData((prev) => ({ ...prev, isFormFLocked: false }));
                                    toast.success("Record unlocked");
                                  }}
                                >
                                  Unlock / Delete Form F (Admin)
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="pr-label">
                <input type="checkbox" name="contrast_safety_flag" checked={formData.contrast_safety_flag} onChange={handleChange} />
                Contrast Safe?
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Allergies & Medical History */}
      <div className="pr-grid pr-grid-2 pr-grid-gap">
        <div>
          <label className="pr-label">Allergies</label>
          <textarea
            name="allergies"
            value={formData.allergies}
            onChange={handleChange}
            className="pr-textarea"
            rows={2}
            placeholder="NIL or list allergies..."
          />
        </div>
        <div>
          <label className="pr-label">Medical History</label>
          <textarea
            name="medical_history"
            value={formData.medical_history}
            onChange={handleChange}
            className="pr-textarea"
            rows={2}
            placeholder="Diabetes, Hypertension..."
          />
        </div>
      </div>

    </div>
  );

      /* ---------- STEP 4 ---------- */
      case 4: // WORKFLOW (ADVANCED)
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="pr-grid pr-grid-2">
                            <div className="p-4 border rounded-xl hover:border-blue-400 cursor-pointer transition-colors bg-blue-50/10">
                                <label className="flex gap-2 font-bold text-slate-700 mb-2">

                                    <input type="radio" name="patient_type" value="OPD" checked={formData.patient_type === "OPD"} onChange={handleChange} />
                                    OPD (Outpatient)
                                </label>
                                <p className="text-xs text-slate-500 pl-6">Standard visit.</p>
                            </div>
                            <div className="p-4 border rounded-xl hover:border-purple-400 cursor-pointer transition-colors bg-purple-50/10">
                          <label className="flex gap-2 font-bold text-slate-700 mb-2">


                                    <input type="radio" name="patient_type" value="IPD" checked={formData.patient_type === "IPD"} onChange={handleChange} />
                                    IPD (Inpatient)
                                </label>
                                <p className="text-xs text-slate-500 pl-6">Admitted patient.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-500">Visit Type</label>
                                <select name="visit_type" value={formData.visit_type} onChange={handleChange} className="w-full p-2.5 bg-white border rounded-md text-sm">
                                    <option value="NEW">New Visit</option>
                                    <option value="FOLLOW_UP">Follow Up</option>
                                    <option value="EMERGENCY">Emergency</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-500">Department</label>
                                <input name="department" value={formData.department} onChange={handleChange} placeholder="e.g. Cardiology" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-500">Attending Physician</label>
                                <input name="attending_physician" value={formData.attending_physician} onChange={handleChange} placeholder="Dr. Name" />
                            </div>
                            {formData.patient_type === 'IPD' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500">Ward / Bed / Room</label>
                                    <input name="ward_room_bed" value={formData.ward_room_bed} onChange={handleChange} placeholder="e.g. Ward A / 102" />
                                </div>
                            )}
                        </div>
                    </div>
                );


      /* ---------- STEP 5 ---------- */
      case 5: // BILLING
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                            <label className="text-sm font-bold uppercase text-orange-900 block mb-2">Billing Category</label>
                            <select name="billing_category" value={formData.billing_category} onChange={handleChange} className="w-full p-3 border rounded-md text-sm">
                                <option value="Self-Pay">Self-Pay / Cash</option>
                                <option value="Insurance">Private Insurance</option>
                                <option value="PMJAY">PMJAY / Ayushman Bharat</option>
                                <option value="CGHS">CGHS / ECHS</option>
                                <option value="Corporate">Corporate Tie-up</option>
                            </select>
                        </div>

                        {formData.billing_category !== "Self-Pay" && (
                            <div className="animate-in fade-in duration-300">
                                <h4 className="font-bold text-slate-700 text-sm mb-4">Insurance Details</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase">Provider</label>
                                        <input name="insurance_provider" placeholder="Provider Name" onChange={handleChange} className="w-full p-2 border rounded-md mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase">Policy / Card No</label>
                                        <input name="insurance_id" placeholder="Policy / Card Number" onChange={handleChange} className="mt-1" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );

      /* ---------- STEP 6 ---------- */
      case 6: // CONSENT & SIGNATURE
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Checkboxes */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-slate-800 border-b pb-2">Consent Declarations</h4>

                               <label className="pr-consent-item">
                                  <input
                                    type="checkbox"
                                    name="data_privacy_accepted"
                                    checked={formData.data_privacy_accepted}
                                    onChange={handleChange}
                                    className="pr-consent-checkbox"
                                  />
                                  <div className="pr-consent-text">
                                    <span className="pr-consent-title">Data Privacy Acceptance</span>
                                    <span className="pr-consent-desc">
                                      I agree to the collection and storage of my medical data as per ABDM norms.
                                    </span>
                                  </div>
                                </label>


                                <label className="pr-consent-item">
                                    <input
                                      type="checkbox"
                                      name="consent_image_sharing"
                                      checked={formData.consent_image_sharing}
                                      onChange={handleChange}
                                      className="pr-consent-checkbox"
                                    />
                                    <div className="pr-consent-text">
                                        <span className="pr-consent-title">Image Sharing Consent</span>
                                        <span className="pr-consent-desc">I allow sharing of anonymized scans for tele-reporting or AI analysis.</span>
                                    </div>
                                </label>

                                <label className="pr-consent-item">
                                    <input
                                      type="checkbox"
                                      name="consent_telemedicine"
                                      checked={formData.consent_telemedicine}
                                      onChange={handleChange}
                                      className="pr-consent-checkbox"
                                    />
                                    <div className="pr-consent-text">
                                      <span className="pr-consent-title">Consent for Telemedicine Services</span>
                                    </div>
                                </label>
                            </div>

                            {/* Signature Pad */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center border-b pb-2">
                                    <h4 className="font-bold text-slate-800">Digital Signature</h4>
                                    <Button size="sm" variant="ghost" className="text-xs text-red-500 h-6" onClick={clearSignature}>Clear</Button>
                                </div>
                                <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 touch-none relative overflow-hidden h-40">
                                    <canvas
                                        ref={canvasRef}
                                        width={400}
                                        height={160}
                                        className="w-full h-full cursor-crosshair"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                    />
                                    {!formData.digital_signature && !isDrawing && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm">
                                            Sign Here
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 text-center">
                                    Use mouse or touch to sign above.
                                </p>
                            </div>
                        </div>
                    </div>
                );

      default:
        return null;
    }
  };

  return (
    <div className="tw fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-full max-w-5xl rounded-xl flex flex-col h-[85vh]">
        {/* HEADER */}
        <div className="p-6 border-b flex justify-between">
          <div>
            <h2 className="text-xl font-bold">New Patient Registration</h2>
            <p className="text-sm text-gray-500">
              Step {step} of 6 — {STEPS[step - 1].title}
            </p>
          </div>
          <button onClick={onClose}>✖</button>
        </div>

       {/* BODY */}
{/* BODY */}
{/* BODY */}
<div className="pr-body flex-1 overflow-y-auto">
  <div className="pr-body-inner w-full h-full">
    {renderStep()}
  </div>
</div>




        {/* FOOTER */}
        <div className="pr-footer">
          <button onClick={step === 1 ? onClose : prevStep}>
            {step === 1 ? "Cancel" : "Back"}
          </button>
          <button
            onClick={step === 6 ? handleSubmit : nextStep}
            disabled={isSubmitting}
           className="pr-btn-primary"
          >
            {step === 6 ? (isSubmitting ? "Saving..." : "Complete Registration") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
