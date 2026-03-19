import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { useMsal } from "@azure/msal-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { FaRedoAlt, FaSearch, FaTimes, FaUserFriends, FaUserTie, FaLayerGroup, FaFileExcel, FaExclamationTriangle } from "react-icons/fa";

const MAX_SELECTION = 10;

const CHECKED_OUT_STATUS = "checkedout";
const NON_IDENTITIES = new Set(["", "unknown user", "employee", "security"]);
const SOURCE_STYLE = {
  visitor: { border: "#D8B200", badge: { background: "#fff8dc", color: "#6b5600", border: "1px solid #efdca0" } },
  guest:   { border: "#F08C00", badge: { background: "#fff2e0", color: "#7a4a00", border: "1px solid #f2d2a6" } },
};
const CONTROL_HEIGHT = "36px";
const CONTROL_FONT = "0.82rem";
const CONTROL_PADDING = "0 12px";

const normalize = (value) => String(value || "").trim().toLowerCase();
const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const padDatePart = (value) => String(value).padStart(2, "0");

const formatExportDateTime = (value) => {
  if (!value) return "";

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return `${parsed.getFullYear()}-${padDatePart(parsed.getMonth() + 1)}-${padDatePart(parsed.getDate())} ${padDatePart(parsed.getHours())}:${padDatePart(parsed.getMinutes())}`;
};

const buildPersonKey = (row) => {
  const first = normalize(row.firstName);
  const last = normalize(row.lastName);
  const email = normalize(row.email);
  const phone = normalizePhone(row.phone);
  const source = normalize(row.source);

  // Required rule: same person only when phone + email are same, and Visitor/Guest stay separate.
  if (email && phone) return `${source}|${email}|${phone}`;

  // If either identifier is missing, keep entries separate to avoid false merges.
  return `${source}|fallback|${normalize(row._id)}|${first}|${last}|${normalize(row.createdAt)}`;
};

