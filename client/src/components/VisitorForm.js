// -----------------changed by rebanta--------------
// Added useRef import to support visitorsRef (current list snapshot) and idempotency guards
import React, { useState, useEffect, useRef } from "react";
// -------------------------------------------------
import { motion, AnimatePresence } from "framer-motion";
import { FaUser, FaWifi, FaInfoCircle, FaFileExcel } from "react-icons/fa";
import { useMsal } from "@azure/msal-react";
import axios from "axios";
import Swal from "sweetalert2";
//--------------------------changed by rebanta------------------------------//
import { validatePhoneLength } from "../utils/phoneUtils";
import duplicateIcon from "../images/duplicate.png";
// -----------------changed by rebanta--------------
// Added BulkUploadModal import for Excel-based batch visitor import feature
import BulkUploadModal from "./BulkUploadModal";
// -------------------------------------------------
//--------------------------changed by rebanta------------------------------//

const MAX_VISITORS = 10;

// ADDED: Phone digit hints per country code
const PHONE_HINTS = {
  "+91": "10 digits",
  "+81": "10–11 digits",
  "+971": "9 digits",
  "+65": "8 digits",
  "+66": "9 digits",
  "+86": "11 digits",
  "+27": "9 digits",
  "+1": "10 digits",
  "+44": "10 digits",
  "+49": "10–11 digits",
  "+33": "9 digits",
  "+61": "9 digits",
  "+46": "7–9 digits",
};

// -----------------changed by rebanta--------------
// Moved COUNTRY_CODES to module scope (was inside component) so it can be
// referenced by splitPhoneByCountryCode without a dependency on the component instance
const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+66", label: "Thailand (+66)" },
  { code: "+86", label: "China (+86)" },
  { code: "+27", label: "South Africa (+27)" },
  { code: "+1", label: "USA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+46", label: "Sweden (+46)" },
];
// -------------------------------------------------

// Flag emoji per country code
const COUNTRY_FLAGS = {
  "+91": "🇮🇳",
  "+81": "🇯🇵",
  "+971": "🇦🇪",
  "+65": "🇸🇬",
  "+66": "🇹🇭",
  "+86": "🇨🇳",
  "+27": "🇿🇦",
  "+1": "🇺🇸",
  "+44": "🇬🇧",
  "+49": "🇩🇪",
  "+33": "🇫🇷",
  "+61": "🇦🇺",
  "+46": "🇸🇪",
};

const isCardFilled = (v) =>
  v.firstName.trim() &&
  v.lastName.trim() &&
  v.email.trim() &&
  v.company.trim() &&
  v.phone.trim() &&
  v.purposeOfVisit.trim() &&
  v.TentativeinTime &&
  v.TentativeoutTime;

// -----------------changed by rebanta--------------
// New helpers: hasVisitorCoreFields checks if any meaningful data exists (used to detect
// pre-filled batches); buildVisitorSeedSignature / buildVisitorBatchSignature produce
// stable JSON keys used to deduplicate repeat-seed effect runs
const hasVisitorCoreFields = (item) =>
  item.firstName || item.lastName || item.email || item.company || item.phone || item.purposeOfVisit;

const buildVisitorSeedSignature = (seed) => ({
  category: seed?.category || "Visitor",
  firstName: seed?.firstName || "",
  lastName: seed?.lastName || "",
  email: seed?.email || "",
  company: seed?.company || "",
  countryCode: seed?.countryCode || "",
  phone: seed?.phone || "",
  purposeOfVisit: seed?.purposeOfVisit || "",
  meetingRoom: seed?.meetingRoom || "",
  laptopSerial: seed?.laptopSerial || "",
  guestWifiRequired: Boolean(seed?.guestWifiRequired),
});

const buildVisitorBatchSignature = (batch) =>
  JSON.stringify(
    (batch || []).map((seed) => ({
      ...buildVisitorSeedSignature(seed),
      TentativeinTime: seed?.TentativeinTime || seed?.inTime || "",
      TentativeoutTime: seed?.TentativeoutTime || seed?.outTime || "",
    }))
  );
// -------------------------------------------------

