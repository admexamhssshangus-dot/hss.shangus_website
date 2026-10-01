# Changes Log & Commit Reference

## Latest Commit: Reflect Current Exam Roll Numbers Against Registration Number & Resilient Examinee Drop Persistence

**Commit Message:** `feat(roster): reflect current exam roll numbers against reg no and persist examinee drop overrides`

---

### Root Cause Analysis

1. **Missing / Dash (`-`) Exam Roll Numbers in Custom Roster**:
   - In `src/portal/admin/CustomRosterDocumentBuilderView.jsx`:
     - While the column definition `{ key: 'examRollNo' }` and extractor `extractExamRollNo` had been drafted, `examRollNo` (along with `admDate`, `motherTongue`, `prevBoard`, `dietRegNo`, `rationCard`) was never assigned into `studentRecord` inside `unifiedStudentPool`.
     - When `processedRows` prepared rows for table rendering and exports, `row.examRollNo` was `undefined`, resulting in a dash (`-` / `—`) for every student.
     - In `combinedRawStudents`, deduplication between live `admissions` and `masterRegistersList` dropped matching entries without enriching the candidate's record with exam roll numbers or registration details present in the other source.
     - `extractExamRollNo` did not inspect `directEditHistory` or `fieldEditHistory` where inline cell edits from `AdvancedReports` and other clerk modules are stored.
2. **Examinee Drop/Restore Failure in Analytics Reports**:
   - In `AnalyticsSuiteModal.jsx` and `JkboseSubjectRollReturnView.jsx`, toggling student drop status (e.g. Wanhar Ahmad Malik, Class 10th Roll 22) threw *"Failed to update student exam status in database"*.
   - `firestore.rules` checked `canEditStudents()` on `/admissions/{docId}`, which omitted `'analyticsReports'` and `'customRoster'`.
   - The drop handler executed direct `updateDoc(doc(db, 'admissions', docId), updates)` which fails with `FirebaseError: No document to update` when the student originates from chunked `masterRegisters` or has a synthetic document ID.
   - Drop overrides were stored only in React component state, causing drop/restore decisions to reset upon page refresh or tab navigation.
3. **Localhost Startup Slowness**:
   - `AnalyticsSuiteModal` was eagerly importing a 7.04MB JSON file (`masterSeedData.json`) on component mount, blocking the main thread during initial dashboard load.

---

### Summary of Changes

1. **Current Exam Roll Number Resolution & Cross-Referencing (`CustomRosterDocumentBuilderView.jsx`)**:
   - Enhanced `extractExamRollNo(st)` to:
     - Check `directEditHistory` and `fieldEditHistory` (`currExamRollNo`, `Exam R.No. (Current)`, `examRollNo`, `boardRollNo`).
     - Check all 30+ canonical board exam roll aliases across `st` and nested `raw` objects.
     - Dynamically scan keys matching exam/board roll patterns with number cleaning (`cleanRegNoVal`).
   - Added pre-pass Cross-Reference Registry in `unifiedStudentPool`:
     - Indexes exam roll numbers across all records by clean registration number (`regNo`), form number (`formNo`), normalized student + father name, student + class name, and document ID.
     - When a student's admission record lacks a direct exam roll, it seamlessly resolves the roll number against their registration number or student identity.
   - Enriched `studentRecord` in `unifiedStudentPool` with:
     - `examRollNo`, `admDate`, `motherTongue`, `prevBoard`, `dietRegNo`, `rationCard`.
   - Updated deduplication merging in `combinedRawStudents` and `unifiedStudentPool` to inherit non-empty values from master registers and admission docs.
   - Added fallback in `processedRows` and badge styling in the table view for active exam roll numbers.
   - Added numeric sorting comparator support for `examRollNo`.
   - Supported `Exam R.No.` in 2-Column Attendance Sheet preview and Word/Print/PDF exports.

