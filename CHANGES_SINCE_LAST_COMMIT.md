# Changes Since Last Commit

## Commit Message

`perf(student-directory): share current-session reads`

## Summary

- Replaced the default all-session student loading path with a private, in-memory current-session directory. The session is read from cached site settings when configured, with the school's November academic rollover as a fallback.
- Added one-query sharing for concurrent requests to both admissions cohorts and individual master-register cohorts. A module opening while another module requests the same session now awaits the same Firestore request instead of creating another read.
- Kept student data in authenticated memory only; current and historical student records are not persisted in browser storage by this directory layer.
- Scoped the Admin Dashboard's admissions listener to the current session and releases it outside live-edit workspaces. It no longer subscribes to the entire admissions collection across all academic years.
- Migrated the main admin, teacher, attendance, assessment, practicals, funds, reports, bulk-ingestion, admission-register, result-ingestion, analytics, and public GK lookup paths to reuse the shared scoped directory or exact identity queries.
- Removed full student-collection scans from funds, bulk ingestion, result ingestion, and public GK candidate lookup. Historical archive reads remain explicit actions in archival/export tools.
- Added regression checks to prevent a future return of whole-admissions listeners, duplicate scoped requests, full bulk-ingestion archive loads, or public full-directory scans.

## Files Changed

1. `scripts/admin-performance-regression-check.js`
2. `src/pages/GkTestRegistration.jsx`
3. `src/portal/admin/AdminDashboard.jsx`
4. `src/portal/admin/AdminPracticals.jsx`
5. `src/portal/admin/AdmissionRegisterSuite.jsx`
6. `src/portal/admin/AnalyticsSuiteModal.jsx`
7. `src/portal/admin/BulkFieldOverwriteModal.jsx`
8. `src/portal/admin/FundDistribution.jsx`
9. `src/portal/admin/ResultIngestionModal.jsx`
10. `src/portal/teacher/AttendancePage.jsx`
11. `src/portal/teacher/PracticalsPage.jsx`
12. `src/portal/teacher/TeacherAssessmentsPage.jsx`
13. `src/services/dbCache.js`
14. `src/utils/studentDataFetcher.js`
15. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npm run build`: completed successfully. Existing unrelated ESLint warnings remain warnings only; no build errors occurred.
- `npm run performance:check`: passed.
- `node --check src/services/dbCache.js`: passed.
- `node --check src/utils/studentDataFetcher.js`: passed.
- Focused `src/utils/studentDataFetcher.test.js`: 5 tests passed. Firebase Auth logged an existing test-environment assertion to the console, but the suite passed.
- `git diff --check`: passed with no whitespace errors.

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
