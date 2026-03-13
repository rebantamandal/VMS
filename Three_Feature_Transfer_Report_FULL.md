# Three-Feature Implementation Report (From Scratch, Final Behavior = Current App)

Date: 2026-02-20  
Goal: Assume the app starts without these 3 features and implement them exactly as they work now.

Critical constraint: Do not switch auth/environment to local-dev mode. If the target app already uses Azure MSAL SSO (or any existing enterprise auth flow), keep that setup exactly as-is and add these features on top.

---

## Scope (implement exactly these)

1. Autofill in all three forms
   - Forms: Adhoc, Guest, Visitor
   - Field-level copy/clear icon buttons
   - Copy source is always entry #1 (index 0)
2. Phone validation
   - Country-specific phone length checks
   - Validate before submit in all three forms
   - Submit payload uses concatenated value: `countryCode + phone`
3. Security page one-week cleanup
   - Hide checked-out records older than 7 days in UI only
   - Keep export dataset complete (no 7-day removal in export dataset)

Also include the visual/UI changes used by these features.

Do not alter existing authentication strategy, tenant config, login flow, token handling, or environment model just to add these features.

---

## Files to modify

- `client/src/components/AdhocForm.js`
- `client/src/components/GuestForm.js`
- `client/src/components/VisitorForm.js`
- `client/src/components/security.js`
- `client/src/utils/phoneUtils.js`
- `client/src/App.css`
- `client/src/images/duplicate.png` (new asset)

Auth/environment note:
- If your app already uses MSAL/Azure SSO, keep using MSAL/Azure SSO.
- Do not replace SSO-based user resolution with localStorage-only mock logic.
- Reuse existing identity variables (`accounts`, token claims, current user context) already present in that app.

---

## 1) Phone validation (implement first)

### 1.1 Create/replace `client/src/utils/phoneUtils.js`

Use this exact code:

```javascript
// Simple phone number validator by country code.
// Expects `countryCode` like "+91" and `localNumber` containing digits only (no + or country code).
export const PHONE_RULES = {
  "+91": { min: 10, max: 10, name: "India" },
  "+1": { min: 10, max: 10, name: "USA/Canada" },
  "+44": { min: 9, max: 10, name: "UK" },
  "+61": { min: 9, max: 9, name: "Australia" },
  "+81": { min: 9, max: 10, name: "Japan" },
  "+971": { min: 9, max: 9, name: "UAE" },
  "+65": { min: 8, max: 8, name: "Singapore" },
  "+66": { min: 9, max: 9, name: "Thailand" },
  "+86": { min: 11, max: 11, name: "China" },
  "+27": { min: 9, max: 9, name: "South Africa" },
  "+49": { min: 10, max: 12, name: "Germany" },
  "+33": { min: 9, max: 9, name: "France" },
  // default fallback: accept 7-15 digits
};

export function validatePhoneLength(countryCode, localNumber) {
  if (!localNumber) return { valid: false, message: "Phone number is required" };

  // Normalize: remove spaces, dashes, parentheses
  const normalized = String(localNumber).replace(/[^0-9]/g, "");

  if (!/^[0-9]+$/.test(normalized)) {
    return { valid: false, message: "Phone must contain only digits" };
  }

  const rule = PHONE_RULES[countryCode];
  if (rule) {
    const len = normalized.length;
    if (len < rule.min || len > rule.max) {
      if (rule.min === rule.max) {
        return {
          valid: false,
          message: `Phone for ${rule.name} must be ${rule.min} digits`,
        };
      }
      return {
        valid: false,
        message: `Phone for ${rule.name} must be between ${rule.min} and ${rule.max} digits`,
      };
    }
    return { valid: true };
  }

  // Fallback: E.164 local length between 7 and 15
  if (normalized.length < 7 || normalized.length > 15) {
    return { valid: false, message: "Phone length must be between 7 and 15 digits" };
  }

  return { valid: true };
}
```

---

## 2) Autofill + phone integration in forms

