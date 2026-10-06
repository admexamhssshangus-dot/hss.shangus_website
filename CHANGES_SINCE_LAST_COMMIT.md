# Changes Since Last Commit

## Commit Message

`fix(practicals-auth): hydrate class 10th practicals cohort and optimize admin rules`

## Summary

- **Populated Class 10th in Practicals Portals**:
  - In `src/portal/admin/AdminPracticals.jsx`, updated `loadData()` to fetch `admissionsData` via `getAdmissionsBySession({ session: getCurrentAcademicSession(), forceRefresh: force })` alongside `getMasterRegistersScoped`.
  - Ingested `admissionsData` into `studentsMap` via `addOrMergeStudent` so that all 64 enrolled Class 10th students (as well as Class 9th) are fully rendered in `AwardsSummaryView` and practical award rolls rather than showing up empty.
  - In `src/portal/teacher/PracticalsPage.jsx`, updated `loadInitialPracticalsData()` to fetch `getAdmissionsBySession({ session: yearSuffix, className: selectedClass })` in `Promise.all` and populated `admDocs` instead of setting it to an empty array.
- **Fixed Firestore Rules 10-Read Limit Abort for Standard Admins**:
  - In `firestore.rules`, streamlined `isSuperAdmin()`, `isBootstrapAdmin()`, `isStandardAdmin()`, `canUseAny()`, `isTeacher()`, and `canReadStudents()` to read only cached UID-based `staffProfile()` (`users/$(request.auth.uid)`) and evaluate `canUseAny(...)` before `isTeacher()`.
  - Removed duplicate calls to `exists(/databases/$(database)/documents/users/$(authEmail()))` that previously triggered Cloud Firestore's strict limit of 10 `get()`/`exists()` calls per request, which had resulted in `permission-denied` errors when standard admins queried the `/admissions` collection.
  - Deployed updated security rules to Cloud Firestore (`firebase deploy --only firestore:rules`).
  - Tested live client SDK queries with custom tokens to verify that standard admins (`e.educational.24@gmail.com`) can query admissions without permission errors (returning all 551 documents).
- **Updated Cloud Storage Security Rules for 2SV Flexibility**:
  - In `storage.rules`, added `admin2StepRequired()` and `validAdminSession()` helpers to ensure standard admins and super administrators can upload documents and photos without requiring an `adminSessions` verification document when 2-Step Verification is disabled.
  - Deployed updated storage rules to Firebase Storage (`firebase deploy --only storage`).
- **Clarified 2SV Admin Controls UI & Synchronized Session Defaults**:
  - In `src/portal/admin/ControlsAndSubjects.jsx`, updated the 2SV badge to `Super Admin & Controls Module` and clarified that by default Standard and Super Admins sign in directly with Email & Password or Google without 2SV verification, unless 2SV is enabled by a Super Admin or a Standard Admin with the `controls` module permission.
  - In `src/utils/settingsLoader.js` (`DEFAULT_SETTINGS`) and `public/slides/settings.json`, explicitly declared default academic session fields (`session: "2025-26"`, `currentSession: "2025-26"`).

## Files Changed

1. `firestore.rules`
2. `storage.rules`
3. `src/portal/admin/AdminPracticals.jsx`
4. `src/portal/teacher/PracticalsPage.jsx`
5. `src/portal/admin/ControlsAndSubjects.jsx`
6. `src/utils/settingsLoader.js`
7. `public/slides/settings.json`
8. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npm run test:public`: 10/10 tests passed (including 2SV conditional enforcement).
- `npm run security:check`: Security regression checks passed.
- `npm run admission:check`: Admission regression checks passed.
- Firebase Firestore Security Rules: Compiled and released to `cloud.firestore`.
- Firebase Storage Security Rules: Compiled and released to `firebase.storage`.
- Live Firestore query test with client SDK and custom token: Verified Standard Admin (`e.educational.24@gmail.com`) queries `/admissions` with 551 documents returned.
- `npm run build`: Production build completed with Exit Code 0 and zero breaking errors.

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

3. Push manually when ready. This project workflow strictly prohibits automatic pushes:

   ```bash
   git push origin main
   ```
