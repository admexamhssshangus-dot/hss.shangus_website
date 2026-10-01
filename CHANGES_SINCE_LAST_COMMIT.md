# Changes Log & Commit Reference

## Latest Commit: Recognize Enrolled Subjects Left Empty as Absent and Fix Class 10th Stream Display

**Commit Message:** `fix(gazette): recognize empty enrolled subjects as absent and lock secondary stream to general`

---

### Root Cause Analysis

1. **Empty Marks for Enrolled Subjects**:
   - In `src/portal/admin/ConsolidatedGazetteView.jsx`, when a teacher submitted an award list but left a candidate's marks cell blank/empty (`totalMarks: ''`), or when an award list had not yet been submitted for an enrolled subject (e.g., Class 10th English, Mathematics, and Social Science), the gazette evaluation treated the subject as un-evaluated (`obtained: null, isAbsent: false`).
   - This caused the subject to display as `—` (dash) and be excluded from total max marks and result calculation.
   - Consequently, candidates like **Muneeb Bashir** (Roll 32) who only had marks in Science (38), Urdu (18), and Healthcare (43) were evaluated out of 150 marks instead of 300 marks, falsely achieving a 66.0% score and being erroneously awarded **`PASS`** with **`First Division`**.
2. **Class 10th Stream Column Display**:
   - Class 10th secondary admission forms often inherited default fields or stream inference triggers (e.g. presence of "Science" or "Mathematics"), causing the gazette Stream column to render `Science` for Class 10th students. Secondary (9th/10th) education does not have streams and must strictly display `General`.
3. **Investigation of 10th English, Mathematics, and Social Science Awards**:
   - Inspected Firestore collections (`practicalsData`, `practicalsBin`, `activityLogs`) across all evaluation types (`Internal Assessment`, `Pre-Board Test`, etc.).
   - Confirmed that teachers have not yet submitted award lists for Class 10th English, Mathematics, or Social Science.

---

### Summary of Changes

1. **Authoritative Secondary Subject Enrollment (`AdminPracticals.jsx`)**:
   - Updated `isStudentEnrolledInSubject(st, subCode, cls)`:
     - For Secondary School (Class 9th & 10th):
       - Core 5 Compulsory Subjects (`EN`, `MA`, `SC`, `SS`, `UR`) belong to **every** Class 10th/9th student.
       - Vocational Elective: `HTC` belongs to students enrolled in Healthcare; `ITE` belongs to students enrolled in IT & ITES based on student admission data and vocational subject mapping.
       - Higher secondary subjects (PH, CH, BO, ZO, ED, HT, PS, etc.) are strictly excluded.
     - Preserves Higher Secondary (11th/12th) Science vs. Arts vs. Commerce stream and subject enrollment mapping.

2. **Empty Enrolled Marks Recognized as Absent (`ConsolidatedGazetteView.jsx`)**:
   - When evaluating subjects for each candidate:
     - If valid numeric marks are present (`hasNumeric`): evaluated with scaled score and pass/fail status.
     - If the subject **belongs to the student** (`belongsToStudent`): any blank/empty marks left by teachers, or subjects awaiting teacher submission, are recognized as **`AB`** (`isAbsent: true`, `obtained: 'AB'`).
       - Increments `absentSubjectsCount` and adds subject max marks to `totalMax`.
       - Renders as `AB` in the gazette table cell.
       - Listed in `absentSubjects`, ensuring the student shows `Absent in (...)` (or `Poor in (...), Absent in (...)`) and grade `—` instead of falsely passing.
     - If the subject **does not belong to the student** (e.g., `ITE` for Healthcare students, or `HTC` for IT students): remains `obtained: null, isAbsent: false`, displaying `—` without penalizing the candidate.

3. **Stream Resolution for Class 9th & 10th (`ConsolidatedGazetteView.jsx`)**:
   - Enforced `isSecondaryClass = selectedClass === '9th' || selectedClass === '10th'`.
   - For secondary cohorts, `resolvedStream` is locked to `'General'`, preventing stream inference from falsely labeling Class 10th students as `Science`.

4. **Subject Stats Metric Alignment (`ConsolidatedGazetteView.jsx`)**:
   - Updated `appearedCount` in subject drilldown stats to filter out absent candidates (`!isAbsent`), ensuring subject pass rate accurately reflects students who sat the examination.

---

### Files Modified

- `src/portal/admin/AdminPracticals.jsx` — Authoritative subject enrollment rules for secondary core and vocational subjects.
- `src/portal/admin/ConsolidatedGazetteView.jsx` — Recognition of empty enrolled subjects as `AB`, locking secondary stream to `General`, and subject stat refinement.
- `CHANGES_SINCE_LAST_COMMIT.md` — Updated log, verification results, and manual commit instructions.

---

### Verification Results

- `cmd /c "set CI=true && npm test -- src/pages/PublicResultLookup.test.jsx --watchAll=false"`: **21/21 tests passed (Exit Code 0)**.
- `npm run build`: **Exit Code 0** (production build created, 11 static pages generated, SEO regression check passed).

---

### Instructions for User Review & Push

To inspect or review the commit:
```bash
git log -1 -p
```

If you wish to amend or re-commit:
```bash
git reset --soft HEAD~1
git commit -m "fix(gazette): recognize empty enrolled subjects as absent and lock secondary stream to general"
```

To push to the remote repository (**Mandatory Manual Rule**):
```bash
git push origin main
```
