const path = require("path");
const XLSX = require("xlsx");

const visitorHeaders = [
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

const guestHeaders = [
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

const companies = [
  "UD Trucks",
  "Isuzu",
  "Bosch India",
  "Tata Consultancy Services",
  "Tech Mahindra",
  "Accenture India",
];

const purposes = [
  "Plant tour",
  "Business meeting",
  "Vendor discussion",
  "Safety audit",
  "Equipment demo",
  "Project review",
];

function pad2(v) {
  return String(v).padStart(2, "0");
}

function dt(day, hour, minute) {
  return `2026-04-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;
}

function addMinutes(day, hour, minute, plusMins) {
  const d = new Date(Date.UTC(2026, 3, day, hour, minute, 0));
  d.setUTCMinutes(d.getUTCMinutes() + plusMins);
  return dt(d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
}

function writeWorkbook(fileName, sheetName, headers, rows) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers, skipHeader: false });
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const targetPath = path.join(__dirname, "..", fileName);
  XLSX.writeFile(wb, targetPath);
  return targetPath;
}

function buildVisitorRows() {
  const rows = [];

  for (let i = 1; i <= 20; i += 1) {
    const day = 10 + ((i - 1) % 5);
    const inHour = 9 + ((i - 1) % 6);
    const inMinute = (i % 2) * 30;
    const inTime = dt(day, inHour, inMinute);
    const outTime = addMinutes(day, inHour, inMinute, 120);

    rows.push({
      firstName: `Visitor${i}`,
      lastName: `User${i}`,
      email: `visitor${i}@example.com`,
      company: companies[i % companies.length],
      countryCode: "+91",
      phone: `900100${String(i).padStart(4, "0")}`,
      purposeOfVisit: purposes[i % purposes.length],
      host: `Host Person ${((i - 1) % 4) + 1}`,
      onBehalfOf: "true",
      meetingRoom: i % 3 === 0 ? `MR-${String.fromCharCode(64 + ((i % 5) + 1))}` : "",
      laptopSerial: i % 4 === 0 ? `LPT-V-${1000 + i}` : "",
      guestWifiRequired: i % 2 === 0 ? "true" : "",
      TentativeinTime: inTime,
      TentativeoutTime: outTime,
    });
  }

  return rows;
}

function buildGuestRows() {
  const rows = [];

  for (let i = 1; i <= 20; i += 1) {
    const day = 15 + ((i - 1) % 5);
    const inHour = 9 + ((i - 1) % 6);
    const inMinute = (i % 2) * 30;
    const inTime = dt(day, inHour, inMinute);
    const outTime = addMinutes(day, inHour, inMinute, 180);

    const meetingRoomRequired = i % 3 === 0;
    const refreshmentRequired = i % 4 === 0;
    const refreshmentTime = refreshmentRequired
      ? addMinutes(day, inHour, inMinute, 90)
      : "";

    rows.push({
      category: i % 2 === 0 ? "Isuzu Employee" : "UD Employee",
      firstName: `Guest${i}`,
      lastName: i % 5 === 0 ? "" : `Member${i}`,
      email: i % 4 === 0 ? "" : `guest${i}@example.com`,
      company: companies[(i + 2) % companies.length],
      host: `Host Person ${((i - 1) % 4) + 1}`,
      onBehalfOf: "true",
      countryCode: "+91",
      phone: `901200${String(i).padStart(4, "0")}`,
      purposeOfVisit: purposes[(i + 1) % purposes.length],
      meetingRoomRequired: meetingRoomRequired ? "true" : "",
      meetingRoom: meetingRoomRequired ? `G-MR-${((i - 1) % 6) + 1}` : "",
      laptopSerial: i % 6 === 0 ? `LPT-G-${2000 + i}` : "",
      guestWifiRequired: i % 2 === 1 ? "true" : "",
      refreshmentRequired: refreshmentRequired ? "true" : "",
      proposedRefreshmentTime: refreshmentTime,
      TentativeinTime: inTime,
      TentativeoutTime: outTime,
    });
  }

  return rows;
}

function buildVisitorErrorRows() {
  return [
    {
      firstName: "",
      lastName: "Err1",
      email: "err1@example.com",
      company: "UD Trucks",
      countryCode: "+91",
      phone: "9003000001",
      purposeOfVisit: "Plant tour",
      host: "Host Person 1",
      onBehalfOf: "true",
      meetingRoom: "",
      laptopSerial: "",
      guestWifiRequired: "false",
      TentativeinTime: "2026-04-12 09:00",
      TentativeoutTime: "2026-04-12 11:00",
    },
    {
      firstName: "Error2",
      lastName: "User2",
      email: "invalid-email",
      company: "UD Trucks",
      countryCode: "+91",
      phone: "9003000002",
      purposeOfVisit: "Business meeting",
      host: "Host Person 1",
      onBehalfOf: "true",
      meetingRoom: "",
      laptopSerial: "",
      guestWifiRequired: "true",
      TentativeinTime: "2026-04-12 09:30",
      TentativeoutTime: "2026-04-12 11:30",
    },
    {
      firstName: "Error3",
      lastName: "User3",
      email: "err3@example.com",
      company: "UD Trucks",
      countryCode: "+91",
      phone: "12345",
      purposeOfVisit: "Vendor discussion",
      host: "Host Person 2",
      onBehalfOf: "true",
      meetingRoom: "",
      laptopSerial: "",
      guestWifiRequired: "false",
      TentativeinTime: "2026-04-12 10:00",
      TentativeoutTime: "2026-04-12 12:00",
    },
    {
      firstName: "Error4",
      lastName: "User4",
      email: "err4@example.com",
      company: "UD Trucks",
      countryCode: "+91",
      phone: "9003000004",
      purposeOfVisit: "Project review",
      host: "Host Person 2",
      onBehalfOf: "true",
      meetingRoom: "",
      laptopSerial: "",
      guestWifiRequired: "false",
      TentativeinTime: "2026-04-12 11:00",
      TentativeoutTime: "2026-04-12 10:00",
    },
    {
      firstName: "Error5",
      lastName: "Dup",
      email: "err5@example.com",
      company: "UD Trucks",
      countryCode: "+91",
      phone: "9003000005",
      purposeOfVisit: "Safety audit",
      host: "Host Person 3",
      onBehalfOf: "true",
      meetingRoom: "",
      laptopSerial: "",
      guestWifiRequired: "false",
      TentativeinTime: "2026-04-12 12:00",
      TentativeoutTime: "2026-04-12 14:00",
    },
    {
      firstName: "Error5",
      lastName: "Dup",
      email: "err6@example.com",
      company: "UD Trucks",
      countryCode: "+91",
      phone: "9003000005",
      purposeOfVisit: "Safety audit",
      host: "Host Person 3",
      onBehalfOf: "true",
      meetingRoom: "",
      laptopSerial: "",
      guestWifiRequired: "false",
      TentativeinTime: "2026-04-12 12:30",
      TentativeoutTime: "2026-04-12 14:30",
    },
    {
      firstName: "Error7",
      lastName: "Bool",
      email: "err7@example.com",
      company: "UD Trucks",
      countryCode: "+91",
      phone: "9003000007",
      purposeOfVisit: "Equipment demo",
      host: "Host Person 4",
      onBehalfOf: "maybe",
      meetingRoom: "",
      laptopSerial: "",
      guestWifiRequired: "2",
      TentativeinTime: "2026-04-12 13:00",
      TentativeoutTime: "2026-04-12 15:00",
    },
    {
      firstName: "Error8",
      lastName: "NoHost",
      email: "err8@example.com",
      company: "UD Trucks",
      countryCode: "+91",
      phone: "9003000008",
      purposeOfVisit: "Plant tour",
      host: "",
      onBehalfOf: "true",
      meetingRoom: "",
      laptopSerial: "",
      guestWifiRequired: "false",
      TentativeinTime: "2026-04-12 13:30",
      TentativeoutTime: "2026-04-12 15:30",
    },
    {
      firstName: "Error9",
      lastName: "MismatchHost",
      email: "err9@example.com",
      company: "UD Trucks",
      countryCode: "+91",
      phone: "9003000009",
      purposeOfVisit: "Business meeting",
      host: "Some Other Host",
      onBehalfOf: "false",
      meetingRoom: "",
      laptopSerial: "",
      guestWifiRequired: "false",
      TentativeinTime: "2026-04-12 14:00",
      TentativeoutTime: "2026-04-12 16:00",
    },
    {
      firstName: "Error10",
      lastName: "PastTime",
      email: "err10@example.com",
      company: "UD Trucks",
      countryCode: "+91",
      phone: "9003000010",
      purposeOfVisit: "Vendor discussion",
      host: "Host Person 1",
      onBehalfOf: "true",
      meetingRoom: "",
      laptopSerial: "",
      guestWifiRequired: "false",
      TentativeinTime: "2025-02-12 10:00",
      TentativeoutTime: "2025-02-12 12:00",
    },
  ];
}

function main() {
  const visitorPath = writeWorkbook(
    "visitor_bulk_20_valid.xlsx",
    "Visitors",
    visitorHeaders,
    buildVisitorRows()
  );

  const guestPath = writeWorkbook(
    "guest_bulk_20_valid.xlsx",
    "Guests",
    guestHeaders,
    buildGuestRows()
  );

  const errorPath = writeWorkbook(
    "visitor_bulk_errors.xlsx",
    "VisitorErrors",
    visitorHeaders,
    buildVisitorErrorRows()
  );

  console.log("Generated files:");
  console.log(visitorPath);
  console.log(guestPath);
  console.log(errorPath);
}

main();
