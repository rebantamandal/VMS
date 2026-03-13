const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const headers = [
  'SL No',
  'Page',
  'Real World Scenario',
  'Steps',
  'Expected Results'
];

const rows = [
  ['HP-1','Home Page','Employee navigation button routes correctly','From home, click EMPLOYEE LOGIN button once','Route changes to /employee and Visitor + Guest service buttons are visible'],
  ['HP-2','Home Page','Security navigation button routes correctly','From home, click SECURITY LOGIN button once','Route changes to /security and card list loader starts without page crash'],
  ['HP-3','Home Page','UD logo button keeps user on root','From home, click logo in header','User remains on / and hero section stays visible'],
  ['EMP-1','Employee Page','Visitor service toggle opens form panel','Click Visitor service button on desktop layout','Visitor form panel animates in with title Visitor Details'],
  ['EMP-2','Employee Page','Guest service toggle opens form panel','Click Guest service button on desktop layout','Guest form panel animates in with title Guest Details'],

  ['VF-1','Visitor Form','Host required validation is enforced','Clear Host field and click Submit','Submission blocked; error popup indicates missing required fields'],
  ['VF-2','Visitor Form','Country code required validation is enforced','Clear country code selection and click Submit','Submission blocked with country code validation message'],
  ['VF-3','Visitor Form','India phone length exact rule','Select +91 and enter 9 digits then Submit','Validation message says India phone must be 10 digits'],
  ['VF-4','Visitor Form','USA phone length exact rule','Select +1 and enter 10 digits then Submit','Validation passes for phone length; no phone-length error shown'],
  ['VF-5','Visitor Form','Phone rejects alphabetic characters','Enter phone value 98AB1234 and Submit','Validation fails with message Phone must contain only digits'],
  ['VF-6','Visitor Form','Multi-visitor payload submission','Add second visitor entry, fill both cards, click Submit','Single POST /api/visitors call sends array payload and success toast appears'],
  ['VF-7','Visitor Form','Duplicate icon copies host/company/purpose/times','In second card, click duplicate icon for each supported field group','Selected values copy from first card into second card'],
  ['VF-8','Visitor Form','Duplicate icon second click clears copied values','After copy, click same duplicate icon again on second card','Copied fields are cleared back to empty state'],
  ['VF-9','Visitor Form','Edit mode pre-fills tentative date-times','Open existing visitor in edit mode with stored inTime/outTime','Tentative In/Out fields display ISO datetime-local values'],
  ['VF-10','Visitor Form','Edit mode phone parsing keeps country split','Open existing visitor with phone stored as +911234567890','Form shows countryCode +91 and local number 1234567890'],
  ['VF-11','Visitor Form','SubmittedBy uses logged-in email on save','Create visitor while logged in with corporate account','Saved payload contains submittedBy as SSO email claim'],
  ['VF-12','Visitor Form','API error surfaces meaningful message','Force backend to return validation error on submit','Error modal displays backend error text instead of generic crash'],

  ['GF-1','Guest Form','On behalf toggle preserves custom host','Set onBehalfOf true and host to another employee; refresh account context','Host remains custom value; not auto-reset to logged-in name'],
  ['GF-2','Guest Form','Meeting room toggle reveals room input','Enable Meeting Room Required switch','Meeting Room text field appears and accepts input'],
  ['GF-3','Guest Form','Refreshment toggle reveals proposed time','Enable Refreshment Required switch','Proposed Refreshment Time field appears'],
  ['GF-4','Guest Form','Guest create requires in/out time from schema','Submit guest without Tentative In/Out values','Backend returns validation error; UI shows submission failed message'],
  ['GF-5','Guest Form','Guest create rejects non-array body contract','Send object payload to POST /api/guests via API client','Response is 400 with Request body must be an array'],
  ['GF-6','Guest Form','Guest Wi-Fi request triggers IT email flow','Submit guest with guestWifiRequired=true','Guest saved and Wi-Fi notification function is invoked'],
  ['GF-7','Guest Form','Meeting room request triggers admin email flow','Submit guest with meetingRoomRequired=true and room value','Guest saved and meeting-room notification function is invoked'],
  ['GF-8','Guest Form','Refreshment request triggers admin email flow','Submit guest with refreshmentRequired=true and proposed time','Guest saved and refreshment notification function is invoked'],
  ['GF-9','Guest Form','Multiple guest cards submit together','Click Add Another Guest, complete two cards, Submit','POST /api/guests persists both records in one transaction'],
  ['GF-10','Guest Form','Phone normalization strips symbols before length check','Enter +1 style local with spaces/brackets and submit','Validator normalizes digits and applies rule to normalized value'],

  ['ADH-1','Adhoc Page','Adhoc submission requires tentative times','Submit adhoc record with phone but without in/out times','Validation blocks submit and shows missing required fields'],
  ['ADH-2','Adhoc Page','Adhoc country-specific phone rule enforcement','Select +65 with 7-digit phone and submit','Validation fails because Singapore requires 8 digits'],
  ['ADH-3','Adhoc Page','Adhoc Wi-Fi flag triggers email workflow','Submit adhoc with guestWifiRequired true','Record saves and adhoc Wi-Fi mail function runs'],
  ['ADH-4','Adhoc Page','Adhoc edit updates existing record','Open adhoc record in edit mode and change purpose then save','PUT /api/adhoc/:id returns updated record with changed purpose'],
  ['ADH-5','Adhoc Page','Adhoc multi-card batch insert','Create 2 adhoc entries in same form and submit','POST /api/adhoc stores both entries and returns created list'],

  ['SEC-1','Security Page','Merged list includes visitor guest adhoc sources','Open security page with data in all three collections','Cards render combined data and each record has correct action set'],
  ['SEC-2','Security Page','Auto-refresh polling updates list every 5 seconds','Keep security page open; create new visitor from another session','New card appears within polling interval without manual refresh'],
  ['SEC-3','Security Page','Status pill New filters exact statuses','Click New status pill','Only cards with status new remain visible and count matches'],
  ['SEC-4','Security Page','Search filters by full name and company','Type part of name/company in search input','Only matching cards remain; unrelated cards hidden'],
  ['SEC-5','Security Page','Consent submit blocked when checkbox unchecked','Open Authorize modal, draw signature, keep consent unchecked, submit','Warning Consent Required appears and status stays new'],
  ['SEC-6','Security Page','Consent submit blocked when signature empty','Open Authorize modal, check consent, keep canvas empty, submit','Warning Signature Required appears and no update call succeeds'],
  ['SEC-7','Security Page','Successful authorize writes checkedIn and encrypted signature','Open Authorize modal, check consent, sign, submit','Status becomes checkedIn, actualInTime set, signature stored encrypted'],
  ['SEC-8','Security Page','Badge edit cannot save blank value','From checkedIn card open Edit Badge and keep value blank','Badge Number Required warning appears and existing badge remains unchanged'],
  ['SEC-9','Security Page','Badge edit persists to cardNo field','Enter badge UD-2026-009 and Save','PUT update succeeds and card displays updated Visitor ID'],
  ['SEC-10','Security Page','Checkout blocked unless both switches are true','Open checkout modal and set only one checkbox true','Checkout denied with required fields warning'],
  ['SEC-11','Security Page','Successful checkout writes flags and timestamp','Open checkout, set hostApproved and badgeSurrendered true, submit','Status becomes checkedOut with actualOutTime and both flags true'],
  ['SEC-12','Security Page','Print card action available only for checkedIn','Compare actions on new vs checkedIn cards','Print Card button appears only for checkedIn records'],
  ['SEC-13','Security Page','Overdue remove appears only for new older than 24h','Create new record with inTime older than 24h and another recent one','Remove button visible only on overdue new record'],
  ['SEC-14','Security Page','Guest remove-ui endpoint performs soft removal','Click Remove on overdue guest and confirm dialog','Guest set to status removed with uiRemoved true and disappears from list'],
  ['SEC-15','Security Page','Adhoc remove-ui endpoint performs soft removal','Click Remove on overdue adhoc and confirm dialog','Adhoc set to status removed with uiRemoved true and disappears from list'],
  ['SEC-16','Security Page','Visitor remove action exposes route mismatch defect','Click Remove on overdue visitor and confirm dialog','Removal fails because UI calls /api/visitors/:id/remove-ui but route defines PATCH /:id/remove'],
  ['SEC-17','Security Page','Checked-out older than 7 days hidden from visible list','Keep a record with actualOutTime older than 7 days','Card is filtered out from UI list automatically'],
  ['SEC-18','Security Page','Export modal quick filters set dates correctly','Open Export dialog and click Today/Yesterday/Last 7 Days','From and To dates auto-populate according to selected quick filter'],
  ['SEC-19','Security Page','Export produces xlsx with filtered dataset columns','Apply status/date filters then click Download Excel','Visitors_YYYY-MM-DD.xlsx is downloaded with mapped status/check-in/out fields'],
  ['SEC-20','Security Page','Network failure does not crash screen','Disconnect backend and trigger fetch/update operation','Error alert shown and page remains interactive without blank crash'],

  ['SYS-1','Backend/API','Health endpoint reflects runtime DB state','Call GET /api/health when DB connected','Response includes status Backend is running and database Connected'],
  ['SYS-2','Backend/API','DB connection failure exits server safely','Start server with invalid MONGO_URI','Startup logs connection error and process exits with code 1'],
  ['SYS-3','Reminder Job','Overstay reminder triggers after 90 minutes','Set checkedIn visitor outTime to now minus 100 minutes and run job','Reminder email sent and reminder15Sent flags saved'],
  ['SYS-4','Reminder Job','Reminder does not resend for same outTime','Run overstay job again without changing outTime','No duplicate reminder is sent for same record/outTime pair'],
  ['SYS-5','Reminder Job','Changing outTime resets reminder eligibility','Update checkedIn record outTime via PUT and rerun job after overdue threshold','Reminder flags reset and one new reminder is sent for new outTime']
];

