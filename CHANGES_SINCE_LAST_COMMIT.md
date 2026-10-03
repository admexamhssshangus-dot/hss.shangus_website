# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): enforce current official exam roll numbers and centre codes across practicals`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Automated Jest tests passed (`24/24 passed`, `Exit Code 0`).

---

## Architectural Purpose & Issues Resolved

### Problem Statement
1. **Old Redundant Exam Roll Numbers Overwriting Official Board Rolls**:
   - In the **Practicals & Award Rolls Portal**, student records (such as Rohit Chidanand Raina, Class 12th Roll 111) were displaying old redundant placeholders (e.g. `201000224`), despite having received official JKBOSE Board exam roll numbers (e.g. `301004100`) synchronized into `admissions` and `masterRegisters` (chunk 118).
   - In `AdminPracticals.jsx` (Step 3 of `loadData`), practical submissions ingested from `practicalsData` were blindly overwriting existing students' canonical `examRollNo` and `'Exam R.No. (Current)'` with stale numbers from submission records created before the official board roll sync.
2. **Cross-Class Exam Roll Leaks**:
   - Students in Class 12th were sometimes displaying old rolls starting with `2` (Class 11th series) or `1` (Class 10th series) stored in historical fields.
   - Students in Class 11th were sometimes displaying previous Class 10th rolls starting with `1`.
3. **Official Examination Centre Alignment**:
   - As per JKBOSE examination structure for Session 2025–26:
     - **Class 10th**: Exactly **1 Centre** (`101061`, exam rolls starting with `101061...`).
     - **Class 11th**: Exactly **2 Centres** (`201003` and `201004`, exam rolls starting with `201003...` and `201004...`).
     - **Class 12th**: Exactly **2 Centres** (`301003` and `301004`, exam rolls starting with `301003...` and `301004...`).
   - The system lacked a strict, class-aware validator to reject old/redundant series and ensure that centre codes are consistently derived from the official 6-digit prefix.
4. **Stale Records in Live Firestore Practicals Collection**:
   - Across 40 practical documents in `practicalsData` for session 2025–26, 2,878 student records still contained the old placeholder rolls from initial draft submissions.

---

## Changes Implemented

### 1. Centralized Official Exam Roll & Centre Resolution Utilities
- File: [src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js)
  - Added `isValidExamRollForClass(roll, targetClass)`:
    - Strictly enforces prefix validation (`1` for 10th, `2` for 11th, `3` for 12th).
    - Prevents old/previous class rolls from leaking into current class awards.
  - Added `getCurrentOfficialExamRoll(st, targetClass)`:
    - Rigorously prioritizes current official board roll fields: `currExamRollNo`, `currExamRoll`, `boardRollNo`, `Exam R.No. (Current)`, followed by class-specific keys.
    - Rejects stale/redundant placeholders and previous-class rolls.
  - Updated `getStudentCentreNo(st, fallbackCentre, targetClass)`:
    - Derives the official 6-digit centre code from the validated current exam roll number.
    - Ensures Class 10th resolves to centre `101061`, Class 11th to `201003` / `201004`, and Class 12th to `301003` / `301004`.
  - Updated `getRecordExamRoll(r, targetClass)`:
    - Proxies directly to `getCurrentOfficialExamRoll` so all PDF generators, award rolls, foils, and cut lists receive the official current roll.

### 2. Admin Practicals Portal Normalization & Overwrite Protection
- File: [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)
  - In `normalizeStudentFields`: Uses `getCurrentOfficialExamRoll` to extract authentic current exam rolls during ingestion.
  - In `addOrMergeStudent`: Compares candidates using class-validated rolls, protecting official live admission and master register rolls from being replaced.
  - In `loadData` (Step 3 - Practical Submissions Ingestion):
    - **Fixed Ingestion Bug**: Prevents practical submission records from overwriting a student's canonical exam roll. Only adopts a submission exam roll if the student currently lacks an exam roll AND the submission roll is valid for the class series.
  - In `AwardsSummaryView`:
    - Table rendering now resolves `getCurrentOfficialExamRoll(st, cls)`, correctly displaying Rohit Chidanand Raina as `301004100` (Centre `301004`).
    - Search filter and column sorting now match against the current official exam roll.

### 3. Teacher Portal Parity
- File: [src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)
  - Updated `getExamRoll(st, selectedClass)` to use `getCurrentOfficialExamRoll(st, selectedClass)`.
  - Guarantees teachers evaluating marks in Teacher Workspace and Teacher Assessments see authentic current board rolls.

### 4. Excel & Word Export Synchronization
- File: [src/utils/practicalsCsvManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsCsvManager.js)
  - Updated `exportCurrentRosterToExcel`, `exportConsolidatedAwardsToExcel`, and `exportConsolidatedAwardsToWord` to use `getCurrentOfficialExamRoll(st, className)` for both display and export columns.

### 5. Firestore Database Healing & Synchronization
- Executed migration script: [scripts/sync_canonical_exam_rolls_to_practicals.mjs](file:///d:/Shk_Gulfam/Projects/hss_shangus/scripts/sync_canonical_exam_rolls_to_practicals.mjs)
  - Scanned all 2025–26 documents in `practicalsData`.
  - Updated 40 practical documents and 2,878 student records in live Firestore, replacing outdated series (`201000...`) with official JKBOSE Board exam rolls (`101061...` for 10th, `201003...`/`201004...` for 11th, `301003...`/`301004...` for 12th).

### 6. Automated Unit Tests
- File: [src/portal/teacher/PracticalsPage.test.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.test.jsx)
  - Added unit test suite `Official Exam Roll Resolution & Centre Code Derivation`:
    - Tests class prefix validation (`10th`, `11th`, `12th`).
    - Verifies resolution of current official roll and rejection of stale/previous class rolls.
    - Verifies single centre for 10th and dual centres for 11th and 12th.
  - All 24 tests passed with `Exit Code 0`.

---

## Files Changed
- `src/utils/practicalsPdfGenerator.js` (Modified)
- `src/portal/admin/AdminPracticals.jsx` (Modified)
- `src/portal/teacher/PracticalsPage.jsx` (Modified)
- `src/utils/practicalsCsvManager.js` (Modified)
- `src/portal/teacher/PracticalsPage.test.jsx` (Modified)
- `scripts/sync_canonical_exam_rolls_to_practicals.mjs` (Added)
- `scripts/analyze_2025_26_centres.mjs` (Added)
- `scripts/audit_outdated_practicals_rolls.mjs` (Added)
- `scripts/inspect_exam_rolls_and_centres.mjs` (Added)
- `scripts/inspect_rohit_details.mjs` (Added)
- `scripts/find_201000224.mjs` (Added)
- `CHANGES_SINCE_LAST_COMMIT.md` (Updated)

---

## Instructions for the User

### 1. How to Review This Commit
To inspect the changes committed locally:
```bash
git log -1 -p
```
or view a condensed stat summary:
```bash
git log -1 --stat
```

### 2. How to Amend or Re-Commit If Desired
If you wish to modify the commit message or make further edits:
```bash
git reset --soft HEAD~1
# (make edits or stage new changes)
git commit -m "fix(practicals): enforce current official exam roll numbers and centre codes across practicals"
```

### 3. How to Push Changes
Per institutional policy, the assistant never pushes to remote repositories. When you are ready to publish:
```bash
git push origin main
```
