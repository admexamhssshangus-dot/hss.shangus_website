# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `feat(practicals): fully enable Class 10th practicals across print engines, exports, and admin controls`
- **Date**: October 02, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally.

---

## Architectural Purpose & Issues Resolved

### 1. Comprehensive Class 10th Secondary Examination Print Engine Integration
- **Problem**:
  - `PRACTICAL_SUBJECT_DEFS` in `src/utils/practicalsPdfGenerator.js` was missing secondary core subjects: `SC` (Science), `SS` (Social Science), and `AD` (Art and Drawing).
  - Print functions (`printConsolidatedAwardRoll`, `printAttendanceSheet`, `printMarksRecordAwardRoll`, `printAllIndividualAwardRolls`, `printFailList`) hardcoded `hseText = className === '11th' ? 'HSE-I (Class 11th)' : 'HSE-II (Class 12th)'`, incorrectly branding Class 10th awards as `"HSE-II (Class 12th)"`.
  - The teacher submission query target `clsTarget = isClass12 ? '12' : '11'` defaulted Class 10th queries to `'11'`, failing to retrieve submitted marks for Class 10th examinees.
- **Solution**:
  - Registered `SC`, `SS`, and `AD` into `PRACTICAL_SUBJECT_DEFS` with comprehensive keywords.
  - Updated all print engines with `isClass10` check to stamp the official Board title: `"Secondary School Examination (Class 10th)"` (while preserving `"HSE-I"` and `"HSE-II"` for Higher Secondary).
  - Configured `clsTarget = isClass10 ? '10' : isClass12 ? '12' : '11'`, ensuring teacher marks submissions are fetched accurately for Class 10th.

### 2. Full Spreadsheet Import & Export Compatibility for Class 10th
- **Problem**:
  - In `src/utils/practicalsCsvManager.js`, `VALID_SUBJECT_CODES` and `defaultSubDefs` lacked `SC`, `SS`, and `AD`.
  - Both matrix and flat row spreadsheet parsers executed `cls = clsRaw.toLowerCase().includes('12') ? '12th' : '11th'`, converting all imported Class 10th files to Class 11th.
  - Word export (`exportConsolidatedAwardsToDocx`) stamped `partText` as `'Part-II (class 12th)'` for Class 10th.
- **Solution**:
  - Registered `SC`, `SS`, `AD`, `HN`, `CS`, `MU` in `VALID_SUBJECT_CODES` and `defaultSubDefs`.
  - Updated both spreadsheet parsers: `const cls = clsRaw.toLowerCase().includes('10') ? '10th' : clsRaw.toLowerCase().includes('12') ? '12th' : '11th'`.
  - Set Word export `partText` to `'Secondary School (class 10th)'`.

### 3. Complete Admin Settings & Teacher Permissions for Class 10th
- **Problem**:
  - In `src/portal/admin/AdminPracticals.jsx`, the permission granting form only had `<option value="11th">` and `<option value="12th">`, preventing administrators from authorizing teachers for Class 10th subjects.
  - `SubjectMarksSettingsCard` only had `['11th', '12th']` in the class switcher, preventing configuration of Class 10th minimum/maximum marks.
  - Print Document Defaults in settings only mapped `['11th', '12th']`, leaving no configuration interface for Class 10th incharge and session details.
  - Initial settings state lacked `maxMarks10`, `nonPractical10`, and `printDetails['10th']`.
- **Solution**:
  - Added `<option value="10th">Class 10th</option>` to the teacher permission granting select dropdown.
  - Added `'10th'` to `SubjectMarksSettingsCard` class switcher (`['10th', '11th', '12th']`), and synchronized `legacyMax10` during updates and official reset.
  - Added Class 10th Non-Practical Subjects configuration input (`nonPractical10`) and integrated it into `AwardsSummaryView`.
  - Added Class 10th Print Headers card (`['10th', '11th', '12th'].map(...)`) with customizable Institution Name, Session Text, Incharge Name, CPIS, and Mobile number.

---

## Files Changed

1. `src/utils/practicalsPdfGenerator.js`: Added `SC`, `SS`, `AD` to `PRACTICAL_SUBJECT_DEFS`, updated `hseText` and `clsTarget` for Class 10th across all 5 print engines, and cleaned unused variables.
2. `src/utils/practicalsCsvManager.js`: Added `SC`, `SS`, `AD`, `HN`, `CS`, `MU` to `VALID_SUBJECT_CODES` and `defaultSubDefs`, updated matrix and flat row spreadsheet parsers for `'10th'`, and updated DOCX `partText` and `clsTarget`.
3. `src/portal/admin/AdminPracticals.jsx`: Added Class 10th defaults to initial `settings`, added Class 10th to `SubjectMarksSettingsCard` switcher & sync, added Class 10th to `Target Class` permission select, added Class 10th non-practical subjects input, and added Class 10th Print Document Defaults card.

---

## Verification & Build Details
- **Production Build**:
  - `npm run build` -> `Exit Code 0` (Zero breaking errors).

---

## Instructions for User

### 1. Inspect the Local Commit
```bash
git log -n 1 --stat
```

### 2. Manually Amend / Re-commit (Optional)
```bash
git reset --soft HEAD~1
# Make desired changes
git add .
git commit -m "feat(practicals): fully enable Class 10th practicals across print engines, exports, and admin controls"
```

### 3. Manually Push to Remote Repository
```bash
git push origin main
```