### 2.1 Add autofill icon asset

- Add image file: `client/src/images/duplicate.png`
- This icon is used by all field-level autofill buttons.

### 2.2 Required imports in each form

In each of these files:
- `client/src/components/AdhocForm.js`
- `client/src/components/GuestForm.js`
- `client/src/components/VisitorForm.js`

ensure both imports exist:

```javascript
import { validatePhoneLength } from "../utils/phoneUtils";
import duplicateIcon from "../images/duplicate.png";
```

### 2.3 Required state in each form

Add:

```javascript
const [autofillStates, setAutofillStates] = useState({});
```

### 2.4 Required helper + `handleChange` behavior

Use this pattern in all three forms (Guest includes `category`, others do not):

```javascript
const getAutofillStateKeyForField = (field) => {
  switch (field) {
    case "host":
      return "host";
    case "category":
      return "category"; // GuestForm only
    case "company":
      return "company";
    case "purposeOfVisit":
      return "purpose";
    case "TentativeinTime":
    case "TentativeoutTime":
      return "times";
    default:
      return null;
  }
};

const handleChange = (index, field, value) => {
  setVisitorsOrGuests((prev) => {
    const updated = prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );

    if (index !== 0 || editModeObject) return updated;

    const autofillStateKey = getAutofillStateKeyForField(field);
    if (!autofillStateKey) return updated;

    return updated.map((item, i) => {
      if (i === 0) return item;
      return { ...item, [field]: value };
    });
  });
};
```

Final behavior of this logic:
- If user edits first entry (index 0) and field is autofill-managed, that value propagates to all later entries.
- Propagation is disabled in edit mode (`visitorToEdit` / `guestToEdit`).

### 2.5 Phone validation before submit

#### AdhocForm

In `validate()`:

```javascript
const phoneCheck = validatePhoneLength(v.countryCode, v.phone);
if (!phoneCheck.valid) {
  temp.phone = phoneCheck.message;
}
```

Also keep required in/out checks.

#### GuestForm

Before submit loop:

```javascript
for (const g of guests) {
  const phoneCheck = validatePhoneLength(g.countryCode, g.phone);
  if (!phoneCheck.valid) {
    setLoading(false);
    Swal.fire({ icon: "error", title: "Invalid phone", text: phoneCheck.message });
    return;
  }
}
```

#### VisitorForm

In `validate()`:

```javascript
const phoneCheck = validatePhoneLength(v.countryCode, v.phone);
if (!phoneCheck.valid) {
  temp.phone = phoneCheck.message;
}
if (!v.countryCode || v.countryCode.trim() === "") {
  temp.countryCode = "Country code is required";
}
if (!v.host || v.host.trim() === "") {
  temp.host = "Host is required";
}
```

### 2.6 Submit payload must concatenate country code + phone

In all three forms, payload uses:

```javascript
phone: `${item.countryCode}${item.phone}`
```

### 2.7 Exact UI behavior for autofill buttons

Implement in each form:

- Button shown only when:
  - not editing (`!visitorToEdit` / `!guestToEdit`)
  - multiple entries exist (`length > 1`)
  - entry index is not first (`index > 0`)
- Color state:
  - `btn-success` = copy mode
  - `btn-danger` = clear mode
- Button style (same across forms):

```javascript
style={{
  width: "40px",
  height: "40px",
  padding: "0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
}}
```

- Icon style:

```javascript
style={{ width: "20px", height: "20px" }}
```

Fields with individual copy/clear buttons:
- Host
- Company (Guest shows Company / Address)
- Purpose of Visit
- Category (Guest only)

Times behavior:
- Single button for both `TentativeinTime` and `TentativeoutTime`
- Copy both from first entry when inactive
- Clear both when active

Header/delete UX behavior:
- Entry title becomes clickable collapsible target (`style={{ cursor: "pointer" }}`)
- When collapsed and `index > 0`, show `Delete Entry` button
- When expanded and `index > 0`, show bottom `Delete Entry` full-width button

