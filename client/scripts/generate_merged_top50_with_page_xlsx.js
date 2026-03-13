const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const headers = [
  'SL No',
  'Page',
  'Real World Scenario',
  'Steps',
  'Expected Results',
  'Priority',
  'Type',
  'Source'
];

const rows = [
  ['HP-1','Home Page','User lands on VMS home','Open app URL','Home page appears with Employee Login and Security Login buttons','P0','Smoke','Image'],
  ['HP-2','Home Page','Employee login navigation','Click Employee Login','Navigates to Employee page with Visitor and Guest options','P0','Smoke','Image'],
  ['HP-3','Home Page','Security login navigation','Click Security Login','Navigates to Security page and starts loading visitor cards','P0','Smoke','Image'],
  ['HP-4','Home Page','Logo visibility and placement','Open home page','UD logo is visible at top-left and clickable','P2','UI','Image'],
  ['HP-5','Home Page','Responsive behavior on mobile','Open page on mobile viewport','Layout adapts without overlap or clipping','P1','UI','Image'],

  ['EMP-1','Employee Page','Visitor form access','Click Register Visitor','Visitor form opens','P0','Smoke','Image'],
  ['EMP-2','Employee Page','Guest form access','Click Register Guest','Guest form opens','P0','Smoke','Image'],
  ['EMP-3','Employee Page','Logo navigation to home','Click UD logo','Redirects to Home page','P1','Navigation','Image'],
  ['EMP-4','Employee Page','Home button navigation','Click Home button','Redirects to Home page','P1','Navigation','Image'],
  ['EMP-5','Employee Page','Navbar welcome text','Login to employee module','Welcome message displays with username','P2','UI','Image'],

  ['VF-1','Visitor Form','Required fields visible','Open Visitor form','Required fields (name, company, host, purpose, phone, in/out time) are available','P0','UI','Image'],
  ['VF-2','Visitor Form','Empty submit validation','Keep mandatory fields empty and submit','Validation errors appear and submission is blocked','P0','Negative','Image'],
  ['VF-3','Visitor Form','Invalid email validation','Enter malformed email and submit','Email validation error appears','P1','Negative','Image'],
  ['VF-4','Visitor Form','Phone validation with alphabets','Enter alphabetic phone and submit','Phone validation error appears','P0','Negative','Image'],
  ['VF-5','Visitor Form','Valid visitor submission','Fill valid data and submit','Visitor is created successfully and success message appears','P0','E2E','Merged'],
  ['VF-6','Visitor Form','In/Out time consistency','Set In Time later than Out Time','Appropriate validation message is shown','P1','Negative','Image'],
  ['VF-7','Visitor Form','Cancel behavior','Enter partial data and click Cancel','Form closes or resets without saving record','P2','Usability','Image'],
  ['VF-8','Visitor Form','Multi-visitor add flow','Click Add Another Visitor and fill second entry','New visitor block appears; multiple visitors submit in one request','P0','E2E','Merged'],
  ['VF-9','Visitor Form','Autofill duplicate icon behavior','Copy Host/Company/Purpose/Times to next card','Selected values copy to next card; second click clears copied values','P1','Functional','Generated'],
  ['VF-10','Visitor Form','Edit existing visitor phone parsing','Open visitor in edit mode with full international phone','Country code and local number are parsed correctly in fields','P1','Regression','Generated'],

  ['GF-1','Guest Form','Required fields visibility','Open Guest form','Required fields and optional toggles are visible','P0','UI','Image'],
  ['GF-2','Guest Form','Refreshment toggle behavior','Enable refreshment switch','Refreshment time field appears','P1','Functional','Image'],
  ['GF-3','Guest Form','Empty submit validation','Submit guest form without required data','Validation errors shown and submit blocked','P0','Negative','Image'],
  ['GF-4','Guest Form','Invalid guest email validation','Enter invalid email and submit','Error message displayed','P1','Negative','Image'],
  ['GF-5','Guest Form','Invalid phone validation','Enter invalid phone and submit','Validation error displayed','P0','Negative','Image'],
  ['GF-6','Guest Form','Valid guest submission','Fill valid guest data and submit','Guest record created successfully','P0','E2E','Merged'],
  ['GF-7','Guest Form','Meeting room toggle behavior','Enable meeting-room-required switch','Meeting room field appears','P1','Functional','Image'],
  ['GF-8','Guest Form','Add multiple guests flow','Click Add Another Guest and submit array payload','Multiple guest records are created in one submission','P0','E2E','Merged'],
  ['GF-9','Guest Form','On behalf host retention','Set onBehalfOf and custom host, then refresh account context','Custom host remains unchanged when onBehalfOf is true','P1','Regression','Generated'],

  ['ADH-1','Adhoc Page','Open adhoc form','Click Add Adhoc/Ad-hoc button','Adhoc form opens','P0','Smoke','Image'],
  ['ADH-2','Adhoc Page','Required field validation','Submit adhoc form without mandatory values','Validation errors appear','P0','Negative','Image'],
  ['ADH-3','Adhoc Page','Successful adhoc entry','Submit valid adhoc data','Adhoc visitor is added successfully','P0','E2E','Image'],
  ['ADH-4','Adhoc Page','Adhoc phone country-rule validation','Select country code and enter invalid length','Phone validation blocks submit with rule-specific message','P1','Negative','Generated'],
  ['ADH-5','Adhoc Page','Adhoc Wi-Fi email trigger','Submit adhoc with Guest Wi-Fi required','Adhoc saved and Wi-Fi email flow is triggered','P1','Integration','Generated'],

  ['SEC-1','Security Page','View merged registered visitors','Open Security page','Visitor/Guest/Adhoc records render in unified cards','P0','E2E','Image'],
  ['SEC-2','Security Page','Authorize visitor opens consent','Click Authorize on New record','Consent form opens for reading and approval','P0','Functional','Image'],
  ['SEC-3','Security Page','Consent checkbox validation','Submit consent without checking checkbox','Error appears: Consent Required','P0','Negative','Image'],
  ['SEC-4','Security Page','Signature required validation','Submit consent without signature','Error appears: Signature Required','P0','Negative','Image'],
  ['SEC-5','Security Page','Clear signature pad','Draw signature then click Clear Signature','Signature pad resets to blank','P2','Usability','Image'],
  ['SEC-6','Security Page','Successful check-in flow','Check consent, sign, and submit','Status changes to CheckedIn, actualInTime saved, encrypted signature stored','P0','E2E','Merged'],
  ['SEC-7','Security Page','Badge assignment after check-in','Click Edit Badge and save valid value','Badge number persists and shows on card','P1','Functional','Image'],
  ['SEC-8','Security Page','View visitor details card content','Open Security cards and inspect fields','Name, category, host, purpose, company, time and status display correctly','P1','UI','Image'],
  ['SEC-9','Security Page','Checkout modal access','Click Check Out on checked-in record','Checkout modal opens','P0','Functional','Image'],
  ['SEC-10','Security Page','Checkout validation - host approval','Submit checkout without Host Approved','Error message displayed; checkout blocked','P0','Negative','Image'],
  ['SEC-11','Security Page','Checkout validation - badge surrendered','Submit checkout without Badge Surrendered','Error message displayed; checkout blocked','P0','Negative','Image'],
  ['SEC-12','Security Page','Successful checkout','Select both required checkboxes and submit checkout','Status changes to CheckedOut and actualOutTime saved','P0','E2E','Image'],
  ['SEC-13','Security Page','Export to Excel access','Click Export to Excel button','Export modal opens with date filters','P1','Functional','Image'],
  ['SEC-14','Security Page','Date range export filtering','Select From/To date and click download','Downloaded Excel contains records within selected range','P1','E2E','Image'],
  ['SEC-15','Security Page','Overdue remove visibility rule','Keep record in New state for >24 hours','Remove button is visible only for overdue new records','P1','Business Rule','Merged'],
  ['SEC-16','Security Page','Overdue remove action (Guest/Adhoc)','Click Remove on overdue Guest/Adhoc and confirm','Record marked uiRemoved and disappears from Security list','P0','E2E','Merged'],
  ['SEC-17','Security Page','Search by name/company','Search with partial name or company','Matching visitor cards are filtered and shown','P1','Functional','Image'],
  ['SEC-18','Security Page','Decrypted signature display','Authorize visitor and revisit card','Signature image is displayed correctly from encrypted value','P1','Regression','Image'],
  ['SEC-19','Security Page','Network/server error handling','Disconnect backend or fail endpoint during fetch/update','User sees friendly error and app does not crash','P0','Resilience','Image'],

  ['NAV-1','Navbar','Role-based visibility','Login as employee/security context','Correct buttons/actions are visible for the page context','P1','UI','Image'],
  ['SYS-1','Backend/API','Health endpoint and DB status','Call / and /api/health','Status response includes backend state and DB connectivity','P1','API','Generated'],
  ['SYS-2','Scheduler/Email','Overstay reminder (90+ mins) and no duplicate send','Run job for checkedIn record past outTime+90 mins twice','First run sends reminder and sets flags; second run for same outTime does not resend','P0','Integration','Generated']
];

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
ws['!cols'] = [
  { wch: 10 },
  { wch: 16 },
  { wch: 42 },
  { wch: 44 },
  { wch: 58 },
  { wch: 10 },
  { wch: 14 },
  { wch: 12 }
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Top 50 Merged Cases');

const outputPath = path.resolve(__dirname, '..', '..', 'Top_50_Merged_Best_Test_Cases_VMS.xlsx');
XLSX.writeFile(wb, outputPath);

if (!fs.existsSync(outputPath)) {
  throw new Error('Failed to generate Top_50_Merged_Best_Test_Cases_VMS.xlsx');
}

console.log(`Generated: ${outputPath}`);
