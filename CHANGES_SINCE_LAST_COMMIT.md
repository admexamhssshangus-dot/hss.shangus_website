# Changes Log & Commit Reference

## Current Working Changes

### 1. Fix Student Scorecard Ghost Elective (Economics vs Urdu) End-to-End
- **Issue Reported:**
  - Student *Mohammad Asif Sheikh Moochi* (Class 11th Humanities, Roll 177, Form 250496, Reg 2401003000900020) was showing `Economics [EC]` as a 6th subject marked `AB (ABSENT)` dragging down their total to `39 / 300 (15.6%)`, even though his elective was supposed to be changed from Economics to Urdu.
- **Root Cause:**
  - Before the student changed his elective to Urdu, an earlier teacher submission for `11th_Economics_Pre-Board Test_2025-26` had recorded him with `totalMarks: "AB"`.
  - In `PublicResultLookup.jsx` (`computeScorecardSubjects`), any teacher mark (including absent "AB") caused un-enrolled subjects to bypass the student's enrolled subject filter and render as an extra 6th subject.
- **End-to-End Resolutions:**
  - **Firestore Database Clean-up:**
    - Pruned Mohammad Asif Sheikh Moochi from `practicalsData/11th_Economics_Pre-Board Test_2025-26`. The document now has exactly 16 valid records.
    - Verified that his Urdu marks (Record #55 in `11th_Urdu_Pre-Board Test_2025-26`) remain intact with marks: `0`.
    - Verified that in `admissions/adm_250496` and `verifiedStudentsCatalog.json`, his 5 subjects are strictly: `General English, Urdu, Education, History, Healthcare`.
  - **Client Scorecard Safeguard ([PublicResultLookup.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/pages/PublicResultLookup.jsx)):**
    - Updated `computeScorecardSubjects` to strictly enforce enrolled subjects when `matchedStudent.subjects` is populated.
    - Absent marks (`isAbsentMark`) in un-enrolled subjects are excluded so dropped/transferred subjects are never appended as phantom electives.
  - **API Serverless Safeguard ([netlify/functions/public-result.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/netlify/functions/public-result.js)):**
    - Pre-extracted `expectedCodes = expectedSubjectCodes(data)` before evaluating sections.
    - If `expectedCodes.length > 0`, skipped sections that do not match the student's expected subject codes.
  - **Teacher Evaluation Roster Filter ([PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)):**
    - When generating class rosters (`rosterScope !== 'all_class'`), students whose enrolled subjects do not match `targetSubjCode` / `targetSubjName` are excluded from the award roll, preventing students who changed subjects from lingering in old teacher mark entry sheets.

### 2. Staff Permissions Tier Isolation & Assigned Classes Display
- **Changes in [StaffPermissionsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffPermissionsManager.jsx):**
  - Grouped Assigned Classes into two dedicated visual cards: *Secondary (9th & 10th)* and *Higher Secondary (11th & 12th)*.
  - Added active tier indicator badges and per-tier subject count badges.
  - Fixed `classSubjectMap` so empty tiers evaluate to `[]` instead of leaking `cleanSubjects`.
- **Subject Matching Isolation ([practicalsSettingsManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSettingsManager.js)):**
  - Isolated Higher Secondary Botany (`BO`) and Zoology (`ZO`) from cross-matching Secondary General Science (`SC`).

### 3. Admission Duplicate Validation Improvements
- **Changes in [netlify/functions/admission-workflow.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/netlify/functions/admission-workflow.js) & [AdmissionForm.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/student/AdmissionForm.jsx):**
  - Allowed same registration number in any class-session for mobile and Aadhaar checks.
  - Allowed parent mobile sharing across different classes for siblings.
  - Handled `duplicate_aadhaar` errors in `AdmissionForm.jsx`.

---

## Files Modified
- `src/pages/PublicResultLookup.jsx`
- `netlify/functions/public-result.js`
- `src/portal/teacher/PracticalsPage.jsx`
- `src/portal/admin/StaffPermissionsManager.jsx`
- `src/utils/practicalsSettingsManager.js`
- `netlify/functions/admission-workflow.js`
- `src/portal/student/AdmissionForm.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
fix(results): eliminate ghost economics elective for student asif, enforce enrolled subject filtering, and isolate staff tier assignments
```

---

## How to Review or Manually Manage Commits

### To review staged changes before commit:
```bash
git diff --staged
```

### If you want to commit manually:
```bash
git add .
git commit -m "fix(results): eliminate ghost economics elective for student asif, enforce enrolled subject filtering, and isolate staff tier assignments"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "fix(results): eliminate ghost economics elective for student asif, enforce enrolled subject filtering, and isolate staff tier assignments"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
