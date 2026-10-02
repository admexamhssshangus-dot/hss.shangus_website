# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): resolve English nomenclature for Class 10th across UI, exports, and print engines`
- **Date**: October 02, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally.

---

## Architectural Purpose & Issues Resolved

### 1. Class-Aware Subject Nomenclature (English vs General English)
- **Problem**:
  - In JKBOSE board curriculum standards:
    - **Class 10th (Secondary)** uses **"English"** as the official core compulsory subject.
    - **Class 11th & 12th (Higher Secondary)** use **"General English"**.
  - Previously, `EN` mapped statically to `"General English"` throughout the portal. In Class 10th Award rolls, Target Subject selectors, Attendance sheets, Marks record prints, Excel exports, and School Assessments, it incorrectly displayed as `EN - General English`.
- **Resolution**:
  - Implemented `getSubjectDisplayName(codeOrName, cls)` in `src/utils/practicalsSettingsManager.js` that dynamically resolves `English` for Class 10th / 9th (secondary) and `General English` for Class 11th / 12th (higher secondary).
  - Integrated `getSubjectDisplayName` across:
    1. **Target Subject Controls & Awards Menu**: The dropdown now displays `EN - English` for Class 10th, and action buttons dynamically label as `Print Marks Record — English`, `Print Attendance Sheet — English`, `Print 2-Column Award Roll — English`, and `Export Blank Roster (.xlsx) — English`.
    2. **PDF Print Engines**:
       - Attendance sheets: `${hseText} — English (EN)`
       - Marks Record (Practicals / Assignments): `Class 10th - Marks Record (Practicals/Assignments) - English`
       - Official 2-Column Award Rolls: `Subject: English (EN)`
       - Consolidated cover letter and Hash Total Matrix: `English`
       - Fail / Absent defaulters list: `English (EN)`
       - Individual worksheets and single award rolls: `English (EN)`
    3. **Spreadsheet & Document Exports**:
       - Excel consolidated workbook (`exportConsolidatedAwardsToExcel`): `English` for Class 10th.
       - Word document export (`exportConsolidatedAwardsToWord`): `English` for Class 10th.
       - Blank teacher roster export (`exportCurrentRosterToExcel`): `English` for Class 10th.
    4. **Admin Dashboard Controls & School Assessments**:
       - `SubjectMarksSettingsCard`: displays `English` when Class 10th tab is selected.
       - `SchoolAssessmentsHub`: displays `English [EN]` when configuring overrides for Class 10th.
       - Permissions manager & submissions log: accurately displays `Class 10th • English (EN)`.

---

## Files Changed

1. `src/utils/practicalsSettingsManager.js`:
   - Added and exported `getSubjectDisplayName(codeOrName, cls)` with class-aware secondary/higher-secondary distinction.
2. `src/portal/admin/AdminPracticals.jsx`:
   - Updated `AwardsSummaryView` subject target dropdown, filter badges, and print labels to use `getSubjectDisplayName`.
   - Updated `SelectedSubmissionModal`, `FacultySubmissionsView`, `SubjectMarksSettingsCard`, and `SettingsPermissionsView`.
3. `src/portal/admin/SchoolAssessmentsHub.jsx`:
   - Updated subject override options and override builder to resolve `English` for Class 10th.
4. `src/utils/practicalsPdfGenerator.js`:
   - Updated all print engines (`printAttendanceSheet`, `printMarksRecordAwardRoll`, `printAllIndividualAwardRolls`, `printConsolidatedAwardRoll`, `printFailList`, `printIndividualAwardRoll`, `printIndividualWorkSheet`) to output `English` for Class 10th.
5. `src/utils/practicalsCsvManager.js`:
   - Updated Excel, Word, and blank roster exports to use `English` for Class 10th.

---

## Verification & Build Details
- **Production Build**:
  - `npm run build` -> `Exit Code 0` (Zero breaking errors).

---

## Instructions for User

### Reviewing the Local Commit
To inspect the changes made in this commit:
```bash
git log -n 1 --stat
git show HEAD
```

### Amending or Re-committing (Optional)
If you wish to make additional adjustments before pushing:
```bash
git reset --soft HEAD~1
# Make desired adjustments
git add .
git commit -m "fix(practicals): resolve English nomenclature for Class 10th across UI, exports, and print engines"
```

### Pushing Changes
Whenever you are ready to update the remote repository, run:
```bash
git push origin main
```
*(As per repository safety guidelines, remote git pushes are performed exclusively by the user.)*
