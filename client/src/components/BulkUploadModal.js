import React, { useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { validatePhoneLength } from "../utils/phoneUtils";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VISITOR_HEADERS = [
  "firstName",
  "lastName",
  "email",
  "company",
  "countryCode",
  "phone",
  "purposeOfVisit",
  "host",
  "onBehalfOf",
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
  "onBehalfOf",
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
  "onBehalfOf",
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
  "onBehalfOf",
  "meetingRoomRequired",
  "meetingRoom",
  "laptopSerial",
  "guestWifiRequired",
  "refreshmentRequired",
  "proposedRefreshmentTime",
];

const VISITOR_SAMPLE_ROW = {
  firstName: "Sample",
  lastName: "Visitor",
  email: "sample.visitor@example.com",
  company: "UD Trucks",
  countryCode: "+91",
  phone: "9876543210",
  purposeOfVisit: "Plant tour",
  host: "Host Name",
  onBehalfOf: "false",
  meetingRoom: "Meeting Room A",
  laptopSerial: "LPT-12345",
  guestWifiRequired: "true",
  TentativeinTime: "2026-04-10 10:00",
  TentativeoutTime: "2026-04-10 12:00",
};

const GUEST_SAMPLE_ROW = {
  category: "Isuzu Employee",
  firstName: "Sample",
  lastName: "Guest",
  email: "sample.guest@example.com",
  company: "UD Trucks",
  host: "Host Name",
  onBehalfOf: "false",
  countryCode: "+91",
  phone: "9876543210",
  purposeOfVisit: "Vendor meeting",
  meetingRoomRequired: "true",
  meetingRoom: "Meeting Room B",
  laptopSerial: "LPT-98765",
  guestWifiRequired: "true",
  refreshmentRequired: "true",
  proposedRefreshmentTime: "2026-04-10 11:00",
  TentativeinTime: "2026-04-10 10:00",
  TentativeoutTime: "2026-04-10 13:00",
};

const GUEST_CATEGORIES = new Set(["Isuzu Employee", "UD Employee"]);

const normalizeHeader = (value) =>
  String(value || "")
    .replace(/\(\s*optional\s*\)/gi, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const toText = (value) => String(value ?? "").trim();

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
    return value;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
  }

  const parsed = new Date(toText(value));
  if (Number.isNaN(parsed.getTime())) return null;
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
  return (
    toText(row.firstname).toLowerCase() === "sample" &&
    toText(row.lastname).toLowerCase() === "visitor" &&
    toText(row.email).toLowerCase() === "sample.visitor@example.com" &&
    toText(row.phone) === "9876543210"
  );
};

