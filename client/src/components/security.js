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
      issueToday,
      returnToday,
    };
  }

  if (returnToday) {
    return {
      enabled: true,
      canIssue: false,
      canReturn: false,
      tone: "success",
      summary: `Pass returned today at ${formatIST(returnToday.recordedAt)}.`,
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
    issueToday,
    returnToday,
  };
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
  useEffect(() => {
  const t = setInterval(() => setNowTick(Date.now()), 30000);
  return () => clearInterval(t);
}, []);


  useEffect(() => {
    let result = visitors;
    let exportResult = visitors;

    //--------------------------changed by rebanta------------------------------//
    // Explanation: Applies selected status to both on-screen list and export dataset.
    if (statusFilter !== "all") {
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
                const isRepeatedRecord = isRepeatedVisitorType(v);
                const isPassActionBusy = isPassActionBusyForVisitor(v._id, passActionKey);
                // Final-day (after return) and post-final-day repeated records should be checkout-only.
                const isFinalDayRepeated = isRepeatedRecord && isFinalCheckoutDay(v, guardNow);
                const isAfterFinalDayRepeated = isRepeatedRecord && isAfterFinalCheckoutDay(v, guardNow);
                const canFinalizeRepeatedToday =
                  isFinalDayRepeated && (!passTracking.issueToday || Boolean(passTracking.returnToday));
                const showOnlyCheckout = canFinalizeRepeatedToday || isAfterFinalDayRepeated;
                const basicJourneyEnabled = !passTracking.enabled && v.source !== "adhoc";
                const basicCanAuthorize = basicJourneyEnabled && v.status === "new";
                const basicStep1State = v.status === "new" ? "next-slate" : "done-slate";
                const basicStep2State = v.status === "checkedIn" ? "current-teal" : v.status === "checkedOut" ? "done-teal" : "idle";
                const basicCanCheckout = basicJourneyEnabled && v.status === "checkedIn";
                const basicStep3State = v.status === "checkedOut" ? "final-dark" : basicCanCheckout ? "next-checkout" : "idle";
                const basicStep1Label = basicCanAuthorize ? "Authorize" : "Authorized";
                const basicStep3Label = v.status === "checkedOut" ? "Complete" : "Check-Out";
                const basicAccentColor =
                  basicCanAuthorize
                    ? "#2563eb"
                    : basicCanCheckout
                      ? "#f59e0b"
                      : v.status === "checkedOut"
                        ? "#f59e0b"
                        : "#14b8a6";
                const basicSummary =
                  v.status === "checkedOut"
                    ? "Visit completed successfully."
                    : v.status === "checkedIn"
                      ? "Visitor is currently on site."
                      : "Use Authorize to approve and capture consent before check-in.";
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
                    className="card shadow-lg border-0 p-4 rounded-4 fancy-card visitor-info-card"
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
                    <div className="visitor-meta">
                      <p className="visitor-meta-row">
                        <FaBuilding className="me-2" />
                        <b>Category: {v.category || "-"}</b>
                      </p>
                      <p className="visitor-meta-row">
                        <FaUser className="me-2" />
                        <b>Host:</b> {v.host || "-"}
                      </p>
                      <p className="visitor-meta-row">
                        <FaQuestion className="me-2" />
                        <b>Purpose:</b> {v.purposeOfVisit || "-"}
                      </p>
                      <p className="visitor-meta-row">
                        <FaMapMarkerAlt className="me-2 text-danger" />
                        <b>Company:</b> {v.company || "-"}
                      </p>
                      <p className="visitor-meta-row">
                        <FaIdBadge className="me-2" />
                        <b>Visitor ID:</b> {v.cardNo || "-"}
                      </p>
                      <p className="visitor-meta-row">
                        <FaClock className="me-2 text-info" />
                        <b>Tentative In:</b> {v.inTime ? new Date(v.inTime).toLocaleString() : "-"}
                      </p>
                      <p className="visitor-meta-row">
                        <FaClock className="me-2 text-info" />
                        <b>Tentative Out:</b> {v.outTime ? new Date(v.outTime).toLocaleString() : "-"}
                      </p>
                      <p className="visitor-meta-row">
                        <FaClock className="me-2 text-success" />
                        <b>Actual Check-In:</b> {v.actualInTime ? new Date(v.actualInTime).toLocaleString() : "-"}
                      </p>
                      <p className="visitor-meta-row visitor-status-row">
                        <b>Status:</b> <span className="badge bg-dark rounded-pill px-3">{v.status?.toUpperCase()}</span>
                      </p>
                    </div>

                    {basicJourneyEnabled && (
                      <div className="visit-stage-wrapper mb-3" style={{ borderLeftColor: basicAccentColor }}>
                        <div className="pass-track-eyebrow">Visit Journey</div>
                        <div className="pass-step-rail visit-step-rail">
                          <div className="pass-step-col">
                            <div
                              className={`pass-step-circle ${basicStep1State === "done-slate" ? "psc-done-slate" : "psc-next-slate"} ${basicCanAuthorize ? "pass-step-circle-actionable" : ""}`}
                              onClick={basicCanAuthorize ? () => openConsent(v) : undefined}
                              title={basicCanAuthorize ? "Authorize" : undefined}
                              style={{ cursor: basicCanAuthorize ? "pointer" : "default" }}
                            >
                              1
                            </div>
                            <div className="pass-step-lbl pass-step-lbl-await">{basicStep1Label}</div>
                          </div>
                          <div className={`pass-step-line ${v.status !== "new" ? "psl-slate" : "psl-idle"}`} />
                          <div className="pass-step-col">
                            <div className={`pass-step-circle ${basicStep2State === "current-teal" ? "psc-current-teal" : basicStep2State === "done-teal" ? "psc-done-teal" : "psc-idle"}`}>
                              2
                            </div>
                            <div className="pass-step-lbl pass-step-lbl-onsite">Checked In</div>
                          </div>
                          <div className={`pass-step-line ${v.status === "checkedOut" ? "psl-teal" : "psl-idle"}`} />
                          <div className="pass-step-col">
                            <div
                              className={`pass-step-circle ${basicStep3State === "final-dark" ? "psc-final-dark" : basicStep3State === "next-checkout" ? "psc-next-checkout" : "psc-idle"} ${basicCanCheckout ? "pass-step-circle-actionable" : ""}`}
                              onClick={basicCanCheckout ? () => openCheckout(v) : undefined}
                              title={basicCanCheckout ? "Check-Out" : undefined}
                              style={{ cursor: basicCanCheckout ? "pointer" : "default" }}
                            >
                              {v.status === "checkedOut" ? "✓" : "3"}
                            </div>
                            <div className="pass-step-lbl pass-step-lbl-closed">{basicStep3Label}</div>
                          </div>
                        </div>
                        <div className="pass-step-summary">
                          <span className="pass-summary-dot visitor-summary-dot-basic" />
                          {basicSummary}
                        </div>
                      </div>
                    )}

                    {passTracking.enabled && (() => {
                      const startKey = getPassDateKey(v.actualInTime || v.inTime);
                      const endKey = getPassDateKey(v.outTime);
                      const todayKey = getPassDateKey(guardNow);
                      let arcDayN = 1, arcTotal = 1;
                      if (startKey && endKey) {
                        const msPerDay = 86400000;
                        const startMs = new Date(startKey + "T12:00:00Z").getTime();
                        const endMs = new Date(endKey + "T12:00:00Z").getTime();
                        const todayMs = new Date(todayKey + "T12:00:00Z").getTime();
                        arcTotal = Math.max(1, Math.round((endMs - startMs) / msPerDay) + 1);
                        arcDayN = Math.max(1, Math.min(Math.round((todayMs - startMs) / msPerDay) + 1, arcTotal));
                      }
                      const R = 20, cx = 26, cy = 26;
                      const circ = 2 * Math.PI * R;
                      const arcFilled = circ * Math.min(arcDayN / arcTotal, 1);

                      const isFirstDay = arcDayN === 1;
                      const isAuthorizeMode = isFirstDay && v.status === "new";
                      const step1State = passTracking.issueToday
                        ? "done"
                        : isAuthorizeMode
                          ? "next-slate"
                          : passTracking.canIssue
                            ? "next-issue"
                            : "idle";
                      const step2State = passTracking.returnToday ? "done" : passTracking.canReturn ? "next-return" : "idle";
                      const conn1Done = Boolean(passTracking.issueToday);
                      const conn2Done = Boolean(passTracking.returnToday);
                      const isFinalDayNow = isFinalCheckoutDay(v, guardNow);
                      const canCheckoutFromPassRail = showOnlyCheckout && v.status === "checkedIn";
                      const step3State = canCheckoutFromPassRail
                        ? "next-checkout"
                        : conn2Done
                          ? (isFinalDayNow ? "final" : "done")
                          : "upcoming";
                      const step3Label = canCheckoutFromPassRail ? "Check-Out" : (isFinalDayNow ? "Complete" : "Next Day");
                      const accentColor =
                        canCheckoutFromPassRail
                          ? "#f59e0b"
                          : step2State === "next-return"
                            ? "#f59e0b"
                            : step3State === "done"
                              ? "#14b8a6"
                            : step1State === "next-slate" || step1State === "next-issue"
                              ? "#2563eb"
                              : "#64748b";

                      return (
                        <div className="pass-track-wrapper mb-3" style={{ borderLeftColor: accentColor }}>
                          <div className="pass-arc-ring">
                            <svg width="52" height="52" viewBox="0 0 52 52" aria-label={`Day ${arcDayN} of ${arcTotal}`}>
                              <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                              <circle
                                cx={cx}
                                cy={cy}
                                r={R}
                                fill="none"
                                stroke={accentColor}
                                strokeWidth="3.5"
                                strokeDasharray={`${arcFilled} ${circ}`}
                                strokeLinecap="round"
                                transform={`rotate(-90 ${cx} ${cy})`}
                              />
                              <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="800" fill="#1e293b">
                                {arcDayN}
                              </text>
                              <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" fontSize="7.5" fontWeight="500" fill="#64748b">
                                of {arcTotal}
                              </text>
                            </svg>
                            <div className="pass-arc-label">Day</div>
                          </div>

                          <div className="pass-track-eyebrow">Daily Pass</div>

                          <div className="pass-step-rail">
                            <div className="pass-step-col">
                              <div
                                className={`pass-step-circle ${step1State === "done" ? "psc-done psc-issue-node" : step1State === "next-slate" ? "psc-next-slate pass-step-circle-actionable" : `psc-${step1State} psc-issue-node`} ${step1State === "next-issue" ? "pass-step-circle-actionable" : ""}`}
                                onClick={
                                  step1State === "next-slate"
                                    ? () => openConsent(v)
                                    : step1State === "next-issue" && !isPassActionBusy
                                      ? () => recordDailyPassEvent(v, "issued")
                                      : undefined
                                }
                                title={step1State === "next-slate" ? "Authorize" : step1State === "next-issue" ? "Issue Pass" : undefined}
                                style={{ cursor: (step1State === "next-slate" || step1State === "next-issue") ? "pointer" : "default" }}
                              >
                                {step1State === "done" ? "✓" : "1"}
                              </div>
                              <div className="pass-step-lbl pass-step-lbl-issue">{isAuthorizeMode ? "Authorize" : "Issue"}</div>
                            </div>
                            <div className={`pass-step-line ${conn1Done ? "psl-done psl-after-issue" : "psl-idle"}`} />

                            <div className="pass-step-col">
                              <div
                                className={`pass-step-circle psc-${step2State} psc-return-node ${step2State === "next-return" ? "pass-step-circle-actionable" : ""}`}
                                onClick={step2State === "next-return" && !isPassActionBusy ? () => recordDailyPassEvent(v, "returned") : undefined}
                                title={step2State === "next-return" ? "Return Pass" : undefined}
                                style={{ cursor: step2State === "next-return" ? "pointer" : "default" }}
                              >
                                {step2State === "done" ? "✓" : "2"}
                              </div>
                              <div className="pass-step-lbl pass-step-lbl-return">Return</div>
                            </div>
                            <div className={`pass-step-line ${conn2Done ? "psl-done psl-after-return" : "psl-idle"}`} />

                            <div className="pass-step-col">
                              <div
                                className={`pass-step-circle psc-${step3State} psc-next-node ${canCheckoutFromPassRail ? "pass-step-circle-actionable" : ""}`}
                                onClick={canCheckoutFromPassRail ? () => openCheckout(v) : undefined}
                                title={canCheckoutFromPassRail ? "Check-Out" : undefined}
                                style={{ cursor: canCheckoutFromPassRail ? "pointer" : "default" }}
                              >
                                {step3State === "done" || step3State === "final" ? "✓" : "→"}
                              </div>
                              <div className="pass-step-lbl pass-step-lbl-next">{step3Label}</div>
                            </div>
                          </div>

                          <div className="pass-step-summary">
                            <span className="pass-summary-dot" style={{ background: accentColor }} />
                            {passTracking.summary}
                          </div>
                        </div>
                      );
                    })()}

                    {/* -----------------changed by rebanta-------------- */}
                    {/* Explanation: Signature preview + caption use dedicated classes so spacing stays
                        uniform with nearby progress and action sections. */}
                    {v.displaySignature && (
                      <div className="signature-block">
                        <img src={v.displaySignature} alt="signature" width={150} className="signature-preview" />
                        <p className="signature-caption">✔ Signed (Encrypted)</p>
                      </div>
                    )}
                    {/* ------------------------------------------------- */}

                    {v.status === "new" && (
                      <div className="text-center d-flex justify-content-center gap-2 flex-wrap card-action-row">
                        <button className="btn btn-dark btn-sm rounded-pill" onClick={() => openConsent(v)}>
                          Authorize
                        </button>
                        <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => openDetails(v)}>
                          View Details
                        </button>
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

                    {v.status === "checkedIn" && (
                      <div className="d-flex justify-content-center gap-2 flex-wrap card-action-row">
                        <button className="btn btn-outline-primary btn-sm rounded-pill" onClick={() => handleBadgeEditOpen(v)}>
                          <FaEdit className="me-1" /> Edit Badge
                        </button>
                        <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => printCard(v)}>
                          <FaPrint className="me-1" /> Print Card
                        </button>
                        <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => openDetails(v)}>
                          View Details
                        </button>
                        {isRepeatedRecord && showOnlyCheckout && (
                          <button className="btn btn-warning btn-sm rounded-pill" onClick={() => openCheckout(v)}>
                            Check Out
                          </button>
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
                  </h3>

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
                  
                </div>

                <div className="text-center mt-4">
                  <button
                    className="btn btn-dark rounded-pill px-4"
                    onClick={() => setShowDetails(false)} 
                  >
                    Close
                  </button>
                </div>

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
        .pass-track-wrapper {
          position: relative;
          background: #ffffff;
          border: 1px solid #dbe3ee;
          border-left-width: 4px;
          border-left-style: solid;
          border-radius: 12px;
          padding: 12px 14px 10px 14px;
          box-shadow: 0 2px 6px rgba(15,23,42,0.04);
          overflow: hidden;
        }
        .pass-track-wrapper::after {
          display: none;
        }
        .pass-arc-ring {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 1;
        }
        .pass-arc-label {
          font-size: 0.6rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 1px;
        }
        .pass-track-eyebrow {
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 8px;
          padding-right: 64px;
        }
        /* Step rail */
        .pass-step-rail {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding-right: 64px;
          padding-bottom: 0;
        }
        .pass-step-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          min-height: 62px;
        }
        .pass-step-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          border: 2px solid;
          flex-shrink: 0;
          transition: box-shadow 0.18s, transform 0.18s, border-color 0.18s;
          user-select: none;
        }
        .pass-step-circle:hover {
          transform: none;
        }
        .pass-step-circle-actionable {
          box-shadow: none;
        }
        .psc-idle {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #cbd5e1;
        }
        .psc-upcoming {
          background: #ffffff;
          border: 2px dashed #94a3b8;
          color: #64748b;
          box-shadow: none;
        }
        .psc-next-issue {
          background: #ffffff;
          border-color: #2563eb;
          color: #1d4ed8;
          animation: pscPulseBlue 1.85s ease-out infinite;
        }
        .psc-next-return {
          background: #ffffff;
          border-color: #f59e0b;
          color: #d97706;
          animation: pscPulseAmber 1.85s ease-out infinite;
        }
        .psc-next-checkout {
          background: #ffffff;
          border-color: #f59e0b;
          color: #d97706;
          animation: pscPulseYellow 1.85s ease-out infinite;
        }
        .psc-done {
          background: #64748b;
          border-color: #64748b;
          color: #fff;
          box-shadow: none;
        }
        .psc-issue-node.psc-done {
          background: #64748b;
          border-color: #64748b;
          box-shadow: none;
        }
        .psc-return-node.psc-done {
          background: #f59e0b;
          border-color: #d97706;
          box-shadow: none;
        }
        .psc-next-node.psc-done {
          background: #2dd4bf;
          border-color: #14b8a6;
          box-shadow: none;
        }
        .psc-final {
          background: #facc15;
          border-color: #f59e0b;
          color: #713f12;
          box-shadow: none;
        }
        @keyframes pscPulseBlue {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0.45); }
          50%       { box-shadow: 0 0 0 9px rgba(37,99,235,0); }
        }
        @keyframes pscPulseIndigo {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          50%       { box-shadow: 0 0 0 9px rgba(99,102,241,0); }
        }
        @keyframes pscPulseAmber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
          50%       { box-shadow: 0 0 0 9px rgba(245,158,11,0); }
        }
        @keyframes pscPulseYellow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(250,204,21,0.55); }
          50%       { box-shadow: 0 0 0 10px rgba(250,204,21,0); }
        }
        .pass-step-lbl {
          font-size: 0.58rem;
          font-weight: 700;
          color: #94a3b8;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }
        .pass-step-lbl-issue {
          color: #475569;
        }
        .pass-step-lbl-return {
          color: #d97706;
        }
        .pass-step-lbl-next {
          color: #14b8a6;
        }
        .pass-step-line {
          flex: 1;
          height: 2px;
          margin: 0 6px;
          margin-bottom: 22px;
          border-radius: 2px;
          transition: background 0.4s;
        }
        .psl-done {
          background: #64748b;
        }
        .psl-after-issue {
          background: #64748b;
        }
        .psl-after-return {
          background: #f59e0b;
        }
        .psl-idle {
          background: #e9eef5;
        }
        .pass-step-summary {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          font-size: 0.71rem;
          color: #475569;
          margin-top: 4px;
          line-height: 1.45;
          padding-right: 64px;
        }
        /* -----------------changed by rebanta-------------- */
        /* Explanation: Keeps signature region and action rows vertically consistent across cards. */
        .signature-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          row-gap: 6px;
          margin: 10px 0;
        }
        .signature-preview {
          display: block;
          width: 150px;
          max-width: 100%;
          border: 1px solid #dbe3ee;
          border-radius: 8px;
          padding: 8px;
          background: #ffffff;
          margin: 0;
        }
        .signature-caption {
          margin: 0;
          font-size: 0.875rem;
          line-height: 1.2;
          color: #15803d;
          font-weight: 400;
        }
        .card-action-row {
          margin-top: 10px;
        }
        /* ------------------------------------------------- */
        .pass-summary-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
        }
        .visit-stage-wrapper {
          background: #ffffff;
          border: 1px solid #dbe3ee;
          border-left-width: 4px;
          border-left-style: solid;
          border-radius: 12px;
          padding: 10px 12px 9px;
          box-shadow: none;
        }
        .visit-step-rail {
          padding-right: 0;
          justify-content: center;
        }
        .visit-step-rail .pass-step-col {
          width: 86px;
          flex: 0 0 86px;
        }
        .visit-step-rail .pass-step-line {
          flex: 1 1 auto;
        }
        .psc-next-slate {
          background: #ffffff;
          border-color: #2563eb;
          color: #1d4ed8;
          animation: pscPulseBlue 1.85s ease-out infinite;
        }
        .psc-done-slate {
          background: #64748b;
          border-color: #64748b;
          color: #fff;
        }
        .psc-current-teal {
          background: #14b8a6;
          border-color: #0d9488;
          color: #fff;
          animation: none;
        }
        .psc-done-teal {
          background: #2dd4bf;
          border-color: #14b8a6;
          color: #fff;
        }
        .psc-final-dark {
          background: #facc15;
          border-color: #f59e0b;
          color: #713f12;
          box-shadow: none;
        }
        @keyframes pscPulseSlate {
          0%, 100% { box-shadow: 0 0 0 0 rgba(71, 85, 105, 0.42); }
          50% { box-shadow: 0 0 0 10px rgba(71, 85, 105, 0); }
        }
        @keyframes pscPulseTeal {
          0%, 100% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.42); }
          50% { box-shadow: 0 0 0 10px rgba(20, 184, 166, 0); }
        }
        .psl-slate {
          background: #64748b;
        }
        .psl-teal {
          background: #2dd4bf;
        }
        .pass-step-lbl-await {
          color: #475569;
        }
        .pass-step-lbl-onsite {
          color: #14b8a6;
        }
        .pass-step-lbl-closed {
          color: #0f172a;
        }
        .visitor-summary-dot-basic {
          background: #64748b;
        }
        .consent-text {
          font-size: 14px;
          line-height: 1.6;
        }
        .consent-text ul {
          padding-left: 20px;
        }
        @media (max-width: 767.98px) {
          .pass-track-wrapper {
            padding-right: 14px;
          }
          .pass-track-eyebrow,
          .pass-step-rail,
          .pass-step-summary {
            padding-right: 0;
          }
          .pass-arc-ring {
            position: static;
            margin-bottom: 8px;
          }
        }
      `}</style>
    </div>
  );
}
