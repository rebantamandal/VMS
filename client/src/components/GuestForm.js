// -----------------changed by rebanta--------------
// Added useRef import to support guestsRef snapshot and idempotency guard refs
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
// Added BulkUploadModal import for Excel-based batch guest import feature
import BulkUploadModal from "./BulkUploadModal";
// -------------------------------------------------
//--------------------------changed by rebanta------------------------------//

const MAX_GUESTS = 10;

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

const isCardFilled = (g) =>
  g.firstName.trim() &&
  g.lastName.trim() &&
  g.email.trim() &&
  g.company.trim() &&
  g.phone.trim() &&
  g.purposeOfVisit.trim() &&
  g.TentativeinTime &&
  g.TentativeoutTime;

// -----------------changed by rebanta--------------
// New helpers: hasGuestCoreFields checks if any meaningful data exists (used to detect
// pre-filled batches); buildGuestSeedSignature / buildGuestBatchSignature produce
// stable JSON keys used to deduplicate repeat-seed effect runs
const hasGuestCoreFields = (item) =>
  item.firstName || item.lastName || item.email || item.company || item.phone || item.purposeOfVisit;

const buildGuestSeedSignature = (seed) => ({
  category: seed?.category || "Isuzu Employee",
  firstName: seed?.firstName || "",
  lastName: seed?.lastName || "",
  email: seed?.email || "",
  company: seed?.company || "",
  countryCode: seed?.countryCode || "",
  phone: seed?.phone || "",
  purposeOfVisit: seed?.purposeOfVisit || "",
  meetingRoom: seed?.meetingRoom || "",
  meetingRoomRequired: Boolean(seed?.meetingRoomRequired),
  laptopSerial: seed?.laptopSerial || "",
  guestWifiRequired: Boolean(seed?.guestWifiRequired),
  refreshmentRequired: Boolean(seed?.refreshmentRequired),
  proposedRefreshmentTime: seed?.proposedRefreshmentTime || "",
});

const buildGuestBatchSignature = (batch) =>
  JSON.stringify(
    (batch || []).map((seed) => ({
      ...buildGuestSeedSignature(seed),
      TentativeinTime: seed?.TentativeinTime || seed?.inTime || "",
      TentativeoutTime: seed?.TentativeoutTime || seed?.outTime || "",
    }))
  );
// -------------------------------------------------

// -----------------changed by rebanta--------------
// New: splitPhoneByCountryCode robustly extracts country code + local number,
// replacing the previous single-regex approach that failed for some country codes
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