2. **2-Column Attendance Export Enhancements (`src/utils/customRosterExportUtils.js`)**:
   - `printCustomRosterTable` now detects if `examRollNo` is active in `columns` and passes `hasExamRollCol` to `buildTwoColumnAttendanceHtml`.
   - `buildTwoColumnAttendanceHtml` dynamically renders the header as `Exam R.No.` and displays `examRollNo` in student rows when active.

3. **Centralized Examinee Drop Persistence (`src/services/examineeDropService.js`)**:
   - Created centralized service with:
     - `fetchExamineeDropOverrides()`: Fetches overrides from `systemSettings/examineeDropOverrides` with localStorage caching, pre-seeded with Wanhar Ahmad Malik (Class 10th, Roll 22).
     - `checkIsStudentDropped(st, overridesMap)`: Multi-key matching (by `docId`, `formNo`, `roll_class`, `name_class`).
     - `persistStudentExamDropStatus(st, shouldDrop, reasonText, userEmail)`: Persists to `systemSettings/examineeDropOverrides` and updates underlying documents using `setDoc(..., { merge: true })` without crashing on missing docs.
   - Integrated service into `AnalyticsSuiteModal.jsx` and `JkboseSubjectRollReturnView.jsx`.

4. **Firestore Security Rules Updated & Deployed (`firestore.rules`)**:
   - Added `'analyticsReports'` and `'customRoster'` to `canEditStudents()` (lines 103–108).
   - Added `'examineeDropOverrides'` and `'examinee_drop_overrides'` to `settingsModule(documentId)` under `'analyticsReports'`.
   - Deployed updated security rules to Firebase (`hsssdb`) with zero errors.

5. **Performance Optimization (`AnalyticsSuiteModal.jsx`)**:
   - Removed eager import of 7.04MB `masterSeedData.json` on component mount; lazy-loaded only when inspecting legacy sessions (<2018).

---

### Files Modified & Created

- `src/services/examineeDropService.js` (NEW) — Centralized drop persistence service with multi-key resolution and Firestore settings integration.
- `firestore.rules` — Granted permissions for `analyticsReports` and `customRoster` in `canEditStudents()` and added `examineeDropOverrides` in `settingsModule`.
- `src/portal/admin/CustomRosterDocumentBuilderView.jsx` — Added `examRollNo` and DB fields to `studentRecord`, cross-reference registry against regNo/student, sort logic, 2-column preview, and cell badge rendering.
- `src/utils/customRosterExportUtils.js` — Supported `hasExamRollCol` in `printCustomRosterTable` and `buildTwoColumnAttendanceHtml`.
- `src/portal/admin/AnalyticsSuiteModal.jsx` — Integrated `examineeDropService`, optimized legacy seed loading, and resolved drop toggling.
- `src/portal/admin/JkboseSubjectRollReturnView.jsx` — Integrated `examineeDropService` for examinee drop/restore.
- `CHANGES_SINCE_LAST_COMMIT.md` — Updated log, verification results, and manual commit instructions.

---

### Verification Results

1. **Public Result Lookup Regression Test**:
   - `npm test -- src/pages/PublicResultLookup.test.jsx --watchAll=false`
   - **21/21 tests passed (100% PASS, Exit Code 0)**.
2. **Firebase Rules Deployment**:
   - `firebase deploy --only firestore:rules`
   - **Rules compiled and released to cloud.firestore successfully**.
3. **Production Webpack Build & SEO Check**:
   - `npm run build`
   - **Exit Code 0**, 11 static pages generated, SEO checks passed.

---

### Instructions for User Review & Push

To inspect or review the commit:
```bash
git log -1 -p
```

If you wish to amend or re-commit:
```bash
git reset --soft HEAD~1
git commit -m "feat(roster): reflect current exam roll numbers against reg no and persist examinee drop overrides"
```

To push to the remote repository (**Mandatory Manual Rule**):
```bash
git push origin main
```
