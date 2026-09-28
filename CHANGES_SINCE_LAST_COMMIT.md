# Changes Log & Commit Reference

## Current Working Changes

### 1. Official Letterhead Studio: 2/3 Horizontal Letterhead & Right Controls Layout
- **User Requests Addressed:**
  - *"make letter 2/3 horizontallly and controls to right"*
  - *"moreover 31/31 remains static than 1/31, then 2/31 so on"*
  - *"popup shall not be hidden"*
  - *"where are other templates here"*
- **Detailed Changes Implemented:**
  1. **2/3 Horizontal Layout & Full Width Coverage ([StaffLetterheadWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffLetterheadWriterView.jsx)):**
     - Reordered studio workspace: The Official A4 Letterhead Preview is positioned on the **Left** occupying 2/3 of the horizontal screen width (`lg:col-span-8`).
     - Removed restrictive `max-w-[620px]` constraint and expanded canvas padding to `w-full p-4 sm:p-7`, allowing the letterhead document to fully cover the entire 2/3 studio area without unnecessary empty side margins.
     - All studio controls (Template selection, Ref No, Dispatch Date, Signatories, Printing, Word Export, Rich-Text formatting toolbar, and Insert Variable action) are consolidated on the **Right** occupying 1/3 width (`lg:col-span-4`).
  2. **Dynamic Staff Pager Index:**
     - Updated the preview counter badge from static `31/31` to dynamic relative index `${previewEmployeeIndex + 1}/${selectedEmployees.length}` (e.g., `1/31`, `2/31`, etc.), correctly reflecting the currently previewed official as the clerk steps through the staff.
  3. **Upward-Opening Insert Variable Popover:**
     - Modified the `[+] Insert Variable` popup to open **upward** (`bottom-full mb-1.5 z-[100]`) with responsive max-height and scrolling, ensuring it never clips beneath the viewport or gets hidden by letterhead containers.
  4. **Categorized Template Dropdown & Template Count:**
     - Added a clean badge showing the total count of loaded templates (`{templates.length} Templates`).
     - Organized the `<select>` options by official categories (Certificates, Service, Conduct, No Objection, Custom) and added an italic description preview beneath the selector.

---

### 2. End-to-End Staff Establishment Directory ([SchoolAccountsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAccountsManager.jsx))
- **User Request Addressed:**
  - *"staff directory needs attension again end to end"*
- **Detailed Changes Implemented:**
  1. **Extended Establishment Fields in Edit & Enrollment Modal:**
     - Added support for all core establishment fields:
       - **Service Particulars:** Service Cadre (Teaching / Ministerial / MTS), Highest Qualification (e.g. M.Sc, B.Ed, M.A), Date of 1st Joining / Appointment (DOJ), and Deployment Status (Regular / Deployed In / Deployed Out).
       - **Accounts & Banking:** Bank Account Number, Bank IFSC Code, PRAN / GPF Account Number, and Pension Scheme (NPS / GPF toggle).
       - **Bio & Contact:** Parentage (Father / Mother / Guardian), Date of Birth (DOB), Phone/Mobile, and Email Address.
       - **Tax & Payroll:** Gross Salary, TDS Deducted, Active Tax Regime, 80C, 80D, HRA Exemption, and 80CCD(2) Other Deductions with real-time reactive side-by-side tax recomputation and 1-click "Apply Cheaper Regime".
  2. **Expandable Establishment Particulars Row Drawer:**
     - Clicking on an official's name or the chevron expands an inline establishment dossier drawer directly under the table row without leaving the directory view.
     - Neatly categorizes data into 4 cards: *Service Particulars*, *Accounts & Banking*, *Contact & Bio*, and *Tax & Deductions Summary*.
  3. **Staff Removal / Retirement Lifecycle Action:**
     - Added a delete/retire action button in the directory table that routes through the Clerk Authorization modal before updating Firebase `systemSettings/facultyPrivate`.
  4. **Robust Identification & Index Resolution:**
     - Replaced fragile array index references with multi-attribute lookup matching `id`, `cpis_no`, `pan`, and `name` to guarantee zero state corruption during active search or category filtering.
  5. **Shared Mail Merge Utilities ([staffLetterMergeUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/staffLetterMergeUtils.js)):**
     - Unified token extraction, merge variable resolution, currency formatting, and pension scheme helpers across Letterhead, Roster Builder, and School Accounts Manager.

---

## Files Modified
- `src/portal/admin/StaffLetterheadWriterView.jsx`: 2/3 letterhead layout on left, 1/3 controls on right, dynamic pager index, upward-opening variable picker, categorized template select.
- `src/portal/admin/SchoolAccountsManager.jsx`: Full establishment modal fields (Cadre, Qualification, PRAN/GPF, Bank, DOJ, Parentage), expandable details drawer, delete/retire handler, safe index matching.
- `src/portal/admin/CustomStaffRosterBuilderView.jsx`: Compact multi-column roster design.
- `src/utils/staffLetterMergeUtils.js`: Dedicated merge variables and data resolution utilities.
- `CHANGES_SINCE_LAST_COMMIT.md`: Documentation of changes, commit message, and manual push guidance.

---

## Local Commit Message
```bash
feat(studio): layout 2/3 letter preview on left, right controls, dynamic staff pager, and end-to-end staff establishment directory
```

---

## Instructions for User: Review & Push
All changes have been built and verified locally (`npm run build` completed with Exit Code 0).

To push these changes to remote GitHub:
```bash
git push origin main
```

If you wish to inspect or modify the commit before pushing:
```bash
# View last commit details
git log -1 -p

# To undo commit while keeping all changes staged:
git reset --soft HEAD~1

# To re-commit with a customized message:
git commit -m "your custom message"
```
