# Changes Log & Commit Reference

## Current Working Changes

### Clerk Portal Official Letterhead, Mail Merge & Custom Staff Rosters Suite
- **User Request Addressed:**
  - *"add new functionality inside this clerk portal about official letter head besides Staff Tax Calculator, as already on separate module similar is working.....this will be for clerk only....aslo this this will see only his history of created letters and documents....here cleark will be able to add variable like name, cpis etc that and will be able to create document for each employee like mail merge manner but it will allow to chose which employees to fetch/use for print....actually some times we need custom list/letters to build for selected or all employees....so we need here functionalites like student rosters and registers and official letter head writer customeised for employees data"*

- **Implementation Details:**
  1. **New Clerk Sub-Tab in School Accounts Manager ([SchoolAccountsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAccountsManager.jsx)):**
     - Mounted a dedicated sub-tab button **"Official Letterhead & Staff Rosters"** (`activeTab === 'staff_documents'`) directly beside `Staff Tax Calculator` in the accounts clerk header bar.
     - Labeled with a distinct amber badge `CLERK` for clear role demarcation.

  2. **Unified Workspace ([ClerkStaffDocumentsWorkspace.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/ClerkStaffDocumentsWorkspace.jsx)):**
     - Houses 3 specialized sub-views:
       - 📝 **Official Letterhead & Mail Merge**
       - 📋 **Custom Staff Registers & Rosters**
       - 🕒 **Clerk Dispatch History**
     - Provides an interactive snapshot modal for viewing and re-printing past letters and rosters.

  3. **Official Staff Letterhead Writer & Mail Merge ([StaffLetterheadWriterView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffLetterheadWriterView.jsx)):**
     - **Rich Text Editor:** WYSIWYG ribbon for formatting (Bold, Italic, Underline, Justify, Lists, Tables, Clean format).
     - **Employee Mail Merge Variable Chips:** Quick-click chips that inject placeholder tokens directly at cursor:
       `{{name}}`, `{{designation}}`, `{{cpis}}`, `{{pan}}`, `{{department}}`, `{{gross_salary}}`, `{{monthly_salary}}`, `{{bank_account}}`, `{{bank_name}}`, `{{ifsc}}`, `{{mobile}}`, `{{doj}}`, `{{ref_no}}`, `{{date}}`.
     - **Selective Staff Picker:** Search filter, category filters (All Staff, Teaching, Non-Teaching), and multi-select checkboxes allowing the clerk to choose which staff members to generate documents for.
     - **Live A4 Letterhead Preview:** Real-time preview card rendering the official school banner, insignia, reference number, date, and resolved employee variables for any selected staff member.
     - **Batch Print Engine:** Batch merges all selected employees into a unified print stream with automatic CSS page breaks (`page-break-after: always; break-after: page;`) so every employee's letter prints on a separate clean page.
     - **Built-in Staff Templates:**
       1. *Salary & Service Verification Certificate*
       2. *No Objection Certificate (NOC)*
       3. *Duty Assignment & Relieving Order*
       4. *Experience & Conduct Certificate*
       5. *Blank Institutional Letterhead*

  4. **Custom Staff Rosters & Registers Builder ([CustomStaffRosterBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomStaffRosterBuilderView.jsx)):**
     - **Column Matrix Selector:** Toggle standard columns (S.No, CPIS, Name, Designation, Department, PAN, Gross Salary, Bank Account, Mobile, Remarks).
     - **Custom Blank / Sign-Off Columns:** Clerk can add custom columns with custom titles (e.g. *Signature*, *Exam Duty Room*, *Stationery/Uniform Issued*, *Thumb Impression*).
     - **Layout Controls:** Portrait and Landscape orientation toggle, repeating table headers on every page, and footer summary row with staff count and gross salary aggregates.
     - **Multi-Format Exports:** 1-Click Browser Print / PDF, Excel (`.xlsx`), and CSV download.

  5. **Mail Merge Engine & Roster Exporters ([staffLetterMergeUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/staffLetterMergeUtils.js)):**
     - Pure helper functions for resolving and interpolating employee variables safely.
     - Batch print iframe execution with official letterhead styling.
     - Excel and CSV generation using `xlsx`.

  6. **Clerk-Scoped Cloud History & Firebase Security Rules ([firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules)):**
     - History is strictly scoped to the Accounts Clerk (`authorScope: 'accounts_clerk'`), separating clerk dispatches from principal or teacher certificates.
     - Updated Firestore security rules for `generatedDocumentHistory` and `documentHistory` to permit accounts module users to delete and archive records.
     - Successfully deployed security rules to Firebase via `npm run deploy:rules`.

---

## Files Modified & Added
- `src/portal/admin/SchoolAccountsManager.jsx`
- `src/portal/admin/ClerkStaffDocumentsWorkspace.jsx` *(New)*
- `src/portal/admin/StaffLetterheadWriterView.jsx` *(New)*
- `src/portal/admin/CustomStaffRosterBuilderView.jsx` *(New)*
- `src/utils/staffLetterMergeUtils.js` *(New)*
- `firestore.rules`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
feat(portal): add clerk official letterhead writer with mail merge, staff roster builder, and scoped history
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
git commit -m "feat(portal): add clerk official letterhead writer with mail merge, staff roster builder, and scoped history"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "feat(portal): add clerk official letterhead writer with mail merge, staff roster builder, and scoped history"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