export default function GuestForm({ isMobile, setActiveForm, guestToEdit,
// -----------------changed by rebanta--------------
// Added repeatSeed, repeatBatch, onRepeatSeedConsumed props for the repeat-guest
// prefill flow; Array.isArray guard added to accounts to prevent crashes with undefined
 repeatSeed, repeatBatch, onRepeatSeedConsumed }) {
// -------------------------------------------------
  const { accounts } = useMsal();

  const currentAccount = Array.isArray(accounts) ? accounts[0] : null;

  const ssoHostName =
    currentAccount?.name ||
    currentAccount?.username ||
    currentAccount?.idTokenClaims?.preferred_username ||
    currentAccount?.idTokenClaims?.email ||
    "Unknown User";

  const ssoEmail =
    currentAccount?.idTokenClaims?.preferred_username ||
    currentAccount?.username ||
    currentAccount?.idTokenClaims?.email ||
    "Unknown User";

  const emptyGuest = {
    category: "Isuzu Employee",
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    host: ssoHostName,
    onBehalfOf: false,
    countryCode: "+91",
    phone: "",
    purposeOfVisit: "",
    meetingRoom: "",
    meetingRoomRequired: false,
    laptopSerial: "",
    guestWifiRequired: false,
    refreshmentRequired: false,
    proposedRefreshmentTime: "",
    TentativeinTime: "",
    TentativeoutTime: "",
    submittedBy: ssoEmail,
    status: "new",
  };

  const [guests, setGuests] = useState([emptyGuest]);
  const [openIndex, setOpenIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autofillStates, setAutofillStates] = useState({});
  // -----------------changed by rebanta--------------
  // New state/refs: showBulkUpload controls the Import-from-Excel modal;
  // guestsRef mirrors state for read-only access inside effects without stale closures;
  // processedRepeatSeedRef / processedRepeatBatchRef prevent duplicate seed effect runs
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const guestsRef = useRef(guests);
  const processedRepeatSeedRef = useRef("");
  const processedRepeatBatchRef = useRef("");

  useEffect(() => {
    guestsRef.current = guests;
  }, [guests]);
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
    guests.some((g) =>
      g.firstName || g.lastName || g.email || g.company ||
      g.phone || g.purposeOfVisit || g.TentativeinTime || g.TentativeoutTime
    );

  useEffect(() => {
    setGuests((prev) =>
      prev.map((g) => ({
        ...g,
        submittedBy: ssoEmail,
        host: g.onBehalfOf ? g.host : ssoHostName,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ssoEmail, ssoHostName]);

  useEffect(() => {
    if (!guestToEdit) return;

    // -----------------changed by rebanta--------------
    // Replaced manual regex phone split with splitPhoneByCountryCode for robustness
    const phoneParts = splitPhoneByCountryCode(guestToEdit.phone, guestToEdit.countryCode, COUNTRY_CODES);
    const parsedCountryCode = phoneParts.countryCode;
    const parsedPhone = phoneParts.phone;
    // -------------------------------------------------

    setGuests([{
      category: guestToEdit.category || "Isuzu Employee",
      firstName: guestToEdit.firstName || "",
      lastName: guestToEdit.lastName || "",
      email: guestToEdit.email || "",
      company: guestToEdit.company || "",
      host: guestToEdit.host || ssoHostName,
      onBehalfOf: guestToEdit.onBehalfOf || false,
      countryCode: parsedCountryCode,
      phone: parsedPhone,
      purposeOfVisit: guestToEdit.purposeOfVisit || "",
      meetingRoom: guestToEdit.meetingRoom || "",
      meetingRoomRequired: guestToEdit.meetingRoomRequired || false,
      laptopSerial: guestToEdit.laptopSerial || "",
      guestWifiRequired: guestToEdit.guestWifiRequired || false,
      refreshmentRequired: guestToEdit.refreshmentRequired || false,
      proposedRefreshmentTime: guestToEdit.proposedRefreshmentTime
        ? new Date(guestToEdit.proposedRefreshmentTime).toISOString().slice(0, 16) : "",
      TentativeinTime: guestToEdit.inTime
        ? new Date(guestToEdit.inTime).toISOString().slice(0, 16) : "",
      TentativeoutTime: guestToEdit.outTime
        ? new Date(guestToEdit.outTime).toISOString().slice(0, 16) : "",
      submittedBy: ssoEmail,
      status: guestToEdit.status || "new",
    }]);
    setOpenIndex(0);
  }, [guestToEdit, ssoEmail, ssoHostName]);

  // -----------------changed by rebanta--------------
  // New: repeatSeed effect — prefills a single guest card from a previously submitted
  // record; idempotency guard prevents double-application on re-renders
  useEffect(() => {
    if (!repeatSeed || guestToEdit) return;

    const seedSignature = JSON.stringify(buildGuestSeedSignature(repeatSeed));
    if (processedRepeatSeedRef.current === seedSignature) return;
    processedRepeatSeedRef.current = seedSignature;

    const phoneParts = splitPhoneByCountryCode(repeatSeed.phone, repeatSeed.countryCode, COUNTRY_CODES);
    const parsedCountryCode = phoneParts.countryCode;
    const parsedPhone = phoneParts.phone;

      const nextGuest = {
        category: repeatSeed.category || "Isuzu Employee",
        firstName: repeatSeed.firstName || "",
        lastName: repeatSeed.lastName || "",
        email: repeatSeed.email || "",
        company: repeatSeed.company || "",
        host: ssoHostName,
        onBehalfOf: false,
        countryCode: parsedCountryCode,
        phone: parsedPhone,
        purposeOfVisit: "",
      meetingRoom: "",
      meetingRoomRequired: false,
      laptopSerial: repeatSeed.laptopSerial || "",
      guestWifiRequired: false,
      refreshmentRequired: false,
      proposedRefreshmentTime: "",
      TentativeinTime: "",
      TentativeoutTime: "",
      submittedBy: ssoEmail,
      status: "new",
    };

    setGuests((prev) => {
      const hasFilledEntries = prev.some(hasGuestCoreFields);
      const base = hasFilledEntries ? prev : [];
      const combined = [...base, nextGuest].slice(0, MAX_GUESTS);

      if (combined.length === base.length) {
        Swal.fire({ icon: "warning", title: `Maximum ${MAX_GUESTS} guests allowed per submission.` });
      }

      setOpenIndex(Math.max(0, combined.length - 1));
      return combined;
    });
    setAutofillStates({});
    if (typeof onRepeatSeedConsumed === "function") onRepeatSeedConsumed();
  }, [repeatSeed, guestToEdit, ssoEmail, ssoHostName, onRepeatSeedConsumed]);
  // -------------------------------------------------

  // -----------------changed by rebanta--------------
  // New: repeatBatch effect — prefills multiple guest cards from a history batch;
  // idempotency guard and slot-limit warning prevent duplicate cards and overflow
  useEffect(() => {
    if (!repeatBatch || guestToEdit || !Array.isArray(repeatBatch) || repeatBatch.length === 0) return;

    const batchSignature = buildGuestBatchSignature(repeatBatch);
    if (processedRepeatBatchRef.current === batchSignature) return;
    processedRepeatBatchRef.current = batchSignature;

    const mapped = repeatBatch.slice(0, MAX_GUESTS).map((seed) => {
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
          category: seed.category || "Isuzu Employee",
          firstName: seed.firstName || "",
          lastName: seed.lastName || "",
          email: seed.email || "",
          company: seed.company || "",
          host: ssoHostName,
          onBehalfOf: false,
          countryCode: parsedCountryCode,
          phone: parsedPhone,
          purposeOfVisit: "",
        meetingRoom: "",
        meetingRoomRequired: false,
        laptopSerial: seed.laptopSerial || "",
        guestWifiRequired: false,
        refreshmentRequired: false,
        proposedRefreshmentTime: "",
        TentativeinTime: parsedInTime,
        TentativeoutTime: parsedOutTime,
        submittedBy: ssoEmail,
        status: "new",
      };
    });

    setGuests((prev) => {
      const hasFilledEntries = prev.some(hasGuestCoreFields);
      const base = hasFilledEntries ? prev : [];
      const combined = [...base, ...mapped].slice(0, MAX_GUESTS);

      setOpenIndex(Math.max(0, combined.length - 1));
      return combined;
    });
    setAutofillStates({});

    const hasFilledEntries = guestsRef.current.some(hasGuestCoreFields);
    const existingCount = hasFilledEntries ? guestsRef.current.length : 0;
    const availableSlots = Math.max(0, MAX_GUESTS - existingCount);
    if (repeatBatch.length > availableSlots) {
      Swal.fire({ icon: "warning", title: `Only first ${availableSlots} guests were added due to form limit.` });
    }

    if (typeof onRepeatSeedConsumed === "function") onRepeatSeedConsumed();
  }, [repeatBatch, guestToEdit, ssoEmail, ssoHostName, onRepeatSeedConsumed]);
  // -------------------------------------------------

  const handleChange = (index, field, value) => {
    setGuests((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const toggleAutofillForFields = (index, key, fields) => {
    const stateKey = `${index}-${key}`;
    const shouldClear = !!autofillStates[stateKey];
    setGuests((prev) => {
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
    if (guestToEdit || guests.length <= 1 || index === 0) return null;
    const stateKey = `${index}-${key}`;
    const isClearMode = !!autofillStates[stateKey];
    return (
      <button
        type="button"
        title={isClearMode ? "Click to clear autofill" : "Autofill from Guest 1"}
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

  const addGuest = () => {
    if (guests.length >= MAX_GUESTS) {
      Swal.fire({ icon: "warning", title: `Maximum ${MAX_GUESTS} guests allowed per submission.` });
      return;
    }
    setGuests((prev) => [...prev, { ...emptyGuest, submittedBy: ssoEmail, host: ssoHostName }]);
    setOpenIndex(guests.length);
  };

  const removeGuest = (index) => {
    setGuests((prev) => prev.filter((_, i) => i !== index));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const now = new Date();
    let validationError = null;
    const seen = {};

    for (let i = 0; i < guests.length; i++) {
      const g = guests[i];

      const dupKey = `${g.firstName.trim().toLowerCase()}_${g.lastName.trim().toLowerCase()}_${g.phone.trim()}`;
      if (seen[dupKey] !== undefined) {
        validationError = `Guest ${i + 1} has the same name and phone as Guest ${seen[dupKey] + 1}.`;
        break;
      }
      seen[dupKey] = i;

      const phoneCheck = validatePhoneLength(g.countryCode, g.phone);
      if (!phoneCheck.valid) { validationError = phoneCheck.message; break; }

      if (g.TentativeinTime && new Date(g.TentativeinTime) < now) {
        validationError = `Guest ${i + 1}: In Time cannot be in the past.`; break;
      }
      if (g.TentativeinTime && g.TentativeoutTime &&
          new Date(g.TentativeoutTime) <= new Date(g.TentativeinTime)) {
        validationError = `Guest ${i + 1}: Out Time must be after In Time.`; break;
      }
      if (g.refreshmentRequired && g.proposedRefreshmentTime) {
        const refresh = new Date(g.proposedRefreshmentTime);
        if (refresh < new Date(g.TentativeinTime) || refresh > new Date(g.TentativeoutTime)) {
          validationError = `Guest ${i + 1}: Refreshment Time must be within the In and Out Time window.`; break;
        }
      }
    }

    if (validationError) {
      setLoading(false);
      Swal.fire({ icon: "error", title: "Validation Error", text: validationError });
      return;
    }

    try {
      const payload = guests.map((g) => ({
        category: g.category,
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        company: g.company,
        host: g.host,
        onBehalfOf: g.onBehalfOf,
        countryCode: g.countryCode,
        phone: `${g.countryCode}${g.phone}`,
        purposeOfVisit: g.purposeOfVisit,
        meetingRoom: g.meetingRoom,
        meetingRoomRequired: g.meetingRoomRequired,
        laptopSerial: g.laptopSerial,
        guestWifiRequired: g.guestWifiRequired,
        refreshmentRequired: g.refreshmentRequired,
        proposedRefreshmentTime: g.proposedRefreshmentTime ? new Date(g.proposedRefreshmentTime) : null,
        inTime: g.TentativeinTime ? new Date(g.TentativeinTime) : null,
        outTime: g.TentativeoutTime ? new Date(g.TentativeoutTime) : null,
        submittedBy: ssoEmail,
        status: g.status || "new",
      }));

      if (guestToEdit) {
        await axios.put(`${process.env.REACT_APP_API_URL}/api/guests/${guestToEdit._id}`, payload[0]);
        Swal.fire({ icon: "success", title: "Guest Updated!", showConfirmButton: false, timer: 2000 });
      } else {
        await axios.post(`${process.env.REACT_APP_API_URL}/api/guests`, payload);
        Swal.fire({ icon: "success", title: "Submission Successful!", showConfirmButton: false, timer: 2000 });
      }

      setGuests([{ ...emptyGuest, submittedBy: ssoEmail, host: ssoHostName }]);
      setOpenIndex(0);
      setActiveForm(null);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Submission Failed", text: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="p-4 shadow-lg rounded-4 position-relative"
      style={{ flex: isMobile ? "1 1 100%" : "0 0 500px", marginTop: isMobile ? "15px" : "0", background: "#F2F2F2" }}
      initial={{ x: isMobile ? 0 : 200, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: isMobile ? 0 : 200, opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="d-flex justify-content-between align-items-center mb-4">
        {/* -----------------changed by rebanta-------------- */}
        {/* Replaced plain <h3> with flex header row; added "Import from Excel" button
            that opens BulkUploadModal for batch guest import via Excel spreadsheet */}
        <h3 className="fw-bold text-center mb-0">
          {guestToEdit ? "Edit Guest" : "Guest Details"}
        </h3>
        {!guestToEdit && (
          <button
            type="button"
            className="btn visitor-inline-btn btn-success btn-sm shadow px-3 me-2"
            title="Import guests from an Excel file"
            onClick={() => setShowBulkUpload(true)}
          >
            <FaFileExcel className="me-2" />
            Import from Excel
          </button>
        )}
        {/* ------------------------------------------------- */}
      </div>

      <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
        {guests.map((guest, index) => (
          <motion.div
            key={index}
            className="p-3 rounded-4 shadow-sm border"
            style={{ background: "linear-gradient(90deg, #F2F2F2, #CECECE)", cursor: "pointer" }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5
                className="fw-bold mb-0 d-flex align-items-center"
                style={{ cursor: "pointer" }}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <FaUser className="me-2 text-primary" /> Guest {index + 1}
                {isCardFilled(guest) && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block", marginLeft: 8 }} />
                )}
              </h5>
              {!guestToEdit && index > 0 && (
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={(e) => { e.stopPropagation(); removeGuest(index); }}
                >
                  Remove
                </button>
              )}
            </div>

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
                      value={guest.host}
                      onChange={(e) => handleChange(index, "host", e.target.value)}
                      disabled={!guest.onBehalfOf}
                    />
                    <button
                      type="button"
                      className={`btn visitor-inline-btn ${guest.onBehalfOf ? "btn-primary" : "btn-outline-primary"}`}
                      style={{ whiteSpace: "nowrap", fontSize: "13px", fontWeight: 600 }}
                      onClick={() => handleChange(index, "onBehalfOf", !guest.onBehalfOf)}
                    >
                      👥 On behalf of
                    </button>
                    {renderAutofillButton(index, "host", ["host"])}
                  </div>

                  {/* Category */}
                  <label className="fw-bold">Category</label>
                  <div className="d-flex gap-2 align-items-center">
                    <select
                      className="form-select"
                      value={guest.category}
                      onChange={(e) => handleChange(index, "category", e.target.value)}
                      required
                    >
                      <option value="Isuzu Employee">Isuzu Employee</option>
                      <option value="UD Employee">UD Employee</option>
                    </select>
                    {renderAutofillButton(index, "category", ["category"])}
                  </div>

                  {/* First Name + Last Name side by side */}
                  <div className="d-flex gap-2">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="First Name"
                      value={guest.firstName}
                      onChange={(e) => handleChange(index, "firstName", e.target.value)}
                      onKeyPress={(e) => { if (!/^[a-zA-Z\s]$/.test(e.key)) e.preventDefault(); }}
                      required
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Last Name"
                      value={guest.lastName}
                      onChange={(e) => handleChange(index, "lastName", e.target.value)}
                      onKeyPress={(e) => { if (!/^[a-zA-Z\s]$/.test(e.key)) e.preventDefault(); }}
                    />
                  </div>

                  <input
                    type="email"
                    className="form-control"
                    placeholder="Email"
                    value={guest.email}
                    onChange={(e) => handleChange(index, "email", e.target.value)}
                  />

                  {/* Company */}
                  <div>
                    <div className="d-flex gap-2 align-items-center">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Company / Address"
                        value={guest.company}
                        onChange={(e) => handleChange(index, "company", e.target.value)}
                        required
                      />
                      {renderAutofillButton(index, "company", ["company"])}
                    </div>
                    {autofillStates[`${index}-company`] && (
                      <small style={{ color: "#16a34a", paddingLeft: "2px" }}>✓ Autofilled from Guest 1</small>
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
                        <span style={{ fontSize: "1rem", lineHeight: 1 }}>{COUNTRY_FLAGS[guest.countryCode] || "🌐"}</span>
                        <span style={{ fontSize: "1rem", fontWeight: "inherit", color: "inherit" }}>{guest.countryCode}</span>
                        <span style={{ fontSize: "10px", color: "#888" }}>▼</span>
                      </div>
                      <select
                        style={{
                          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                          opacity: 0, cursor: "pointer", border: "none", outline: "none",
                        }}
                        value={guest.countryCode || "+91"}
                        onChange={(e) => handleChange(index, "countryCode", e.target.value)}
                        required
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <input
                      style={{ border: "none", outline: "none", flex: 1, padding: "6px 10px", fontSize: "1rem", background: "transparent", fontFamily: "inherit", fontWeight: "inherit", color: "inherit" }}
                      placeholder="Phone Number"
                      type="text"
                      required
                      value={guest.phone}
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
                      {PHONE_HINTS[guest.countryCode] || "Enter number"}
                    </span>
                  </div>

                  {/* Purpose */}
                  <div>
                    <div className="d-flex gap-2 align-items-center">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Purpose of Visit"
                        value={guest.purposeOfVisit}
                        onChange={(e) => handleChange(index, "purposeOfVisit", e.target.value)}
                        required
                      />
                      {renderAutofillButton(index, "purpose", ["purposeOfVisit"])}
                    </div>
                    {autofillStates[`${index}-purpose`] && (
                      <small style={{ color: "#16a34a", paddingLeft: "2px" }}>✓ Autofilled from Guest 1</small>
                    )}
                  </div>

                  {/* Meeting Room Toggle */}
                  <div className="d-flex align-items-center mt-3">
                    <strong className="me-2">Meeting Room Booked:</strong>
                    <div
                      className={`wifi-toggle ${guest.meetingRoomRequired ? "active" : ""}`}
                      onClick={() => handleChange(index, "meetingRoomRequired", !guest.meetingRoomRequired)}
                    >
                      <div className="toggle-circle"></div>
                    </div>
                  </div>

                  {guest.meetingRoomRequired && (
                    <input
                      type="text"
                      className="form-control mt-2"
                      placeholder="Meeting Room"
                      value={guest.meetingRoom}
                      onChange={(e) => handleChange(index, "meetingRoom", e.target.value)}
                      required
                    />
                  )}

                  {/* WiFi */}
                  <div className="d-flex align-items-center mt-3">
                    <FaWifi className={`me-2 fs-5 ${guest.guestWifiRequired ? "text-success" : "text-secondary"}`} />
                    <strong className="me-2">Guest Wi-Fi:</strong>
                    <div
                      className={`wifi-toggle ${guest.guestWifiRequired ? "active" : ""}`}
                      onClick={() => handleChange(index, "guestWifiRequired", !guest.guestWifiRequired)}
                    >
                      <div className="toggle-circle"></div>
                    </div>
                  </div>

                  {/* Refreshment */}
                  <div className="d-flex align-items-center mt-3">
                    <strong className="me-2">Refreshment Required:</strong>
                    <div
                      className={`wifi-toggle ${guest.refreshmentRequired ? "active" : ""}`}
                      onClick={() => handleChange(index, "refreshmentRequired", !guest.refreshmentRequired)}
                    >
                      <div className="toggle-circle"></div>
                    </div>
                  </div>

                  {guest.refreshmentRequired && (
                    <>
                      <label className="fw-bold mt-3">Proposed Refreshment Time</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={guest.proposedRefreshmentTime || ""}
                        min={guest.TentativeinTime || getNowLocal()}
                        max={guest.TentativeoutTime || ""}
                        onChange={(e) => handleChange(index, "proposedRefreshmentTime", e.target.value)}
                        required
                      />
                      {guest.TentativeinTime && guest.TentativeoutTime && (
                        <small style={{ color: "#6b7280", paddingLeft: "2px" }}>Must be between In Time and Out Time</small>
                      )}
                    </>
                  )}

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
                      className="form-control"
                      required
                      min={getNowLocal()}
                      value={guest.TentativeinTime}
                      onChange={(e) => handleChange(index, "TentativeinTime", e.target.value)}
                    />
                    {renderAutofillButton(index, "times", ["TentativeinTime", "TentativeoutTime"])}
                  </div>

                  {/* Tentative Out Time */}
                  <label className="fw-bold mt-2">Tentative Out Time</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    required
                    min={guest.TentativeinTime || getNowLocal()}
                    value={guest.TentativeoutTime}
                    onChange={(e) => handleChange(index, "TentativeoutTime", e.target.value)}
                  />
                  {autofillStates[`${index}-times`] && (
                    <small style={{ color: "#16a34a", paddingLeft: "2px" }}>✓ Autofilled from Guest 1</small>
                  )}

                  <p className="text-muted mt-2 mb-0">
                    <small>Submitted by: {guest.submittedBy}</small>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {!guestToEdit && (
          <motion.button
            type="button"
            className="bg-dark text-white mt-2 py-2 rounded-3 border-0"
            onClick={addGuest}
            whileHover={{ scale: 1.05 }}
            disabled={guests.length >= MAX_GUESTS}
          >
            + Add Another Guest
            {guests.length >= MAX_GUESTS ? " (max reached)" : ` (${MAX_GUESTS - guests.length} remaining)`}
          </motion.button>
        )}

        <div className="d-flex justify-content-between mt-3">
          <motion.button type="button" className="btn btn-outline-danger px-4 py-2 rounded-3" onClick={handleCancel} whileHover={{ scale: 1.05 }}>
            Cancel
          </motion.button>
          <motion.button type="submit" className="btn btn-success px-4 py-2 rounded-3" whileHover={{ scale: 1.05 }} disabled={loading}>
            {loading ? "Submitting..." : guestToEdit ? "Save Changes" : "Submit"}
          </motion.button>
        </div>
      </form>

      <style>{`
        .visitor-autofill-btn { width: 38px; height: 38px; min-width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .visitor-inline-btn { height: 38px; display: inline-flex; align-items: center; white-space: nowrap; flex-shrink: 0; }
        .wifi-toggle { width: 50px; height: 26px; background: #ccc; border-radius: 50px; display: flex; align-items: center; padding: 3px; transition: background 0.3s ease; cursor: pointer; }
        .wifi-toggle.active { background: rgb(7, 143, 167); }
        .toggle-circle { width: 20px; height: 20px; background: #fff; border-radius: 50%; transition: transform 0.3s ease; }
        .wifi-toggle.active .toggle-circle { transform: translateX(24px); }
      `}</style>

      {/* -----------------changed by rebanta-------------- */}
      {/* New: BulkUploadModal renders outside the form; type="guest" targets guest API;
          accepts hostName and submittedBy from SSO state; controlled by showBulkUpload */}
      <BulkUploadModal
        show={showBulkUpload}
        type="guest"
        hostName={ssoHostName}
        submittedBy={ssoEmail}
        onClose={() => setShowBulkUpload(false)}
      />
      {/* ------------------------------------------------- */}
    </motion.div>
  );
}