const excludedCaseIds = new Set([
  'VF-3',
  'VF-4',
  'VF-5',
  'VF-7',
  'VF-8',
  'VF-10',
  'GF-10',
  'ADH-2',
  'SEC-17'
]);

const rowsWithoutThreeFeatures = rows.filter(([slNo]) => !excludedCaseIds.has(slNo));

const supplementalRowsFromMergedSource = [
  ['HP-4','Home Page','Logo visibility and placement','Open home page','UD logo is visible at top-left and clickable'],
  ['HP-5','Home Page','Responsive behavior on mobile','Open page on mobile viewport','Layout adapts without overlap or clipping']
];

const existingIds = new Set(rowsWithoutThreeFeatures.map(([slNo]) => slNo));
const backfillRows = supplementalRowsFromMergedSource.filter(([slNo]) => !existingIds.has(slNo));
const strictTop50Rows = [...rowsWithoutThreeFeatures, ...backfillRows].slice(0, 50);

const ws = XLSX.utils.aoa_to_sheet([headers, ...strictTop50Rows]);
ws['!cols'] = [
  { wch: 10 },
  { wch: 18 },
  { wch: 52 },
  { wch: 60 },
  { wch: 70 }
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Top 50 Detailed Cases');

const outputPath = path.resolve(__dirname, '..', '..', 'Top_50_Merged_Best_Test_Cases_VMS_Detailed_Without_Three_Features_Top50.xlsx');
XLSX.writeFile(wb, outputPath);

if (!fs.existsSync(outputPath)) {
  throw new Error('Failed to generate workbook');
}

console.log(`Generated: ${outputPath}`);
console.log(`Excluded IDs: ${Array.from(excludedCaseIds).join(', ')}`);
console.log(`Total rows after exclusion: ${rowsWithoutThreeFeatures.length}; backfilled: ${strictTop50Rows.length - rowsWithoutThreeFeatures.length}; exported: ${strictTop50Rows.length}`);
