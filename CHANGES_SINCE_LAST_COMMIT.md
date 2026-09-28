# Changes Log & Commit Reference

## Current Working Changes

### Comprehensive Staff Document Suite Enhancements: More Columns Drawer, Direct Preview Editing, Compact Letterhead Layout & Common History Tab

- **User Requests Addressed:**
  1. *"show history common tab at above for all"*
  2. *"manage-comapct or group items so that whole letter card is visible"*
  3. *"allow editing/insertion in preivew mode also for letter"*
  4. *"show all other columns avaibale about staff under more columns"*

- **Implementation Details:**

  1. **All Available Staff Attributes Under "More Columns" ([CustomStaffRosterBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomStaffRosterBuilderView.jsx), [staffLetterMergeUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/staffLetterMergeUtils.js)):**
     - Expanded `MORE_STAFF_ROSTER_COLUMNS` and `ALL_STAFF_ROSTER_COLUMNS` with all 27 available faculty fields:
       - **Personal & Demographics:** Father's / Parent Name (`parentage`), Date of Birth (`dob`), Gender (`gender`), Social Category (`category`), Email Address (`email`), Govt. Mail ID (`gov_mail_id`).
       - **Service & Qualifications:** Date of 1st Appointment (`doj`), Designation at 1st Appt (`designation_at_first_appointment`), Stay Period / From (`stay_period`), Service Cadre (`cadre`), Qualifications (`qualification`), PG Subject (`subject_pg`), B.Ed Status (`bed`), Zone Name (`zone_name`), UDISE / DDO Code (`ddo_code`).
       - **Financial & Accounts:** Monthly Gross Salary (`monthly_salary`), Net Take-Home Salary (`net_salary`), TDS Paid (`tds`), Tax Regime (`tax_regime`), 80C Deductions (`deduction_80c`), 80D Deductions (`deduction_80d`), Bank Name (`bank_name`), IFSC Code (`ifsc`).
       - **Addresses & Postings:** Permanent Address (`permanent_address`), Present Address (`present_address`), Deployment Status (`if_deployed`), Health / Security Grounds (`health_issues`).
     - **UI Drawer:** Added expandable "More Staff Columns" drawer (defaulted to expanded) with search filter, active count pill, `Select All` and `Clear` shortcuts, and checkbox grid.
     - **Unified Cell Resolution:** Implemented `resolveStaffColumnValue` ensuring consistent data mapping across the UI live preview table, print iframe, Excel (.xlsx), and CSV exports.

  2. **Direct Editing & Insertion in Live Preview Mode ([StaffLetterheadWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffLetterheadWriterView.jsx)):**
     - Letter body container is now directly editable (`contentEditable={true}`) in both `Live Preview` mode and token edit mode.
     - Implemented `savedRangeRef` selection tracker so clicking any placeholder chip from the right column (`{{name}}`, `{{cpis}}`, `{{gross_salary}}`, etc.) or using formatting ribbon buttons (Bold, Italic, Lists, Alignments) directly inserts and formats at the cursor position in live preview mode without requiring the user to switch modes.

  3. **Ultra-Compact Viewport-Fitting Letter Card ([StaffLetterheadWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffLetterheadWriterView.jsx)):**
     - Compacted the 3-column layout to fit on standard laptop viewports without vertical scrolling.
     - Scaled center sheet (banner logo 26px, typography 10px–10.5px, compact line-heights, minimum height reduced to 360px) ensuring the crest, ref/date bar, letter body, signatory blocks, and watermark footer are fully visible on screen.
     - Consolidated left column controls into a unified compact card and condensed the right-side formatting toolbar into a clean single-row ribbon.

  4. **Common History Tab at Top Level ([SchoolAccountsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAccountsManager.jsx), [ClerkStaffDocumentsWorkspace.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/ClerkStaffDocumentsWorkspace.jsx)):**
     - Added a top-level `Dispatch History` tab to the global header in `SchoolAccountsManager.jsx` alongside `Staff Tax Calculator` and `Official Letterhead & Staff Rosters`.
     - Linked bidirectional sub-tab navigation with `initialSubTab` synchronization.

---

## Files Modified
- `src/portal/admin/SchoolAccountsManager.jsx`
- `src/portal/admin/ClerkStaffDocumentsWorkspace.jsx`
- `src/portal/admin/StaffLetterheadWriterView.jsx`
- `src/portal/admin/CustomStaffRosterBuilderView.jsx`
- `src/utils/staffLetterMergeUtils.js`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
feat(clerk): add more staff columns drawer, enable preview direct editing, compact letter layout, and top history tab
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
git commit -m "feat(clerk): add more staff columns drawer, enable preview direct editing, compact letter layout, and top history tab"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "feat(clerk): add more staff columns drawer, enable preview direct editing, compact letter layout, and top history tab"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
