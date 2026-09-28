# Changes Log & Commit Reference

## Current Working Changes

### 1. Clerk Portal: Dedicated Staff Establishment Directory & Cloud Sync with Permissions
- **User Request Addressed:**
  - *"i think faculty directory is relevant in clerk portal,....here in cms we can keep/show only those required on website academics etc.....note that edits submitted by cleark portal are saved to fierbase and integrated immediately....but ensure to ask proper permissions to cleark while he edits/save info....ensure old and new tax are updating correctly"*
  - *"make this check box style dropdown so that Target Staff 31/31 is not required....combine its functionalites here in check box drop down like search, ALL/clear; All, teaching/non teaching, NPS, GPF etc (allow to label NPS/GPFif not there already in staff info table)"*
  - *"why place holdes shown by brackets rathe show plus icon which wil show all avaible to chose from"*
  - *"make compact with multple column format or other techniques so that all is visible once on page"*

- **Detailed Changes Implemented:**
  1. **New First-Class "Staff Directory" Tab ([SchoolAccountsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAccountsManager.jsx)):**
     - Added `staff_directory` as the primary tab in the Clerk Portal navigation bar alongside Staff Tax Calculator, Official Letterhead & Mail Merge, Custom Staff Registers & Rosters, and Dispatch History.
     - Overview counter pills displaying real-time metrics: Total Staff, Teaching Faculty, Non-Teaching / MTS, NPS Scheme, GPF Scheme, Inactive / Deployed.
     - Real-time search across Name, CPIS ID, PAN Number, Phone, Designation, and Department with quick clear.
     - Filter tabs: `All`, `Teaching`, `Non-Teaching / MTS`, `NPS Scheme`, `GPF Scheme`, `Inactive / Deployed`.
     - High-density establishment table displaying S.No, Official Name & Designation, CPIS ID, PAN, Pension Scheme (interactive badge), Annual Gross Salary with monthly equivalent, Active Tax Regime, and Live Side-by-Side Tax (New vs Old).
     - Single-click CSV export of complete establishment registry.
  2. **Comprehensive Staff Establishment & Tax Modal ([SchoolAccountsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAccountsManager.jsx)):**
     - Allows accounts clerk to edit full employee particulars: Name, Designation, Department/Subject, Cadre (Teaching vs Non-Teaching), CPIS ID, PAN Number, Phone/Mobile, Pension Scheme (NPS / GPF toggle buttons), and Deployment Status.
     - Payroll & Gross Salary inputs with automatic monthly equivalent display and TDS tracking.
     - Deductions & Exemptions section covering 80C (up to ₹1.5L), 80D (Health Insurance), HRA Exemption, and 80CCD(2) Employer NPS contribution.
     - **Live Side-by-Side Tax Comparison (New vs Old)**: Recomputes both New Tax Regime (Sec 115BAC) and Old Tax Regime tax in real time as the user types or adjusts salary/deductions, showing taxable incomes, total annual tax, net tax due after TDS, and an automatic recommendation banner highlighting which regime saves more money with a 1-click "Apply Cheaper Regime" action.
  3. **Clerk Security & Authorization Confirmation Modal ([SchoolAccountsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAccountsManager.jsx)):**
     - Prevents accidental edits or overwrites by requiring explicit clerk verification before writing to Firebase Cloud.
     - Displays an authorization summary with the staff member's name, designation, CPIS, and a table of exact field modifications (Previous Value vs New Value).
     - Upon confirmation, atomically commits private faculty to Firestore (`systemSettings/facultyPrivate`), updates public cache (`hss_public_faculty`), broadcasts cross-tab sync (`hss_data_sync`), and records audit trails in admin activity logging.
  4. **Multi-Select Checkbox Dropdown in Letterhead Studio ([StaffLetterheadWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffLetterheadWriterView.jsx)):**
     - Replaced native single-select dropdown and removed redundant 31/31 Target Staff card from left panel.
     - Floating multi-select checkbox dropdown combines search by name/CPIS/PAN, `All` / `Clear` selection buttons, category filter pills (`All`, `Teach`, `MTS`, `NPS`, `GPF`), checkboxes for merge inclusion, and row selection for active preview.
     - Interactive **NPS / GPF Badge**: Allows labeling or toggling pension scheme directly from the dropdown row with instant cloud synchronization.
  5. **`[+] Insert Variable` Floating Popover ([StaffLetterheadWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffLetterheadWriterView.jsx)):**
     - Removed raw bracket placeholder rows from the left panel.
     - Added an intuitive `[+] Insert Variable` toolbar button triggering a categorized popover (`Identity & Particulars`, `Salary & Banking`, `Service & Establishment`, `Dispatch & Session`) with instant variable search.
  6. **Compact Multi-Column Roster Studio ([CustomStaffRosterBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomStaffRosterBuilderView.jsx)):**
     - Converted column pickers into compact 3-to-4 column responsive grids so all columns and options fit on screen without excessive scrolling.
  7. **Academic Faculty Notice Banner in CMS ([AdminPortal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/pages/AdminPortal.jsx)):**
     - Added a clean top banner in CMS Faculty tab clarifying that public website academic profiles are managed there, while master establishment records (CPIS, PAN, NPS/GPF, and tax) are managed in the Clerk Portal, with a 1-click button to open the Clerk Staff Directory.
  8. **Unified Pension Helper ([staffPensionHelper.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/staffPensionHelper.js)):**
     - Created unified helper module for pension scheme resolution and immutable employee updates across all components.

---

## Files Modified & Added
- `src/portal/admin/SchoolAccountsManager.jsx` (New Staff Directory tab, full establishment modal, clerk permission modal, live side-by-side tax comparison, cloud persistence)
- `src/portal/admin/StaffLetterheadWriterView.jsx` (Checkbox-style staff dropdown with NPS/GPF labeling, `[+] Insert Variable` popover, left panel optimization)
- `src/portal/admin/CustomStaffRosterBuilderView.jsx` (Compact 3-4 column grid layout for column selectors and roster builder)
- `src/pages/AdminPortal.jsx` (Informational notice banner in CMS Faculty tab pointing to Clerk Portal)
- `src/utils/staffPensionHelper.js` (Unified NPS/GPF pension scheme determination and mutation utility)
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
feat(accounts): integrate staff establishment directory into clerk portal with firebase sync and compact multi-select dropdown
```

---

## How to Review or Manually Manage Commits

### To review staged changes before commit:
```bash
git diff --staged
```

### If you want to commit manually:
```bash
git add .
git commit -m "feat(accounts): integrate staff establishment directory into clerk portal with firebase sync and compact multi-select dropdown"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "feat(accounts): integrate staff establishment directory into clerk portal with firebase sync and compact multi-select dropdown"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
