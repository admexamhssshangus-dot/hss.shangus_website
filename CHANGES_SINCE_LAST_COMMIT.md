# Changes Since Last Commit

## Commit Message

`fix(catalog): fix empty initial state, eliminate duplicate controls & resolve double print windows`

## Files Changed

1. **[src/portal/admin/OfficialDocumentCatalogView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/OfficialDocumentCatalogView.jsx)**
   - **Resolved Empty Initial State**:
     - Set default `timeRange` to `'all'` ("All Records (All-Time Archive)") so opening the Despatch Register & Catalog view immediately presents all issued documents without being restricted by narrow date boundaries.
     - Calibrated academic session date boundaries (`academic_2025_26` extended through 31 Dec 2026 to align with the J&K Kashmir school cycle, and added `academic_2026_27` through 31 Mar 2027), ensuring all 2026 documents are included when filtering by academic session.
     - Enhanced `parseRecordDate` to support Firestore Timestamp instances (`.toDate()`, `.toMillis()`, `.seconds * 1000`) in addition to string formats.
   - **Removed Duplicacies**:
     - Removed the duplicate `Refresh` button in the catalog toolbar; the single universal Refresh button in the modal header remains the clean single point of refresh.
     - Renamed `All 4 Modules` tab to `All Documents ({stats.total})` and added the `Admissions ({stats.admissions})` module filter pill and KPI card so all 51 documents are cleanly classified and accounted for.
     - Added `cleanHtmlEntities` to unescape HTML entities (`&nbsp;`, `&amp;`, `&quot;`, `&#39;`, etc.) from subject lines, titles, and recipient strings so raw HTML entities like `&nbsp; &nbsp;` never render in the UI, Excel, or print outputs.
   - **Fixed Double Print Window / Tab**:
     - Replaced `window.open('', '_blank')` in `handlePrintCatalog` with an isolated offscreen hidden iframe (`#despatch-catalog-print-frame`) with a single-run `hasPrinted` execution guard, preventing popup tabs from appearing and ensuring only one print dialog opens directly on screen.

2. **[src/utils/beneficiaryPrintUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/beneficiaryPrintUtils.js)**
   - **Fixed Race Condition Double Print Window**:
     - Added `hasPrinted` boolean guard and cleared `fallbackTimer` when `logoImg.onload` executes. This guarantees `triggerPrint()` is only called once, eliminating the double print dialogs when printing from the Beneficiary Studio.

3. **[src/services/docHistoryService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/docHistoryService.js)**
   - **Enhanced Subject Entity Cleaning**:
     - Updated `cleanSubjectString` to decode all standard HTML entities (`&nbsp;`, `&amp;`, `&quot;`, `&#39;`, `&lt;`, `&gt;`) and collapse extraneous whitespace before saving and resolving document records.

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
git commit -m "fix(catalog): fix empty initial state, eliminate duplicate controls & resolve double print windows"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant does not push automatically. When you are ready, please push the commit manually:
```bash
git push origin main
```
