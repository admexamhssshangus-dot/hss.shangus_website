# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): merge practicals history from e.educational admin to socialshiftz teacher email and exclude admin from faculty roster`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Automated Jest tests passed (`Exit Code 0`).

---

## Architectural Purpose & Issues Resolved

### Problem Statement
1. **Duplicate Faculty Entries in Admin Practicals Roster**:
   - In the Practicals Faculty & Evaluator Submissions view, Sheikh Gulfam appeared twice:
     - Row 2: Sheikh Gulfam (`e.educational.24@gmail.com`) with role badge `EXAMINER`, displaying Botany 11th (Internal 86, External 170) and 12th (Internal 105).
     - Row 3: Sheikh Gulfam (`socialshiftz@gmail.com`) with role badge `TEACHER`, displaying the exact same Botany practical documents.
2. **Account Role Ambiguity**:
   - `e.educational.24@gmail.com` is the primary institutional Master Admin email account, whereas `socialshiftz@gmail.com` is Sheikh Gulfam's official Teacher/Faculty email.
   - Historical Botany practical evaluations and audit versions were created or logged using `e.educational.24@gmail.com`.
   - In `AdminPracticals.jsx`, `setTeachers` included users with `role === 'admin'`. Because `e.educational.24@gmail.com` had `name: 'Sheikh Gulfam'` and `socialshiftz@gmail.com` also had `name: 'Sheikh Gulfam'`, fuzzy name matching linked the same Botany documents to both accounts.
3. **Teacher Portal Ownership & Access**:
   - When Sheikh Gulfam signs in with his official teacher email `socialshiftz@gmail.com`, any historical practical submissions originally created under `e.educational.24@gmail.com` must be seamlessly owned, accessible, and editable in the Teacher Workspace without UID or email mismatches.

---

## Changes Implemented

### 1. Firestore Database Consolidation
- **Executed Migration Script**: [scripts/merge_gulfam_practicals_history.mjs](file:///d:/Shk_Gulfam/Projects/hss_shangus/scripts/merge_gulfam_practicals_history.mjs)
  - **`practicalsData` Collection**:
    - `11th_BO_external_2024-25_(Oct-Nov)`: set `teacherEmail: 'socialshiftz@gmail.com'`, `submittedByEmail: 'socialshiftz@gmail.com'`, `teacherName: 'Sheikh Gulfam'`, `submittedByName: 'Sheikh Gulfam'`.
    - `11th_BO_internal_2024-25_(Oct-Nov)`: set `teacherEmail: 'socialshiftz@gmail.com'`, `submittedByEmail: 'socialshiftz@gmail.com'`, `teacherName: 'Sheikh Gulfam'`, `submittedByName: 'Sheikh Gulfam'`.
    - `11th_Botany_Pre-Board Test_2025-26`: confirmed canonical ownership by `socialshiftz@gmail.com`.
    - `12th_BO_internal_2024-25_(Oct-Nov)`: set `teacherEmail: 'socialshiftz@gmail.com'`, `submittedByEmail: 'socialshiftz@gmail.com'`, `teacherName: 'Sheikh Gulfam'`, `submittedByName: 'Sheikh Gulfam'`.
    - `12th_Botany_Internal Assessment_2025-26`: set `teacherEmail: 'socialshiftz@gmail.com'`, `submittedByEmail: 'socialshiftz@gmail.com'`, `teacherName: 'Sheikh Gulfam'`, `submittedByName: 'Sheikh Gulfam'`.
    - `12th_Botany_Pre-Board Test_2025-26`: set `teacherEmail: 'socialshiftz@gmail.com'`, `submittedByEmail: 'socialshiftz@gmail.com'`, `teacherName: 'Sheikh Gulfam'`, `submittedByName: 'Sheikh Gulfam'`.
    - `history_11th_Botany_Pre-Board Test_2025-26_1789487999790`: set `teacherEmail: 'socialshiftz@gmail.com'`, `submittedByEmail: 'socialshiftz@gmail.com'`.
  - **`practicalsBin` Collection**:
    - Updated 10 historical audit log and trash bin entries to `socialshiftz@gmail.com`.
  - **`adminPracticalsSettings/config` Collection**:
    - Added `'e.educational.24@gmail.com'` to `excludedTeacherEmails`.

### 2. Admin Practicals Portal Normalization & Deduplication
- File: [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)
  - Added `'e.educational.24@gmail.com'` to `DEFAULT_EXCLUDED_TEACHERS`.
  - In `parsePracticalsSnap`: Automatically normalizes any practicals submission with `e.educational` to `teacherEmail: 'socialshiftz@gmail.com'`, `submittedByEmail: 'socialshiftz@gmail.com'`, `teacherName: 'Sheikh Gulfam'`.
  - In `setTeachers`: Filters out pure administrative roles (`admin`) and strictly excludes `e.educational` from the faculty roster.
  - In `isDocMatchingTeacher` and `facultyMembers`:
    - Normalizes `dEmail` from `e.educational` to `socialshiftz@gmail.com`.
    - Strictly prevents the institutional admin email from claiming teacher submissions.
    - Prevents orphan or fallback evaluator rows from rendering for `e.educational`.

### 3. Unified Submissions Ownership in Teacher Portal
- File: [src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js)
  - In `isSubmissionOwnedByTeacher`:
    - Normalizes both `itemEmail` and `currentEmail` aliasing `e.educational` to `socialshiftz@gmail.com`.
    - Allows email alias matching across accounts even if Firebase Auth UIDs differ, ensuring Sheikh Gulfam logged in as `socialshiftz@gmail.com` can view, generate award rolls, and edit all historical submissions.

### 4. Audit & Verification Scripts
- Files:
  - [scripts/inspect_gulfam_practicals.mjs](file:///d:/Shk_Gulfam/Projects/hss_shangus/scripts/inspect_gulfam_practicals.mjs): Deep audit script inspecting `practicalsData`, `practicalsBin`, `users`, and settings.
  - [scripts/merge_gulfam_practicals_history.mjs](file:///d:/Shk_Gulfam/Projects/hss_shangus/scripts/merge_gulfam_practicals_history.mjs): Migration script automating consolidation in Firestore.

---

## Files Changed
- `src/portal/admin/AdminPracticals.jsx` (Modified)
- `src/utils/practicalsPdfGenerator.js` (Modified)
- `scripts/inspect_gulfam_practicals.mjs` (Added)
- `scripts/merge_gulfam_practicals_history.mjs` (Added)
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
git commit -m "fix(practicals): merge practicals history from e.educational admin to socialshiftz teacher email and exclude admin from faculty roster"
```

### 3. How to Push Changes
Per institutional policy, the assistant never pushes to remote repositories. When you are ready to publish:
```bash
git push origin main
```
