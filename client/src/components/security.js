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
              filteredVisitors.map((v, i) => (
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


                    {v.status === "checkedIn" && (
                      <div className="d-flex justify-content-center gap-2 mt-3 flex-wrap">
                        <button className="btn btn-outline-primary btn-sm rounded-pill" onClick={() => handleBadgeEditOpen(v)}>
                          <FaEdit className="me-1" /> Edit Badge
                        </button>
                        <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => printCard(v)}>
                          <FaPrint className="me-1" /> Print Card
                        </button>

                        {/*----------------------------------Changes by Anup----------------------------------------------------------------------- */}
                        <button className="btn btn-outline-dark btn-sm rounded-pill" onClick={() => openDetails(v)}>
                          View Details   {/*This is what the user will see on the cards of the security page */}
                        </button>
                        {/*----------------------------------Changes by Anup----------------------------------------------------------------------- */}

                        <button className="btn btn-warning btn-sm rounded-pill" onClick={() => openCheckout(v)}>
                          Check Out
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
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
