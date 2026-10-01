# Changes Log & Commit Reference

## Current Working Changes

### Exclude Exam-Dropped / Discharged Students from All Practicals Outputs

- **Feature Addressed:**
  - Exam-dropped and discharged students were previously appearing in printed award rolls, attendance sheets, Excel exports, and DOCX consolidated award matrices. These students should be fully excluded from all practicals output at every layer.

- **Changes Made:**

  1. **`studentApprovalStatus.js` — Broadened `isStudentExamDropped()` detection:**
     - Now also detects `isDropped`, `dropped` boolean flags on student records.
     - Reads generic `status`, `Status`, `admissionStatus`, `studentStatus`, `Admission Status` fields for dropped detection.
     - Added `discharged` / `discharge` as recognized dropped-status keywords.
     - Updated `resolveStudentAdmissionStatus()` to return `'Dropped'` for `drop` status strings.

  2. **`practicalsPdfGenerator.js` — Filter before every print function:**
     - `printIndividualAwardRoll` — filters records before rendering.
     - `printConsolidatedAwardRoll` — filters students before rendering.
     - `printAttendanceSheet` — filters students before rendering.
     - `printAllIndividualAwardRolls` — filters students before rendering.
     - `printFailList` — filters students before rendering.

  3. **`practicalsCsvManager.js` — Filter before every export function:**
     - `exportCurrentRosterToExcel` — filters students at start.
     - `exportConsolidatedAwardsToExcel` — filters students at start; returns false if none remain.
     - `exportConsolidatedAwardsToDocx` — filters students at start; returns false if none remain.

  4. **`AdminPracticals.jsx` — UI-layer filter on print/export buttons:**
     - `AwardsSummaryView` print buttons now filter `selectedStudentsList`/`sortedStudents` through `isStudentExamDropped` before passing to print/export functions.

---

## Files Added / Modified
- `src/utils/studentApprovalStatus.js` — Extended dropped detection logic.
- `src/utils/practicalsPdfGenerator.js` — All print functions filter dropped students.
- `src/utils/practicalsCsvManager.js` — All export functions filter dropped students.
- `src/portal/admin/AdminPracticals.jsx` — UI buttons filter dropped students before invoking exports.
- `CHANGES_SINCE_LAST_COMMIT.md` — Updated memory log.

---

## Local Commit Message
```bash
fix(practicals): exclude exam-dropped and discharged students from all PDF, Excel, and DOCX outputs
```

---

## Instructions for User: Review & Push
All changes have been built and verified locally (`npm run build` completed with Exit Code 0), staged, and committed to your local Git repository.

### How to Inspect the Local Commit:
```bash
git log -1 --stat
git show HEAD
```

### How to Amend or Re-commit (if desired):
```bash
git reset --soft HEAD~1
# Make any additional changes if needed
git commit -m "fix(practicals): exclude exam-dropped and discharged students from all PDF, Excel, and DOCX outputs"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