---

## 3) Security page: one-week cleanup in UI only

File: `client/src/components/security.js`

### 3.1 Add/keep helper function

```javascript
const isCheckoutOlderThanWeek = (v) => {
  const checkoutTime = v.actualOutTime || v.outTime;
  if (!checkoutTime) return false;
  const checkoutMs = new Date(checkoutTime).getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - checkoutMs > oneWeekMs;
};
```

### 3.2 Keep dual datasets in state

```javascript
const [filteredVisitors, setFilteredVisitors] = useState([]);
const [exportFilteredVisitors, setExportFilteredVisitors] = useState([]);
```

### 3.3 Filtering useEffect (exact behavior)

- Start both datasets from `visitors`
- Apply status filter to both
- Apply search filter to both
- Apply date filter to both
- Apply one-week removal only to UI dataset

Critical line:

```javascript
result = result.filter((v) => !isCheckoutOlderThanWeek(v));
```

Final assignment:

```javascript
setFilteredVisitors(result);
setExportFilteredVisitors(exportResult);
```

### 3.4 Export must use export dataset (not UI dataset)

In `exportToExcel`:

```javascript
const exportData = exportFilteredVisitors.map((v) => ({
  "First Name": v.firstName || "",
  "Last Name": v.lastName || "",
  ...(v.source === "visitor" && { Company: v.company || "-" }),
  Category: v.category || "-",
  Purpose: v.purposeOfVisit || "-",
  "Visitor ID": v.cardNo || "-",
  "Tentative In": v.inTime ? new Date(v.inTime).toLocaleString() : "-",
  "Actual Check-In": v.actualInTime ? new Date(v.actualInTime).toLocaleString() : "-",
  "Actual Check-Out": v.actualOutTime ? new Date(v.actualOutTime).toLocaleString() : "-",
  Status: v.status?.toUpperCase() || "-",
  "Badge Surrendered": v.badgeSurrendered ? "Yes" : "No",
  "Host Approved": v.hostApproved ? "Yes" : "No",
  Signed: v.displaySignature ? "Yes" : "No",
}));
```

This is what guarantees:
- UI hides records checked-out older than one week
- Export still includes them when other filters match

---

## 4) Visual/CSS changes to keep feature parity

### 4.1 `client/src/App.css` background updates

Set:

```css
.homepage {
  background: url("./images/Key\ Visual\ 2.jpg") no-repeat center center/cover;
}

.service-page {
  background: url("./images/staffbg.jpg") no-repeat center center/cover;
}
```

### 4.2 Form visual behavior tied to features

These are part of the implemented UX and should remain:
- Autofill icon button dimensions: 40x40
- Icon image dimensions: 20x20
- Times section shown as grouped “Tentative In & Out Time” row with right-side autofill button
- Entry cards support collapse/expand by clicking heading
- Delete action text: `Delete Entry`

### 4.3 Security page visual note

Current import in security page:

```javascript
import securitybg from "../images/staffbg.jpg";
```

Keep this to match current screen background.

---

## 5) Final acceptance checklist (must all pass)

1. In Adhoc/Guest/Visitor forms, adding multiple entries shows copy/clear icon buttons on entries 2+.
2. Clicking green button copies from first entry; clicking again (red state) clears target field(s).
3. Editing first entry updates same autofill-managed fields in later entries (when not in edit mode).
4. Phone validation blocks submit with country-specific messages.
5. Submit payload stores phone as combined `countryCode + phone`.
6. Security page list does not show checked-out records older than 7 days.
7. Export still includes records that are hidden from UI due to 7-day rule.
8. App backgrounds and small autofill icon visuals match current UI.

---

## 6) Transfer order (recommended)

1. Add `phoneUtils.js`
2. Add `duplicate.png`
3. Update `AdhocForm.js`
4. Update `GuestForm.js`
5. Update `VisitorForm.js`
6. Update `security.js`
7. Update `App.css`
8. Run end-to-end manual checks from checklist above

End of report.
