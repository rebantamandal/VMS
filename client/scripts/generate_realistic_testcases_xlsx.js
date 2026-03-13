const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const headers = [
  'Test Case ID','Module','Scenario','Preconditions','Test Steps','Test Data','Expected Result','Priority','Type'
];

const rows = [
  ['TC-001','Home','Navigate to Employee screen from landing page','Frontend app running','Open /; click EMPLOYEE LOGIN','N/A','User is navigated to /employee and Employee services are visible','P0','E2E'],
  ['TC-002','Home','Navigate to Security screen from landing page','Frontend app running','Open /; click SECURITY LOGIN','N/A','User is navigated to /security and merged visitor list starts loading','P0','E2E'],
  ['TC-003','Employee UI','Visitor form expands/collapses','On /employee','Click Visitor service button twice','N/A','Visitor form opens on first click and collapses on second click','P2','UI'],
  ['TC-004','Employee UI','Guest form expands/collapses','On /employee','Click Guest service button twice','N/A','Guest form opens on first click and collapses on second click','P2','UI'],
  ['TC-005','Visitor Form','Default values for new visitor','MSAL account available','Open Visitor form','N/A','category=Visitor, countryCode=+91, host=submittedBy from logged-in account, status=new','P1','UI'],
  ['TC-006','Visitor Form','Submit single valid visitor','API and DB reachable','Fill required visitor fields; submit','Valid name/email/company/phone/purpose/host','POST /api/visitors succeeds and success toast appears','P0','E2E'],
  ['TC-007','Visitor Form','Multiple visitor entries in one submission','On Visitor form','Add Visitor; fill 2 entries; submit','Two valid visitors','Single API call with array payload creates both records','P0','E2E'],
  ['TC-008','Visitor Form','Autofill host/company/purpose/times to second entry','At least 2 visitor cards','Set first card fields; use duplicate icon on second card','Host, Company, Purpose, Tentative times','Second card receives copied values, toggling again clears copied values','P1','UI'],
  ['TC-009','Visitor Form Validation','Reject missing host','Visitor form open','Clear Host; submit','Host empty','Validation blocks submit and shows required-field alert','P0','Negative'],
  ['TC-010','Visitor Form Validation','Reject invalid India phone length','Visitor form open','Select +91; enter 9-digit local phone; submit','+91 + 123456789','Validation error: phone must be 10 digits','P0','Negative'],
  ['TC-011','Visitor Form Validation','Accept valid UK phone length','Visitor form open','Select +44; enter 10-digit local phone; submit','+44 + 1234567890','Submission passes phone validation','P1','Positive'],
  ['TC-012','Visitor Form Edit','Parse stored full phone into country code + local','Existing visitor has phone like +911234567890','Open visitor in edit mode','Stored phone +911234567890','Form pre-fills countryCode=+91 and phone=1234567890','P1','Regression'],
  ['TC-013','Guest Form','Default host and submittedBy behavior','MSAL account available','Open Guest form','N/A','host defaults to current user name; submittedBy uses user email','P1','UI'],
  ['TC-014','Guest Form','On-behalf-of host retention on account refresh','Guest form with onBehalfOf=true and custom host','Trigger account/context refresh','onBehalfOf=true, host=Another Employee','host remains custom value, not overwritten by SSO name','P1','E2E'],
  ['TC-015','Guest Form','Submit valid guest with required in/out time','API and DB reachable','Fill guest fields incl in/out time; submit','Valid guest payload','POST /api/guests succeeds and success toast appears','P0','E2E'],
  ['TC-016','Guest Form Validation','Reject non-digit phone input','Guest form open','Enter phone with letters/symbols; submit','98AB#12345','Validation blocks with message Phone must contain only digits','P0','Negative'],
  ['TC-017','Guest API','Create guest fails for non-array body','Backend running','Call POST /api/guests with object instead of array','{...guest}','HTTP 400 with Request body must be an array','P1','API Negative'],
  ['TC-018','Guest API','Meeting room email trigger','ACS env configured','Create guest with meetingRoomRequired=true','meetingRoomRequired=true','Meeting room email function is invoked and request still persists','P1','Integration'],
  ['TC-019','Guest API','Refreshment email trigger','ACS env configured','Create guest with refreshmentRequired=true and time','refreshmentRequired=true','Refreshment email function is invoked and guest saved','P1','Integration'],
  ['TC-020','Guest API','Wi-Fi email trigger','ACS env configured','Create guest with guestWifiRequired=true','guestWifiRequired=true','Wi-Fi email function is invoked and guest saved','P1','Integration'],
  ['TC-021','Adhoc Form','Submit valid adhoc visitor','API and DB reachable','Open /adhoc; fill fields including in/out time; submit','Valid adhoc payload','POST /api/adhoc succeeds and success toast appears','P0','E2E'],
  ['TC-022','Adhoc Form Validation','Reject missing tentative in/out time','Adhoc form open','Leave Tentative In/Out blank; submit','No times','Validation blocks with missing required fields alert','P0','Negative'],
  ['TC-023','Adhoc Form Validation','Reject invalid phone by country rule','Adhoc form open','Select +65; enter 7-digit local phone; submit','+65 + 1234567','Validation blocks because Singapore requires 8 digits','P0','Negative'],
  ['TC-024','Adhoc API','Adhoc Wi-Fi email trigger','ACS env configured','Create adhoc with guestWifiRequired=true','guestWifiRequired=true','sendAdhocWifiEmail invoked and record saved','P1','Integration'],
  ['TC-025','Security Fetch','Security page merges visitors+guests+adhoc','Records exist in all 3 collections','Open /security','N/A','Cards show combined list with source-aware behavior','P0','E2E'],
  ['TC-026','Security Polling','Auto-refresh every 5 seconds','Security page open','Create new visitor from another session; wait <=5s','N/A','New record appears without manual refresh','P1','E2E'],
  ['TC-027','Security Search','Search by full name/company','Security data loaded','Type query in search box','Name or company fragment','Only matching records remain visible','P1','UI'],
  ['TC-028','Security Filters','Status pills All/New/CheckedIn/CheckedOut','Mixed-status records exist','Click each status pill','N/A','Displayed count/list matches selected status','P1','UI'],
  ['TC-029','Security Consent','Block authorization when consent checkbox unchecked','Visitor status=new','Open consent modal; draw signature; keep checkbox unchecked; submit','N/A','Warning shown and status not updated','P0','Negative'],
  ['TC-030','Security Consent','Block authorization when signature canvas empty','Visitor status=new','Open consent modal; check consent; do not sign; submit','N/A','Warning shown: signature required','P0','Negative'],
  ['TC-031','Security Consent','Successful authorization writes encrypted signature','Visitor status=new','Check consent; sign canvas; submit','Signature strokes','Record updated to checkedIn with actualInTime and encrypted signature saved','P0','E2E'],
  ['TC-032','Security Checkout','Block checkout if badge surrender or host approval missing','Visitor status=checkedIn','Open checkout modal; keep one/both checkboxes false; checkout','N/A','Checkout prevented with warning message','P0','Negative'],
  ['TC-033','Security Checkout','Successful checkout updates status and flags','Visitor status=checkedIn','Open checkout; check both flags; submit','badgeSurrendered=true, hostApproved=true','Record status=checkedOut and actualOutTime captured','P0','E2E'],
  ['TC-034','Security Badge','Badge edit requires non-empty value','Visitor status=checkedIn','Open Edit Badge; leave blank; save','badgeNo=blank','Validation warning shown; no update call should complete','P1','Negative'],
  ['TC-035','Security Badge','Badge edit persists card number','Visitor status=checkedIn','Open Edit Badge; enter badge; save','UD-2026-001','cardNo updated and reflected on card','P1','E2E'],
  ['TC-036','Security Print','Print card availability for checkedIn only','One new and one checkedIn record','Inspect actions on both cards','N/A','Print Card button appears only for checkedIn records','P2','UI'],
  ['TC-037','Security Remove','Remove button visible only when new record overdue >24h','New records with inTime old/new','View new cards','inTime now-25h and now-2h','Remove button shown only for >24h overdue record','P1','UI'],
  ['TC-038','Security Remove','Guest overdue removal succeeds via /api/guests/:id/remove-ui','New overdue guest record','Click Remove and confirm','reason=Overdue > 24h and not authorized','Guest marked removed/uiRemoved=true and disappears from UI','P0','E2E'],
  ['TC-039','Security Remove','Adhoc overdue removal succeeds via /api/adhoc/:id/remove-ui','New overdue adhoc record','Click Remove and confirm','N/A','Adhoc marked removed/uiRemoved=true and disappears from UI','P0','E2E'],
  ['TC-040','Security Remove','Visitor overdue removal endpoint mismatch defect detection','New overdue visitor record','Click Remove and confirm','N/A','Current build fails removal for Visitor because UI calls /remove-ui while visitor route exposes /remove','P0','Defect'],
  ['TC-041','Security List Retention','CheckedOut older than 7 days hidden from cards','Record with actualOutTime older than 7 days','Open /security and inspect list','actualOutTime=now-8d','Record is excluded from visible card list','P1','Business Rule'],
  ['TC-042','Security Export','Export modal quick filters Today/Yesterday/Last7','Security page loaded','Open export dialog; click quick filters','today/yesterday/last7','Date inputs auto-populate and export count updates','P2','UI'],
  ['TC-043','Security Export','Export creates xlsx with selected filtered columns','Filtered visitors available','Set filters; click Download Excel','N/A','File Visitors_YYYY-MM-DD.xlsx downloads with mapped columns','P1','E2E'],
  ['TC-044','Security Export','Export dataset includes records hidden by 7-day UI filter (consistency check)','Have checkedOut record older than 7 days','Observe list count; export same filters','N/A','If export includes hidden records, raise consistency defect between UI and export dataset','P1','Defect'],
  ['TC-045','Server Health','Backend health endpoint reflects DB status','Server running','Call GET / and GET /api/health','N/A','Response includes status and current dbStatus','P1','API'],
  ['TC-046','DB Startup','Fail-fast startup on invalid MONGO_URI','Set invalid MONGO_URI','Start server','Bad URI','dbStatus becomes Connection Failed and process exits with error','P0','Negative'],
  ['TC-047','Reminder Job','Overstay reminder triggers after 90+ mins for checkedIn with outTime','CheckedIn visitor/adhoc with outTime in past >90m','Run overstay job once','outTime=now-100m','Reminder email sent and reminder flags updated','P0','Integration'],
  ['TC-048','Reminder Job','No duplicate reminder for same outTime','Record already reminder15Sent for same outTime','Run job again','reminder15Sent=true and reminder15SentForOutTime=outTime','No second email is sent','P1','Integration'],
  ['TC-049','Reminder Job','Reminder re-enabled when outTime changes','CheckedIn record previously reminded','Update outTime via PUT; run job after overdue window','New outTime value','Reminder flags reset by update logic and email can send again for new outTime','P1','Integration'],
  ['TC-050','Lifecycle E2E','Start-to-finish journey across modules','Frontend+Backend+DB+Email configured','Home to Employee create Visitor/Guest/Adhoc; Security authorize, edit badge, print, checkout; export report; run reminder checks','Representative realistic records','All core workflows complete with correct statuses, signature/card/export artifacts, and notifications','P0','Full E2E'],
];

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
ws['!cols'] = [
  { wch: 14 }, { wch: 18 }, { wch: 50 }, { wch: 34 }, { wch: 54 },
  { wch: 28 }, { wch: 62 }, { wch: 10 }, { wch: 14 }
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Top 50 Practical Cases');
const outputPath = path.resolve(__dirname, '..', '..', 'Top_50_Realistic_Test_Cases_VMS.xlsx');
XLSX.writeFile(wb, outputPath);

if (!fs.existsSync(outputPath)) {
  throw new Error('XLSX generation failed');
}

console.log(`Generated: ${outputPath}`);
