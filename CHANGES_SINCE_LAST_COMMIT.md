# Changes Log & Commit Reference

## Latest Commit: Fix Modal Responsiveness, Arts-Subject Leak in Science Stream & 11th Placeholder Resolution

**Commit Message:** `fix(direct-entry & practicals): fix modal responsiveness z-index, prevent arts subject ED in science stream and resolve Same as in Class 11th placeholders`

---

### Summary of Changes

1. **Fixed Direct Entry Preview & Inspect Modal Responsiveness (`BulkFieldOverwriteModal.jsx`)**:
   - **Root Cause**: The inspect diff modal previously rendered within the parent DOM container with `z-60` (which is not configured in standard Tailwind, leaving it as `z-index: auto`), allowing the background table header (`position: sticky top-0 z-10`) to slice across the modal dialog and block student field cards (such as Subject 2).
   - **Fix**: Wrapped both `inspectModalContent` and `progressOverlayContent` in `createPortal(..., document.body)` with `z-[9999]` and `z-[10000]`.
   - Enhanced modal card responsiveness and word-wrapping with `min-w-0`, `truncate` on labels, and resilient flex/grid layouts across mobile and desktop viewports.

2. **Eliminated "Same as in Class 11th" Placeholders End-to-End**:
   - Class 12th students with `"Same as in Class 11th"` now reliably resolve authentic subjects from `Subjects Studied in Class 11th`, `Subjects to be taken in Class 11th`, `Subjects in Class 11th`, multi-subject columns (`Subjects1..Subjects6`), or stream fallbacks.
   - Updated `resolveStudentSubjectsRaw` in `practicalsPdfGenerator.js`, `getStudentSubjectsStr` in `AdminPracticals.jsx`, `extractRawSubjectsString` in `PracticalsPage.jsx`, and `extractRawSubjectsString` in `AttendancePage.jsx` to reject `SAME_AS_11_RE` placeholders and resolve genuine subjects.
   - Ensured Excel roster exports in `practicalsCsvManager.js` use resolved abbreviations rather than unexpanded placeholders.

3. **Prevented Arts Subjects (Like Education / ED) in Science Stream**:
   - **Root Cause**: In `practicalsPdfGenerator.js`, `practicalsCsvManager.js`, and `AttendancePage.jsx`, regexes like `/\b(education|edu|ed)\b/i` matched `"Education"` inside `"Physical Education"`, causing Science students who took Physical Education to falsely receive Arts subject `ED` (Education) alongside `PD`.
   - **Fix**:
     - Pre-tokenized multi-word and compound subjects before single-word abbreviation (`Physical Education` ➔ `__SUB_PD__`, `Environmental Science` ➔ `__SUB_ES__`, `Political Science` ➔ `__SUB_PS__`, `Computer Science` ➔ `__SUB_CS__`, `Social Science` ➔ `__SUB_SS__`, etc.).
     - Implemented a strict Science Stream Guard across `practicalsPdfGenerator.js`, `AdminPracticals.jsx`, `PracticalsPage.jsx`, `AttendancePage.jsx`, and `practicalsCsvManager.js` that strips Arts-only electives (`ED`, `HT`, `PS`, `SO`, `AR`, `PR`) and Secondary `SC` from any Science stream student.
     - Exported and wired canonical `isStudentEnrolledInPracticalSubject` across Attendance Sheets, Individual Award Rolls, and Consolidated Matrices in PDF, Excel, and Word exports.

---

### Files Modified

- `src/portal/admin/BulkFieldOverwriteModal.jsx` — Portaled inspect modal and progress overlay to `document.body` with `z-[9999]`, added responsive card styling.
- `src/utils/practicalsPdfGenerator.js` — Pre-tokenized compound subjects, enforced Science stream guard, exported `isStudentEnrolledInPracticalSubject`, fixed 9th/10th resolution.
- `src/utils/practicalsCsvManager.js` — Imported and integrated `isStudentEnrolledInPracticalSubject` and `getAbbreviatedSubjects` for Excel and Word matrix exports.
- `src/portal/admin/AdminPracticals.jsx` — Enhanced `getStudentSubjectsStr` and `isStudentEnrolledInSubject` with 11th resolution and strict Science stream guard.
- `src/portal/teacher/PracticalsPage.jsx` — Resolved 11th subjects for 12th students and enforced Science stream guard.
- `src/portal/teacher/AttendancePage.jsx` — Resolved 11th subjects, enforced Science stream guard and eliminated Arts matching for Science students.
- `src/portal/teacher/PracticalsPage.test.jsx` — Added regression tests verifying `ED` is never assigned to Science students opting for Physical Education and that `"Same as in Class 11th"` resolves cleanly.
- `CHANGES_SINCE_LAST_COMMIT.md` — Updated with complete documentation of this commit.

---

### Verification Results
- `npm test -- src/portal/teacher/PracticalsPage.test.jsx --watchAll=false`: **19/19 Tests Passed (100%)**.
- `npm run build`: **Compiled successfully with Exit Code 0**. SEO checks passed (11 pages, static metadata, sitemap).

---

### Instructions for User Review & Push

To inspect or review the commit:
```bash
git log -1 -p
```

If you wish to amend or re-commit:
```bash
git reset --soft HEAD~1
git commit -m "fix(direct-entry & practicals): fix modal responsiveness z-index, prevent arts subject ED in science stream and resolve Same as in Class 11th placeholders"
```

To push to the remote repository (Mandatory Manual Rule):
```bash
git push origin main
```
