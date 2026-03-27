import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { FaCheckCircle, FaTimes } from "react-icons/fa";
import { validatePhoneLength, PHONE_RULES } from "../utils/phoneUtils";

// Stricter email regex to match VisitorForm.js
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const VISITOR_HEADERS = [
  "firstName",
  "lastName",
  "email",
  "company",
  "countryCode",
  "phone",
  "purposeOfVisit",
  "host",
  "meetingRoom",
  "laptopSerial",
  "guestWifiRequired",
  "TentativeinTime",
  "TentativeoutTime",
];

const VISITOR_REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "company",
  "countryCode",
  "phone",
  "purposeOfVisit",
  "host",
  "TentativeinTime",
  "TentativeoutTime",
];

const VISITOR_OPTIONAL_FIELDS = [
  "meetingRoom",
  "laptopSerial",
  "guestWifiRequired",
];

const GUEST_HEADERS = [
  "category",
  "firstName",
  "lastName",
  "email",
  "company",
  "host",
  "countryCode",
  "phone",
  "purposeOfVisit",
  "meetingRoomRequired",
  "meetingRoom",
  "laptopSerial",
  "guestWifiRequired",
  "refreshmentRequired",
  "proposedRefreshmentTime",
  "TentativeinTime",
  "TentativeoutTime",
];

const GUEST_REQUIRED_FIELDS = [
  "category",
  "firstName",
  "company",
  "countryCode",
  "phone",
  "purposeOfVisit",
  "host",
  "TentativeinTime",
  "TentativeoutTime",
];

const GUEST_OPTIONAL_FIELDS = [
  "lastName",
  "email",
  "meetingRoomRequired",
  "meetingRoom",
  "laptopSerial",
  "guestWifiRequired",
  "refreshmentRequired",
  "proposedRefreshmentTime",
];

const VISITOR_SAMPLE_ROW = {
  firstName: "Sample (ignored row)",
  lastName: "Visitor (example)",
  email: "sample.visitor@example.com",
  company: "Sample Company",
  countryCode: "91", // You can enter '91' or '+91', system will auto-correct
  phone: "9876543210",
  purposeOfVisit: "Sample entry only - ignored",
  host: "Sample Host",
  meetingRoom: "Sample Meeting Room",
  laptopSerial: "SAMPLE-IGNORE",
  guestWifiRequired: "true",
  TentativeinTime: "10-04-2026 10:00",
  TentativeoutTime: "10-04-2026 12:00",
};

const GUEST_SAMPLE_ROW = {
  category: "Isuzu Employee",
  firstName: "Sample (ignored row)",
  lastName: "Guest (example)",
  email: "sample.guest@example.com",
  company: "Sample Company",
  host: "Sample Host",
  countryCode: "91", // You can enter '91' or '+91', system will auto-correct
  phone: "9876543210",
  purposeOfVisit: "Sample entry only - ignored",
  meetingRoomRequired: "true",
  meetingRoom: "Sample Meeting Room",
  laptopSerial: "SAMPLE-IGNORE",
  guestWifiRequired: "true",
  refreshmentRequired: "true",
  proposedRefreshmentTime: "10-04-2026 11:00",
  TentativeinTime: "10-04-2026 10:00",
  TentativeoutTime: "10-04-2026 13:00",
};

const GUEST_CATEGORIES = new Set(["Isuzu Employee", "UD Employee"]);

