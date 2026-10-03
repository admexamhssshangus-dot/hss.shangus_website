# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): arrange individual award roll records by exam roll number in dictionary order to prevent repeating centre headers`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Automated Security, Admission, and SEO regression checks passed (`Exit Code 0`).

---

## Architectural Purpose & Issues Resolved

### Problem Statement
In individual practical award roll printouts (such as `INTERNAL PRACTICAL AWARD ROLL` for Class 12th Botany), when student records have Board Exam Roll Numbers assigned, the centre number header (e.g., `centre no. 301003` and `centre no. 301004`) was alternating and repeating back and forth dozens of times across the award sheet.

### Technical Root Cause Analysis
1. **Roster Sorting By Class Roll Number**:
   - In `PracticalsPage.jsx`, student records are loaded and default-sorted by Class Roll Number (`rollAsc`: 1, 2, 3, 4...).
   - In Class 12th, Class Roll 1 has Exam Roll `301003037` (Centre 301003), Roll 2 has `301003038` (Centre 301003), but Roll 3 is assigned to Centre 301004 (`301004055`), and Roll 4 returns to Centre 301003 (`301003039`).
2. **Missing Exam Roll Number Natural Dictionary Ordering**:
   - In JKBOSE examinations, the first 6 digits of the Exam Roll Number strictly represent the Examination Centre Code (e.g., `301003` vs `301004`).
   - When printing individual awards, neither `printIndividualAwardRoll` nor `PracticalsPage.jsx` was sorting student records by Exam Roll Number.
   - Because the centre header row checks `if (rCentre && rCentre !== currentCentre)`, each time the list alternated between student rolls of different centres, a new `centre no. XXXXXX` header was injected, cluttering the sheet and wasting vertical table rows.

---

## Changes Implemented

### 1. Robust Roll Extraction & Dictionary Sorting Engine
- File: [src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js)
  - **`getRecordExamRoll(r)`**: Robustly extracts clean, non-placeholder Exam Roll Numbers across all candidate keys (`examRollNo`, `Exam Roll No.`, `Exam R.No. (Current)`, `Exam Roll`, `Board Roll`, etc.).
  - **`getRecordClassRoll(r)`**: Robustly extracts clean Class Roll Numbers without mistaking 7-digit exam rolls.
  - **`getStudentCentreNo(st, fallbackCentre)`**: Prioritizes deriving the 6-digit Centre Code directly from `getRecordExamRoll(st)` so it always reflects the student's true examination centre.
  - **`sortRecordsForAwardRoll(recordsList)`**:
    - When students have Exam Roll Numbers, sorts them in dictionary / natural ascending order (`examA.localeCompare(examB, undefined, { numeric: true, sensitivity: 'base' })`).
    - Groups all records with the same centre prefix consecutively (e.g. all `301003xxx` contiguously, followed by all `301004xxx` contiguously).
    - Ensures the centre header (`centre no. XXXXXX`) appears **exactly once** at the beginning of each centre section and never repeats or alternates.
    - If Exam Roll Numbers are not given or for trailing students, cleanly falls back to Class Roll Number (numeric ascending), then Student Name.

### 2. Universal Integration in Individual Award Rolls
- File: [src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js)
  - In `printIndividualAwardRoll`, applied `records = sortRecordsForAwardRoll(records);` immediately at entry.
  - Derived unified column headers based on dataset-wide exam roll presence (`hasAnyExamRoll = records.some(...)`).
  - In `printAllIndividualAwardRolls`, sorted `subjectStudents` with `sortRecordsForAwardRoll` before pagination, guaranteeing that bulk award roll printing also eliminates repeating centre headers.

### 3. Teacher Portal Print Handler & Multi-Column Sorting
- File: [src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)
  - Imported `sortRecordsForAwardRoll` and `getRecordExamRoll`.
  - In `handlePrintAwardRoll`, sorted `studentMarks` using `sortRecordsForAwardRoll(studentMarks)` prior to generating print records.
  - In `sortedStudents`, added support for `sortBy === 'examAsc'` and `sortBy === 'examDesc'` with dictionary order comparisons.
  - Added `Exam R.No. ↑` and `Exam R.No. ↓` options to the teacher roster toolbar sort dropdown for effortless on-screen inspection.

---

## Verification & Build Results
- **Production Build**: Executed `npm run build` with `Exit Code 0`.
- **Static Asset Generation**: 11 public pages generated; canonical redirects, sitemap, and SEO regression checks passed with zero errors.
- **Firebase Security Rules**: Security rules remain compliant with RBAC isolation.

---

## Instructions for User

### Reviewing the Local Commit
To inspect the commit history:
```bash
git log -n 1 --stat
```

### Amending or Re-committing (Optional)
If you wish to edit or amend the commit:
```bash
git reset --soft HEAD~1
git commit -m "fix(practicals): arrange individual award roll records by exam roll number in dictionary order to prevent repeating centre headers"
```

### Pushing to Production
Per the strict project instructions, the AI assistant **never pushes to remote repositories**. Please deploy your verified changes to GitHub and Firebase Hosting by running:
```bash
git push origin main
```