const isGuestSampleRow = (row) => {
  return (
    toText(row.firstname).toLowerCase() === "sample" &&
    toText(row.lastname).toLowerCase() === "guest" &&
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
  const normalizedActual = (actualHeaders || [])
    .map((h) => normalizeHeader(h))
    .filter(Boolean);
  const normalizedExpected = (expectedHeaders || [])
    .map((h) => normalizeHeader(h))
    .filter(Boolean);

  if (!normalizedActual.length) {
    return ["Header row is missing. Please use the downloaded template."];
  }

  const seen = new Set();
  const duplicateHeaders = [];
  normalizedActual.forEach((h) => {
    if (seen.has(h)) duplicateHeaders.push(h);
    seen.add(h);
  });
  if (duplicateHeaders.length > 0) {
    return [
      `Duplicate header(s) found: ${duplicateHeaders.join(", ")}. Please keep each column only once.`,
    ];
  }

  const actualSet = new Set(normalizedActual);
  const expectedSet = new Set(normalizedExpected);
  const missing = normalizedExpected.filter((h) => !actualSet.has(h));
  const extra = normalizedActual.filter((h) => !expectedSet.has(h));

  const errors = [];
  if (missing.length > 0) {
    errors.push(`Missing required column(s): ${missing.join(", ")}.`);
  }
  if (extra.length > 0) {
    errors.push(`Unexpected column(s): ${extra.join(", ")}.`);
  }

  if (errors.length === 0) {
    const hasOrderMismatch =
      normalizedActual.length !== normalizedExpected.length ||
      normalizedExpected.some((h, idx) => normalizedActual[idx] !== h);

    if (hasOrderMismatch) {
      errors.push("Column order does not match the template. Please use the template as-is.");
    }
  }

  return errors;
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
    ["4. Optional fields can be left blank."],
    ["5. Submit once all required fields are valid."],
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
    const firstName = toText(row.firstname);
    const lastName = toText(row.lastname);
    const email = toText(row.email).toLowerCase();
    const company = toText(row.company);
    const countryCode = toText(row.countrycode) || "+91";
    const phone = splitPhoneByCountryCode(row.phone, countryCode);
    const purposeOfVisit = toText(row.purposeofvisit);
    const rowHost = toText(row.host);
    const onBehalfOfParsed = parseBooleanStrict(row.onbehalfof);
    const onBehalfOf = onBehalfOfParsed.value;
    const host = onBehalfOf ? rowHost : loggedInHost;
    const meetingRoom = toText(row.meetingroom);
    const laptopSerial = toText(row.laptopserial);
    const guestWifiParsed = parseBooleanStrict(row.guestwifirequired);
    const guestWifiRequired = guestWifiParsed.value;
    const inTime = parseExcelDate(row.tentativeintime ?? row.intime);
    const outTime = parseExcelDate(row.tentativeouttime ?? row.outtime);

    if (!firstName) errors.push(`Row ${lineNumber}: firstName is required.`);
    if (!lastName) errors.push(`Row ${lineNumber}: lastName is required.`);
    if (!email) errors.push(`Row ${lineNumber}: email is required.`);
    if (email && !EMAIL_REGEX.test(email)) errors.push(`Row ${lineNumber}: email format is invalid.`);
    if (!company) errors.push(`Row ${lineNumber}: company is required.`);
    if (!purposeOfVisit) errors.push(`Row ${lineNumber}: purposeOfVisit is required.`);
    if (!rowHost) errors.push(`Row ${lineNumber}: host is required.`);
    if (!phone) errors.push(`Row ${lineNumber}: phone is required.`);
    if (!onBehalfOfParsed.valid) {
      errors.push(`Row ${lineNumber}: onBehalfOf ${onBehalfOfParsed.message}.`);
    }
    if (
      !onBehalfOf &&
      rowHost &&
      rowHost.toLowerCase() !== loggedInHost.toLowerCase()
    ) {
      errors.push(
        `Row ${lineNumber}: host must match logged-in host (${loggedInHost}) unless onBehalfOf is true.`
      );
    }
    if (!guestWifiParsed.valid) {
      errors.push(`Row ${lineNumber}: guestWifiRequired ${guestWifiParsed.message}.`);
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

    const duplicateKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${phone}`;
    if (seen[duplicateKey]) {
      errors.push(
        `Row ${lineNumber}: duplicate person and phone found (same as row ${seen[duplicateKey]}).`
      );
    } else {
      seen[duplicateKey] = lineNumber;
    }

    payload.push({
      category: "Visitor",
      host,
      onBehalfOf,
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
    const rowHost = toText(row.host);
    const onBehalfOfParsed = parseBooleanStrict(row.onbehalfof);
    const onBehalfOf = onBehalfOfParsed.value;
    const host = onBehalfOf ? rowHost : loggedInHost;
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
    if (!company) errors.push(`Row ${lineNumber}: company is required.`);
    if (!rowHost) errors.push(`Row ${lineNumber}: host is required.`);
    if (!purposeOfVisit) errors.push(`Row ${lineNumber}: purposeOfVisit is required.`);
    if (!phone) errors.push(`Row ${lineNumber}: phone is required.`);
    if (!onBehalfOfParsed.valid) {
      errors.push(`Row ${lineNumber}: onBehalfOf ${onBehalfOfParsed.message}.`);
    }
    if (
      !onBehalfOf &&
      rowHost &&
      rowHost.toLowerCase() !== loggedInHost.toLowerCase()
    ) {
      errors.push(
        `Row ${lineNumber}: host must match logged-in host (${loggedInHost}) unless onBehalfOf is true.`
      );
    }
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
      onBehalfOf,
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const content = useMemo(() => {
    const isVisitor = type === "visitor";
    const resolvedHostName = toText(hostName) || "Logged-in Host";
    return {
      title: isVisitor ? "Bulk Visitor Upload" : "Bulk Guest Upload",
      endpoint: isVisitor ? "/api/visitors" : "/api/guests",
      entityName: isVisitor ? "visitors" : "guests",
      headers: isVisitor ? VISITOR_HEADERS : GUEST_HEADERS,
      requiredFields: isVisitor ? VISITOR_REQUIRED_FIELDS : GUEST_REQUIRED_FIELDS,
      optionalFields: isVisitor ? VISITOR_OPTIONAL_FIELDS : GUEST_OPTIONAL_FIELDS,
      sampleRow: isVisitor
        ? { ...VISITOR_SAMPLE_ROW, host: resolvedHostName }
        : { ...GUEST_SAMPLE_ROW, host: resolvedHostName },
      instructionRows: isVisitor
        ? buildInstructionRows(VISITOR_REQUIRED_FIELDS, VISITOR_OPTIONAL_FIELDS, [
            "Use readable date/time format, for example: 2026-04-10 10:00.",
            "host is required and should match the logged-in host name.",
            "Use onBehalfOf = true only when entering a different host name.",
          ])
        : buildInstructionRows(GUEST_REQUIRED_FIELDS, GUEST_OPTIONAL_FIELDS, [
            "category must be Isuzu Employee or UD Employee.",
            "meetingRoom is required only when meetingRoomRequired is true.",
            "proposedRefreshmentTime is required only when refreshmentRequired is true.",
            "host is required and should match the logged-in host name.",
            "Use onBehalfOf = true only when entering a different host name.",
          ]),
      fileName: isVisitor ? "visitor_bulk_upload_template.xlsx" : "guest_bulk_upload_template.xlsx",
    };
  }, [type, hostName]);

  if (!show) return null;

  const resetLocalState = () => {
    setSelectedFile(null);
    setValidationErrors([]);
    setSummary(null);
    setSubmitting(false);
  };

  const closeModal = () => {
    if (submitting) return;
    resetLocalState();
    if (typeof onClose === "function") onClose();
  };

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
  };

  const parseAndValidateFile = async () => {
    if (!selectedFile) {
      setValidationErrors(["Please choose an Excel file first."]);
      return null;
    }

    const fileBytes = await selectedFile.arrayBuffer();
    const workbook = XLSX.read(fileBytes, { type: "array", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      setValidationErrors(["Uploaded file does not contain a worksheet."]);
      return null;
    }

    const sheet = workbook.Sheets[firstSheetName];
    const { headers, rows } = extractRows(sheet);

    const headerErrors = validateTemplateHeaders(headers, content.headers);
    if (headerErrors.length > 0) {
      setValidationErrors(headerErrors);
      return null;
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
      setValidationErrors([
        "No data rows found. Keep at least one real row below the sample row.",
      ]);
      return null;
    }

    const result =
      type === "visitor"
        ? validateVisitorRows(dataRows, hostName, submittedBy)
        : validateGuestRows(dataRows, hostName, submittedBy);

    if (result.errors.length > 0) {
      setValidationErrors(result.errors);
      return null;
    }

    setValidationErrors([]);
    return result.payload;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSummary(null);

    try {
      const payload = await parseAndValidateFile();
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

      setSummary(successSummary);

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

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 1100,
        backdropFilter: "blur(2px)",
      }}
      onClick={closeModal}
    >
      <div
        className="mx-auto mt-5 p-4 rounded-4 shadow-lg bg-white"
        style={{ maxWidth: "860px", width: "95%", maxHeight: "88vh", overflowY: "auto" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0 fw-bold">{content.title}</h4>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={closeModal}
            disabled={submitting}
          >
            Close
          </button>
        </div>

        <div className="p-3 rounded-3 border mb-3" style={{ background: "#f8fafc" }}>
          <p className="mb-2 fw-semibold">Template</p>
          <p className="mb-2" style={{ fontSize: "0.9rem" }}>
            Download the template, keep the headers unchanged, and enter real rows below the sample row.
            The sample row is ignored automatically while processing.
          </p>
          <p className="mb-1" style={{ fontSize: "0.88rem" }}>
            <strong>Required:</strong> {content.requiredFields.join(", ")}
          </p>
          <p className="mb-2" style={{ fontSize: "0.88rem" }}>
            <strong>Optional:</strong> {content.optionalFields.join(", ")}
          </p>
          <button type="button" className="btn btn-outline-primary" onClick={downloadTemplate}>
            Download Template
          </button>
        </div>

        <div className="p-3 rounded-3 border mb-3">
          <label className="form-label fw-semibold">Upload Filled Excel File</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="form-control"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setSelectedFile(file);
              setValidationErrors([]);
              setSummary(null);
            }}
          />
          <small className="text-muted d-block mt-2">
            Only .xlsx or .xls files are supported.
          </small>
        </div>

        {validationErrors.length > 0 && (
          <div className="alert alert-danger" role="alert">
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

        {summary && (
          <div className="alert alert-success" role="alert">
            <p className="fw-semibold mb-1">Upload completed</p>
            <p className="mb-0">
              Processed rows: {summary.totalRows} | Created records: {summary.createdCount}
            </p>
          </div>
        )}

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-danger" onClick={closeModal} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={handleSubmit}
            disabled={submitting || !selectedFile}
          >
            {submitting ? "Validating and Uploading..." : "Validate and Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
