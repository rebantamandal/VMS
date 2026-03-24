import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import CryptoJS from "crypto-js";
import * as XLSX from "xlsx";
import {
  FaClock,
  FaUser,
  FaBuilding,
  FaPrint,
  FaIdBadge,
  FaEdit,
  FaMapMarkerAlt,
  FaFileExcel,
  FaFilter,
  FaSearch,
  FaQuestion,
  FaInfoCircle,
} from "react-icons/fa";
import Navbar from "./navbar";
import tt from "../images/logo.png";
import securitybg from "../images/staffbg.jpg";
import { useNavigate } from "react-router-dom";



const ENCRYPTION_KEY = process.env.REACT_APP_SIGNATURE_KEY || "your-secure-32-character-key!!";

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  console.error("❌ SIGNATURE KEY ERROR: Key missing or weak");
  alert("SIGNATURE KEY ERROR: Missing or invalid signature key");
}

const encryptSignature = (signatureData) => {
  try {
    if (!signatureData) return null;
    return CryptoJS.AES.encrypt(signatureData, ENCRYPTION_KEY).toString();
  } catch (err) {
    console.error("❌ ENCRYPTION FAILED:", err);
    return null;
  }
};

const decryptSignature = (encryptedData) => {
  try {
    if (!encryptedData) return null;
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    console.error("❌ SIGNATURE DECRYPT FAILED:", err);
    return null;
  }
};

const toDateOnly = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const formatISODate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatIST = (dateValue) => {
  if (!dateValue) return "-";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// -----------------changed by rebanta--------------
// New pass tracking utilities: IST-aware date key formatters, daily pass event accessors,
// multi-day visit detection, per-card pass action state machine, and UI tone/label helpers
const PASS_TRACKING_TIME_ZONE = "Asia/Kolkata";

const passDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PASS_TRACKING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const getPassDateKey = (value) => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = passDateKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
};

const getDailyPassEvents = (visitor) => (
  Array.isArray(visitor?.dailyPassEvents) ? visitor.dailyPassEvents : []
);