// -----------------changed by rebanta--------------
// New: splitPhoneByCountryCode robustly extracts country code + local number from a raw
// phone string, replacing the previous single-regex approach that failed for some codes
const splitPhoneByCountryCode = (rawPhone, explicitCountryCode, codeOptions) => {
  const raw = String(rawPhone || "").trim();
  const digits = raw.replace(/\D/g, "");
  const codes = (codeOptions || [])
    .map((item) => item.code)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (explicitCountryCode) {
    const explicitDigits = explicitCountryCode.replace(/\D/g, "");
    if (digits.startsWith(explicitDigits) && digits.length > explicitDigits.length) {
      return { countryCode: explicitCountryCode, phone: digits.slice(explicitDigits.length) };
    }
    return { countryCode: explicitCountryCode, phone: digits };
  }

  for (const code of codes) {
    const ccDigits = code.replace(/\D/g, "");
    if (digits.startsWith(ccDigits) && digits.length > ccDigits.length) {
      return { countryCode: code, phone: digits.slice(ccDigits.length) };
    }
  }

  return { countryCode: "+91", phone: digits };
};
// -------------------------------------------------

export default function VisitorForm({ isMobile, setActiveForm, visitorToEdit,
// -----------------changed by rebanta--------------
// Added repeatSeed, repeatBatch, onRepeatSeedConsumed props for the repeat-visitor
// prefill flow; Array.isArray guard added to accounts to prevent crashes with undefined
 repeatSeed, repeatBatch, onRepeatSeedConsumed }) {
// -------------------------------------------------
  const { accounts } = useMsal();

  const currentAccount = Array.isArray(accounts) ? accounts[0] : null;
  const ssoUserName =
    currentAccount?.name ||
    currentAccount?.username ||
    currentAccount?.localAccountId ||
    "Unknown User";

  const ssoEmail =
    currentAccount?.idTokenClaims?.preferred_username ||
    currentAccount?.username ||
    currentAccount?.idTokenClaims?.email ||
    "Unknown User";
  console.log("Logged-in user email:", ssoEmail);

  const emptyVisitor = {
    category: "Visitor",
    host: ssoUserName,
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    countryCode: "+91",
    phone: "",
    purposeOfVisit: "",
    meetingRoom: "",
    laptopSerial: "",
    guestWifiRequired: false,
    TentativeinTime: "",
    TentativeoutTime: "",
    submittedBy: ssoUserName,
    status: "new",
  };

  const [visitors, setVisitors] = useState([emptyVisitor]);
  const [openIndex, setOpenIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [autofillStates, setAutofillStates] = useState({});
  // -----------------changed by rebanta--------------
  // New state/refs: showBulkUpload controls the Import-from-Excel modal;
  // visitorsRef mirrors state for read-only access inside effects without stale closures;
  // processedRepeatSeedRef / processedRepeatBatchRef prevent duplicate seed effect runs
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const visitorsRef = useRef(visitors);
  const processedRepeatSeedRef = useRef("");
  const processedRepeatBatchRef = useRef("");

  useEffect(() => {
    visitorsRef.current = visitors;
  }, [visitors]);
  // -------------------------------------------------

  const getNowLocal = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const hasUnsavedChanges = () =>
    visitors.some((v) =>
      v.firstName || v.lastName || v.email || v.company ||
      v.phone || v.purposeOfVisit || v.TentativeinTime || v.TentativeoutTime
    );

  useEffect(() => {
    if (currentAccount) {
      const userName =
        currentAccount.name ||
        currentAccount.username ||
        currentAccount.localAccountId ||
        "Unknown User";
      setVisitors((prevVisitors) =>
        prevVisitors.map((v) => ({ ...v, submittedBy: userName, host: userName }))
      );
    }
  }, [currentAccount]);

  useEffect(() => {
    if (visitorToEdit) {
      // -----------------changed by rebanta--------------
      // Replaced manual regex phone split with splitPhoneByCountryCode for robustness
      const phoneParts = splitPhoneByCountryCode(visitorToEdit.phone, visitorToEdit.countryCode, COUNTRY_CODES);
      const parsedCountryCode = phoneParts.countryCode;
      const parsedPhone = phoneParts.phone;
      // -------------------------------------------------

      setVisitors([{
        ...visitorToEdit,
        category: visitorToEdit.category || "Visitor",
        host: visitorToEdit.host || ssoUserName,
        countryCode: parsedCountryCode,
        phone: parsedPhone,
        TentativeinTime: visitorToEdit.inTime
          ? new Date(visitorToEdit.inTime).toISOString().slice(0, 16) : "",
        TentativeoutTime: visitorToEdit.outTime
          ? new Date(visitorToEdit.outTime).toISOString().slice(0, 16) : "",
        submittedBy: ssoUserName,
      }]);
      setOpenIndex(0);
    }
  }, [visitorToEdit, ssoUserName]);

  // -----------------changed by rebanta--------------
  // New: repeatSeed effect — prefills a single visitor card from a previously submitted
  // record; idempotency guard prevents double-application on re-renders
  useEffect(() => {
    if (!repeatSeed || visitorToEdit) return;

    const seedSignature = JSON.stringify(buildVisitorSeedSignature(repeatSeed));
    // Guard against repeated effect runs with the same repeat payload.
    if (processedRepeatSeedRef.current === seedSignature) return;
    processedRepeatSeedRef.current = seedSignature;

    const phoneParts = splitPhoneByCountryCode(repeatSeed.phone, repeatSeed.countryCode, COUNTRY_CODES);
    const parsedCountryCode = phoneParts.countryCode;
    const parsedPhone = phoneParts.phone;

      const nextVisitor = {
        category: repeatSeed.category || "Visitor",
        host: ssoUserName,
        firstName: repeatSeed.firstName || "",
        lastName: repeatSeed.lastName || "",
        email: repeatSeed.email || "",
        company: repeatSeed.company || "",
        countryCode: parsedCountryCode,
        phone: parsedPhone,
        purposeOfVisit: "",
      meetingRoom: "",
      laptopSerial: repeatSeed.laptopSerial || "",
      guestWifiRequired: false,
      TentativeinTime: "",
      TentativeoutTime: "",
      submittedBy: ssoEmail,
      status: "new",
    };

    setVisitors((prev) => {
      const hasFilledEntries = prev.some(hasVisitorCoreFields);
      const base = hasFilledEntries ? prev : [];
      const combined = [...base, nextVisitor].slice(0, MAX_VISITORS);

      if (combined.length === base.length) {
        Swal.fire({ icon: "warning", title: `Maximum ${MAX_VISITORS} visitors allowed per submission.` });
      }

      setOpenIndex(Math.max(0, combined.length - 1));
      return combined;
    });
    setAutofillStates({});
    if (typeof onRepeatSeedConsumed === "function") onRepeatSeedConsumed();
  }, [repeatSeed, visitorToEdit, ssoUserName, ssoEmail, onRepeatSeedConsumed]);
  // -------------------------------------------------

  // -----------------changed by rebanta--------------
  // New: repeatBatch effect — prefills multiple visitor cards from a history batch;
  // idempotency guard and slot-limit warning prevent duplicate cards and overflow
  useEffect(() => {
    if (!repeatBatch || visitorToEdit || !Array.isArray(repeatBatch) || repeatBatch.length === 0) return;

    const batchSignature = buildVisitorBatchSignature(repeatBatch);
    // Guard against repeated effect runs with the same repeat batch.
    if (processedRepeatBatchRef.current === batchSignature) return;
    processedRepeatBatchRef.current = batchSignature;

    const mapped = repeatBatch.slice(0, MAX_VISITORS).map((seed) => {
      const phoneParts = splitPhoneByCountryCode(seed.phone, seed.countryCode, COUNTRY_CODES);
      const parsedCountryCode = phoneParts.countryCode;
      const parsedPhone = phoneParts.phone;
      const parsedInTime = seed.TentativeinTime
        ? seed.TentativeinTime
        : seed.inTime
          ? new Date(seed.inTime).toISOString().slice(0, 16)
          : "";
      const parsedOutTime = seed.TentativeoutTime
        ? seed.TentativeoutTime
        : seed.outTime
          ? new Date(seed.outTime).toISOString().slice(0, 16)
          : "";

        return {
          category: seed.category || "Visitor",
          host: ssoUserName,
          firstName: seed.firstName || "",
          lastName: seed.lastName || "",
          email: seed.email || "",
          company: seed.company || "",
          countryCode: parsedCountryCode,
          phone: parsedPhone,
          purposeOfVisit: "",
        meetingRoom: "",
        laptopSerial: seed.laptopSerial || "",
        guestWifiRequired: false,
        TentativeinTime: parsedInTime,
        TentativeoutTime: parsedOutTime,
        submittedBy: ssoEmail,
        status: "new",
      };
    });

    setVisitors((prev) => {
      const hasFilledEntries = prev.some(hasVisitorCoreFields);
      const base = hasFilledEntries ? prev : [];
      const combined = [...base, ...mapped].slice(0, MAX_VISITORS);

      setOpenIndex(Math.max(0, combined.length - 1));
      return combined;
    });
    setAutofillStates({});

    const hasFilledEntries = visitorsRef.current.some(hasVisitorCoreFields);
    const existingCount = hasFilledEntries ? visitorsRef.current.length : 0;
    const availableSlots = Math.max(0, MAX_VISITORS - existingCount);
    if (repeatBatch.length > availableSlots) {
      Swal.fire({ icon: "warning", title: `Only first ${availableSlots} visitors were added due to form limit.` });
    }

    if (typeof onRepeatSeedConsumed === "function") onRepeatSeedConsumed();
  }, [repeatBatch, visitorToEdit, ssoUserName, ssoEmail, onRepeatSeedConsumed]);
  // -------------------------------------------------

  const handleChange = (index, field, value) => {
    setVisitors((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const toggleAutofillForFields = (index, key, fields) => {
    const stateKey = `${index}-${key}`;
    const shouldClear = !!autofillStates[stateKey];
    setVisitors((prev) => {
      const firstEntry = prev[0] || {};
      return prev.map((item, i) => {
        if (i !== index) return item;
        const updatedItem = { ...item };
        fields.forEach((field) => {
          updatedItem[field] = shouldClear ? "" : firstEntry[field] || "";
        });
        return updatedItem;
      });
    });
    setAutofillStates((prev) => ({ ...prev, [stateKey]: !prev[stateKey] }));
  };

  const renderAutofillButton = (index, key, fields) => {
    if (visitorToEdit || visitors.length <= 1 || index === 0) return null;
    const stateKey = `${index}-${key}`;
    const isClearMode = !!autofillStates[stateKey];
    return (
      <button
        type="button"
        title={isClearMode ? "Click to clear autofill" : "Autofill from Visitor 1"}
        className="btn"
        style={{
          width: "34px", height: "34px", padding: 0,
          display: "grid", placeItems: "center", borderRadius: "8px", flexShrink: 0,
          border: isClearMode ? "1.5px solid #bbf7d0" : "1.5px solid #bfdbfe",
          background: isClearMode ? "#f0fdf4" : "#eff6ff",
          color: isClearMode ? "#16a34a" : "#2563eb",
          fontSize: "15px",
          transition: "background 0.18s, color 0.18s, border-color 0.18s",
        }}
        onMouseEnter={(e) => {
          if (isClearMode) {
            e.currentTarget.style.background = "#fef2f2";
            e.currentTarget.style.color = "#dc2626";
            e.currentTarget.style.borderColor = "#fecaca";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isClearMode ? "#f0fdf4" : "#eff6ff";
          e.currentTarget.style.color = isClearMode ? "#16a34a" : "#2563eb";
          e.currentTarget.style.borderColor = isClearMode ? "#bbf7d0" : "#bfdbfe";
        }}
        onClick={(e) => { e.stopPropagation(); toggleAutofillForFields(index, key, fields); }}
      >
        {isClearMode ? "✓" : <img src={duplicateIcon} alt="copy" style={{ width: "18px", height: "18px" }} />}
      </button>
    );
  };

  const addVisitor = () => {
    if (visitors.length >= MAX_VISITORS) {
      Swal.fire({ icon: "warning", title: `Maximum ${MAX_VISITORS} visitors allowed per submission.` });
      return;
    }
    setVisitors([...visitors, { ...emptyVisitor, submittedBy: ssoUserName, host: ssoUserName }]);
    setOpenIndex(visitors.length);
  };

  const removeVisitor = (index) => {
    const updated = visitors.filter((_, i) => i !== index);
    setVisitors(updated);
    setOpenIndex(index > 0 ? index - 1 : 0);
    setAutofillStates((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => { if (!k.startsWith(`${index}-`)) next[k] = prev[k]; });
      return next;
    });
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      Swal.fire({
        icon: "warning",
        title: "Discard changes?",
        text: "You have unsaved entries. Are you sure you want to cancel?",
        showCancelButton: true,
        confirmButtonText: "Yes, discard",
        cancelButtonText: "Keep editing",
        confirmButtonColor: "#dc2626",
      }).then((result) => { if (result.isConfirmed) setActiveForm(null); });
    } else {
      setActiveForm(null);
    }
  };

  const validate = () => {
    let temp = {};
    const now = new Date();

    // Duplicate detection
    const seen = {};
    visitors.forEach((v, i) => {
      const key = `${v.firstName.trim().toLowerCase()}_${v.lastName.trim().toLowerCase()}_${v.phone.trim()}`;
      if (seen[key] !== undefined) {
        temp[`duplicate_${i}`] = `Visitor ${i + 1} has the same name and phone as Visitor ${seen[key] + 1}`;
      } else {
        seen[key] = i;
      }
    });

    visitors.forEach((v, i) => {
      const phoneCheck = validatePhoneLength(v.countryCode, v.phone);
      if (!phoneCheck.valid) temp.phone = phoneCheck.message;
      if (!v.countryCode || v.countryCode.trim() === "") temp.countryCode = "Country code is required";
      if (!v.host || v.host.trim() === "") temp.host = "Host is required";

      if (!v.TentativeinTime) {
        temp[`inTime_${i}`] = "Tentative In Time is required";
      } else if (new Date(v.TentativeinTime) < now) {
        temp[`inTime_${i}`] = "In Time cannot be in the past";
      }
      if (!v.TentativeoutTime) {
        temp[`outTime_${i}`] = "Tentative Out Time is required";
      } else if (v.TentativeinTime && new Date(v.TentativeoutTime) <= new Date(v.TentativeinTime)) {
        temp[`outTime_${i}`] = "Out Time must be after In Time";
      }
    });

    setErrors(temp);
    return Object.keys(temp).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      Swal.fire({ icon: "error", title: "Invalid Input", text: "Please fix the errors before submitting." });
      return;
    }
    setLoading(true);
    try {
      const payload = visitors.map((v) => ({
        ...v,
        phone: `${v.countryCode}${v.phone}`,
        inTime: v.TentativeinTime ? new Date(v.TentativeinTime) : null,
        outTime: v.TentativeoutTime ? new Date(v.TentativeoutTime) : null,
        submittedBy: ssoEmail,
      }));

      if (visitorToEdit) {
        await axios.put(`${process.env.REACT_APP_API_URL}/api/visitors/${visitorToEdit._id}`, payload[0]);
        Swal.fire({ icon: "success", title: "Visitor Updated!", showConfirmButton: false, timer: 2000 });
      } else {
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/visitors`, payload);
        console.log(response);
        Swal.fire({ icon: "success", title: "Visitors Submitted!", showConfirmButton: false, timer: 2000 });
      }

      setVisitors([{ ...emptyVisitor, submittedBy: ssoEmail, host: ssoUserName }]);
      setOpenIndex(0);
      setActiveForm(null);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.error || err.message });
    }
    setLoading(false);
  };

  return (
    <motion.div
      className="p-4 shadow-lg rounded-4 position-relative"
      style={{ flex: isMobile ? "1 1 100%" : "0 0 500px", marginTop: isMobile ? "15px" : "0", background: "#F2F2F2" }}
      initial={{ x: 200, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 200, opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="d-flex justify-content-between align-items-center mb-4">
        {/* -----------------changed by rebanta-------------- */}
        {/* Replaced plain <h3> with flex header row; added "Import from Excel" button
            that opens BulkUploadModal for batch visitor import via Excel spreadsheet */}
        <h3 className="fw-bold text-center mb-0">
          {visitorToEdit ? "Edit Visitor" : "Visitor Details"}
        </h3>
        {!visitorToEdit && (
          <button
            type="button"
            className="btn visitor-inline-btn btn-success btn-sm shadow px-3 me-2"
            title="Import visitors from an Excel file"
            onClick={() => setShowBulkUpload(true)}
          >
            <FaFileExcel className="me-2" />
            Import from Excel
          </button>
        )}
        {/* ------------------------------------------------- */}
      </div>

      <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
        {visitors.map((visitor, index) => (
          <motion.div
            key={index}
            className="p-3 rounded-4 shadow-sm border"
            style={{ background: "linear-gradient(90deg, #F2F2F2, #CECECE)" }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5
                className="fw-bold mb-0 d-flex align-items-center"
                style={{ cursor: "pointer" }}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <FaUser className="me-2 text-primary" /> Visitor {index + 1}
                {isCardFilled(visitor) && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block", marginLeft: 8 }} />
                )}
              </h5>
              {!visitorToEdit && index > 0 && (
                <button
                  className="btn btn-outline-danger btn-sm"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeVisitor(index); }}
                >
                  Remove
                </button>
              )}
            </div>

            {errors[`duplicate_${index}`] && (
              <div className="alert alert-warning py-1 px-2 mb-2" style={{ fontSize: "12px" }}>
                ⚠ {errors[`duplicate_${index}`]}
              </div>
            )}

            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="d-flex flex-column gap-2"
                >
                  {/* Host */}
                  <label className="fw-bold">Host</label>
                  <div className="d-flex gap-2 align-items-start">
                    <input
                      className="form-control flex-grow-1"
                      placeholder="Host"
                      required
                      value={visitor.host}
                      onChange={(e) => handleChange(index, "host", e.target.value)}
                      disabled={!visitor.onBehalfOf}
                    />
                    <button
                      type="button"
                      className={`btn visitor-inline-btn ${visitor.onBehalfOf ? "btn-primary" : "btn-outline-primary"}`}
                      style={{ whiteSpace: "nowrap", fontSize: "13px", fontWeight: 600 }}
                      onClick={() => handleChange(index, "onBehalfOf", !visitor.onBehalfOf)}
                    >
                      👥 On behalf of
                    </button>
                    {renderAutofillButton(index, "host", ["host"])}
                  </div>
                  {errors.host && <p style={{ color: "red", fontSize: "12px", marginTop: "5px" }}>{errors.host}</p>}

                  {/* First Name + Last Name side by side */}
                  <div className="d-flex gap-2">
                    <input
                      className="form-control"
                      placeholder="First Name"
                      required
                      value={visitor.firstName}
                      onChange={(e) => handleChange(index, "firstName", e.target.value)}
                      onKeyPress={(e) => { if (!/^[a-zA-Z\s]$/.test(e.key)) e.preventDefault(); }}
                    />
                    <input
                      className="form-control"
                      placeholder="Last Name"
                      required
                      value={visitor.lastName}
                      onChange={(e) => handleChange(index, "lastName", e.target.value)}
                      onKeyPress={(e) => { if (!/^[a-zA-Z\s]$/.test(e.key)) e.preventDefault(); }}
                    />
                  </div>

                  <input
                    className="form-control"
                    placeholder="Email"
                    required
                    type="email"
                    value={visitor.email}
                    onChange={(e) => handleChange(index, "email", e.target.value)}
                  />

                  {/* Company */}
                  <div>
                    <div className="d-flex gap-2 align-items-center">
                      <input
                        className="form-control"
                        placeholder="Company"
                        required
                        value={visitor.company}
                        onChange={(e) => handleChange(index, "company", e.target.value)}
                      />
                      {renderAutofillButton(index, "company", ["company"])}
                    </div>
                    {autofillStates[`${index}-company`] && (
                      <small style={{ color: "#16a34a", paddingLeft: "2px" }}>✓ Autofilled from Visitor 1</small>
                    )}
                  </div>

                  {/* Phone — Flag + inline badge style */}
                  <div
                    className="d-flex align-items-center"
                    style={{
                      border: "1px solid #dee2e6",
                      borderRadius: "8px",
                      overflow: "hidden",
                      background: "white",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#86b7fe"; e.currentTarget.style.boxShadow = "0 0 0 0.25rem rgba(13,110,253,.25)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#dee2e6"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {/* Flag trigger — clicking opens native select */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "8px 10px",
                          background: "#f8f9fa",
                          borderRight: "1px solid #dee2e6",
                          cursor: "pointer",
                          minWidth: "90px",
                          userSelect: "none",
                        }}
                      >
                        <span style={{ fontSize: "1rem", lineHeight: 1 }}>{COUNTRY_FLAGS[visitor.countryCode] || "🌐"}</span>
                        <span style={{ fontSize: "1rem", fontWeight: "inherit", color: "inherit" }}>{visitor.countryCode}</span>
                        <span style={{ fontSize: "10px", color: "#888" }}>▼</span>
                      </div>
                      <select
                        style={{
                          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                          opacity: 0, cursor: "pointer", border: "none", outline: "none",
                        }}
                        value={visitor.countryCode || "+91"}
                        onChange={(e) => handleChange(index, "countryCode", e.target.value)}
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <input
                      style={{ border: "none", outline: "none", flex: 1, padding: "6px 10px", fontSize: "1rem", background: "transparent", fontFamily: "inherit", fontWeight: "inherit", color: "inherit" }}
                      placeholder="Phone Number"
                      type="tel"
                      required
                      value={visitor.phone}
                      onChange={(e) => handleChange(index, "phone", e.target.value)}
                      onKeyPress={(e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); }}
                      maxLength={15}
                    />

                    {/* Inline badge */}
                    <span style={{
                      background: "#fff3e0",
                      color: "#e67e00",
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "20px",
                      marginRight: "8px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}>
                      {PHONE_HINTS[visitor.countryCode] || "Enter number"}
                    </span>
                  </div>
                  {(errors.countryCode || errors.phone) && (
                    <p style={{ color: "red", fontSize: "12px", marginTop: "5px" }}>{errors.countryCode || errors.phone}</p>
                  )}

                  {/* Purpose */}
                  <div>
                    <div className="d-flex gap-2 align-items-center">
                      <input
                        className="form-control"
                        placeholder="Purpose of Visit"
                        required
                        value={visitor.purposeOfVisit}
                        onChange={(e) => handleChange(index, "purposeOfVisit", e.target.value)}
                      />
                      {renderAutofillButton(index, "purpose", ["purposeOfVisit"])}
                    </div>
                    {autofillStates[`${index}-purpose`] && (
                      <small style={{ color: "#16a34a", paddingLeft: "2px" }}>✓ Autofilled from Visitor 1</small>
                    )}
                  </div>

                  {/* Meeting Room + Laptop Serial side by side */}
                  <div className="d-flex gap-2">
                    <input
                      className="form-control"
                      placeholder="Meeting Room (optional)"
                      value={visitor.meetingRoom}
                      onChange={(e) => handleChange(index, "meetingRoom", e.target.value)}
                    />
                    <input
                      className="form-control"
                      placeholder="Laptop Serial (optional)"
                      value={visitor.laptopSerial}
                      onChange={(e) => handleChange(index, "laptopSerial", e.target.value)}
                    />
                  </div>

                  {/* WiFi */}
                  <div className="d-flex align-items-center mt-3">
                    <FaWifi className={`me-2 fs-5 ${visitor.guestWifiRequired ? "text-success" : "text-secondary"}`} />
                    <strong className="me-2">Guest Wi-Fi:</strong>
                    <div
                      className={`wifi-toggle ${visitor.guestWifiRequired ? "active" : ""}`}
                      onClick={() => handleChange(index, "guestWifiRequired", !visitor.guestWifiRequired)}
                    >
                      <div className="toggle-circle"></div>
                    </div>
                  </div>

                  {/* Tentative In Time */}
                  <label className="fw-bold mt-3 d-flex align-items-center gap-2">
                    <span>Tentative In Time</span>
                    <span
                      title="If Tentative Out is more than 24 hours after Tentative In, this entry is treated as repeated and daily pass tracking rules apply."
                      style={{ cursor: "pointer", color: "#6b7280", fontSize: "0.9rem", lineHeight: 1 }}
                      aria-label="Repeated visit rule"
                    >
                      <FaInfoCircle />
                    </span>
                  </label>
                  <div className="d-flex gap-2 align-items-center">
                    <input
                      type="datetime-local"
                      className={`form-control ${errors[`inTime_${index}`] ? "is-invalid" : ""}`}
                      required
                      min={getNowLocal()}
                      value={visitor.TentativeinTime}
                      onChange={(e) => handleChange(index, "TentativeinTime", e.target.value)}
                    />
                    {renderAutofillButton(index, "times", ["TentativeinTime", "TentativeoutTime"])}
                  </div>
                  {errors[`inTime_${index}`] && (
                    <small style={{ color: "red" }}>⚠ {errors[`inTime_${index}`]}</small>
                  )}

                  {/* Tentative Out Time */}
                  <label className="fw-bold mt-2">Tentative Out Time</label>
                  <input
                    type="datetime-local"
                    className={`form-control ${errors[`outTime_${index}`] ? "is-invalid" : ""}`}
                    required
                    min={visitor.TentativeinTime || getNowLocal()}
                    value={visitor.TentativeoutTime}
                    onChange={(e) => handleChange(index, "TentativeoutTime", e.target.value)}
                  />
                  {errors[`outTime_${index}`] && (
                    <small style={{ color: "red" }}>⚠ {errors[`outTime_${index}`]}</small>
                  )}
                  {autofillStates[`${index}-times`] && (
                    <small style={{ color: "#16a34a", paddingLeft: "2px" }}>✓ Autofilled from Visitor 1</small>
                  )}

                  <p className="text-muted mt-2 mb-0">
                    <small>Submitted by: {visitor.submittedBy}</small>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {!visitorToEdit && (
          <motion.button
            type="button"
            className="bg-dark text-white mt-2 py-2 rounded-3 border-0"
            onClick={addVisitor}
            whileHover={{ scale: 1.05 }}
            disabled={visitors.length >= MAX_VISITORS}
          >
            + Add Another Visitor
            {visitors.length >= MAX_VISITORS ? " (max reached)" : ` (${MAX_VISITORS - visitors.length} remaining)`}
          </motion.button>
        )}

        <div className="d-flex justify-content-between mt-3">
          <motion.button type="button" className="btn btn-outline-danger px-4 py-2" onClick={handleCancel} whileHover={{ scale: 1.05 }}>
            Cancel
          </motion.button>
          <motion.button type="submit" className="btn btn-success px-4 py-2" disabled={loading} whileHover={{ scale: 1.05 }}>
            {loading ? "Submitting..." : visitorToEdit ? "Save Changes" : "Submit"}
          </motion.button>
        </div>
      </form>

      <style>{`
        .wifi-toggle { width: 50px; height: 26px; background: #ccc; border-radius: 50px; display: flex; align-items: center; padding: 3px; cursor: pointer; transition: background 0.3s ease; }
        .wifi-toggle.active { background: rgb(7, 143, 167); }
        .toggle-circle { width: 20px; height: 20px; background: white; border-radius: 50%; transition: transform 0.3s ease; }
        .wifi-toggle.active .toggle-circle { transform: translateX(24px); }
        .visitor-inline-btn { height: 38px; display: inline-flex; align-items: center; white-space: nowrap; flex-shrink: 0; }
      `}</style>

      {/* -----------------changed by rebanta-------------- */}
      {/* New: BulkUploadModal renders outside the form; accepts hostName and submittedBy
          from SSO state; controlled by showBulkUpload flag */}
      <BulkUploadModal
        show={showBulkUpload}
        type="visitor"
        hostName={ssoUserName}
        submittedBy={ssoEmail}
        onClose={() => setShowBulkUpload(false)}
      />
      {/* ------------------------------------------------- */}
    </motion.div>
  );
}