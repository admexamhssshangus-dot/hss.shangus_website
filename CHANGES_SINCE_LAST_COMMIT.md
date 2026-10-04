# Changes Summary Since Last Commit

## Commit Summary

- **Commit Message**: `fix(practicals-and-admissions): restore Class 10th examinee, fix exam roll propagation, and eliminate phantom doc creation`
- **Date**: October 04, 2026
- **Status**: Production build verified (Exit Code 0), unit tests passed locally.

---

## Detailed Summary of Changes

### 1. Restored Class 10th Examinee Status (Suhaib Yousuf)
- **Root Cause**: Student Suhaib Yousuf (Class 10th, Roll 46, Form 251297, Reg `2501000000610046`) was previously marked with `isExamDropped: true` and `examStatus: "dropped"` (reason: `"Shortage of attendance"`), causing the Class 10th roster to display `59/59 (1 dropped)` instead of 60 active examinees.
- **Resolution**:
  - Restored `admissions/251297` in Cloud Firestore to `isExamDropped: false`, `examStatus: "active"`, and cleared `examDroppedReason`, `examDroppedAt`, and `examDroppedBy`.
  - Cleaned all corresponding override keys from `systemSettings/examineeDropOverrides` (`id_251297`, `form_251297`, `roll_10th_46`, `roll_2025-26_10th_46`, `name_10th_suhaibyousuf`, `name_2025-26_10th_suhaibyousuf`, `name_roll_suhaibyousuf_46`).
  - Class 10th now displays the full active roster of 60 students with zero dropped students.

### 2. Elimination of Phantom / Duplicate Documents on Record Edit
- **File**: `src/portal/admin/AdvancedReports.jsx` (`updateStudentDocument`)
  - Identified and removed speculative `setDoc({ merge: true })` inside candidate ID loops. Previously, if `updateDoc` failed on a candidate ID, the fallback loop speculatively wrote new documents (such as `250495` and `active_250495`), creating unwanted phantom copies in Firestore.
  - Sanitized target ID resolution to only attempt `updateDoc` on authentic existing document IDs (`primaryDocId`, `adm_${formNo}`).
  - Deleted existing phantom documents (`admissions/250495` and `admissions/active_250495`) from Firestore, leaving only the authentic document (`admissions/adm_250495`).
- **File**: `src/services/dbCache.js`
  - In `updateCachedItem`, guarded against prepending partial documents to cache arrays when the item is not found, returning unmodified cache state instead of generating synthetic phantom records.

### 3. End-to-End Exam Roll Number Resolution in Practicals & PDF Generators
- **File**: `src/utils/practicalsPdfGenerator.js`
  - Expanded `getStudentExamRoll` and `getRecordExamRoll` to resolve all schema aliases: `currExamRollNo`, `currExamRoll`, `boardRollNo`, `boardRoll`, `Exam R. No. (Current)`, `Exam Roll Number`, `examRollNo`, `exam_roll_no`.
  - Added class-specific prefix validation and fallback through `getCurrentOfficialExamRoll(st, resolvedClass)`.
  - Updated all award rolls and attendance sheet generators (`printMarksRecordAwardRoll`, `printAttendanceSheet`, `printConsolidatedAwardRoll`, `printAllIndividualAwardRolls`, `printFailList`, `exportConsolidatedAwardsToWord`) to display authentic Board Exam Roll Numbers instead of dashes (`—`).
  - Fixed `histClass` resolution in `printHistoricalSubmission` to resolve undeclared variable build errors.
- **File**: `src/portal/admin/AdminPracticals.jsx`
  - Updated student record normalization (`normalizeStudentFields`) and table row rendering to pass `resolvedClass` to `getCurrentOfficialExamRoll(st, resolvedClass)` so `currExamRollNo`, `boardRollNo`, and `examRollNo` are uniformly available in both the UI table and export payloads.
- **File**: `src/data/verifiedStudentsCatalog.json`
  - Enriched Class 12th records with official 2025-26 Board Exam Rolls (`301003...` and `301004...`) from master register chunk 116–120 for offline resilience and fast initial rendering.

---

## Files Changed

1. `src/portal/admin/AdvancedReports.jsx`
2. `src/services/dbCache.js`
3. `src/utils/practicalsPdfGenerator.js`
4. `src/portal/admin/AdminPracticals.jsx`
5. `src/data/verifiedStudentsCatalog.json`
6. `CHANGES_SINCE_LAST_COMMIT.md`

---

## Verification

- `npm run build` — Passed with exit code 0; production assets generated cleanly.
- Unit tests (`src/utils/practicalsSubjectMatching.test.js`, `src/utils/studentApprovalStatus.test.js`) — 14/14 tests passed.
- Cloud Firestore live data verified:
  - `admissions/251297`: `isExamDropped: false`, `examStatus: "active"`.
  - `systemSettings/examineeDropOverrides`: 0 dropped overrides remaining.
  - Phantom documents `admissions/250495` and `admissions/active_250495`: confirmed 404 (deleted). Authentic `admissions/adm_250495`: verified intact.

---

## Instructions for User

### Review the Local Commit

```bash
git log -1 --stat
git show HEAD
```

### Amend or Re-commit (Optional)

```bash
git reset --soft HEAD~1
git commit -m "fix(practicals-and-admissions): restore Class 10th examinee, fix exam roll propagation, and eliminate phantom doc creation"
```

### Push Manually

Per project instructions, commits are created locally only and never pushed automatically by the assistant. When you are ready to push:

```bash
git push origin main
```
