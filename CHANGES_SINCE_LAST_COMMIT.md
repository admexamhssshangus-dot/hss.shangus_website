# Changes Log & Commit Reference

## Current Working Changes

### 1. Official Letter Writer: Classified Template Selector, Duplicate & Overwrite Support
- **User Requests Addressed:**
  - *"make comapct overall....arrange all controls of left and right to left in a compact manner avoiding repetition and making desing minimal..... and preview to right...allow to overwrite template and generated new after duplicating earlier adn modifying it"*
  - *"resume all"*
- **Detailed Changes Implemented ([OfficialLetterWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialLetterWriterView.jsx)):**
  1. **Classified Template Dropdown with Category Groups:**
     - Replaced the repetitive list of template cards with a compact, structured `<select>` dropdown organized by `<optgroup>` categories (General, Orders & Circulars, Certificates, Financial, Custom Presets).
     - Displayed live badge count of all available templates and an italic description preview for the selected template.
  2. **1-Click Duplicate Template Action:**
     - Added a `Duplicate` button next to the template selector. When clicked, it copies the current template's subject, body, salutation, reference prefix, and department into a new draft preset, opens the save modal, and allows instant customization.
  3. **1-Click Overwrite Custom Template Action:**
     - When an active template is a user-created custom template, an `Overwrite` button is prominently displayed in the header. Clicking it updates the existing custom template in-place without creating redundant duplicates.
  4. **Compact Minimal Controls Alignment:**
     - Harmonized the template selector card, quick document inserts, and actions bar to fit neatly within the left controls panel without vertical overflow or visual clutter.

---

### 2. Official Letterhead Studio: 2/3 Horizontal Letterhead & Right Controls Layout
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

### 3. Top Navigation & Studio Header Cleanup ([AdminDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminDashboard.jsx))
- **Detailed Changes Implemented:**
  - Suppressed redundant admissions sync button in top header bar when inside Document Studio, Custom Roster, and Roster Builder views (`activeTab in ['customRoster', 'docStudio', 'roster']`), avoiding unnecessary background polling when working on static document templates.

---

## Files Modified
- `src/portal/admin/AdminDashboard.jsx`: Context-aware suppression of redundant admissions sync button in document studio tabs.
- `src/portal/admin/OfficialLetterWriterView.jsx`: Classified template selector dropdown, 1-click Duplicate, 1-click Overwrite, compact left controls layout.
- `src/portal/admin/StaffLetterheadWriterView.jsx`: 2/3 letterhead layout on left, 1/3 controls on right, dynamic pager index, upward-opening variable picker, categorized template select.
- `src/portal/admin/SchoolAccountsManager.jsx`: Full establishment modal fields (Cadre, Qualification, PRAN/GPF, Bank, DOJ, Parentage), expandable details drawer, delete/retire handler, safe index matching.
- `src/portal/admin/CustomStaffRosterBuilderView.jsx`: Compact multi-column roster design.
- `src/utils/staffLetterMergeUtils.js`: Dedicated merge variables and data resolution utilities.
- `CHANGES_SINCE_LAST_COMMIT.md`: Documentation of changes, commit message, and manual push guidance.

---

## Local Commit Message
```bash
perf(admin): refine top sub-nav cloud sync visibility and finalize studio workflows
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