export default function EmployeeProfileModal({ show, onClose, onRepeatSelect, onRepeatMultiSelect }) {
  const { accounts } = useMsal();
  const [historyRows, setHistoryRows] = useState([]);
  const [visitRowsByPerson, setVisitRowsByPerson] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedRows, setSelectedRows] = useState({});
  const [selectMultipleMode, setSelectMultipleMode] = useState(false);
  const [bulkTentativeInTime, setBulkTentativeInTime] = useState("");
  const [bulkTentativeOutTime, setBulkTentativeOutTime] = useState("");

  const currentAccount = Array.isArray(accounts) ? accounts[0] : null;
  const hostName =
    currentAccount?.name ||
    currentAccount?.username ||
    currentAccount?.localAccountId ||
    "Unknown User";
  const hostEmail =
    currentAccount?.idTokenClaims?.preferred_username ||
    currentAccount?.username ||
    currentAccount?.idTokenClaims?.email ||
    "Unknown User";

  const identitySet = useMemo(() => {
    return new Set([normalize(hostName), normalize(hostEmail)]);
  }, [hostName, hostEmail]);

  const identityTokens = useMemo(() => {
    return [...identitySet].filter((token) => !NON_IDENTITIES.has(token));
  }, [identitySet]);

  const isUnknownIdentity = identityTokens.length === 0;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [visitorsRes, guestsRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/api/visitors`),
        axios.get(`${process.env.REACT_APP_API_URL}/api/guests`),
      ]);

      const visitors = (visitorsRes.data || []).map((v) => ({
        ...v,
        source: "visitor",
        sourceLabel: "Visitor",
        fullName: `${v.firstName || ""} ${v.lastName || ""}`.trim(),
      }));

      const guests = (guestsRes.data || []).map((g) => ({
        ...g,
        source: "guest",
        sourceLabel: "Guest",
        fullName: `${g.firstName || ""} ${g.lastName || ""}`.trim(),
      }));

      const allCheckoutRows = [...visitors, ...guests]
        .filter((row) => {
          const status = normalize(row.status);
          const isCheckedOut = status === CHECKED_OUT_STATUS || Boolean(row.actualOutTime);
          return isCheckedOut && row.uiRemoved !== true;
        })
        .sort((a, b) => {
          const aTime = new Date(a.actualOutTime || a.outTime || a.updatedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.actualOutTime || b.outTime || b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });

      const belongsToHost = (row) => {
        if (identityTokens.length === 0) return true;
        const hostValue = normalize(row.host);
        const submittedByValue = normalize(row.submittedBy);
        return identityTokens.some((token) =>
          hostValue === token ||
          submittedByValue === token
        );
      };

      const grouped = new Map();
      const visitsMap = {};

      allCheckoutRows.forEach((row) => {
        const personKey = buildPersonKey(row);
        if (!visitsMap[personKey]) visitsMap[personKey] = [];
        visitsMap[personKey].push({ ...row, personKey });
        const rowTime = new Date(row.actualOutTime || row.outTime || row.updatedAt || row.createdAt || 0).getTime();

        if (!grouped.has(personKey)) {
          grouped.set(personKey, {
            ...row,
            personKey,
            visitCount: 1,
            latestCheckoutAt: row.actualOutTime || row.outTime || row.updatedAt || row.createdAt,
            hasCurrentHost: belongsToHost(row),
          });
          return;
        }

        const existing = grouped.get(personKey);
        const existingTime = new Date(existing.latestCheckoutAt || 0).getTime();

        if (rowTime > existingTime) {
          grouped.set(personKey, {
            ...existing,
            ...row,
            personKey,
            visitCount: existing.visitCount + 1,
            latestCheckoutAt: row.actualOutTime || row.outTime || row.updatedAt || row.createdAt,
            hasCurrentHost: existing.hasCurrentHost || belongsToHost(row),
          });
        } else {
          existing.visitCount += 1;
          existing.hasCurrentHost = existing.hasCurrentHost || belongsToHost(row);
        }
      });

      const groupedRows = [...grouped.values()]
        .filter((row) => row.hasCurrentHost)
        .sort((a, b) => {
          const aTime = new Date(a.latestCheckoutAt || 0).getTime();
          const bTime = new Date(b.latestCheckoutAt || 0).getTime();
          return bTime - aTime;
        });

      setVisitRowsByPerson(visitsMap);
      setHistoryRows(groupedRows);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Could not load profile history",
        text: error.response?.data?.error || error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [identityTokens]);

  useEffect(() => {
    if (show) {
      fetchHistory();
      setSearchQuery("");
      setSourceFilter("all");
      setSelectedRows({});
      setSelectMultipleMode(false);
      setBulkTentativeInTime("");
      setBulkTentativeOutTime("");
    }
  }, [show, fetchHistory]);

  const filteredRows = useMemo(() => {
    const query = normalize(searchQuery);
    const phoneQuery = normalizePhone(searchQuery);
    return historyRows.filter((row) => {
      const matchesSource = sourceFilter === "all" || row.source === sourceFilter;
      if (!matchesSource) return false;
      if (!query) return true;

      return (
        normalize(row.fullName).includes(query) ||
        normalize(row.email).includes(query) ||
        (phoneQuery.length > 0 && normalizePhone(row.phone).includes(phoneQuery))
      );
    });
  }, [historyRows, searchQuery, sourceFilter]);

  const selectedKeys = useMemo(
    () => Object.keys(selectedRows).filter((k) => selectedRows[k]),
    [selectedRows]
  );

  const selectedEntries = useMemo(
    () => historyRows.filter((row) => selectedRows[row.personKey || `${row.source}-${row._id}`]),
    [historyRows, selectedRows]
  );

  const selectedSource = useMemo(() => {
    const firstSelected = selectedEntries[0];
    return firstSelected?.source || null;
  }, [selectedEntries]);

  const selectedVisitorRows = useMemo(
    () => selectedEntries.filter((row) => row.source === "visitor"),
    [selectedEntries]
  );

  const selectedGuestRows = useMemo(
    () => selectedEntries.filter((row) => row.source === "guest"),
    [selectedEntries]
  );

  const selectionScopeSource = selectedSource || (sourceFilter !== "all" ? sourceFilter : null);
  const selectionScopeLabel =
    selectionScopeSource === "visitor"
      ? "Visitors"
      : selectionScopeSource === "guest"
        ? "Guests"
        : "Visitors and Guests";

  const isBulkTimeRequired = selectedKeys.length > 1 && Boolean(selectedSource);
  const isBulkTimeComplete = Boolean(bulkTentativeInTime) && Boolean(bulkTentativeOutTime);
  const isBulkTimeInvalid = isBulkTimeComplete && new Date(bulkTentativeOutTime) <= new Date(bulkTentativeInTime);
  const isBulkTimeRangeValid =
    !isBulkTimeRequired ||
    (isBulkTimeComplete && !isBulkTimeInvalid);

  const visitorCount = historyRows.filter((r) => r.source === "visitor").length;
  const guestCount   = historyRows.filter((r) => r.source === "guest").length;

  const toggleSelection = (row) => {
    const key = row.personKey || `${row.source}-${row._id}`;

    setSelectedRows((prev) => {
      const isAlreadySelected = Boolean(prev[key]);
      if (isAlreadySelected) {
        return {
          ...prev,
          [key]: false,
        };
      }

      const nextSelectedKeys = Object.keys(prev).filter((selectedKey) => prev[selectedKey]);
      if (nextSelectedKeys.length >= MAX_SELECTION) {
        return prev;
      }

      if (selectedSource && row.source !== selectedSource) {
        return prev;
      }

      return {
        ...prev,
        [key]: true,
      };
    });
  };

  const toggleSelectMultipleMode = () => {
    setSelectMultipleMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedRows({});
        setBulkTentativeInTime("");
        setBulkTentativeOutTime("");
      }
      return next;
    });
  };

  const handleSourceFilterChange = (nextFilter) => {
    if (nextFilter === sourceFilter) return;

    const switchingAcrossLockedTypes =
      selectMultipleMode &&
      selectedKeys.length > 0 &&
      nextFilter !== "all" &&
      selectedSource &&
      nextFilter !== selectedSource;

    if (switchingAcrossLockedTypes) {
      setSelectedRows({});
      setBulkTentativeInTime("");
      setBulkTentativeOutTime("");
    }

    setSourceFilter(nextFilter);
  };

  const openRepeatForm = (row) => {
    if (typeof onRepeatSelect === "function") {
      onRepeatSelect({
        type: row.source,
        data: row,
      });
      return;
    }

    Swal.fire({
      icon: "info",
      title: "Repeat callback not configured",
      text: "Unable to open prefilled form right now.",
    });
  };

  const repeatSelected = (type) => {
    const chosen = type === "visitor" ? selectedVisitorRows : selectedGuestRows;
    if (!chosen.length) return;

    const isMultiRepeat = chosen.length > 1;
    if (isMultiRepeat) {
      if (!bulkTentativeInTime || !bulkTentativeOutTime) {
        Swal.fire({
          icon: "warning",
          title: "Set Tentative In and Out for all selected",
          text: "Please provide both tentative times in the popup before repeating multiple entries.",
        });
        return;
      }
      if (new Date(bulkTentativeOutTime) <= new Date(bulkTentativeInTime)) {
        Swal.fire({
          icon: "warning",
          title: "Invalid time range",
          text: "Tentative Out Time must be after Tentative In Time.",
        });
        return;
      }
    }

    const payloadRows = isMultiRepeat
      ? chosen.map((item) => ({
          ...item,
          TentativeinTime: bulkTentativeInTime,
          TentativeoutTime: bulkTentativeOutTime,
        }))
      : chosen[0];

    if (typeof onRepeatMultiSelect === "function") {
      onRepeatMultiSelect({
        type,
        data: payloadRows,
      });
      return;
    }

    Swal.fire({
      icon: "info",
      title: "Bulk repeat callback not configured",
      text: "Unable to open bulk prefilled form right now.",
    });
  };

  const exportVisitsForPerson = (row) => {
    const personKey = row.personKey || buildPersonKey(row);
    const visits = visitRowsByPerson[personKey] || [];

    if (!visits.length) {
      Swal.fire({
        icon: "info",
        title: "No visit details found",
        text: "No detailed visit records are available for export.",
      });
      return;
    }

    // Only include important fields in export
    const rowsForExport = visits.map((visit, index) => ({
      serialNumber: index + 1,
      Category: visit.category || "",
      firstName: visit.firstName || "",
      lastName: visit.lastName || "",
      email: visit.email || "",
      company: visit.company || "",
      countryCode: visit.countryCode || "",
      phone: visit.phone || "",
      purposeOfVisit: visit.purposeOfVisit || "",
      tentativeIn: formatExportDateTime(visit.inTime),
      tentativeOut: formatExportDateTime(visit.outTime),
      actualIn: formatExportDateTime(visit.actualInTime),
      actualOut: formatExportDateTime(visit.actualOutTime)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rowsForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Visit Details");

    const safeName = (row.fullName || `${row.sourceLabel}-${row._id}`)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const fileName = `${safeName || "visit_details"}_${row.source || "entry"}_all_visits.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ background: "rgba(15, 23, 42, 0.6)", zIndex: 1040, backdropFilter: "blur(3px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            className="position-absolute top-50 start-50 translate-middle bg-white rounded-4 shadow-lg d-flex flex-column"
            style={{ width: "min(94vw, 860px)", maxHeight: "88vh", borderRadius: "18px", overflow: "hidden", fontFamily: "Arial, sans-serif" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="px-4 py-3" style={{ background: "#fff8dc", boxShadow: "0 4px 12px rgba(216, 178, 0, 0.14)", borderBottom: "3px solid #D8B200" }}>
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <h5 className="mb-1 fw-bold d-flex align-items-center gap-2" style={{ color: "#5f4b00", fontSize: "1.4rem", letterSpacing: "0.3px", fontWeight: "700" }}>
                    <FaLayerGroup style={{ fontSize: "1.5rem" }} />
                    Previous Visitors &amp; Guests
                  </h5>
                  <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
                    {visitorCount > 0 && (
                      <span className="badge rounded-pill d-inline-flex align-items-center gap-1"
                        style={{ ...SOURCE_STYLE.visitor.badge, fontSize: "0.88rem", padding: "7px 12px", boxShadow: "0 2px 8px rgba(216, 178, 0, 0.16)", fontWeight: "600" }}>
                        <FaUserTie size={12} /> {visitorCount} {visitorCount === 1 ? "Visitor" : "Visitors"}
                      </span>
                    )}
                    {guestCount > 0 && (
                      <span className="badge rounded-pill d-inline-flex align-items-center gap-1"
                        style={{ ...SOURCE_STYLE.guest.badge, fontSize: "0.88rem", padding: "7px 12px", boxShadow: "0 2px 8px rgba(240, 140, 0, 0.16)", fontWeight: "600" }}>
                        <FaUserFriends size={12} /> {guestCount} {guestCount === 1 ? "Guest" : "Guests"}
                      </span>
                    )}
                    {isUnknownIdentity && (
                      <span className="rounded-pill d-inline-flex align-items-center" style={{ background: "#fff8dc", color: "#6b5600", border: "1px solid #efdca0", fontSize: "0.88rem", padding: "7px 12px", fontWeight: "600" }}>
                        Showing all (local / not signed in)
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" className="btn btn-outline-danger btn-sm flex-shrink-0" onClick={onClose}
                  title="Close" style={{ height: "38px", width: "38px", padding: 0, borderRadius: "50%" }}>
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="px-4 pt-3 pb-3" style={{ background: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
              {/* Search + multi-select tools */}
              <div className="d-flex align-items-center flex-wrap gap-3 mb-3">
                <div className="input-group flex-grow-1" style={{ minWidth: "280px", height: CONTROL_HEIGHT, borderRadius: "8px", overflow: "hidden" }}>
                  <span className="input-group-text" style={{ height: CONTROL_HEIGHT, background: "#fff", color: "#6b7280", border: "1px solid #dee2e6", borderRight: "none" }}>
                    <FaSearch size={13} />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    style={{ height: CONTROL_HEIGHT, border: "1px solid #dee2e6", borderLeft: "none", fontSize: "0.95rem", fontWeight: "500", color: "#1e293b" }}
                    placeholder="Search by name, email or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button className="btn" type="button"
                      style={{ height: CONTROL_HEIGHT, background: "transparent", border: "1px solid #dee2e6", borderLeft: "none", color: "#c28f00", cursor: "pointer" }}
                      onClick={() => setSearchQuery("")} title="Clear search">
                      <FaTimes size={12} />
                    </button>
                  )}
                </div>

                <div className="d-flex align-items-center gap-2 flex-wrap" style={{ minHeight: CONTROL_HEIGHT }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={selectMultipleMode ? { fontSize: CONTROL_FONT, height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "6px", whiteSpace: "nowrap", fontWeight: "600", background: "#D8B200", color: "#1f2937", border: "none" } : { fontSize: CONTROL_FONT, height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "6px", whiteSpace: "nowrap", fontWeight: "600", background: "transparent", color: "#a87700", border: "1.5px solid #D8B200" }}
                    onClick={toggleSelectMultipleMode}
                  >
                    {selectMultipleMode ? "Exit Multi-Select" : "Select Multiple"}
                  </button>

                  {selectMultipleMode && (
                    <span className="badge rounded-pill d-inline-flex align-items-center gap-1"
                      style={selectionScopeSource
                        ? {
                            ...(SOURCE_STYLE[selectionScopeSource]?.badge || {}),
                            fontSize: "0.78rem",
                            padding: "7px 11px",
                            height: CONTROL_HEIGHT,
                          }
                        : {
                            fontSize: "0.78rem",
                            padding: "7px 11px",
                            height: CONTROL_HEIGHT,
                            background: "#f1f5f9",
                            color: "#475569",
                            border: "1px solid #cbd5e1",
                          }}>
                      {selectionScopeSource === "visitor" ? <FaUserTie size={11} /> : selectionScopeSource === "guest" ? <FaUserFriends size={11} /> : null}
                      {`${selectedKeys.length}/${MAX_SELECTION} ${selectionScopeLabel}`}
                    </span>
                  )}
                </div>

                <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap ms-auto">
                  {[
                    { key: "all", label: "All", count: historyRows.length },
                    { key: "visitor", label: "Visitors Only", count: visitorCount },
                    { key: "guest", label: "Guests Only", count: guestCount },
                  ].map((option) => {
                    const isActive = sourceFilter === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className="btn btn-sm"
                        style={isActive ? { fontSize: CONTROL_FONT, height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "6px", whiteSpace: "nowrap", fontWeight: "600", background: "#D8B200", color: "#1f2937", border: "none" } : { fontSize: CONTROL_FONT, height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "6px", whiteSpace: "nowrap", fontWeight: "600", background: "transparent", color: "#a87700", border: "1.5px solid #D8B200" }}
                        onClick={() => handleSourceFilterChange(option.key)}
                      >
                        {option.label} ({option.count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Type-lock hint */}
              {selectMultipleMode && selectionScopeSource && (
                <div className="rounded-3 px-3 py-2 d-flex align-items-center gap-2 mt-2" style={{ background: SOURCE_STYLE[selectionScopeSource]?.badge?.background || "#f1f5f9", border: `1.5px solid ${SOURCE_STYLE[selectionScopeSource]?.border || "#dee2e6"}`, fontSize: "0.82rem" }}>
                  <span style={{ color: SOURCE_STYLE[selectionScopeSource]?.badge?.color, fontSize: "1rem" }}>
                    {selectionScopeSource === "visitor" ? <FaUserTie /> : <FaUserFriends />}
                  </span>
                  <span style={{ color: SOURCE_STYLE[selectionScopeSource]?.badge?.color }}>
                    Only <strong>{selectionScopeLabel}</strong> can be selected at once.
                    {selectedKeys.length >= MAX_SELECTION && (
                      <span className="ms-2 fw-semibold" style={{ color: "#ef4444" }}>Max {MAX_SELECTION} reached.</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* ── List ── */}
            <div className="flex-grow-1 p-3" style={{ overflowY: "auto", background: "#fff" }}>
              {loading && (
                <div className="text-center py-6 text-muted">
                  <div className="spinner-border spinner-border-sm me-2" style={{ color: "#b88600" }} />
                  <span style={{ color: "#b88600", fontWeight: "500" }}>Loading history...</span>
                </div>
              )}

              {!loading && filteredRows.length === 0 && (
                <div className="text-center py-6 rounded-3" style={{ background: "#fff", border: "2px dashed #cbd5e1", padding: "40px 20px" }}>
                  <div className="mb-3" style={{ fontSize: "2.5rem", color: "#b88600" }}><FaSearch /></div>
                  <h6 className="fw-bold mb-2" style={{ color: "#1e293b", fontSize: "1.1rem", fontWeight: "700" }}>
                    {searchQuery ? "No matches found" : "No checkout history yet"}
                  </h6>
                  <p className="text-muted mb-0" style={{ color: "#475569", fontSize: "0.95rem", fontWeight: "500" }}>
                    {searchQuery
                      ? "Try a different name, email, or phone number."
                      : "Checked-out visitors and guests will appear here for quick repeat registration."}
                  </p>
                </div>
              )}

              {!loading && filteredRows.length > 0 && (
                <div className="d-flex flex-column gap-3">
                  {filteredRows.map((row) => {
                    const key = row.personKey || `${row.source}-${row._id}`;
                    const isSelected = Boolean(selectedRows[key]);
                    const srcStyle = SOURCE_STYLE[row.source] || SOURCE_STYLE.visitor;

                    // In multi-select mode, rows NOT matching the locked type are hidden
                    const hiddenByLock = selectMultipleMode && selectionScopeSource && selectionScopeSource !== row.source;
                    if (hiddenByLock) return null;

                    const atMax = selectedKeys.length >= MAX_SELECTION && !isSelected;

                    return (
                      <div
                        key={key}
                        className="border rounded-3"
                        style={{
                          borderLeft: `6px solid ${srcStyle.border}`,
                          boxShadow: isSelected ? `0 0 0 2px ${srcStyle.border}, 0 8px 16px rgba(216, 178, 0, 0.18)` : "0 2px 8px rgba(0,0,0,0.06)",
                          transition: "all 0.2s",
                          background: isSelected ? srcStyle.badge.background : "#fff",
                          cursor: selectMultipleMode ? "pointer" : "default",
                        }}
                        onMouseEnter={(e) => { if (!selectMultipleMode) e.currentTarget.style.boxShadow = "0 4px 12px rgba(216, 178, 0, 0.16)"; }}
                        onMouseLeave={(e) => { if (!selectMultipleMode) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
                      >
                        <div className="p-3">
                          <div className="d-flex align-items-start gap-3">
                            {/* Checkbox (only shown in multi-select and type matches) */}
                            {selectMultipleMode && (
                              <div className="pt-1">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  style={{ width: "1.1rem", height: "1.1rem", cursor: atMax ? "not-allowed" : "pointer" }}
                                  checked={isSelected}
                                  disabled={atMax}
                                  onChange={() => toggleSelection(row)}
                                />
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-grow-1 min-width-0">
                              {/* Name + badges row */}
                              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                  <h6 className="mb-0 fw-bold" style={{ fontSize: "1.15rem", color: "#1e293b", fontWeight: "700" }}>
                                    {row.fullName || "Unnamed"}
                                  </h6>
                                  <span className="badge rounded-pill" style={{ ...srcStyle.badge, fontSize: "0.85rem", padding: "6px 12px", boxShadow: `0 2px 6px ${srcStyle.border}30`, fontWeight: "600" }}>
                                    {row.source === "visitor" ? <FaUserTie size={10} className="me-1" /> : <FaUserFriends size={10} className="me-1" />}
                                    {row.sourceLabel}
                                  </span>
                                  <span className="badge rounded-pill" style={{ background: "#D8B200", color: "#1f2937", fontSize: "0.85rem", padding: "6px 12px", boxShadow: "0 2px 6px rgba(216, 178, 0, 0.28)", fontWeight: "600" }}>
                                    {row.visitCount} {row.visitCount === 1 ? "visit" : "visits"}
                                  </span>
                                </div>

                                {/* Action buttons */}
                                <div className="d-flex align-items-center gap-2">
                                  {!selectMultipleMode && (
                                    <button
                                      type="button"
                                      className="btn btn-sm d-inline-flex align-items-center gap-1"
                                      style={{
                                        background: srcStyle.border,
                                        color: "#fff",
                                        border: "none",
                                        fontSize: CONTROL_FONT,
                                        minWidth: "130px",
                                        height: CONTROL_HEIGHT,
                                        padding: CONTROL_PADDING,
                                        borderRadius: "8px",
                                        fontWeight: "500",
                                        cursor: "pointer",
                                        boxShadow: `0 4px 12px ${srcStyle.border}40`,
                                        transition: "all 0.2s",
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 6px 16px ${srcStyle.border}60`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 4px 12px ${srcStyle.border}40`; e.currentTarget.style.transform = "translateY(0)"; }}
                                      onClick={() => openRepeatForm(row)}
                                      title="Open pre-filled form for this person"
                                    >
                                      <FaRedoAlt size={11} /> Repeat
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-sm d-inline-flex align-items-center gap-1"
                                    style={{
                                      fontSize: CONTROL_FONT,
                                      minWidth: "130px",
                                      height: CONTROL_HEIGHT,
                                      padding: CONTROL_PADDING,
                                      background: "#fff8dc",
                                      color: "#6b5600",
                                      border: "1.5px solid #efdca0",
                                      borderRadius: "8px",
                                      fontWeight: "500",
                                      cursor: "pointer",
                                      transition: "all 0.2s",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = "#fff2e0"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(216, 178, 0, 0.2)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff8dc"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                                    onClick={() => exportVisitsForPerson(row)}
                                    title="Export all visit details for this person"
                                  >
                                    <FaFileExcel size={11} /> Export
                                  </button>
                                </div>
                              </div>

                              {/* Core info */}
                              <div className="d-flex flex-wrap gap-3" style={{ fontSize: "0.95rem", color: "#475569", marginTop: "10px", lineHeight: "1.55", fontWeight: "500" }}>
                                {row.email && (
                                  <span><strong>Email:</strong> {row.email}</span>
                                )}
                                {row.phone && (
                                  <span><strong>Phone:</strong> {row.phone}</span>
                                )}
                                {row.latestCheckoutAt && (
                                  <span className="text-muted">
                                    <strong>Last visit:</strong> {new Date(row.latestCheckoutAt).toLocaleDateString("en-IN", {
                                      day: "2-digit", month: "short", year: "numeric"
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Sticky action bar (shown when rows are selected) ── */}
            <AnimatePresence>
              {selectMultipleMode && selectedKeys.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.2 }}
                  className="px-4 pt-3 pb-2 d-flex flex-column gap-3"
                  style={{ background: "#f8f9fa", borderTop: "2px solid #dee2e6", borderRadius: "0 0 1rem 1rem" }}
                >
                  {/* Row 1: tentative inputs — full width, only when >1 selected */}
                  {isBulkTimeRequired && (
                    <div>
                      <div className="d-flex align-items-stretch w-100" style={{
                        border: `1.5px solid ${isBulkTimeInvalid ? "#fecaca" : "#dee2e6"}`,
                        borderRadius: "8px",
                        background: "#fff",
                        overflow: "hidden",
                        transition: "all 0.2s",
                      }}>
                        {/* IN field */}
                        <div className="d-flex flex-column flex-grow-1 px-3 py-2" style={{ borderRight: "1px solid #dee2e6" }}>
                          <label className="mb-0" style={{ fontSize: "0.65rem", fontWeight: 700, color: "#b88600", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tentative In</label>
                          <input
                            type="datetime-local"
                            className="form-control form-control-sm border-0 p-0 w-100"
                            value={bulkTentativeInTime}
                            onChange={(e) => setBulkTentativeInTime(e.target.value)}
                            title="Tentative In"
                            style={{ height: "28px", fontSize: "0.85rem", boxShadow: "none", background: "transparent", fontWeight: "500", color: "#1e293b" }}
                          />
                        </div>
                        {/* Divider arrow */}
                        <div className="d-flex align-items-center justify-content-center px-2" style={{ color: "#cbd5e1", fontSize: "0.9rem", background: "#f8fafc", flexShrink: 0, fontWeight: "bold" }}>&rarr;</div>
                        {/* OUT field */}
                        <div className="d-flex flex-column flex-grow-1 px-3 py-2" style={{ borderLeft: "1px solid #dee2e6" }}>
                          <label className="mb-0" style={{ fontSize: "0.65rem", fontWeight: 700, color: "#9a5d00", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tentative Out</label>
                          <input
                            type="datetime-local"
                            className="form-control form-control-sm border-0 p-0 w-100"
                            min={bulkTentativeInTime || undefined}
                            value={bulkTentativeOutTime}
                            onChange={(e) => setBulkTentativeOutTime(e.target.value)}
                            title="Tentative Out"
                            style={{ height: "28px", fontSize: "0.85rem", boxShadow: "none", background: "transparent", fontWeight: "500", color: "#1e293b" }}
                          />
                        </div>
                      </div>
                      {/* Inline warning when Out is not after In */}
                      {isBulkTimeInvalid && (
                        <div className="d-flex align-items-center gap-2 mt-2 px-2 py-1 rounded" style={{ background: "#fef2f2", color: "#dc2626", fontSize: "0.75rem", fontWeight: "500" }}>
                          <FaExclamationTriangle size={12} style={{ flexShrink: 0 }} />
                          <span>Out time must be after In time</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Row 2: counter left, buttons right — always fits */}
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <span className="fw-semibold text-nowrap" style={{ fontSize: "0.9rem", color: "#334155" }}>
                      {selectedKeys.length} of {MAX_SELECTION} selected
                      {selectedSource && (
                        <span className="ms-2" style={{ color: "#b88600", fontWeight: "600" }}>
                          ({selectedSource === "visitor" ? "Visitors" : "Guests"})
                        </span>
                      )}
                    </span>
                    <div className="d-flex gap-2 align-items-center">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center"
                        style={{ height: CONTROL_HEIGHT, fontSize: CONTROL_FONT, padding: "0 18px", whiteSpace: "nowrap", borderRadius: "6px", fontWeight: "500" }}
                        onClick={() => setSelectedRows({})}
                      >
                        Clear
                      </button>
                      {selectedSource === "visitor" && (
                        <button
                          type="button"
                          className="btn btn-sm d-inline-flex align-items-center justify-content-center gap-2"
                          style={{
                            height: CONTROL_HEIGHT,
                            fontSize: CONTROL_FONT,
                            padding: "0 18px",
                            whiteSpace: "nowrap",
                            borderRadius: "6px",
                            fontWeight: "500",
                            background: "#D8B200",
                            color: "#1f2937",
                            border: "none",
                          }}
                          onClick={() => repeatSelected("visitor")}
                          disabled={!selectedVisitorRows.length || !isBulkTimeRangeValid}
                        >
                          <FaRedoAlt size={12} />
                          Repeat {selectedVisitorRows.length} {selectedVisitorRows.length === 1 ? "Visitor" : "Visitors"}
                        </button>
                      )}
                      {selectedSource === "guest" && (
                        <button
                          type="button"
                          className="btn btn-sm d-inline-flex align-items-center justify-content-center gap-2"
                          style={{
                            height: CONTROL_HEIGHT,
                            fontSize: CONTROL_FONT,
                            padding: "0 18px",
                            whiteSpace: "nowrap",
                            borderRadius: "6px",
                            fontWeight: "500",
                            background: "#F08C00",
                            color: "#fff",
                            border: "none",
                          }}
                          onClick={() => repeatSelected("guest")}
                          disabled={!selectedGuestRows.length || !isBulkTimeRangeValid}
                        >
                          <FaRedoAlt size={12} />
                          Repeat {selectedGuestRows.length} {selectedGuestRows.length === 1 ? "Guest" : "Guests"}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
