const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const headers = [
  'TC ID',
  'Module/Page',
  'Scenario',
  'Steps',
  'Expected Result',
  'Priority',
  'Type'
];

const rows = [
  ['TC-001','Home Page','Application loads successfully','Open application URL','Home page loads with Employee Login and Security Login actions visible','P0','Smoke'],
  ['TC-002','Home Page','Employee login navigation','Click Employee Login on home page','User navigates to Employee page without errors','P0','Navigation'],
  ['TC-003','Home Page','Security login navigation','Click Security Login on home page','User navigates to Security page and list starts loading','P0','Navigation'],
  ['TC-004','Home Page','Logo route behavior','Click UD logo from Home and Employee pages','User is routed to Home page consistently','P2','UI'],
  ['TC-005','Home Page','Responsive layout on smaller screen','Open app in mobile viewport','Buttons and layout remain usable without overlap','P2','UI'],

  ['TC-006','Employee Page','Visitor form opens from employee module','Click Register Visitor','Visitor form panel opens','P0','Functional'],
  ['TC-007','Employee Page','Guest form opens from employee module','Click Register Guest','Guest form panel opens','P0','Functional'],

  ['TC-008','Visitor Form','Mandatory field validation','Leave required fields empty and click Submit','Submission blocked with field-level validation messages','P0','Negative'],
  ['TC-009','Visitor Form','Country code required for phone','Clear country code and submit','Validation error shown for country code','P0','Negative'],
  ['TC-010','Visitor Form','Phone validation - non-digit rejection','Enter alphabetic phone characters and submit','Validation fails: phone must contain digits only','P0','Validation'],
  ['TC-011','Visitor Form','Phone validation - India length rule','Select +91 and enter 9 digits then submit','Validation fails: India phone must be 10 digits','P0','Validation'],
  ['TC-012','Visitor Form','Phone validation - USA length rule','Select +1 and enter valid 10 digits then submit','Phone validation passes for +1 rule','P1','Validation'],
  ['TC-013','Visitor Form','Autofill duplicate icon copies values','Add second visitor card and click duplicate icon','Host, company, purpose, and tentative times are copied from first card','P0','Functional'],
  ['TC-014','Visitor Form','Autofill duplicate icon clear behavior','Click duplicate icon again on same copied card','Copied values are cleared back to empty state','P1','Functional'],
  ['TC-015','Visitor Form','Multiple visitors submit in one request','Fill two visitor cards and submit once','Single API request creates both visitor records','P0','E2E'],
  ['TC-016','Visitor Form','Edit mode prefill behavior','Open existing visitor in edit mode','All existing values, including date-time fields, are prefilled correctly','P1','Regression'],
  ['TC-017','Visitor Form','Edit mode phone split behavior','Open existing visitor with international phone','Country code and local number are parsed into separate fields','P1','Regression'],
  ['TC-018','Visitor Form','SubmittedBy captured from logged-in identity','Submit visitor while logged in','Payload stores submittedBy with user email/identity','P1','Integration'],
  ['TC-019','Visitor Form','API failure handling on submit','Force backend validation error and submit','User sees meaningful error message; app does not crash','P0','Resilience'],

  ['TC-020','Guest Form','Mandatory field validation','Leave required guest fields empty and submit','Submission blocked with validation errors','P0','Negative'],
  ['TC-021','Guest Form','Meeting room toggle behavior','Enable meeting room required toggle','Meeting room input appears and is editable','P1','Functional'],
  ['TC-022','Guest Form','Refreshment toggle behavior','Enable refreshment required toggle','Proposed refreshment time field appears','P1','Functional'],
  ['TC-023','Guest Form','On behalf host retention','Set onBehalfOf true, assign custom host, refresh account context','Custom host value is preserved','P1','Regression'],
  ['TC-024','Guest Form','Phone validation with formatting symbols','Enter phone with spaces/brackets and submit','Input is normalized and validated correctly','P1','Validation'],
  ['TC-025','Guest Form','Multiple guests submit in one request','Fill two guest cards and submit once','Backend persists both guest entries from array payload','P0','E2E'],
  ['TC-026','Guest Form','Guest Wi-Fi request email trigger','Submit guest with guestWifiRequired true','Guest saved and Wi-Fi notification flow is triggered','P1','Integration'],
  ['TC-027','Guest Form','Meeting room request email trigger','Submit guest with meetingRoomRequired true','Guest saved and meeting room notification flow is triggered','P1','Integration'],
  ['TC-028','Guest Form','Refreshment request email trigger','Submit guest with refreshmentRequired true','Guest saved and refreshment notification flow is triggered','P1','Integration'],

  ['TC-029','Adhoc Page','Adhoc form required field validation','Submit adhoc form without required values','Validation blocks submission','P0','Negative'],
  ['TC-030','Adhoc Page','Adhoc phone validation by country rule','Choose country code and enter invalid length','Validation fails with country-specific rule message','P0','Validation'],
  ['TC-031','Adhoc Page','Valid adhoc submission','Enter valid adhoc data and submit','Adhoc visitor is created successfully','P0','E2E'],
  ['TC-032','Adhoc Page','Adhoc edit existing record','Open adhoc record in edit mode and update purpose','Updated values are saved via update API','P1','Regression'],
  ['TC-033','Adhoc Page','Adhoc multi-card submission','Add second adhoc card and submit','Both adhoc records are created in one submission','P0','E2E'],
  ['TC-034','Adhoc Page','Adhoc Wi-Fi email trigger','Submit adhoc with guestWifiRequired true','Record saves and Wi-Fi email flow is triggered','P1','Integration'],

  ['TC-035','Security Page','Merged list shows Visitor + Guest + Adhoc','Open Security page with data in all collections','Unified cards render records from all sources','P0','E2E'],
  ['TC-036','Security Page','Auto-refresh polling updates list','Keep Security page open and create a new visitor','New card appears automatically within polling interval','P1','Functional'],
  ['TC-037','Security Page','Status pill filtering','Click status filter (New / CheckedIn / CheckedOut)','Only matching status records are displayed','P1','Functional'],
  ['TC-038','Security Page','Search by name/company','Use search with partial name or company','Only matching records remain visible','P1','Functional'],
  ['TC-039','Security Page','View details in security page','Click View Details on a record card','Detailed visitor information opens and shows all expected fields','P0','Functional'],
  ['TC-040','Security Page','Authorize validation - consent required','Open authorize modal, sign but keep consent unchecked, submit','Authorization blocked with Consent Required message','P0','Negative'],
  ['TC-041','Security Page','Authorize validation - signature required','Open authorize modal, check consent but leave signature blank, submit','Authorization blocked with Signature Required message','P0','Negative'],
  ['TC-042','Security Page','Successful authorize/check-in','Provide consent and signature then submit','Status updates to CheckedIn and actualInTime is saved','P0','E2E'],
  ['TC-043','Security Page','Edit badge validation','Open Edit Badge and submit empty value','Save blocked and badge-required warning appears','P1','Negative'],
  ['TC-044','Security Page','Edit badge success','Enter valid badge number and save','Badge value persists and displays on card','P1','Functional'],
  ['TC-045','Security Page','Checkout validation rules','Open checkout and set only one required checkbox','Checkout blocked until all required checks are true','P0','Negative'],
  ['TC-046','Security Page','Successful checkout flow','Set hostApproved and badgeSurrendered true and submit','Record moves to CheckedOut and actualOutTime is stored','P0','E2E'],
  ['TC-047','Security Page','Clear security page records older than 1 week','Keep checked-out record with actualOutTime older than 7 days','Older checked-out records are auto-hidden/cleared from Security visible list','P0','Business Rule'],
  ['TC-048','Security Page','Export to Excel with filters','Set date range and export','Downloaded Excel contains records matching selected filter criteria','P1','E2E'],

  ['TC-049','Backend/API','Health endpoint reports DB status','Call health endpoint when DB is up','Response returns backend running state and DB connection status','P1','API'],
  ['TC-050','Reminder Job','Overstay reminder and no duplicate resend','Run reminder job twice on same overdue checked-in record','First run sends reminder and marks flag; second run does not resend duplicate','P1','Integration']
];

if (rows.length !== 50) {
  throw new Error(`Expected exactly 50 test cases, found ${rows.length}`);
}

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
ws['!cols'] = [
  { wch: 10 },
  { wch: 18 },
  { wch: 50 },
  { wch: 60 },
  { wch: 64 },
  { wch: 10 },
  { wch: 14 }
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Top 50 Functional Cases');

const outputPath = path.resolve(__dirname, '..', '..', 'Top_50_All_Functionality_VMS_Including_4_Features.xlsx');
XLSX.writeFile(wb, outputPath);

if (!fs.existsSync(outputPath)) {
  throw new Error('Failed to generate Top_50_All_Functionality_VMS_Including_4_Features.xlsx');
}

console.log(`Generated: ${outputPath}`);