const formatDateKeyForIST = (dateKey) => {
  if (!dateKey) return "";

  const [yearText, monthText, dayText] = String(dateKey).split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (!year || !month || !day) return dateKey;

  const stableDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return stableDate.toLocaleDateString("en-IN", {
    timeZone: PASS_TRACKING_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isLongPeriodVisit = (visitor) => {
  const startDateKey = getPassDateKey(visitor?.actualInTime || visitor?.inTime);
  const finalOutDateKey = getPassDateKey(visitor?.outTime);
  return Boolean(startDateKey && finalOutDateKey && startDateKey < finalOutDateKey);
};

const isVisitorRecord = (visitor) => visitor?.source === "visitor";

const isRepeatedVisitorType = (visitor) => visitor?.source !== "adhoc" && isLongPeriodVisit(visitor);

const isFinalCheckoutDay = (visitor, now = new Date()) => {
  // Derives whether current IST day is the scheduled final checkout day for repeated records.
  const todayKey = getPassDateKey(now);
  const finalOutDateKey = getPassDateKey(visitor?.outTime);
  return Boolean(todayKey && finalOutDateKey && todayKey === finalOutDateKey);
};

const isAfterFinalCheckoutDay = (visitor, now = new Date()) => {
  // Keeps a clear checkout path when a repeated record is still checked in after the final day.
  const todayKey = getPassDateKey(now);
  const finalOutDateKey = getPassDateKey(visitor?.outTime);
  return Boolean(todayKey && finalOutDateKey && todayKey > finalOutDateKey);
};

const getPassTrackingMeta = (visitor, now = new Date()) => {
  const enabled = isLongPeriodVisit(visitor);
  if (!enabled) {
    return { enabled: false };
  }

  const todayKey = getPassDateKey(now);
  const finalOutDateKey = getPassDateKey(visitor?.outTime);
  const todayEvents = getDailyPassEvents(visitor).filter((event) => event?.dateKey === todayKey);
  const issueToday = todayEvents.find((event) => event?.action === "issued");
  const returnToday = todayEvents.find((event) => event?.action === "returned");
  const alertSentToday =
    isVisitorRecord(visitor) &&
    Array.isArray(visitor?.dailyPassAlertDates) &&
    visitor.dailyPassAlertDates.includes(todayKey);
  const isFinalDay = Boolean(todayKey && finalOutDateKey && todayKey === finalOutDateKey);
  const trackingActive =
    visitor?.status === "checkedIn" &&
    Boolean(todayKey && finalOutDateKey && todayKey <= finalOutDateKey);

  if (visitor?.status !== "checkedIn") {
    const isCheckedOut = visitor?.status === "checkedOut";
    return {
      enabled: true,
      canIssue: false,
      canReturn: false,
      tone: "secondary",
      summary: isCheckedOut
        ? "Visit completed and checked out."
        : "Long-period visit record",
      todayLabel: isCheckedOut ? "Checked Out" : "Not Active",
      nextIssueLabel: isCheckedOut ? "No action required" : "Check in to start daily pass flow",
      issueToday,
      returnToday,
    };
  }

  if (todayKey && finalOutDateKey && todayKey > finalOutDateKey) {
    return {
      enabled: true,
      canIssue: false,
      canReturn: false,
      tone: "secondary",
      // Clarifies that pass actions are closed only after the visit window ends.
      summary: "Visit window ended. Complete final Check Out if still pending.",
      todayLabel: "Past Final Day",
      nextIssueLabel: "Complete final Check Out",
      issueToday,
      returnToday,
    };
  }

  if (returnToday) {
    const tomorrowKey = getPassDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const nextIssueAvailable = tomorrowKey && finalOutDateKey && tomorrowKey <= finalOutDateKey;

    return {
      enabled: true,
      canIssue: false,
      canReturn: false,
      tone: "success",
      summary: `Pass returned today at ${formatIST(returnToday.recordedAt)}.`,
      todayLabel: "Pass Returned",
      nextIssueLabel: isFinalDay
        ? "Complete final Check Out now"
        : nextIssueAvailable
        ? `${formatDateKeyForIST(tomorrowKey)} (IST)`
        : "No further pass issue required",
      issueToday,
      returnToday,
    };
  }

  if (issueToday) {
    return {
      enabled: true,
      canIssue: false,
      canReturn: true,
      tone: alertSentToday ? "danger" : "warning",
      summary: alertSentToday
        ? `Alert sent. Today's pass was issued at ${formatIST(issueToday.recordedAt)} and is still pending return.`
        : `Pass issued today at ${formatIST(issueToday.recordedAt)}. Awaiting return${isFinalDay ? " before checkout" : ""}.`,
      todayLabel: isFinalDay ? "Issued, Return Required Today" : "Issued, Awaiting Return",
      nextIssueLabel: isFinalDay ? "Return pass, then complete Check Out" : "Record pass return after collection",
      issueToday,
      returnToday,
    };
  }

  return {
    enabled: true,
    canIssue: trackingActive,
    canReturn: false,
    tone: trackingActive ? "primary" : "secondary",
    summary: trackingActive
      ? isFinalDay
        ? "Final day: issue today's pass, then return it and complete checkout."
        : "Ready to issue today's pass."
      : "Pass tracking becomes active only while the visitor is checked in during the visit window.",
    todayLabel: trackingActive
      ? isFinalDay
        ? "Final Day - Not Issued"
        : "Not Issued"
      : "Not Active",
    nextIssueLabel: trackingActive
      ? isFinalDay
        ? "Issue today's pass"
        : `${formatDateKeyForIST(todayKey)} (IST)`
      : "Check in to start daily pass flow",
    issueToday,
    returnToday,
  };
};

const getPassStatusStyles = (tone) => {
  switch (tone) {
    case "success":
      return { background: "#ecfdf3", border: "1px solid #9dd7b5", color: "#146c43" };
    case "warning":
      return { background: "#fff8e1", border: "1px solid #f3d37a", color: "#8a5a00" };
    case "danger":
      return { background: "#fff1f1", border: "1px solid #ef9a9a", color: "#9f1d1d" };
    case "primary":
      return { background: "#eef4ff", border: "1px solid #9fc0ff", color: "#0d47a1" };
    default:
      return { background: "#f4f4f5", border: "1px solid #d4d4d8", color: "#3f3f46" };
  }
};

const getPassStatusLabel = (meta) => {
  if (!meta?.enabled) return "Standard Visit";
  if (meta.tone === "success") return "Returned Today";
  if (meta.tone === "warning") return "Pending Return";
  if (meta.tone === "danger") return "Alert Raised";
  if (meta.tone === "primary") return "Ready To Issue";
  return "Long-Period Visit";
};

const getPassTodayLabel = (meta) => {
  if (!meta?.enabled) return "Not Applicable";
  if (meta.todayLabel) return meta.todayLabel;
  if (meta.returnToday) return "Issued + Returned";
  if (meta.issueToday) return "Issued, Awaiting Return";
  return "Not Issued";
};

const getRepeatPrimaryAction = (visitor, passTracking) => {
  // Guides guards with one clear next step for repeated checked-in records.
  if (!visitor || visitor.status !== "checkedIn" || !isRepeatedVisitorType(visitor)) return null;

  if (passTracking?.canIssue) {
    return { kind: "issued", label: "Issue Pass", className: "btn btn-success btn-sm rounded-pill pass-action-btn" };
  }

  if (passTracking?.canReturn) {
    return { kind: "returned", label: "Return Pass", className: "btn btn-danger btn-sm rounded-pill pass-action-btn" };
  }

  return null;
};

const isPassActionBusyForVisitor = (visitorId, passActionKey) => {
  // Prevents duplicate pass clicks across card and details modal for the same record.
  return Boolean(visitorId && passActionKey && passActionKey.startsWith(`${visitorId}:`));
};
// -------------------------------------------------

// ✅ NEW: check if current time > tentative inTime + 24 hours
const isOverdue24Hours = (v) => {
  if (!v?.inTime) return false;
  const inMs = new Date(v.inTime).getTime();
  return Date.now() > inMs + 24 * 60 * 60 * 1000;
};

const isCheckoutOlderThanWeek = (v) => {
  //--------------------------changed by rebanta------------------------------//
  // Explanation: Determines whether checkout timestamp is older than one week for UI filtering.
  const checkoutTime = v.actualOutTime || v.outTime;
  if (!checkoutTime) return false;
  const checkoutMs = new Date(checkoutTime).getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - checkoutMs > oneWeekMs;
  //--------------------------changed by rebanta------------------------------//
};


export default function Security() {
  const [visitors, setVisitors] = useState([]);
  //--------------------------changed by rebanta------------------------------//
  // Explanation: Keeps latest filtered list for export operation and export count in dialog.
  const [filteredVisitors, setFilteredVisitors] = useState([]);
  //--------------------------changed by rebanta------------------------------//
  const [exportFilteredVisitors, setExportFilteredVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConsent, setShowConsent] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showBadgeEdit, setShowBadgeEdit] = useState(false);
  // -----------------changed by rebanta--------------
  // New: tracks in-flight pass action key to disable duplicate button clicks
  const [passActionKey, setPassActionKey] = useState("");
  // -------------------------------------------------
  const [currentVisitor, setCurrentVisitor] = useState(null);
  const [badgeEditVisitor, setBadgeEditVisitor] = useState(null);
  const [badgeNo, setBadgeNo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [checkoutData, setCheckoutData] = useState({
    badgeSurrendered: false,
    hostApproved: false,
  });

  const [sortOrder] = useState("asc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState("none");

  // ✅ FIX: stable count source — 7-day filtered but never affected by status/search/date filters
  const [countVisitors, setCountVisitors] = useState([]);

  const canvasRef = useRef(null);
  const signatureCtx = useRef(null);
  const drawing = useRef(false);
  const navigate = useNavigate();
  const [nowTick, setNowTick] = useState(Date.now());

  //----------------------Changed by Anup----------------------------------------------------------------------------------------------------
  
  const [showDetails, setShowDetails] = useState(false); // controls wether the view detail is visible or not
  const [detailsVisitor, setDetailsVisitor] = useState(null); // stores the visitor whose details are meant to be shown in the details modal

  //---------------------Changed by Anup-----------------------------------------------------------------------------------------------------


  useEffect(() => {
    fetchVisitors();
    const interval = setInterval(() => {
      fetchVisitors();
    }, 5000);

    return () => clearInterval(interval);
  }, []);
  // ✅ NEW: trigger rerender so overdue button appears when time passes
  // -----------------changed by rebanta--------------
  // Shortened tick interval from 30 s to 5 s so pass-day-boundary and overdue states update promptly
  useEffect(() => {
  // Refreshes time-based pass state frequently enough to avoid day-boundary confusion around midnight.
  const t = setInterval(() => setNowTick(Date.now()), 5000);
  return () => clearInterval(t);
}, []);
  // -------------------------------------------------


  useEffect(() => {
    let result = visitors;
    let exportResult = visitors;

    //--------------------------changed by rebanta------------------------------//
    // Explanation: Applies selected status to both on-screen list and export dataset.
    if (statusFilter === "repeated") {
      result = result.filter((v) => isRepeatedVisitorType(v));
      exportResult = exportResult.filter((v) => isRepeatedVisitorType(v));
    } else if (statusFilter !== "all") {
      result = result.filter((v) => v.status === statusFilter);
      exportResult = exportResult.filter((v) => v.status === statusFilter);
    }
    //--------------------------changed by rebanta------------------------------//

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter((v) => {
        const fullName = `${v.firstName || ""} ${v.lastName || ""}`.toLowerCase();
        const company = (v.company || "").toLowerCase();
        //--------------------------changed by rebanta------------------------------//
        // Explanation: Matches search text against full name or company fields.
        return fullName.includes(query) || company.includes(query);
        //--------------------------changed by rebanta------------------------------//
      });

    }

    let appliedFrom = dateFrom;
    let appliedTo = dateTo;

    if (quickFilter !== "none") {
      const today = new Date();
      const todayOnly = toDateOnly(today);

      if (quickFilter === "today") {
        appliedFrom = formatISODate(todayOnly);
        appliedTo = formatISODate(todayOnly);
      } else if (quickFilter === "yesterday") {
        const y = new Date(todayOnly);
        y.setDate(y.getDate() - 1);
        appliedFrom = formatISODate(y);
        appliedTo = formatISODate(y);
      } else if (quickFilter === "last7") {
        const end = new Date(todayOnly);
        const start = new Date(todayOnly);
        start.setDate(start.getDate() - 6);
        appliedFrom = formatISODate(start);
        appliedTo = formatISODate(end);
      }
    }

    if (appliedFrom || appliedTo) {
      const fromDate = appliedFrom ? new Date(appliedFrom + "T00:00:00") : null;
      const toDateObj = appliedTo ? new Date(appliedTo + "T23:59:59.999") : null;

      result = result.filter((v) => {
        const checkIn = v.actualInTime || v.inTime;
        if (!checkIn) return false;
        const checkDate = new Date(checkIn);
        if (fromDate && checkDate < fromDate) return false;
        if (toDateObj && checkDate > toDateObj) return false;
        return true;
      });

      //--------------------------changed by rebanta------------------------------//
      // Explanation: Applies the same date-window filtering rules to export data.
      exportResult = exportResult.filter((v) => {
        const checkIn = v.actualInTime || v.inTime;
        if (!checkIn) return false;
        const checkDate = new Date(checkIn);
        if (fromDate && checkDate < fromDate) return false;
        if (toDateObj && checkDate > toDateObj) return false;
        return true;
      });
      //--------------------------changed by rebanta------------------------------//
    }

    //--------------------------changed by rebanta------------------------------//
    // Explanation: Removes stale checkout records and syncs both display + export arrays.
    result = result.filter((v) => !isCheckoutOlderThanWeek(v));

    // ✅ FIX: countVisitors = full 7-day filtered list, ignoring status/search/date filters
    // This keeps button counts stable no matter which filter tab is active or hovered
    const countBase = visitors.filter((v) => !isCheckoutOlderThanWeek(v));
    setCountVisitors(countBase);

    setFilteredVisitors(result);
    setExportFilteredVisitors(exportResult);
    //--------------------------changed by rebanta------------------------------//
  }, [visitors, statusFilter, searchQuery, sortOrder, dateFrom, dateTo, quickFilter, nowTick]); // ✅ CHANGED


  //--------------------------changed by rebanta------------------------------//
  // Explanation: Fetches and merges visitors/guests/adhoc data into a normalized source-aware list.
  const fetchVisitors = async () => {
  //--------------------------changed by rebanta------------------------------//
    console.log("📡 FETCH STARTED: ", new Date().toLocaleTimeString());

    const api = process.env.REACT_APP_API_URL;
    if (!api) {
      console.error("❌ ENV ERROR: API URL missing in .env");
      alert("API URL missing — check .env");
      return;
    }

    let visitorData = [];
    let guestData = [];
    let adhocData = [];

    try {
      try {
        console.log("➡ GET /visitors");
        const res = await axios.get(`${api}/api/visitors`);
        visitorData = res.data;
        console.log("✔ VISITORS OK:", visitorData.length);
      } catch (err) {
        console.error("❌ VISITOR GET FAILED:", err.response?.data || err.message);
      }

      try {
        console.log("➡ GET /guests");
        const res = await axios.get(`${api}/api/guests`);
        guestData = res.data;
        console.log("✔ GUESTS OK:", guestData.length);
      } catch (err) {
        console.error("❌ GUEST GET FAILED:", err.response?.data || err.message);
      }

      try {
        console.log("➡ GET /adhoc");
        const res = await axios.get(`${api}/api/adhoc`);
        adhocData = res.data;
        console.log("✔ ADHOC OK:", adhocData.length);
      } catch (err) {
        console.error("❌ ADHOC GET FAILED:", err.response?.data || err.message);
      }

      const merged = [
        ...visitorData.map((v) => ({
          ...v,
          source: "visitor",
          displaySignature: decryptSignature(v.signature),
        })),
        ...guestData.map((g) => ({
          ...g,
          source: "guest",
          displaySignature: decryptSignature(g.signature),
        })),
        ...adhocData.map((a) => ({
          ...a,
          source: "adhoc",
          displaySignature: decryptSignature(a.signature),
        })),
      ];

      setVisitors(merged);
      console.log("📌 MERGED RESULT:", merged.length);

    } catch (outer) {
      console.error("❌ FETCH CRASH:", outer);
    }

    setLoading(false);
  };

  const updateVisitor = async (id, data, source) => {
    console.log("🔄 UPDATE →", { id, source, data });

    let endpoint = "";
    const api = process.env.REACT_APP_API_URL;

    if (source === "guest") endpoint = `${api}/api/guests/${id}`;
    else if (source === "adhoc") endpoint = `${api}/api/adhoc/${id}`;
    else endpoint = `${api}/api/visitors/${id}`;

    try {
      await axios.put(endpoint, data);
      console.log("✔ UPDATE OK");
      fetchVisitors();
    } catch (err) {
      console.error("❌ UPDATE FAILED:", err.response?.data || err.message);
      Swal.fire("Update failed", err.message, "error");
    }
  };

  // -----------------changed by rebanta--------------
  // New: records daily pass issue/return events to backend; syncs details modal record state;
  // handles already-recorded responses gracefully without surfacing errors to the user
  const recordDailyPassEvent = async (visitor, action) => {
    if (!visitor?._id || visitor.source === "adhoc") return;

    const api = process.env.REACT_APP_API_URL;
    const endpoint =
      visitor.source === "guest"
        ? `${api}/api/guests/${visitor._id}/pass-events`
        : `${api}/api/visitors/${visitor._id}/pass-events`;

    const actionKey = `${visitor._id}:${action}`;
    setPassActionKey(actionKey);

    try {
      const response = await axios.post(endpoint, {
        action,
        recordedBy: "Security",
      });

      const responseBody = response.data || {};
      const updatedRecord = responseBody.guest || responseBody.visitor || responseBody;
      if (detailsVisitor?._id === visitor._id && updatedRecord?._id) {
        setDetailsVisitor({ ...updatedRecord, source: visitor.source });
      }

      await fetchVisitors();

      if (responseBody.alreadyRecorded) {
        Swal.fire({
          icon: "info",
          title: "Already recorded",
          text: responseBody.message || "This pass action is already recorded for today.",
          timer: 1600,
          showConfirmButton: false,
        });
      } else {
        Swal.fire({
          icon: "success",
          title: action === "issued" ? "Pass issued" : "Pass returned",
          text: responseBody.message || "Pass action saved.",
          timer: 1200,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire(
        "Pass update failed",
        err.response?.data?.error || err.message,
        "error"
      );
    } finally {
      setPassActionKey("");
    }
  };
  // -------------------------------------------------

  // ✅ NEW: Remove visitor from UI for ALL users (end-to-end)
// Calls backend: PUT /api/{visitors|guests|adhoc}/:id/remove-ui
const removeFromUI = async (visitor) => {
  if (!visitor?._id) return;

  const confirm = await Swal.fire({
    icon: "warning",
    title: "Remove visitor?",
    text: "This will remove from Security page for ALL users (DB record will remain).",
    showCancelButton: true,
    confirmButtonText: "Yes, Remove",
    cancelButtonText: "Cancel",
  });

  if (!confirm.isConfirmed) return;

  const api = process.env.REACT_APP_API_URL;
  let endpoint = "";

  if (visitor.source === "guest") endpoint = `${api}/api/guests/${visitor._id}/remove-ui`;
  else if (visitor.source === "adhoc") endpoint = `${api}/api/adhoc/${visitor._id}/remove-ui`;
  else endpoint = `${api}/api/visitors/${visitor._id}/remove-ui`;

  try {
    await axios.put(endpoint, { reason: "Overdue > 24h and not authorized" });
    Swal.fire({ icon: "success", title: "Removed", timer: 1200, showConfirmButton: false });
    fetchVisitors(); // refresh list for everyone
  } catch (err) {
    Swal.fire("Remove failed", err.response?.data?.message || err.message, "error");
  }
};


  // Calculate date one year from today
const getExpiryDate = () => {
  const today = new Date();
  const expiryDate = new Date(today);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  
  // Format as: DD Month YYYY (e.g., 23 December 2025)
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return expiryDate.toLocaleDateString('en-IN', options);
};

  const openConsent = (visitor) => {
    setCurrentVisitor(visitor);
    setConsentChecked(false);
    setShowConsent(true);
  };

  useEffect(() => {
    if (showConsent && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      signatureCtx.current = ctx;
    }
  }, [showConsent]);

  const startSign = (e) => {
    if (!signatureCtx.current) return;
    drawing.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    signatureCtx.current.beginPath();
    signatureCtx.current.moveTo(x, y);
  };

  const signing = (e) => {
    if (!drawing.current || !signatureCtx.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    signatureCtx.current.lineTo(x, y);
    signatureCtx.current.stroke();
  };

  const endSign = () => (drawing.current = false);

  const clearPad = () => {
    if (canvasRef.current && signatureCtx.current) {
      const c = canvasRef.current;
      signatureCtx.current.clearRect(0, 0, c.width, c.height);
    }
  };

  const getSignatureImage = () => {
    if (!canvasRef.current) return "";
    return canvasRef.current.toDataURL("image/png");
  };

  const isCanvasEmpty = () => {
    if (!canvasRef.current) return true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pixelBuffer = new Uint32Array(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !pixelBuffer.some((color) => color !== 0);
  };

  const submitConsent = async () => {
    if (!consentChecked) {
      Swal.fire({
        icon: "warning",
        title: "Consent Required",
        text: "Please check the consent checkbox to proceed",
      });
      return;
    }

    if (isCanvasEmpty()) {
      Swal.fire({
        icon: "warning",
        title: "Signature Required",
        text: "Please provide your signature before submitting",
      });
      return;
    }

    const signatureImage = getSignatureImage();
    const encryptedSignature = encryptSignature(signatureImage);

    if (!encryptedSignature) {
      Swal.fire({
        icon: "error",
        title: "Encryption failed",
        text: "Unable to secure signature data",
      });
      return;
    }

    const actualCheckInTime = new Date();

    await updateVisitor(
      currentVisitor._id,
      {
        status: "checkedIn",
        actualInTime: actualCheckInTime,
        signature: encryptedSignature,
      },
      currentVisitor.source
    );

    Swal.fire({
      icon: "success",
      title: "Authorized!",
      timer: 1200,
      showConfirmButton: false,
    });

    setShowConsent(false);
    setCurrentVisitor(null);
    setConsentChecked(false);
  };

  const openCheckout = (visitor) => {
    setCurrentVisitor(visitor);
    setCheckoutData({
      badgeSurrendered: false,
      hostApproved: false,
    });
    setShowCheckout(true);
  };

  const finalCheckout = async () => {
    if (!checkoutData.badgeSurrendered || !checkoutData.hostApproved) {
      Swal.fire({
        icon: "warning",
        title: "Required Fields",
        text: "Both 'Badge Surrendered' and 'Host Approved' must be checked before checkout",
      });
      return;
    }

    const actualCheckOutTime = new Date();

    await updateVisitor(
      currentVisitor._id,
      {
        status: "checkedOut",
        actualOutTime: actualCheckOutTime,
        badgeSurrendered: checkoutData.badgeSurrendered,
        hostApproved: checkoutData.hostApproved,
      },
      currentVisitor.source
    );

    Swal.fire({
      icon: "success",
      title: "Checked Out!",
      timer: 1200,
      showConfirmButton: false,
    });

    setShowCheckout(false);
    setCurrentVisitor(null);
  };

  const handleBadgeEditOpen = (visitor) => {
    setBadgeEditVisitor(visitor);
    setBadgeNo(visitor.cardNo || "");
    setShowBadgeEdit(true);
  };

  const saveBadgeNo = async () => {
    if (!badgeNo || badgeNo.trim() === "") {
      Swal.fire({
        icon: "warning",
        title: "Badge Number Required",
        text: "Please enter a valid badge number before saving.",
        confirmButtonText: "OK",
      });
      return;
    }
    if (!badgeEditVisitor) return;

    await updateVisitor(
      badgeEditVisitor._id,
      { cardNo: badgeNo },
      badgeEditVisitor.source
    );
    Swal.fire({
      icon: "success",
      title: "Badge Saved!",
      timer: 1000,
      showConfirmButton: false,
    });

    setShowBadgeEdit(false);
    setBadgeEditVisitor(null);
  };

  const openExportDialog = () => {
    setShowExportDialog(true);
  };

  const openAdhoc = () => {
    navigate('/adhoc')
  }

  //-----------------------Changes by Anup----------------------------------------------------------------------------------------------------
  const openDetails = (visitor) => {
    setDetailsVisitor(visitor);       //used for setting visitor details and showing the Detail popup
    setShowDetails(true);
  };
  //-----------------------Changes by Anup----------------------------------------------------------------------------------------------------

  // -----------------changed by rebanta--------------
  // New: keeps the details modal record in sync after each 5 s background fetch refresh
  useEffect(() => {
    // Keeps the open details modal in sync with the latest fetched record state.
    if (!showDetails || !detailsVisitor?._id) return;

    const refreshedDetailsVisitor = visitors.find(
      (visitor) => visitor._id === detailsVisitor._id && visitor.source === detailsVisitor.source
    );

    if (refreshedDetailsVisitor) {
      setDetailsVisitor(refreshedDetailsVisitor);
    }
  }, [visitors, showDetails, detailsVisitor]);
  // -------------------------------------------------

  const isGuestSource = (src) => src === "guest";

const getConsentSalutation = (v) => {
  if (!v) return "Dear Visitor,";
  return isGuestSource(v.source) ? "Dear Guest," : "Dear Visitor,";
};

const getConsentLabel = (v) => {
  if (!v) return "Visitor's Consent:";
  return isGuestSource(v.source) ? "Guest's Consent:" : "Visitor's Consent:";
};

  // -----------------changed by rebanta--------------
  // New: derived pass-tracking state for the active details modal — computed once per render
  // so card and modal actions stay in sync without redundant utility calls
  // Reuses the same derived details state across the modal instead of recomputing it inline.
  const detailsNow = detailsVisitor ? new Date(nowTick) : null;
  const detailsPassMeta = detailsVisitor ? getPassTrackingMeta(detailsVisitor, detailsNow) : null;
  const detailsPassEvents = detailsVisitor ? getDailyPassEvents(detailsVisitor) : [];
  const detailsIsRepeated = detailsVisitor ? isRepeatedVisitorType(detailsVisitor) : false;
  const detailsIsFinalDay = detailsVisitor ? isFinalCheckoutDay(detailsVisitor, detailsNow) : false;
  const detailsIsAfterFinalDay = detailsVisitor ? isAfterFinalCheckoutDay(detailsVisitor, detailsNow) : false;
  const detailsIsBeforeFinalDay = detailsIsRepeated && !detailsIsFinalDay && !detailsIsAfterFinalDay;
  const detailsPrimaryAction = detailsVisitor ? getRepeatPrimaryAction(detailsVisitor, detailsPassMeta) : null;
  const detailsPassActionBusy = detailsVisitor
    ? isPassActionBusyForVisitor(detailsVisitor._id, passActionKey)
    : false;
  const requirePassFlowBeforeFinalCheckout =
    detailsIsRepeated && detailsIsFinalDay && !detailsPassMeta?.returnToday;
  // -------------------------------------------------


  const exportToExcel = () => {
    //--------------------------changed by rebanta------------------------------//
    // Explanation: Uses exportFilteredVisitors so exported records match current filter dialog scope.
    const exportData = exportFilteredVisitors.map((v) => ({
      "First Name": v.firstName || "",
      "Last Name": v.lastName || "",
      ...(v.source === "visitor" && { Company: v.company || "-" }),
      Category: v.category || "-",
      Phone: v.phone || "-",
      Purpose: v.purposeOfVisit || "-",
      "Visitor ID": v.cardNo || "-",
      "Tentative In": formatIST(v.inTime), // ✅ IST
  "Tentative Out": formatIST(v.outTime), // ✅ IST
  "Actual Check-In": formatIST(v.actualInTime), // ✅ IST
  "Actual Check-Out": formatIST(v.actualOutTime), 
      Status: v.status?.toUpperCase() || "-",
      "Badge Surrendered": v.badgeSurrendered ? "Yes" : "No",
      "Host Approved": v.hostApproved ? "Yes" : "No",
      Signed: v.displaySignature ? "Yes" : "No",
    }));
    //--------------------------changed by rebanta------------------------------//

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Visitors");

    //--------------------------changed by rebanta------------------------------//
    // Explanation: Creates date-stamped export filename for downloaded Excel report.
    const fileName = `Visitors_${new Date().toISOString().split("T")[0]}.xlsx`;
    //--------------------------changed by rebanta------------------------------//
    XLSX.writeFile(workbook, fileName);

    Swal.fire({
      icon: "success",
      title: "Exported!",
      text: `${exportFilteredVisitors.length} records exported successfully`,
      timer: 2000,
      showConfirmButton: false,
    });

    setShowExportDialog(false);
    setDateFrom("");
    setDateTo("");
    setQuickFilter("none");
  };

  const printCard = (visitor) => {
    const logoPath = `${window.location.origin}${tt}`;
    const noPhotoPath = "/No-photo.jpg";


    const isGuest = visitor.source === "guest";
    // const hostName = visitor.submittedBy || "-";

    const printContent = `
    <div class="visitor-card">
      <img src="${logoPath}" class="watermark" />
      <div class="header">
        <img src="${logoPath}" class="logo" />
        <h2>${isGuest ? 'GUEST PASS' : 'VISITOR PASS'}</h2>
      </div>
      <hr class="divider" />
      
      <div class="content-wrapper">
        <div class="info-section">
          <p class="welcome">WELCOME TO UD TRUCKS INDIA</p>
          <p class="visitor-name">${(visitor.firstName || "").toUpperCase()} ${(visitor.lastName || "").toUpperCase()}</p>
          
          <div class="info-grid">
          <p><i class="fas fa-user-tag"></i> <span class="label">CATEGORY:</span> <span class="value">${(visitor.category || "-").toUpperCase()}</span></p>
            <p><i class="fas fa-user"></i> <span class="label">HOST:</span> <span class="value">${(visitor.host || "-").toUpperCase()}</span></p>
            <p><i class="fas fa-bullseye"></i> <span class="label">PURPOSE:</span> <span class="value">${(visitor.purposeOfVisit || "-").toUpperCase()}</span></p>
            <p><i class="fas fa-building"></i> <span class="label">COMPANY:</span> <span class="value">${(visitor.company || "-").toUpperCase()}</span></p>
            <p><i class="fas fa-id-badge"></i> <span class="label">VISITOR ID:</span> <span class="value">${(visitor.cardNo || "-").toUpperCase()}</span></p>
            <p><i class="fas fa-clock"></i> <span class="label">CHECK-IN:</span> <span class="value">${visitor.actualInTime ? new Date(visitor.actualInTime).toLocaleString('en-IN', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}).toUpperCase() : "-"}</span></p>
          </div>
        </div>
        
        <div class="signature-section">
  <p class="no-picture">Photography and videography prohibited</p>
  <img src="${noPhotoPath}" class="no-photo-img" />
</div>

      </div>
      
    </div>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>${isGuest ? 'GUEST PASS' : 'VISITOR PASS'} - ${visitor.firstName || "GUEST"}</title>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
          <style>
            @page { 
              size: 8.7cm 5.5cm;
              margin: 0; 
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            html, body { 
              width: 8.7cm;
              height: 5.5cm;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            
            body { 
              display: flex;
              justify-content: center;
              align-items: center;
              font-family: 'Arial', sans-serif;
              background: white;
            }
            
            .visitor-card {
              width: 8.7cm;
              height: 5.5cm;
              background: #F2F2F2;
              border-radius: 8px;
              padding: 0.25cm;
              box-shadow: 0 4px 8px rgba(0,0,0,0.15);
              position: relative;
              border: 2px solid #1a237e;
              display: flex;
              flex-direction: column;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .visitor-card .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 4cm;
              opacity: 0.04;
              z-index: 0;
            }
            
            .visitor-card .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              position: relative;
              margin-bottom: 0.12cm;
              z-index: 1;
            }
            
            .visitor-card .logo {
              width: 1cm;
              height: auto;
            }
            
            .visitor-card h2 {
              margin: 0;
              font-size: 0.5cm;
              font-weight: 700;
              letter-spacing: 1px;
              color: #1a237e;
              text-transform: uppercase;
            }
            
            .visitor-card .divider {
              border: none;
              border-top: 2px dotted #4a90e2;
              width: 100%;
              margin: 0.15cm 0;
              z-index: 1;
            }
            
            .content-wrapper {
              display: flex;
              gap: 0.25cm;
              z-index: 1;
              position: relative;
              flex-grow: 1;
            }
            
            .info-section {
              flex: 1;
              color: #222;
            }
            
            .info-grid p {
              margin: 0.06cm 0;
              display: flex;
              align-items: center;
              font-size: 0.24cm;
              line-height: 1.2;
            }
            
            .info-section i {
              color: #1a237e;
              margin-right: 0.08cm;
              font-size: 0.24cm;
              min-width: 0.3cm;
            }
            
            .info-section .label {
              font-weight: 600;
              margin-right: 0.08cm;
              min-width: 1.6cm;
              font-size: 0.22cm;
            }
            
            .info-section .value {
              font-size: 0.24cm;
              flex: 1;
              word-break: break-word;
            }
            
            .welcome {
              font-size: 0.26cm;
              font-weight: 700;
              color: #1a237e;
              margin-bottom: 0.1cm !important;
              text-align: center;
              letter-spacing: 0.3px;
            }
            
            .visitor-name {
              font-size: 0.38cm;
              font-weight: 800;
              color: #1a237e;
              margin-bottom: 0.10cm !important;
              text-align: center;
              letter-spacing: 0.5px;
            }
            
            .signature-section {
              width: 1.8cm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border-left: 1px solid #ccc;
              padding-left: 0.15cm;
            }
          .no-picture {
  font-size: 0.22cm;
  font-weight: 700;
  color: #1a237e;
  text-align: center;
  text-transform: uppercase;
  line-height: 1.2;
  margin-bottom: 0.1cm;
}

.no-photo-img {
  width: 1.2cm;
  height: auto;
  opacity: 0.9;
}


            @media print {
              body { 
                background: white;
                margin: 0;
              }
              
              .visitor-card {
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 1000);
    };
  };

  const applyQuickFilter = (q) => {
    if (quickFilter === q) {
      setQuickFilter("none");
      setDateFrom("");
      setDateTo("");
    } else {
      setQuickFilter(q);
      const today = new Date();
      const todayOnly = toDateOnly(today);

      if (q === "today") {
        setDateFrom(formatISODate(todayOnly));
        setDateTo(formatISODate(todayOnly));
      } else if (q === "yesterday") {
        const y = new Date(todayOnly);
        y.setDate(y.getDate() - 1);
        setDateFrom(formatISODate(y));
        setDateTo(formatISODate(y));
      } else if (q === "last7") {
        const end = new Date(todayOnly);
        const start = new Date(todayOnly);
        start.setDate(start.getDate() - 6);
        setDateFrom(formatISODate(start));
        setDateTo(formatISODate(end));
      }
    }
  };

  const handleManualDateFrom = (val) => {
    setQuickFilter("none");
    setDateFrom(val);
  };
  const handleManualDateTo = (val) => {
    setQuickFilter("none");
    setDateTo(val);
  };

  return (
    <div
      className="d-flex flex-column min-vh-100"
      style={{
  backgroundImage: `url(${securitybg})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
}}
    >
      <Navbar exportToExcel={openExportDialog} adhoc={openAdhoc} />
      <div className="container py-4 flex-grow-1">
        <motion.div
          className="text-center mb-4"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="display-4 fw-bold text-dark">Facilo - Visitor Details</h1>
          <p className="text-muted fs-5">Manage visitor check-ins and check-outs</p>
        </motion.div>

        <div className="row justify-content-center mb-3">
          <div className="col-md-6">
            <div className="input-group shadow-sm">
              <span className="input-group-text bg-white border-end-0">
                <FaSearch className="text-muted" />
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search by name or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ✅ FIX: all 4 counts now use countVisitors — stable regardless of active filter tab */}
        <div className="d-flex justify-content-center gap-2 mb-2 flex-wrap align-items-center">
          <button
            className={`btn btn-sm rounded-pill px-4 ${statusFilter === "all" ? "btn-dark" : "btn-outline-dark"}`}
            onClick={() => setStatusFilter("all")}
          >
            <FaFilter className="me-2" />All ({countVisitors.length})
          </button>
          <button
            className={`btn btn-sm rounded-pill px-4 ${statusFilter === "new" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setStatusFilter("new")}
          >
            New ({countVisitors.filter((v) => v.status === "new").length})
          </button>
          <button
            className={`btn btn-sm rounded-pill px-4 ${statusFilter === "checkedIn" ? "btn-success" : "btn-outline-success"}`}
            onClick={() => setStatusFilter("checkedIn")}
          >
            Checked In ({countVisitors.filter((v) => v.status === "checkedIn").length})
          </button>
          <button
            className={`btn btn-sm rounded-pill px-4 ${statusFilter === "checkedOut" ? "btn-warning" : "btn-outline-warning"}`}
            onClick={() => setStatusFilter("checkedOut")}
          >
            Checked Out ({countVisitors.filter((v) => v.status === "checkedOut").length})
          </button>
          {/* -----------------changed by rebanta-------------- */}
          {/* New filter tab: "Repeated" — shows only multi-day visitors/guests via isRepeatedVisitorType */}
          <button
            className={`btn btn-sm rounded-pill px-4 ${statusFilter === "repeated" ? "btn-info" : "btn-outline-info"}`}
            onClick={() => setStatusFilter("repeated")}
          >
            Repeated ({countVisitors.filter((v) => isRepeatedVisitorType(v)).length})
          </button>
          {/* ------------------------------------------------- */}
          {/* info icon with tooltip explaining 7-day filter */}
          <span
            title="Only records checked out within the last 7 days are shown on screen. For older records, use Export to Excel."
            style={{ cursor: "pointer", color: "#6c757d", fontSize: "1rem", alignSelf: "center" }}
          >
            <FaInfoCircle />
          </span>
        </div>

        {loading ? (
          <p className="text-center">Loading...</p>
        ) : (
          <div className="row justify-content-center">
            {filteredVisitors.length === 0 ? (
              <div className="col-12 text-center">
                <p className="text-muted fs-5">
                  {searchQuery ? `No visitors found matching "${searchQuery}"` : "No visitors found for this filter"}
                </p>
              </div>
            ) : (
              // -----------------changed by rebanta--------------
              // Refactored map to block body: per-card pass-tracking state derived from shared
              // nowTick so all date-sensitive UI (chips, buttons, panels) refresh together
              filteredVisitors.map((v, i) => {
                // Uses the shared time tick so date-based actions update consistently in the UI.
                const guardNow = new Date(nowTick);
                const passTracking = getPassTrackingMeta(v, guardNow);
                const passStatusStyles = getPassStatusStyles(passTracking.tone);
                const passStatusLabel = getPassStatusLabel(passTracking);
                const passTodayLabel = getPassTodayLabel(passTracking);
                const isRepeatedRecord = isRepeatedVisitorType(v);
                const repeatPrimaryAction = getRepeatPrimaryAction(v, passTracking);
                const isPassActionBusy = isPassActionBusyForVisitor(v._id, passActionKey);
                // Final-day (after return) and post-final-day repeated records should be checkout-only.
                const isFinalDayRepeated = isRepeatedRecord && isFinalCheckoutDay(v, guardNow);
                const isAfterFinalDayRepeated = isRepeatedRecord && isAfterFinalCheckoutDay(v, guardNow);
                const showOnlyCheckout =
                  (isFinalDayRepeated && Boolean(passTracking.returnToday)) ||
                  isAfterFinalDayRepeated;
                // -------------------------------------------------

                return (
                <motion.div
                  key={v._id}
                  className="col-md-4 mb-3"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div
                    className="card shadow-lg border-0 p-4 rounded-4 fancy-card"
                    style={{
                      background: "#F2F2F2",
                      backdropFilter: "blur(10px)",
                      position: "relative",
                      paddingTop: "2.5rem",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "-18px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "60px",
                        height: "24px",
                        background: "#222",
                        borderRadius: "8px",
                      }}
                    ></div>

                    <h4 className="fw-bold text-center mb-3">
                      <FaUser className="me-2" />
                      {v.firstName} {v.lastName}
                    </h4>
                    {/* -----------------changed by rebanta-------------- */}
                    {/* New: badge chip identifying multi-day visitors and guests on the card */}
                    {isRepeatedRecord && (
                      <div className="text-center mb-2">
                        <span className="repeated-visit-chip">Repeated Visitor/Guest</span>
                      </div>
                    )}
                    {/* ------------------------------------------------- */}
                    <p>
                      <FaBuilding className="me-2" />
                      <b>Category: {v.category || "-"}</b> 
                    </p>
                    <p>
                      <FaUser className="me-2" />
                      <b>Host:</b> {v.host || "-"}
                    </p>
                    <p>
                      <FaQuestion className="me-2" />
                      <b>Purpose:</b> {v.purposeOfVisit || "-"}
                    </p>
                    <p>
                      <FaMapMarkerAlt className="me-2 text-danger" />
                      <b>Company:</b> {v.company || "-"}
                    </p>

                    <p>
                      <FaIdBadge className="me-2" />
                      <b>Visitor ID:</b> {v.cardNo || "-"}
                    </p>
                    <p>
                      <FaClock className="me-2 text-info" />
                      <b>Tentative In:</b> {v.inTime ? new Date(v.inTime).toLocaleString() : "-"}
                    </p>
                    <p>
                      <FaClock className="me-2 text-info" />
                      <b>Tentative Out:</b> {v.outTime ? new Date(v.outTime).toLocaleString() : "-"}
                    </p>
                    <p>
                      <FaClock className="me-2 text-success" />
                      <b>Actual Check-In:</b> {v.actualInTime ? new Date(v.actualInTime).toLocaleString() : "-"}
                    </p>
                    <p>
                      <b>Status:</b> <span className="badge bg-dark rounded-pill px-3">{v.status?.toUpperCase()}</span>
                    </p>

                    {/* -----------------changed by rebanta-------------- */}
                    {/* New: per-card daily pass tracking panel — status chip, summary text,
                        today's pass label, next-issue date, and visit window for multi-day records */}
                    {passTracking.enabled && (
                      <div className="pass-panel rounded-3 p-3 mb-3" style={passStatusStyles}>
                        <div className="pass-panel-header mb-2">
                          <div className="fw-semibold">Daily Pass Tracking</div>
                          <span className={`pass-status-chip pass-status-${passTracking.tone || "secondary"}`}>
                            {passStatusLabel}
                          </span>
                        </div>

                        <div className="small pass-summary-text">{passTracking.summary}</div>

                        <div className="pass-mini-grid mt-2">
                          <div className="pass-mini-card">
                            <div className="pass-mini-label">Today's Status</div>
                            <div className="pass-mini-value">{passTodayLabel}</div>
                          </div>
                          <div className="pass-mini-card">
                            <div className="pass-mini-label">Next Issue</div>
                            <div className="pass-mini-value">{passTracking.nextIssueLabel || "Will appear automatically"}</div>
                          </div>
                        </div>
                        <div className="small mt-1">
                          <b>Visit Window:</b> {formatIST(v.inTime)} to {formatIST(v.outTime)}
                        </div>
                      </div>
                    )}
                    {/* ------------------------------------------------- */}

                    {v.displaySignature && (
                      <div className="text-center my-2">
                        <img src={v.displaySignature} alt="signature" width={150} className="border rounded p-2" />
                        <p className="text-success small">✔ Signed (Encrypted)</p>
                      </div>
                    )}

                    {v.status === "new" && (
  <div className="text-center d-flex justify-content-center gap-2 flex-wrap">
    <button className="btn btn-dark btn-sm rounded-pill" onClick={() => openConsent(v)}>
      Authorize
    </button>
    {/*----------------------------------Changes by Anup----------------------------------------------------------------------- */}
    <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => openDetails(v)}>
      View Details   {/*This is what the user will see on the cards of the security page */}
    </button>
    {/*----------------------------------Changes by Anup----------------------------------------------------------------------- */}


    {/* ✅ NEW: show Remove only if overdue */}
    {isOverdue24Hours(v) && (
      <button
        className="btn btn-danger btn-sm rounded-pill"
        onClick={() => removeFromUI(v)}
      >
        Remove
      </button>
    )}
  </div>
)}


                    {/* -----------------changed by rebanta-------------- */}
                    {/* Redesigned: repeated visitors get Issue/Return Pass + showOnlyCheckout guard;
                        non-repeated get Edit Badge, optional Issue/Return Pass, Print, View Details, Check Out */}
                    {v.status === "checkedIn" && (
                      <div className="d-flex justify-content-center gap-2 mt-3 flex-wrap action-row-modern">
                        {isRepeatedRecord ? (
                          showOnlyCheckout ? (
                          <>
                            <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => openDetails(v)}>
                              {/* Keep View Details always available, including checkout-only state. */}
                              View Details
                            </button>
                            <button className="btn btn-warning btn-sm rounded-pill" onClick={() => openCheckout(v)}>
                              {/* On final day after return, enforce checkout-only action on card. */}
                              Check Out
                            </button>
                          </>
                          ) : (
                            <>
                              <button className="btn btn-outline-primary btn-sm rounded-pill" onClick={() => handleBadgeEditOpen(v)}>
                                <FaEdit className="me-1" /> Edit Badge
                              </button>
                              {repeatPrimaryAction?.kind === "issued" && (
                                <button
                                  className={repeatPrimaryAction.className}
                                  onClick={() => recordDailyPassEvent(v, "issued")}
                                  disabled={isPassActionBusy}
                                >
                                  {repeatPrimaryAction.label}
                                </button>
                              )}
                              {repeatPrimaryAction?.kind === "returned" && (
                                <button
                                  className={repeatPrimaryAction.className}
                                  onClick={() => recordDailyPassEvent(v, "returned")}
                                  disabled={isPassActionBusy}
                                >
                                  {repeatPrimaryAction.label}
                                </button>
                              )}
                              <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => printCard(v)}>
                                <FaPrint className="me-1" /> Print Card
                              </button>
                              <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => openDetails(v)}>
                                View Details
                              </button>
                            </>
                          )
                        ) : (
                          <>
                            <button className="btn btn-outline-primary btn-sm rounded-pill" onClick={() => handleBadgeEditOpen(v)}>
                              <FaEdit className="me-1" /> Edit Badge
                            </button>
                            {passTracking.enabled && passTracking.canIssue && v.source !== "adhoc" && (
                              <button
                                className="btn btn-success btn-sm rounded-pill pass-action-btn"
                                onClick={() => recordDailyPassEvent(v, "issued")}
                                disabled={isPassActionBusy}
                              >
                                Issue Pass
                              </button>
                            )}
                            {passTracking.enabled && passTracking.canReturn && v.source !== "adhoc" && (
                              <button
                                className="btn btn-danger btn-sm rounded-pill pass-action-btn"
                                onClick={() => recordDailyPassEvent(v, "returned")}
                                disabled={isPassActionBusy}
                              >
                                Return Pass
                              </button>
                            )}
                            <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => printCard(v)}>
                              <FaPrint className="me-1" /> Print Card
                            </button>

                            {/*----------------------------------Changes by Anup----------------------------------------------------------------------- */}
                            <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => openDetails(v)}>
                              View Details   {/*This is what the user will see on the cards of the security page */}
                            </button>
                            {/*----------------------------------Changes by Anup----------------------------------------------------------------------- */}

                            {(!isRepeatedRecord || isFinalCheckoutDay(v)) && (
                              <button className="btn btn-warning btn-sm rounded-pill" onClick={() => openCheckout(v)}>
                                {/* Keep direct checkout on card for non-repeated visits and final-day repeated visits. */}
                                Check Out
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {/* ------------------------------------------------- */}
                  </div>
                </motion.div>
                );
              })
            )}
          </div>
        )}
      </div>

{/* CONSENT MODAL - UPDATED WITH BETTER STYLING */}
<AnimatePresence>
  {showConsent && currentVisitor && (
    <motion.div 
      className="modal show d-block" 
      style={{ background: "rgba(0,0,0,0.6)" }} 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content p-4 rounded-4">
          <h3 className="text-center fw-bold mb-4" style={{ fontSize: "1.5rem" }}>
            Visitor Consent Form
          </h3>
          
          <div className="consent-text p-3 mb-3" style={{ 
            background: "#f8f9fa", 
            borderRadius: "8px",
            maxHeight: "300px",
            overflowY: "auto",
            fontSize: "14px",
            lineHeight: "1.6",
            fontFamily: "Arial, sans-serif"
          }}>
            <p className="mb-3" style={{ fontSize: "14px" }}>
             <strong>{getConsentSalutation(currentVisitor)}</strong>

            </p>
            <p className="mb-3" style={{ fontSize: "14px" }}>
              UD Trucks India Private Limited ('We'), will be collecting, processing, storing and utilizing 
              your personal data (as detailed below) solely for the purpose of security, risk management and compliance.
            </p>
            
            <ul className="mb-3" style={{ paddingLeft: "20px", fontSize: "14px" }}>
              <li>Name, address, mobile number, email id., purpose of visit, signature</li>
            </ul>
            
            <p className="mb-3" style={{ fontSize: "14px" }}>
              We acknowledge that your data will be securely stored, accessed only by authorized personnel, 
              and managed in accordance with applicable data protection laws and our privacy policy.
            </p>
            
            <p className="mb-3" style={{ fontSize: "14px" }}>
              Your consent to collect, process, store and utilize your personal data will remain valid for 
              one calendar year from today upto <strong>{getExpiryDate()}</strong>. You understand that you may withdraw your consent at any time 
              by notifying UDVMSSupport@udtrucks.onmicrosoft.com.

            </p>
            
            <p className="mb-3" style={{ fontSize: "14px" }}>
              Please sign below to indicate your understanding and acceptance of the above terms.
            </p>
          </div>

          <div className="mb-3">
            <p className="fw-bold mb-2" style={{ 
              fontSize: "15px", 
              color: "#dc3545",
              fontFamily: "Arial, sans-serif"
            }}>
              {getConsentLabel(currentVisitor)}

            </p>
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="consentCheckbox"
                checked={consentChecked}
                onChange={() => setConsentChecked(!consentChecked)}
              />
              <label 
                className="form-check-label" 
                htmlFor="consentCheckbox"
                style={{ fontSize: "14px", fontFamily: "Arial, sans-serif" }}
              >
                I confirm that my consent is given voluntarily and that I have had the opportunity 
                to ask questions regarding this authorization.
              </label>
            </div>
          </div>

          <p className="text-danger text-center fw-bold mb-2" style={{ fontSize: "14px" }}>
            * Signature is required
          </p>
          <div className="text-center">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              style={{ touchAction: "none", background: "white" }}
              className="border rounded"
              onMouseDown={startSign}
              onMouseMove={signing}
              onMouseUp={endSign}
              onMouseLeave={endSign}
              onTouchStart={startSign}
              onTouchMove={signing}
              onTouchEnd={endSign}
            />
          </div>

          <button 
            className="btn btn-outline-secondary btn-sm d-block mx-auto mt-2" 
            onClick={clearPad}
            style={{ fontSize: "13px" }}
          >
            Clear Signature
          </button>

          <div className="text-center mt-4 d-flex gap-2 justify-content-center">
            <button 
              className="btn btn-outline-secondary rounded-pill shadow px-4" 
              onClick={() => {
                setShowConsent(false);
                setCurrentVisitor(null);
                setConsentChecked(false);
              }}
              style={{ fontSize: "14px" }}
            >
              Cancel
            </button>
            <button 
              className="btn btn-success rounded-pill shadow px-4" 
              onClick={submitConsent}
              style={{ fontSize: "14px" }}
            >
              Submit Consent
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )}
</AnimatePresence>
      {/* BADGE EDIT MODAL */}
      <AnimatePresence>
         {showBadgeEdit && badgeEditVisitor && (
          <motion.div className="modal show d-block" style={{ background: "rgba(0,0,0,0.6)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content p-4 rounded-4">
                <h3 className="text-center fw-bold mb-3">
                  <FaIdBadge className="me-2" />
                  Edit Badge Number
                </h3>
                <input
                  value={badgeNo}
                  onChange={(e) => setBadgeNo(e.target.value)}
                  className="form-control text-center fs-5 rounded-pill shadow-sm"
                  placeholder="Enter Badge Number"
                />
                
               <div className="text-center mt-4 d-flex justify-content-center gap-2">
  <button
    type="button"
    className="btn btn-outline-secondary btn-sm rounded-pill shadow px-4"
    onClick={() => {
      setShowBadgeEdit(false);
      setBadgeEditVisitor(null);
    }}
  >
    Close
  </button>

  <button
    type="button"
    className="btn btn-success btn-sm rounded-pill shadow px-4"
    onClick={saveBadgeNo}
  >
    Save
                  </button>
                </div>
                {/* //--------------------------changed by rebanta------------------------------// */}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHECKOUT MODAL */}
      <AnimatePresence>
        {showCheckout && currentVisitor && (
          <motion.div className="modal show d-block" style={{ background: "rgba(0,0,0,0.6)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content p-4 rounded-4">
                <h3 className="text-center fw-bold mb-3">Check-Out Form</h3>
                <hr />
                <div className="d-flex flex-column gap-3 align-items-start px-4">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="badgeSurrendered"
                      checked={checkoutData.badgeSurrendered}
                      onChange={() => setCheckoutData({ ...checkoutData, badgeSurrendered: !checkoutData.badgeSurrendered })}
                    />
                    <label className="form-check-label" htmlFor="badgeSurrendered">
                      Badge Surrendered?
                    </label>
                  </div>

                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="hostApproved"
                      checked={checkoutData.hostApproved}
                      onChange={() => setCheckoutData({ ...checkoutData, hostApproved: !checkoutData.hostApproved })}
                    />
                    <label className="form-check-label" htmlFor="hostApproved">
                      Host Approved?
                    </label>
                  </div>
                </div>
                                <div className="text-center mt-4 d-flex justify-content-center gap-2">
  <button
    className="btn btn-outline-secondary btn-sm rounded-pill shadow px-4"
    onClick={() => {
      setShowCheckout(false);
      setCurrentVisitor(null);
    }}
  >
    Close
  </button>
  <button className="btn btn-warning btn-sm rounded-pill shadow px-4" onClick={finalCheckout}>
    Check Out
  </button>
</div>

                
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXPORT DIALOG MODAL */}
      <AnimatePresence>
        {showExportDialog && (
          <motion.div 
            className="modal show d-block" 
            style={{ background: "rgba(0,0,0,0.6)" }} 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content p-4 rounded-4">
                <h3 className="text-center fw-bold mb-3">
                  <FaFileExcel className="me-2 text-success" />
                  Export to Excel
                </h3>
                <p className="text-center text-muted mb-4">Select a date range for export</p>
                
                <div className="d-flex align-items-center gap-2 mb-3 justify-content-center">
                  <label className="small mb-0">From</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dateFrom}
                    onChange={(e) => handleManualDateFrom(e.target.value)}
                    style={{ width: 150 }}
                  />
                  <label className="small mb-0">To</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dateTo}
                    onChange={(e) => handleManualDateTo(e.target.value)}
                    style={{ width: 150 }}
                  />
                </div>

                <div className="d-flex gap-2 mb-4 justify-content-center">
                  <button
                    className={`btn btn-sm rounded-pill ${quickFilter === "today" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => applyQuickFilter("today")}
                  >
                    Today
                  </button>
                  <button
                    className={`btn btn-sm rounded-pill ${quickFilter === "yesterday" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => applyQuickFilter("yesterday")}
                  >
                    Yesterday
                  </button>
                  <button
                    className={`btn btn-sm rounded-pill ${quickFilter === "last7" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => applyQuickFilter("last7")}
                  >
                    Last 7 Days
                  </button>
                </div>

                <div className="text-center">
                  {/* //--------------------------changed by rebanta------------------------------// */}
                  {/* Explanation: Displays live count of records that will be exported with current filters. */}
                  <p className="small text-muted mb-3">
                    {exportFilteredVisitors.length} record(s) will be exported
                  </p>
                  {/* //--------------------------changed by rebanta------------------------------// */}
                  <button 
                    className="btn btn-success rounded-pill shadow px-4 me-2" 
                    onClick={exportToExcel}
                  >
                    <FaFileExcel className="me-2" />
                    Download Excel
                  </button>
                  <button 
                    className="btn btn-outline-secondary rounded-pill px-4" 
                    onClick={() => {
                      setShowExportDialog(false);
                      setDateFrom("");
                      setDateTo("");
                      setQuickFilter("none");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*----------------------------------Changes by Anup----------------------------------------------------------------------- */}
      <AnimatePresence> {/*runs if and only if showDetails is true and detailsVisitor contains data */}
        {showDetails && detailsVisitor && (
          <motion.div
            className="modal show d-block"
            style={{ background: "rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content p-4 rounded-4">

                <h3 className="text-center fw-bold mb-4">
                  {detailsVisitor?.source === "guest" ? "Guest Details" : detailsVisitor?.source === "adhoc" ? "Adhoc Visitor Details" : "Visitor Details"}
                </h3> {/* this is used to figure out what type of visitor is */}

                <div className="row">

                  <div className="col-md-6 mb-2">
                    <b>Phone Number:</b><br />
                    {detailsVisitor.phone || "-"}
                  </div>

                  <div className="col-md-6 mb-2">
                    <b>Email:</b><br />
                    {detailsVisitor.email || "-"}
                  </div>

                  <div className="col-md-6 mb-2">
                    <b>Meeting Room:</b><br />
                    {detailsVisitor?.source === "adhoc" ? "-" : detailsVisitor.meetingRoom || "-"}
                  </div>

                  {/* Laptop serial ONLY for visitors */}
                  {detailsVisitor.source !== "guest" && (
                    <div className="col-md-6 mb-2">
                      <b>Laptop Serial No:</b><br />
                      {detailsVisitor.laptopSerial || "-"}
                    </div>
                  )}

                  {/* Refreshments ONLY for guests */}
                  {detailsVisitor.source === "guest" && (
                    <>
                      <div className="col-md-6 mb-2">
                        <b>Refreshments:</b><br />
                        {detailsVisitor.refreshmentRequired ? "Yes" : "No"}
                      </div>

                      <div className="col-md-6 mb-2">
                        <b>Refreshments Time:</b><br />
                        {detailsVisitor.proposedRefreshmentTime ? new Date(detailsVisitor.proposedRefreshmentTime).toLocaleString("en-IN") : "-"}
                      </div>
                    </>
                  )}

                  <div className="col-md-6 mb-2">
                    <b>Guest WiFi Required:</b><br />
                    {detailsVisitor.guestWifiRequired ? "Yes" : "No"}
                  </div>

                  {/* -----------------changed by rebanta-------------- */}
                  {/* Pass history section: groups issue+return pairs into cycle rows shown as a table */}
                  {detailsVisitor.source !== "adhoc" && isLongPeriodVisit(detailsVisitor) && (
                    <div className="col-12 mt-3">
                      <div className="border rounded-3 p-3" style={{ background: "#f8f9fa" }}>
                        <div className="fw-bold mb-2">Pass History</div>
                        {detailsPassEvents.length === 0 ? (
                          <div className="small text-muted">No daily pass actions recorded yet.</div>
                        ) : (() => {
                          // Group events by dateKey, pair issue+return into cycle rows
                          const byDate = {};
                          detailsPassEvents.forEach((ev) => {
                            if (!byDate[ev.dateKey]) byDate[ev.dateKey] = [];
                            byDate[ev.dateKey].push(ev);
                          });

                          const rows = [];
                          Object.keys(byDate)
                            .sort((a, b) => (a < b ? -1 : 1))
                            .forEach((dateKey) => {
                              const events = byDate[dateKey];
                              const issues = events
                                .filter((e) => e.action === "issued")
                                .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
                              const returns = events
                                .filter((e) => e.action === "returned")
                                .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
                              const cycleCount = Math.max(issues.length, returns.length);
                              for (let c = 0; c < cycleCount; c++) {
                                rows.push({
                                  dateKey,
                                  cycle: c + 1,
                                  issuedAt: issues[c]?.recordedAt || null,
                                  returnedAt: returns[c]?.recordedAt || null,
                                });
                              }
                            });

                          // Reverse so newest cycle is first
                          rows.reverse();

                          return (
                            <div style={{ overflowX: "auto" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                <thead>
                                  <tr style={{ background: "#e9ecef", textAlign: "left" }}>
                                    <th style={{ padding: "8px 12px", borderBottom: "2px solid #dee2e6", whiteSpace: "nowrap" }}>Date</th>
                                    <th style={{ padding: "8px 12px", borderBottom: "2px solid #dee2e6" }}>Cycle</th>
                                    <th style={{ padding: "8px 12px", borderBottom: "2px solid #dee2e6", whiteSpace: "nowrap" }}>Issued At</th>
                                    <th style={{ padding: "8px 12px", borderBottom: "2px solid #dee2e6", whiteSpace: "nowrap" }}>Returned At</th>
                                    <th style={{ padding: "8px 12px", borderBottom: "2px solid #dee2e6" }}>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row, idx) => (
                                    <tr key={`${row.dateKey}-${row.cycle}`} style={{ background: idx % 2 === 0 ? "#fff" : "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
                                      <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>{row.dateKey}</td>
                                      <td style={{ padding: "7px 12px" }}>{row.cycle}</td>
                                      <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>{row.issuedAt ? formatIST(row.issuedAt) : "-"}</td>
                                      <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>{row.returnedAt ? formatIST(row.returnedAt) : "-"}</td>
                                      <td style={{ padding: "7px 12px" }}>
                                        <span style={{
                                          display: "inline-block",
                                          padding: "2px 10px",
                                          borderRadius: "20px",
                                          fontSize: "0.78rem",
                                          fontWeight: 600,
                                          background: row.returnedAt ? "#1e293b" : "#fef9c3",
                                          color: row.returnedAt ? "#f8fafc" : "#713f12",
                                          border: row.returnedAt ? "none" : "1px solid #fde68a",
                                        }}>
                                          {row.returnedAt ? "Returned" : "Issued"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  {/* ------------------------------------------------- */}


                  
                </div>

                {/* -----------------changed by rebanta-------------- */}
                {/* Redesigned details modal footer: Issue Pass, Return Pass, Optional/Final
                    Check Out (blocked until pass returned on final day), and Close button */}
                <div className="text-center mt-4 d-flex justify-content-center gap-2 flex-wrap">
                  {detailsVisitor.status === "checkedIn" && (
                    <>
                      {detailsPrimaryAction?.kind === "issued" && (
                        <button
                          className="btn btn-success rounded-pill px-4"
                          onClick={() => recordDailyPassEvent(detailsVisitor, "issued")}
                          disabled={detailsPassActionBusy}
                        >
                          {/* Mirrors the single next-step action inside details modal. */}
                          Issue Pass
                        </button>
                      )}
                      {detailsPrimaryAction?.kind === "returned" && (
                        <button
                          className="btn btn-danger rounded-pill px-4"
                          onClick={() => recordDailyPassEvent(detailsVisitor, "returned")}
                          disabled={detailsPassActionBusy}
                        >
                          Return Pass
                        </button>
                      )}
                      <button
                        className="btn btn-warning rounded-pill px-4"
                        disabled={requirePassFlowBeforeFinalCheckout}
                        title={
                          requirePassFlowBeforeFinalCheckout
                            ? "Complete today's Issue Pass and Return Pass before final checkout"
                            : detailsIsBeforeFinalDay
                              ? "Optional until the final day"
                              : "Proceed to checkout"
                        }
                        onClick={() => {
                          setShowDetails(false);
                          openCheckout(detailsVisitor);
                        }}
                      >
                        {detailsIsBeforeFinalDay ? "Optional Check Out" : "Check Out"}
                      </button>
                    </>
                  )}
                  <button
                    className="btn btn-dark rounded-pill px-4"
                    onClick={() => setShowDetails(false)} 
                  >
                    Close
                  </button>
                </div>
                {/* ------------------------------------------------- */}

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/*----------------------------------Changes by Anup----------------------------------------------------------------------- */}

      <footer className="watermark text-center py-3 UD Redbg-opacity-50 mt-auto">
        <small>© {new Date().getFullYear()} UD Trucks | Facilo Portal</small>
      </footer>

      <style jsx>{`
        .fancy-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .fancy-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.3);
        }
        /* -----------------changed by rebanta-------------- */
        /* New CSS: repeated-visit-chip badge, pass panel (pass-panel, pass-panel-header,
           pass-summary-text, pass-status-chip variants), pass-mini-grid card layout,
           action-row-modern divider, and pass-action-btn — all for the daily pass feature */
        .repeated-visit-chip {
          display: inline-block;
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.2px;
          border: 1px solid #74b9ff;
          color: #0b4f8a;
          background: #edf6ff;
          border-radius: 999px;
          padding: 3px 10px;
        }
        .pass-panel {
          box-shadow: 0 8px 16px rgba(2, 6, 23, 0.08);
        }
        .pass-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .pass-summary-text {
          line-height: 1.45;
        }
        .pass-status-chip {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid transparent;
          white-space: nowrap;
        }
        .pass-status-success {
          color: #0f5132;
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.45);
        }
        .pass-status-warning {
          color: #7a4b00;
          background: rgba(251, 191, 36, 0.2);
          border-color: rgba(251, 191, 36, 0.45);
        }
        .pass-status-danger {
          color: #9f1239;
          background: rgba(244, 63, 94, 0.15);
          border-color: rgba(244, 63, 94, 0.45);
        }
        .pass-status-primary {
          color: #1d4ed8;
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.45);
        }
        .pass-status-secondary {
          color: #52525b;
          background: rgba(161, 161, 170, 0.15);
          border-color: rgba(161, 161, 170, 0.45);
        }
        .pass-mini-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .pass-mini-card {
          background: rgba(255, 255, 255, 0.65);
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 10px;
          padding: 8px 10px;
        }
        .pass-mini-label {
          font-size: 0.66rem;
          font-weight: 700;
          letter-spacing: 0.24px;
          text-transform: uppercase;
          opacity: 0.8;
        }
        .pass-mini-value {
          font-size: 0.78rem;
          margin-top: 2px;
          line-height: 1.35;
        }
        .action-row-modern {
          border-top: 1px dashed rgba(15, 23, 42, 0.18);
          padding-top: 10px;
        }
        .pass-action-btn {
          font-weight: 700;
          letter-spacing: 0.15px;
        }
        @media (min-width: 768px) {
          .pass-mini-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        /* ------------------------------------------------- */
        .consent-text {
          font-size: 14px;
          line-height: 1.6;
        }
        .consent-text ul {
          padding-left: 20px;
        }
      `}</style>
    </div>
  );
}
