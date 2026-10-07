# Changes Since Last Commit

## Commit Message

`fix(practicals): resolve student roster discovery and merge teacher account for Masooda Rashid`

## Summary of Changes

1. **Teacher Account Merging (`masrat74@gmail.com` -> `masoodarashidmasooda@gmail.com`)**:
   - **Live Firestore Resolution**:
     - `adminSettings/permissions`: Removed deprecated `masrat74@gmail.com` and established canonical `masoodarashidmasooda@gmail.com` with classes `['11th', '12th']`, subjects `['History (HT)']`, and permissions `['attendanceMgmt', 'practicals']`.
     - `users/masoodarashidmasooda@gmail.com`: Updated profile with role `'teacher'`, assigned classes `['11th', '12th']`, subjects `['History (HT)']`, and linked email.
     - `users/masrat74@gmail.com`: Deactivated (`active: false`, `mergedInto: 'masoodarashidmasooda@gmail.com'`).
     - `practicalsData`: Reassigned historical submissions `11th_HT_internal_2024-25_(Oct-Nov)` and `12th_HT_internal_2024-25_(Oct-Nov)` ownership to `teacherEmail: 'masoodarashidmasooda@gmail.com'`, `teacherName: 'Masooda Rashid'`.
   - **Runtime & Fallback Authorization (`src/services/staffAuthService.js`)**:
     - Added canonical profile for `masoodarashidmasooda@gmail.com` to `FALLBACK_STAFF_PROFILES` with subjects `['History (HT)']` and classes `['11th', '12th']`.
     - Exported `STAFF_EMAIL_ALIASES` mapping `masrat74@gmail.com` -> `masoodarashidmasooda@gmail.com`.
     - Implemented automatic alias resolution in `resolveStaffRoleAndPerms`.
   - **Admin Permissions & Overview (`src/portal/admin/StaffPermissionsManager.jsx` & `src/portal/admin/AdminPracticals.jsx`)**:
     - Added Masooda Rashid to `DEFAULT_ADMIN_USERS` and added alias deduplication in staff account lists.
     - Unified teacher submission ownership filters in Admin Practicals to recognise email aliases.
   - **Seed Data (`src/data/cleanPracticalsSeedData.js`)**:
     - Updated seed award entries for 11th and 12th History to `masoodarashidmasooda@gmail.com`.

2. **Practicals Student Roster Resolution & Identifier Pipeline (`src/portal/teacher/PracticalsPage.jsx`)**:
   - **Root Cause Resolution**:
     - Identified that `hasAssignedClassRoll` and student roster extraction were strictly calling `getAssignedClassRollNumber`, which automatically discards all 7+ digit board exam roll numbers (e.g. `201003041` for 11th / 12th examinees).
     - Introduced `getPracticalsStudentRoll(st)`: authoritatively resolves assigned class rolls, direct rolls, serial numbers (`S.No.`), roll numbers, and official board exam roll numbers.
     - Expanded `hasAssignedClassRoll(st)` so examinees with valid roll numbers, serial numbers, or board roll numbers are never dropped.
   - **Document ID & Collection Discovery**:
     - Submissions stored in Firestore use format `${className}_${subjectCode}_internal_${sessionUnderscore}` (e.g. `11th_HT_internal_2024-25_(Oct-Nov)`).
     - Expanded award resolution to query code-based ID patterns and perform fallback collection queries against `practicalsData` matching class and subject code.
   - **State Sync & Real-time Listeners**:
     - Updated `onSnapshot`, `handleLoadSubmissionRecord`, `handleSaveDraft`, `handleSubmitFinal`, and PDF award roll printing to use `getPracticalsStudentRoll`.
   - **Historical Session Detection & 1-Click Switcher**:
     - Added smart detection for sessions where examinee data exists (e.g. `2024-25 (Oct-Nov)` vs empty `2025-26`).
     - Added a prominent, styled action banner in the empty state card with a 1-click button to load the populated historical session roster.

3. **PDF Generation & Award Roll Ownership (`src/utils/practicalsPdfGenerator.js`)**:
   - Added email and UID alias normalization for Masooda Rashid in `isSubmissionOwnedByTeacher`.
   - Added subject fallback verification against `user.assignedSubjects` for historical awards.

## Files Changed

1. `src/data/cleanPracticalsSeedData.js`
2. `src/portal/admin/AdminPracticals.jsx`
3. `src/portal/admin/StaffPermissionsManager.jsx`
4. `src/portal/teacher/PracticalsPage.jsx`
5. `src/services/staffAuthService.js`
6. `src/utils/practicalsPdfGenerator.js`
7. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- **Production Build**: Verified with `npm run build` (Exit Code 0, all 12 public routes generated, zero SEO regression errors).
- **Live Firestore Data**: Merged permissions, user profiles, and practicals documents verified.
- **Roster Resolution Test**: Verified 11th and 12th History students with 7-digit board exam rolls are properly indexed, loaded, and displayed.

## Manual Git Push Instructions

1. Inspect the local commit:
   ```bash
   git log -1 --stat
   ```
2. If you wish to amend or re-commit:
   ```bash
   git reset --soft HEAD~1
   git commit -m "fix(practicals): resolve student roster discovery and merge teacher account for Masooda Rashid"
   ```
3. Push changes to GitHub (strictly manual):
   ```bash
   git push origin main
   ```
