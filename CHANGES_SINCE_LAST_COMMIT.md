# Changes Since Last Commit

## Commit Message

`fix(practicals): preserve authoritative class rolls`

## Summary

- Introduced one authoritative class-roll resolver for the browser and Cloud Functions. Named class-roll fields always take priority, while generic legacy `rollNo` fields are rejected when they look like official examination-roll numbers.
- Removed the legacy Apps Script attendance-roster fallback. Attendance now uses the scoped Firestore admissions/master-register directory only.
- Updated practical roster construction, saved-award reconciliation, attendance, manual marks records, award/attendance print generators, practical exports, imports, and admin editing to use the authoritative class roll.
- Future teacher drafts, submissions, imports, admin edits, and generated attendance records now retain `classRollNo` separately from `examRollNo`. The compatible `rollNo` is set to the same authoritative class roll.
- The callable backend also independently derives that value from the server-authorised roster, so browser-supplied roll values cannot corrupt records when the Cloud Function is deployed.
- Admin edits preserve existing historical rows when no trustworthy class roll is available, preventing any marks or legacy data from being discarded.
- Added focused browser and server tests covering explicit class-roll precedence and rejection of a generic official exam roll.

## Files Changed

1. `functions/academicRecords.js`
2. `functions/admissionStatus.js`
3. `functions/admissionStatus.test.js`
4. `src/portal/admin/AdminPracticals.jsx`
5. `src/portal/teacher/AttendancePage.jsx`
6. `src/portal/teacher/PracticalsPage.jsx`
7. `src/utils/practicalsCsvManager.js`
8. `src/utils/practicalsPdfGenerator.js`
9. `src/utils/studentApprovalStatus.js`
10. `src/utils/studentApprovalStatus.test.js`
11. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `node --test functions/admissionStatus.test.js`: passed (2 tests).
- Focused `src/utils/studentApprovalStatus.test.js`: passed (8 tests).
- `npm run build`: passed (optimized production build, 11 public HTML pages, and SEO regression checks).
- `git diff --check`: passed with no whitespace errors.
- Production Cloud Function deployment: attempted for `submitAcademicRecord`, but not completed. Firebase reported that Cloud Build and Artifact Registry are disabled for project `hsssdb` and timed out while trying to enable them. The client-side safeguards are ready; enable those required Google Cloud APIs and deploy this function before relying on the server-side enforcement.

## Instructions for the User

1. Review the local commit:

   ```bash
   git show --stat HEAD
   git log -1 -p
   ```

2. Amend or recreate the commit if you prefer another message:

   ```bash
   git reset --soft HEAD~1
   git commit -m "Your custom commit message"
   ```

3. Push manually when ready. This project workflow deliberately never pushes automatically:

   ```bash
   git push origin main
   ```
