# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): fix subject counting, group excel tools, add marks record award roll print and prevent reg no page break`
- **Date**: October 02, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally.

---

## Architectural Purpose & Enhancements

### 1. Subject Counting Integrity & Cross-Contamination Audits
- **Problem**: In the Practicals Cover Letter subject gist summary and table matrices, Education (`ED`) was erroneously reporting 113 students for Class 12th despite only 91 Arts/Commerce students being enrolled.
- **Root Cause**: Raw keyword substring matching without stream guards caused Science students with Physical Education (`PED`/`PE`), students with words like `medical`/`med`, and subjects containing substrings like `studied` to falsely match `ED`.
- **Solution**:
  - Replaced raw regex/keyword looping in `printConsolidatedAwardRoll`, `exportConsolidatedAwardsToExcel`, and `exportConsolidatedAwardsToDocx` with the canonical `isStudentEnrolledInPracticalSubject` validator.
  - Stripped non-subject tokens (`NON-MED`, `MED`, `STUDIED`, `APPLIED`) before testing for `ED`.
  - Disentangled Persian (`PE`) from Physical Education (`PD`): removed flawed alias `if (code === 'PE' && abbrList.includes('PD')) return true;` so Physical Education students are never falsely counted under Persian.
  - Guarded Science students against Arts electives (`ED`, `HT`, `PS`, `SO`, `AR`, `PR`, `SC`).

### 2. Grouped Excel Tools (Template & Import into Single Dropdown)
- **Problem**: Separate `[Template]` and `[Import Excel]` buttons took up excessive horizontal space in the top navigation ribbon of `AdminPracticals.jsx`.
- **Solution**:
  - Combined both actions into a sleek, unified `[Excel ▾]` dropdown menu with outside-click detection.
  - Provides quick access to:
    1. **Import Excel / CSV Marks**: Launches `CsvImportModal`.
    2. **Download Excel Template (.xlsx)**: Downloads the official spreadsheet template with prefilled instructions and subject codes.
    3. **Download CSV Template (.csv)**: Downloads lightweight comma-separated template.
  - Added a direct "Need the standard template? Download Excel Template" link inside `CsvImportModal` for maximum user convenience.

### 3. Subject Marks Record Award Roll Printing
- **Problem**: Teachers and administrators needed to print evaluation award rolls with specific evaluation columns (`Pract Copy / Assignment`, `Viva Voce`, `Total`) without the Subject or Candidate Signature columns.
- **Solution**:
  - Added a dedicated `[Award Roll]` button directly beside the `[Attendance]` button in the `AwardsSummaryView` toolbar of `AdminPracticals.jsx`.
  - Added a corresponding option inside the `[Awards / Export ▾]` dropdown.
  - Implemented `printMarksRecordAwardRoll` in `practicalsPdfGenerator.js`:
    - Exactly 7 institutional columns: `S.No.`, `Class R.No.`, `Exam Roll No.`, `Student Name` (with Board Reg No), `Pract Copy / Assignment`, `Viva Voce`, and `Total`.
    - Document header & print title formatted per institutional standard: `${className} - Marks Record (Practicals/Assignments) - ${subjectName}`.
    - Dynamically displays evaluation marks from teacher submissions or leaves neat blank entry cells for offline evaluation records.
    - Handles single-subject printing and multi-subject batch printing with clean `@media print` page breaks.

### 4. Page Break Fix: Registration Number & Row Fragmentation
- **Problem**: In Chromium/Edge print preview, rows near the bottom of a page (e.g. row 59 `Hamid Manzoor Bhat`) would split across page boundaries: the name remained on the first page, while `Reg: 2301000000610005` spilled onto the next page under an orphan table header.
- **Root Cause**: In Blink/Chromium, tables with `border-collapse: collapse;` ignore `page-break-inside: avoid` on `<tr>` and `<td>` (Chromium Bug 278327). Additionally, non-monolithic child boxes allow the fragmentation engine to break between name and registration number.
- **Solution**:
  - Configured `border-collapse: separate !important; border-spacing: 0 !important;` on `.award-table`, `.attendance-table`, `.matrix-table`, and `.gist-table` with clean 1px border mapping, enabling Chromium to strictly respect `tr` and `td` pagination boundaries.
  - Wrapped student names and registration numbers in `<div class="student-name-block">` configured as a monolithic box (`display: block !important; width: 100% !important; overflow: hidden !important; break-inside: avoid !important; page-break-inside: avoid !important;`).
  - Switched row height to `46px` on `<tr>` instead of hardcoded `height: 50px` on every `<td>`, ensuring entire rows move cleanly to the next page as a single indivisible unit.

---

## Files Changed & Synchronizations Completed

### 1. `src/utils/practicalsPdfGenerator.js`
- Enforced `border-collapse: separate !important; border-spacing: 0 !important;` in `PRINT_ENGINE_CSS` for all tables.
- Made `.student-name-block` monolithic with `display: block; overflow: hidden; break-inside: avoid !important;`.
- Updated `printAttendanceSheet` and `printMarksRecordAwardRoll` row layouts.
- Added exported function `printMarksRecordAwardRoll` generating 7 columns with institutional header and marks binding.
- Updated gist and matrix enrolled checks to use canonical `isStudentEnrolledInPracticalSubject`.
- Refined subject abbreviations and stream isolation for `ED`, `PE`/`PD`, `HT`/`HTC`.

### 2. `src/utils/practicalsCsvManager.js`
- Updated `gistCounts` in `exportConsolidatedAwardsToExcel` and `gistList` in `exportConsolidatedAwardsToDocx` to use `isStudentEnrolledInPracticalSubject(st, sub.code, className)`.
- Cleaned up loop scopes and syntax.

### 3. `src/portal/admin/AdminPracticals.jsx`
- Imported `printMarksRecordAwardRoll`.
- Updated `isStudentEnrolledInSubject` to strip `STUDIED` and `APPLIED` tokens for `ED`.
- Added `showExcelMenu` and `excelMenuRef` state with outside-click listener.
- Replaced separate `[Template]` and `[Import Excel]` buttons with unified `[Excel ▾]` dropdown in the top header ribbon.
- Added `[Award Roll]` button next to `[Attendance]` in `AwardsSummaryView` toolbar.
- Added `Print Marks Record Award Roll` in `Awards / Export` dropdown.
- Added direct template download link inside `CsvImportModal`.

---

## Verification & Build Details
- **Production Build**:
  - `npm run build` -> `Exit Code 0`
  - All 11 static pages, SEO regression check, and bundle chunks verified.

---

## Instructions for User

### 1. Inspect the Local Commit
To inspect the local commit:
```bash
git log -n 1 --stat
```

### 2. Manually Amend / Re-commit (Optional)
If you wish to adjust the commit message or files before pushing:
```bash
git reset --soft HEAD~1
# Make desired changes
git add .
git commit -m "fix(practicals): fix subject counting, group excel tools, add marks record award roll print and prevent reg no page break"
```

### 3. Push to Remote Repository (Manual Action)
As per institutional policy, the assistant never pushes to remote repositories:
```bash
git push origin main
```