const normalizeHeader = (value) =>
  String(value || "")
    .replace(/\(\s*optional\s*\)/gi, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const toText = (value) => String(value ?? "").trim();

const NAME_TEXT_REGEX = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

const isValidNameText = (value) => NAME_TEXT_REGEX.test(toText(value));

const parseBooleanStrict = (value) => {
  if (value === null || value === undefined || value === "") {
    return { valid: true, value: false, provided: false };
  }

  if (typeof value === "boolean") {
    return { valid: true, value, provided: true };
  }

  if (typeof value === "number") {
    if (value === 1) return { valid: true, value: true, provided: true };
    if (value === 0) return { valid: true, value: false, provided: true };
    return {
      valid: false,
      provided: true,
      message: "must be true/false, yes/no, or 1/0",
    };
  }

  const normalized = toText(value).toLowerCase();
  if (!normalized) return { valid: true, value: false, provided: false };
  if (["true", "yes", "y", "1"].includes(normalized)) {
    return { valid: true, value: true, provided: true };
  }
  if (["false", "no", "n", "0"].includes(normalized)) {
    return { valid: true, value: false, provided: true };
  }

  return {
    valid: false,
    provided: true,
    message: "must be true/false, yes/no, or 1/0",
  };
};

const parseExcelDate = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Reject date-only cells (00:00) because template requires explicit date + time.
    if (
      value.getHours() === 0 &&
      value.getMinutes() === 0 &&
      value.getSeconds() === 0 &&
      value.getMilliseconds() === 0
    ) {
      return null;
    }
    return value;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    // Integer Excel serials represent date-only values (no time-of-day).
    if (
      Number.isInteger(value) ||
      ((parsed.H || 0) === 0 && (parsed.M || 0) === 0 && (parsed.S || 0) === 0)
    ) {
      return null;
    }
    return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
  }

  if (typeof value === "string") {
    const raw = toText(value);
    // Strict text format for template input: dd-mm-yyyy HH:mm (or dd/mm/yyyy HH:mm)
    const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[\sT,]+(\d{1,2}):(\d{2})$/);
    if (dmyMatch) {
      const day = Number.parseInt(dmyMatch[1], 10);
      const month = Number.parseInt(dmyMatch[2], 10);
      const year = Number.parseInt(dmyMatch[3], 10);
      const hour = Number.parseInt(dmyMatch[4], 10);
      const minute = Number.parseInt(dmyMatch[5], 10);

      const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
      if (
        !Number.isNaN(candidate.getTime()) &&
        candidate.getFullYear() === year &&
        candidate.getMonth() === month - 1 &&
        candidate.getDate() === day
      ) {
        return candidate;
      }
      return null;
    }

    // If text has no explicit time part, reject.
    if (!/(?:\s|T)\d{1,2}:\d{2}/.test(raw)) {
      return null;
    }
  }

  const parsed = new Date(toText(value));
  if (Number.isNaN(parsed.getTime())) return null;
  // Fallback parser should still enforce non-zero time-of-day.
  if (
    parsed.getHours() === 0 &&
    parsed.getMinutes() === 0 &&
    parsed.getSeconds() === 0 &&
    parsed.getMilliseconds() === 0
  ) {
    return null;
  }
  return parsed;
};

const splitPhoneByCountryCode = (rawPhone, explicitCountryCode) => {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  const countryCode = explicitCountryCode || "+91";
  const countryDigits = countryCode.replace(/\D/g, "");

  if (countryDigits && digits.startsWith(countryDigits) && digits.length > countryDigits.length) {
    return digits.slice(countryDigits.length);
  }

  return digits;
};

const isEmptyRow = (row) =>
  Object.values(row || {}).every((value) => toText(value) === "");

const isVisitorSampleRow = (row) => {
  const firstName = toText(row.firstname).toLowerCase();
  const lastName = toText(row.lastname).toLowerCase();
  return (
    firstName.startsWith("sample") &&
    lastName.startsWith("visitor") &&
    toText(row.email).toLowerCase() === "sample.visitor@example.com" &&
    toText(row.phone) === "9876543210"
  );
};

const isGuestSampleRow = (row) => {
  const firstName = toText(row.firstname).toLowerCase();
  const lastName = toText(row.lastname).toLowerCase();
  return (
    firstName.startsWith("sample") &&
    lastName.startsWith("guest") &&
    toText(row.email).toLowerCase() === "sample.guest@example.com" &&
    toText(row.phone) === "9876543210"
  );
};

const extractRows = (sheet) => {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });

  if (!matrix.length) return { headers: [], rows: [] };

  const headers = (matrix[0] || []).map((header) => toText(header));
  if (!headers.length || headers.every((header) => !header)) {
    return { headers: [], rows: [] };
  }

  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const values = matrix[i] || [];
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    rows.push({
      lineNumber: i + 1,
      row,
    });
  }

  return { headers, rows };
};

const validateTemplateHeaders = (actualHeaders, expectedHeaders) => {
  // Enforce strict header order and column count
  if (!actualHeaders || !expectedHeaders) {
    return ["Header row is missing. Please use the downloaded template."];
  }
  if (actualHeaders.length !== expectedHeaders.length) {
    return [
      `Column count mismatch: expected ${expectedHeaders.length}, got ${actualHeaders.length}. Please use the template as-is.`
    ];
  }
  for (let i = 0; i < expectedHeaders.length; i++) {
    if (normalizeHeader(actualHeaders[i]) !== normalizeHeader(expectedHeaders[i])) {
      return [
        `Column order mismatch at position ${i + 1}: expected '${expectedHeaders[i]}', got '${actualHeaders[i]}'. Please use the template as-is.`
      ];
    }
  }
  return [];
};

