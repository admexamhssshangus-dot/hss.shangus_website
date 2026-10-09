# Changes Since Last Commit

## Commit Message

`feat(catalog): add 1-click toggle to hide/unhide admission forms in history & print`

## Files Changed

1. **[src/portal/admin/OfficialDocumentCatalogView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialDocumentCatalogView.jsx)**
   - **1-Click Hide/Unhide Admission Forms in One Go**:
     - Added `hideAdmissionForms` state (defaulted to `true`) so the Official Despatch Register immediately presents a clean, authentic institutional ledger of outward documents (Letters, Certificates, Sanctions, ID Cards) rather than being flooded by routine student admission forms.
     - Derived `activeTimeFilteredRecords`, `availableAccounts`, `sectionCounts`, and `catalogRecords` dynamically based on the toggle. When hidden, section counts (e.g. Admissions & Examinations) accurately count genuine certificates/ID cards rather than dozens of admission intake forms.
     - Added a prominent 1-click toggle button in Row 1 of the toolbar: `[EyeOff] Admissions Hidden (X)` / `[Eye] Admissions Shown (X)` with instant toast confirmation and zero reload.
     - In Row 2, conditionally rendered the `Admissions` module filter tab only when admissions are unhidden and exist in the period.
   - **History & Register Print Integration**:
     - Updated `handlePrintCatalog` so that printing the register directly honors `hideAdmissionForms`. When hidden, all admission form items are completely excluded from the printed table, and the summary KPI header omits admissions, producing a clean, professional outward despatch register.
     - Included an informative banner indicator in print when admissions are excluded.
   - **Excel Export Integration**:
     - Updated `handleExportExcel` to dynamically reflect hidden admission counts in the Summary Statistics sheet without corrupting or breaking exported sheets.

2. **[src/portal/admin/DocumentHistoryModal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/DocumentHistoryModal.jsx)**
   - **Archive Cards 1-Click Hide/Unhide Control**:
     - Added `hideAdmissionForms` state (defaulted to `true`) in the Archive Cards view.
     - Filtered `categoryCounts` and `filteredRecords` so that admission application forms are cleanly omitted in one go by default, while remaining 100% accessible whenever toggled.
     - Added 1-click toggle pill `[EyeOff] Admissions Hidden (X)` / `[Eye] Admissions Shown (X)` in the archive toolbar and modal header count badge (`X Saved (Y Hidden)`).
     - Conditionally rendered the `Admissions` tab in the archive category selector when unhidden.

---

## Instructions for the User

### 1. How to Review the Local Commit
You can review the changes and commit log locally:
```bash
git log -1 --stat
git show HEAD
```

### 2. How to Amend or Re-commit (Optional)
If you wish to edit the commit message or make adjustments:
```bash
git reset --soft HEAD~1
# Make desired adjustments...
git add .
git commit -m "feat(catalog): add 1-click toggle to hide/unhide admission forms in history & print"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant does not push automatically. When you are ready, please push the commit manually:
```bash
git push origin main
```