const normalizeRowKeys = (row) => {
  const normalized = {};
  Object.keys(row || {}).forEach((key) => {
    normalized[normalizeHeader(key)] = row[key];
  });
  return normalized;
};

const buildInstructionRows = (requiredFields, optionalFields, extraRows = []) => {
  const rows = [
    ["How to use"],
    ["1. Download template from this popup."],
    ["2. Keep header names unchanged."],
    ["3. Fill real rows below sample row."],
    ["4. The first data row in the Template sheet is a sample row."],
    ["5. Do not remove the sample row; it is ignored automatically during upload."],
    ["6. Optional fields can be left blank."],
    ["7. Submit once all required fields are valid."],
    [],
    ["Required fields"],
    [requiredFields.join(", ")],
    [],
    ["Optional fields"],
    [optionalFields.join(", ")],
  ];

  if (extraRows.length > 0) {
    rows.push([]);
    extraRows.forEach((item) => rows.push([item]));
  }

  return rows;
};

const formatFileSize = (bytes) => {
  const size = Number(bytes || 0);
  if (!size || Number.isNaN(size)) return "0 KB";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const ALLOWED_COUNTRY_CODES = Object.keys(PHONE_RULES);
const validateVisitorRows = (records, defaultHostName, submittedBy) => {
  const errors = [];
  const payload = [];
  const seen = {};
  const now = new Date();
  const loggedInHost = toText(defaultHostName);

  if (!loggedInHost) {
    errors.push("Host could not be resolved from logged-in Azure account. Please sign in again.");
    return { errors, payload };
  }

  records.forEach(({ lineNumber, row }) => {
    let rowHasError = false;
    const firstName = toText(row.firstname);
    const lastName = toText(row.lastname);
    const email = toText(row.email).toLowerCase();
    const company = toText(row.company);
    let countryCode = toText(row.countrycode) || "+91";
    // Auto-correct: add '+' if missing
    if (countryCode && !countryCode.startsWith("+") && ALLOWED_COUNTRY_CODES.includes("+" + countryCode)) {
      countryCode = "+" + countryCode;
    }
    // Restrict country code to allowed values
    let unknownCountryCode = false;
    if (!ALLOWED_COUNTRY_CODES.includes(countryCode)) {
      errors.push(`Row ${lineNumber}: countryCode '${countryCode}' is not allowed. Allowed codes: ${ALLOWED_COUNTRY_CODES.join(", ")}`);
      rowHasError = true;
      unknownCountryCode = true;
    }
    const phone = splitPhoneByCountryCode(row.phone, countryCode);
    const purposeOfVisit = toText(row.purposeofvisit);
    let rowHost = toText(row.host);
    // Default host to Azure auth if empty
    if (!rowHost) rowHost = loggedInHost;
    const host = rowHost;
    const meetingRoom = toText(row.meetingroom);
    const laptopSerial = toText(row.laptopserial);
    const guestWifiParsed = parseBooleanStrict(row.guestwifirequired);
    const guestWifiRequired = guestWifiParsed.value;
    const inTime = parseExcelDate(row.tentativeintime ?? row.intime);
    const outTime = parseExcelDate(row.tentativeouttime ?? row.outtime);

    if (!firstName) { errors.push(`Row ${lineNumber}: firstName is required.`); rowHasError = true; }
    else if (!isValidNameText(firstName)) { errors.push(`Row ${lineNumber}: firstName must contain letters only.`); rowHasError = true; }
    if (!lastName) { errors.push(`Row ${lineNumber}: lastName is required.`); rowHasError = true; }
    else if (!isValidNameText(lastName)) { errors.push(`Row ${lineNumber}: lastName must contain letters only.`); rowHasError = true; }
    if (!email) { errors.push(`Row ${lineNumber}: email is required.`); rowHasError = true; }
    if (email && !EMAIL_REGEX.test(email)) { errors.push(`Row ${lineNumber}: email format is invalid.`); rowHasError = true; }
    if (!company) { errors.push(`Row ${lineNumber}: company is required.`); rowHasError = true; }
    if (!purposeOfVisit) { errors.push(`Row ${lineNumber}: purposeOfVisit is required.`); rowHasError = true; }
    if (!rowHost) { errors.push(`Row ${lineNumber}: host is required.`); rowHasError = true; }
    if (!phone) { errors.push(`Row ${lineNumber}: phone is required.`); rowHasError = true; }
    if (!guestWifiParsed.valid) { errors.push(`Row ${lineNumber}: guestWifiRequired ${guestWifiParsed.message}.`); rowHasError = true; }
    const phoneCheck = validatePhoneLength(countryCode, phone);
    if (unknownCountryCode) {
      errors.push(`Row ${lineNumber}: phone length cannot be validated for unknown country code '${countryCode}'.`);
      rowHasError = true;
    } else if (!phoneCheck.valid) {
      errors.push(`Row ${lineNumber}: ${phoneCheck.message} (countryCode: ${countryCode}).`);
      rowHasError = true;
    }
    if (!inTime) { errors.push(`Row ${lineNumber}: TentativeinTime is required and must be a valid date/time.`); rowHasError = true; }
    else if (inTime < now) { errors.push(`Row ${lineNumber}: TentativeinTime cannot be in the past.`); rowHasError = true; }
    if (!outTime) { errors.push(`Row ${lineNumber}: TentativeoutTime is required and must be a valid date/time.`); rowHasError = true; }
    else if (inTime && outTime <= inTime) { errors.push(`Row ${lineNumber}: TentativeoutTime must be after TentativeinTime.`); rowHasError = true; }
    const duplicateKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${phone}`;
    if (seen[duplicateKey]) { errors.push(`Row ${lineNumber}: duplicate person and phone found (same as row ${seen[duplicateKey]}).`); rowHasError = true; }
    else { seen[duplicateKey] = lineNumber; }
    if (!rowHasError) {
      payload.push({
        category: "Visitor",
        host,
        firstName,
        lastName,
        email,
        company,
        countryCode,
        phone: `${countryCode}${phone}`,
        purposeOfVisit,
        meetingRoom,
        laptopSerial,
        guestWifiRequired,
        inTime,
        outTime,
        submittedBy,
        status: "new",
      });
    }
  });

  return { errors, payload };
};

const validateGuestRows = (records, defaultHostName, submittedBy) => {
  const errors = [];
  const payload = [];
  const seen = {};
  const now = new Date();
  const loggedInHost = toText(defaultHostName);

  if (!loggedInHost) {
    errors.push("Host could not be resolved from logged-in Azure account. Please sign in again.");
    return { errors, payload };
  }

  records.forEach(({ lineNumber, row }) => {
    const category = toText(row.category) || "Isuzu Employee";
    const firstName = toText(row.firstname);
    const lastName = toText(row.lastname);
    const email = toText(row.email).toLowerCase();
    const company = toText(row.company);
    let rowHost = toText(row.host);
    if (!rowHost) rowHost = loggedInHost;
    const host = rowHost;
    const countryCode = toText(row.countrycode) || "+91";
    const phone = splitPhoneByCountryCode(row.phone, countryCode);
    const purposeOfVisit = toText(row.purposeofvisit);
    const meetingRoomRequiredParsed = parseBooleanStrict(row.meetingroomrequired);
    const meetingRoomRequired = meetingRoomRequiredParsed.value;
    const meetingRoom = toText(row.meetingroom);
    const laptopSerial = toText(row.laptopserial);
    const guestWifiParsed = parseBooleanStrict(row.guestwifirequired);
    const guestWifiRequired = guestWifiParsed.value;
    const refreshmentRequiredParsed = parseBooleanStrict(row.refreshmentrequired);
    const refreshmentRequired = refreshmentRequiredParsed.value;
    const proposedRefreshmentTime = parseExcelDate(row.proposedrefreshmenttime);
    const inTime = parseExcelDate(row.tentativeintime ?? row.intime);
    const outTime = parseExcelDate(row.tentativeouttime ?? row.outtime);

    if (!GUEST_CATEGORIES.has(category)) {
      errors.push(`Row ${lineNumber}: category must be Isuzu Employee or UD Employee.`);
    }

    if (!firstName) errors.push(`Row ${lineNumber}: firstName is required.`);
    else if (!isValidNameText(firstName)) errors.push(`Row ${lineNumber}: firstName must contain letters only.`);
    if (lastName && !isValidNameText(lastName)) {
      errors.push(`Row ${lineNumber}: lastName must contain letters only.`);
    }
    if (!company) errors.push(`Row ${lineNumber}: company is required.`);
    if (!rowHost) errors.push(`Row ${lineNumber}: host is required.`);
    if (!purposeOfVisit) errors.push(`Row ${lineNumber}: purposeOfVisit is required.`);
    if (!phone) errors.push(`Row ${lineNumber}: phone is required.`);
    if (!meetingRoomRequiredParsed.valid) {
      errors.push(`Row ${lineNumber}: meetingRoomRequired ${meetingRoomRequiredParsed.message}.`);
    }
    if (!guestWifiParsed.valid) {
      errors.push(`Row ${lineNumber}: guestWifiRequired ${guestWifiParsed.message}.`);
    }
    if (!refreshmentRequiredParsed.valid) {
      errors.push(`Row ${lineNumber}: refreshmentRequired ${refreshmentRequiredParsed.message}.`);
    }

    if (email && !EMAIL_REGEX.test(email)) {
      errors.push(`Row ${lineNumber}: email format is invalid.`);
    }

    const phoneCheck = validatePhoneLength(countryCode, phone);
    if (!phoneCheck.valid) errors.push(`Row ${lineNumber}: ${phoneCheck.message}.`);

    if (!inTime) {
      errors.push(`Row ${lineNumber}: TentativeinTime is required and must be a valid date/time.`);
    } else if (inTime < now) {
      errors.push(`Row ${lineNumber}: TentativeinTime cannot be in the past.`);
    }

    if (!outTime) {
      errors.push(`Row ${lineNumber}: TentativeoutTime is required and must be a valid date/time.`);
    } else if (inTime && outTime <= inTime) {
      errors.push(`Row ${lineNumber}: TentativeoutTime must be after TentativeinTime.`);
    }

    if (meetingRoomRequired && !meetingRoom) {
      errors.push(`Row ${lineNumber}: meetingRoom is required when meetingRoomRequired is true.`);
    }
    // If meetingRoom is filled but meetingRoomRequired is not true, throw error
    if (!meetingRoomRequired && meetingRoom) {
      errors.push(`Row ${lineNumber}: meetingRoom should only be filled if meetingRoomRequired is true.`);
    }

    if (refreshmentRequired && !proposedRefreshmentTime) {
      errors.push(
        `Row ${lineNumber}: proposedRefreshmentTime is required when refreshmentRequired is true.`
      );
    }

    if (
      refreshmentRequired &&
      proposedRefreshmentTime &&
      inTime &&
      outTime &&
      (proposedRefreshmentTime < inTime || proposedRefreshmentTime > outTime)
    ) {
      errors.push(
        `Row ${lineNumber}: proposedRefreshmentTime must be between TentativeinTime and TentativeoutTime.`
      );
    }

    const duplicateKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${phone}`;
    if (seen[duplicateKey]) {
      errors.push(
        `Row ${lineNumber}: duplicate person and phone found (same as row ${seen[duplicateKey]}).`
      );
    } else {
      seen[duplicateKey] = lineNumber;
    }

    payload.push({
      category,
      firstName,
      lastName,
      email,
      company,
      host,
      countryCode,
      phone: `${countryCode}${phone}`,
      purposeOfVisit,
      meetingRoom,
      meetingRoomRequired,
      laptopSerial,
      guestWifiRequired,
      refreshmentRequired,
      proposedRefreshmentTime: proposedRefreshmentTime || null,
      inTime,
      outTime,
      submittedBy,
      status: "new",
    });
  });

  return { errors, payload };
};

export default function BulkUploadModal({
  show,
  type,
  hostName,
  submittedBy,
  onClose,
  onSuccess,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [hasDownloadedTemplate, setHasDownloadedTemplate] = useState(false);

  const content = useMemo(() => {
    const isVisitor = type === "visitor";
    const resolvedHostName = toText(hostName) || "Logged-in Host";
    return {
      title: isVisitor ? "Bulk Visitor Upload" : "Bulk Guest Upload",
      subtitle: isVisitor
        ? "Import multiple visitors in one go using the Excel template."
        : "Import multiple guests in one go using the Excel template.",
      endpoint: isVisitor ? "/api/visitors" : "/api/guests",
      entityName: isVisitor ? "visitors" : "guests",
      entityLabel: isVisitor ? "Visitor" : "Guest",
      headers: isVisitor ? VISITOR_HEADERS : GUEST_HEADERS,
      requiredFields: isVisitor ? VISITOR_REQUIRED_FIELDS : GUEST_REQUIRED_FIELDS,
      optionalFields: isVisitor ? VISITOR_OPTIONAL_FIELDS : GUEST_OPTIONAL_FIELDS,
      sampleRow: isVisitor
        ? { ...VISITOR_SAMPLE_ROW, host: resolvedHostName }
        : { ...GUEST_SAMPLE_ROW, host: resolvedHostName },
      instructionRows: isVisitor
        ? buildInstructionRows(VISITOR_REQUIRED_FIELDS, VISITOR_OPTIONAL_FIELDS, [
            "firstName and lastName must contain letters only (no numbers or symbols).",
            "Use date/time format dd-mm-yyyy HH:mm, for example: 10-04-2026 10:00.",
            "host is required and should match the logged-in host name.",
          ])
        : buildInstructionRows(GUEST_REQUIRED_FIELDS, GUEST_OPTIONAL_FIELDS, [
            "category must be Isuzu Employee or UD Employee.",
            "firstName and lastName must contain letters only (no numbers or symbols).",
            "meetingRoom is required only when meetingRoomRequired is true.",
            "proposedRefreshmentTime is required only when refreshmentRequired is true.",
            "Use date/time format dd-mm-yyyy HH:mm, for example: 10-04-2026 10:00.",
            "host is required and should match the logged-in host name.",
          ]),
      fileName: isVisitor ? "visitor_bulk_upload_template.xlsx" : "guest_bulk_upload_template.xlsx",
    };
  }, [type, hostName]);

  const resetLocalState = useCallback(() => {
    setSelectedFiles([]);
    setValidationErrors([]);
    setSubmitting(false);
    setHasDownloadedTemplate(false);
  }, []);

  const closeModal = useCallback(() => {
    if (submitting) return;
    resetLocalState();
    if (typeof onClose === "function") onClose();
  }, [submitting, resetLocalState, onClose]);

  useEffect(() => {
    if (!show) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) {
        closeModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show, submitting, closeModal]);

  if (!show) return null;

  const downloadTemplate = () => {
    const templateWorkbook = XLSX.utils.book_new();

    const templateSheet = XLSX.utils.json_to_sheet([content.sampleRow], {
      header: content.headers,
      skipHeader: false,
    });

    content.headers.forEach((header, index) => {
      if (!content.optionalFields.includes(header)) return;
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: index });
      templateSheet[cellAddress] = {
        ...(templateSheet[cellAddress] || { t: "s" }),
        v: `${header} (optional)`,
      };
    });

    templateSheet["!cols"] = content.headers.map((header) => ({
      wch: Math.max(14, header.length + 2),
    }));

    const instructionsSheet = XLSX.utils.aoa_to_sheet(content.instructionRows);
    instructionsSheet["!cols"] = [{ wch: 90 }];

    XLSX.utils.book_append_sheet(templateWorkbook, templateSheet, "Template");
    XLSX.utils.book_append_sheet(templateWorkbook, instructionsSheet, "Instructions");

    XLSX.writeFile(templateWorkbook, content.fileName);
    setHasDownloadedTemplate(true);
  };

  const parseAndValidateFiles = async () => {
    if (!selectedFiles.length) {
      setValidationErrors(["Please choose at least one Excel file first."]);
      return null;
    }

    const allErrors = [];
    const allPayload = [];

    for (const selectedFile of selectedFiles) {
      const fileTag = `[${selectedFile.name}]`;

      try {
        const fileBytes = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(fileBytes, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          allErrors.push(`${fileTag} Uploaded file does not contain a worksheet.`);
          continue;
        }

        const sheet = workbook.Sheets[firstSheetName];
        const { headers, rows } = extractRows(sheet);

        const headerErrors = validateTemplateHeaders(headers, content.headers);
        if (headerErrors.length > 0) {
          allErrors.push(...headerErrors.map((err) => `${fileTag} ${err}`));
          continue;
        }

        const allRows = rows.map(({ lineNumber, row }) => ({
          lineNumber,
          row: normalizeRowKeys(row),
        }));

        const filteredRows = allRows.filter(({ row }) => !isEmptyRow(row));
        const dataRows = filteredRows.filter(({ row }) => {
          if (type === "visitor") return !isVisitorSampleRow(row);
          return !isGuestSampleRow(row);
        });

        if (!dataRows.length) {
          allErrors.push(`${fileTag} No data rows found. Keep at least one real row below the sample row.`);
          continue;
        }

        const result =
          type === "visitor"
            ? validateVisitorRows(dataRows, hostName, submittedBy)
            : validateGuestRows(dataRows, hostName, submittedBy);

        if (result.errors.length > 0) {
          allErrors.push(...result.errors.map((err) => `${fileTag} ${err}`));
          continue;
        }

        allPayload.push(...result.payload);
      } catch (error) {
        allErrors.push(`${fileTag} Failed to read file: ${error.message || "Unknown parsing error."}`);
      }
    }

    if (allErrors.length > 0) {
      setValidationErrors(allErrors);
      return null;
    }

    setValidationErrors([]);
    return allPayload;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const payload = await parseAndValidateFiles();
      if (!payload) return;

      const response = await axios.post(`${process.env.REACT_APP_API_URL}${content.endpoint}`, payload);
      const responseData = response.data;
      const createdCount = Array.isArray(responseData)
        ? responseData.length
        : responseData?.guests?.length || payload.length;

      const successSummary = {
        totalRows: payload.length,
        createdCount,
      };

      Swal.fire({
        icon: "success",
        title: `Bulk ${content.entityName} upload successful`,
        text: `${createdCount} ${content.entityName} created successfully.`,
      });

      if (typeof onSuccess === "function") {
        onSuccess(successSummary);
      }

      resetLocalState();
      if (typeof onClose === "function") onClose();
    } catch (error) {
      setValidationErrors([
        error.response?.data?.error || error.message || "Bulk upload failed.",
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const step1Done = hasDownloadedTemplate;
  const step2Done = selectedFiles.length > 0;
  const step3Active = submitting;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        zIndex: 1100,
        backdropFilter: "blur(3px)",
      }}
      onClick={closeModal}
    >
      <div
        className="position-absolute top-50 start-50 translate-middle bg-white rounded-4 shadow-lg d-flex flex-column"
        style={{ width: "min(94vw, 860px)", maxHeight: "88vh", borderRadius: "18px", overflow: "hidden", border: "1px solid #e2e8f0", fontFamily: "'Segoe UI', 'Calibri', 'Helvetica Neue', sans-serif" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="px-3 py-3"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 58%, #334155 100%)", borderBottom: "2px solid #D8B200" }}
        >
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span
                  className="badge rounded-pill"
                  style={{ background: "#fff2e0", color: "#7a4a00", border: "1px solid #f2d2a6", fontSize: "0.75rem", letterSpacing: "0.2px", fontWeight: "600" }}
                >
                  {content.entityLabel} Import
                </span>
              </div>
              <h4 className="mb-0 fw-bold" style={{ color: "#f8fafc", letterSpacing: "0.2px" }}>{content.title}</h4>
              <p className="mb-0" style={{ fontSize: "0.92rem", color: "#cbd5e1" }}>{content.subtitle}</p>
            </div>
            <button
              type="button"
              className="btn btn-sm flex-shrink-0 d-inline-flex align-items-center justify-content-center"
              title="Close"
              style={{
                height: "38px",
                width: "38px",
                padding: 0,
                lineHeight: 1,
                borderRadius: "50%",
                border: "1px solid rgba(248, 250, 252, 0.38)",
                background: "rgba(248, 250, 252, 0.08)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(248, 250, 252, 0.2)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(248, 250, 252, 0.08)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              onClick={closeModal}
              disabled={submitting}
            >
              <FaTimes size={14} color="#f8fafc" />
            </button>
          </div>
        </div>

        <div className="p-3 d-flex flex-column gap-2" style={{ overflowY: "auto", background: "#fff" }}>
          <div
            className="rounded-3 border px-3 py-2 d-flex align-items-center justify-content-between flex-wrap gap-1"
            role="status"
            aria-live="polite"
            style={{ background: "#f8fafc", borderColor: "#dbe3ec", userSelect: "none" }}
          >
            <div className="d-inline-flex align-items-center gap-2" style={{ color: step1Done ? "#166534" : "#475569", fontSize: "0.86rem", fontWeight: "600" }}>
              <FaCheckCircle size={12} color={step1Done ? "#15803d" : "#94a3b8"} /> 1. Template
            </div>
            <div className="d-inline-flex align-items-center gap-2" style={{ color: step2Done ? "#166534" : "#475569", fontSize: "0.86rem", fontWeight: "600" }}>
              <FaCheckCircle size={12} color={step2Done ? "#15803d" : "#94a3b8"} /> 2. Upload
            </div>
            <div className="d-inline-flex align-items-center gap-2" style={{ color: step3Active ? "#0f4f78" : "#475569", fontSize: "0.86rem", fontWeight: "600" }}>
              {step3Active ? (
                <span className="spinner-border spinner-border-sm" style={{ width: "12px", height: "12px", borderWidth: "2px", color: "#0f4f78" }} />
              ) : (
                <FaCheckCircle size={12} color="#94a3b8" />
              )}
              3. Validate &amp; Import
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between flex-wrap gap-1 px-1">
            <p className="mb-0" style={{ color: "#475569", fontSize: "0.84rem" }}>
              Tips: Keep header order unchanged, keep the sample row, and use a valid date/time format.
            </p>
            <span style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: "500" }}>Press Esc to close</span>
          </div>

          <div className="p-2 rounded-3 border" style={{ background: "#fffcf2", border: "1px solid #efdca0", borderLeft: "5px solid #D8B200" }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
              <p className="mb-0 fw-semibold" style={{ color: "#6b5600" }}>Step 1: Download the template</p>
              <button type="button" className="btn btn-sm" style={{ background: "#D8B200", color: "#1f2937", border: "none", fontWeight: "700", transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)" }} onClick={downloadTemplate}>
                Download Template
              </button>
            </div>
            <p className="mb-1" style={{ fontSize: "0.88rem" }}>
              Keep the headers unchanged and fill real rows below the sample row. The sample row is ignored automatically.
            </p>
            <p className="mb-1" style={{ fontSize: "0.88rem" }}>
              <strong>Required:</strong> {content.requiredFields.join(", ")}
            </p>
            <p className="mb-0" style={{ fontSize: "0.88rem" }}>
              <strong>Optional:</strong> {content.optionalFields.join(", ")}
            </p>
          </div>

          <div className="p-2 rounded-3 border" style={{ background: "#fffaf3", border: "1px solid #f2d2a6", borderLeft: "5px solid #F08C00" }}>
            <label className="form-label fw-semibold mb-1" style={{ color: "#7a4a00" }}>Step 2: Upload one or more filled Excel files</label>
            <div
              className="rounded-3 p-2"
              style={{ border: "1.5px dashed #f0c98a", background: "#fff" }}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                className="form-control"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  setSelectedFiles(files);
                  setValidationErrors([]);
                }}
              />
              <small className="text-muted d-block mt-1">
                Supported formats: .xlsx and .xls (multiple files allowed)
              </small>
              {selectedFiles.length > 0 && (
                <div className="mt-1 px-2 py-1 rounded-2" style={{ background: "#eef9ff", color: "#0f4f78", fontSize: "0.84rem" }}>
                  <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                    <span>
                      Selected files: <strong>{selectedFiles.length}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      style={{ padding: "2px 8px", fontSize: "0.74rem" }}
                      onClick={() => {
                        setSelectedFiles([]);
                        setValidationErrors([]);
                      }}
                      disabled={submitting}
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="mb-0 mt-1 ps-3" style={{ maxHeight: "100px", overflowY: "auto" }}>
                    {selectedFiles.map((file) => (
                      <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                        {file.name} ({formatFileSize(file.size)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="alert alert-danger mb-0" role="alert">
              <p className="fw-semibold mb-2">Validation errors ({validationErrors.length})</p>
              <ul className="mb-0" style={{ maxHeight: "220px", overflowY: "auto" }}>
                {validationErrors.slice(0, 60).map((errorMessage, index) => (
                  <li key={`${errorMessage}-${index}`}>{errorMessage}</li>
                ))}
              </ul>
              {validationErrors.length > 60 && (
                <p className="mb-0 mt-2">
                  Showing first 60 errors. Fix these and re-upload to see remaining issues.
                </p>
              )}
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 pt-0">
            <button type="button" className="btn btn-outline-danger" onClick={closeModal} disabled={submitting}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: "linear-gradient(135deg, #D8B200 0%, #f59e0b 100%)", color: "#1f2937", border: "none", fontWeight: "700", minWidth: "220px", letterSpacing: "0.01em", boxShadow: "0 6px 14px rgba(216,178,0,0.28)", transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)" }}
              onClick={handleSubmit}
              disabled={submitting || selectedFiles.length === 0}
            >
              {submitting ? "Running validation and import..." : `Validate and Import ${content.entityName} from ${selectedFiles.length || 0} file(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
