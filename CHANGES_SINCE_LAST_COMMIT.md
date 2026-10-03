# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): enable real-time firestore sync for faculty submissions and permission reflection`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Automated Security, Admission, and SEO regression checks passed (`Exit Code 0`).

---

## Architectural Purpose & Issues Resolved

### Problem Statement
1. When a faculty member submitted practical awards or saved evaluation drafts in the teacher portal (`PracticalsPage.jsx`), the submission did not reflect immediately on the administrator's screen under **Faculty & Submissions** or in the pending approvals badge counter without manually hard-refreshing.
2. When an administrator granted or revoked evaluation permissions for a teacher under **Settings & Permissions -> Teacher Permissions**, the permissions did not take effect on the teacher portal immediately. Teachers still saw "Cross-Subject" warnings, or the granted subject was not listed as assigned.
3. Submissions were subject to multiple caching layers (a 3-minute in-memory cache in `AdminPracticals.jsx` and a 10-minute collection cache in `practicalsSettingsManager.js`) that prevented instant synchronization across active browser sessions.

---

### Technical Root Cause Analysis
1. **Absence of Real-time Firestore Listeners (`onSnapshot`) in `AdminPracticals.jsx`**:
   - `AdminPracticals.jsx` only loaded data once on component mount via `getDocs(collection(db, 'practicalsData'))`.
   - Switching tabs (`class10`, `class11`, `class12`, `faculty_submissions`, `settings`) simply changed UI state without re-querying Firestore.
   - When a teacher submitted an award on their device, the administrator's browser had no event listener to receive the newly created staging document (`pending_*`), leaving the pending approvals tray and tab counters stale.
2. **Aggressive In-Memory Caching (`memoryPracticalsData`)**:
   - `loadData` cached `practicalsData` in module memory for 3 minutes (`Date.now() - memoryPracticalsTs < 3 * 60 * 1000`). Even if `loadData()` was invoked without `force=true`, stale cached documents were returned.
3. **Teacher Evaluation Permissions Disconnect & Caching**:
   - `getAdminPracticalsSettings()` in `practicalsSettingsManager.js` cached `adminPracticalsSettings` collection for 10 minutes (`10 * 60 * 1000`).
   - When admin saved permissions, `saveSettingsDoc` in `AdminPracticals.jsx` did not invalidate `adminPracticalsSettings` cache.
   - Furthermore, `getTeacherClassSubjectPermissions` and `isCrossSubject` in `PracticalsPage.jsx` only checked `user.assignedSubjects` from the user profile; they were never merging explicit permissions granted by administrators in `adminPracticalsSettings.permissions`.

---

## Changes Implemented

### 1. Real-Time Firestore Sync on Submissions & Pending Approvals
- File: [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)
  - Extracted modular `parsePracticalsSnap` helper to sanitize records, normalize academic sessions, and separate canonical awards from pending approval staging documents.
  - Added an active `onSnapshot(collection(db, 'practicalsData'), ...)` listener inside `useEffect`. As soon as any faculty member saves a draft, submits an award, or updates student marks, the admin portal receives the update in real time.
  - Updated `setSubmissions` and `setPendingApprovals` reactively, updating the ribbon count `Faculty & Submissions (N)` and the pulsing `Pending Award Approvals` alert tray instantly.
  - Added real-time listener on `doc(db, 'adminPracticalsSettings', 'config')` to sync practical configurations and permissions.
  - Updated `loadData(force)` to flush both memory and collection caches whenever force refresh is requested.
  - Updated `saveSettingsDoc` to invalidate `adminPracticalsSettings` cache upon every write.

### 2. Immediate Teacher Evaluation Permission Propagation
- File: [src/utils/practicalsSettingsManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSettingsManager.js)
  - Added `force` parameter support to `getAdminPracticalsSettings(force = false)` to allow callers to bypass the 10-minute cache on demand.
  - Enhanced `getTeacherClassSubjectPermissions(user, practicalsSettings = null)` to merge explicit administrator permissions granted under `adminPracticalsSettings.permissions` for the teacher's email.
  - Updated `getTeacherAssignedSubjectsForClass(user, targetClass, practicalsSettings = null)` to incorporate merged permissions.

### 3. Reactive Permissions & Cross-Subject Validation on Teacher Portal
- File: [src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)
  - Added real-time `onSnapshot` listener on `doc(db, 'adminPracticalsSettings', 'config')` so teacher portals receive permissions within milliseconds of admin granting them.
  - Merged `practicalsSettings.permissions` into `allTeacherAssignedSubjects` and `teacherAssignedClasses`.
  - Updated `isCrossSubject` logic to verify explicit permissions from `practicalsSettings.permissions`, eliminating false cross-subject flags and enabling frictionless submissions.

---

## Verification & Build Results
- **Production Build**: Executed `npm run build` with `Exit Code 0`.
- **Search Pages & SEO Verification**: 11 public pages generated; automated SEO regression checks passed with zero errors.
- **Firebase Security Rules**: Checked and confirmed intact.

---

## Instructions for User

### Reviewing the Local Commit
To inspect the commit history:
```bash
git log -n 1 --stat
```

### Amending or Re-committing (Optional)
If you wish to edit or amend the commit:
```bash
git reset --soft HEAD~1
git commit -m "fix(practicals): enable real-time firestore sync for faculty submissions and permission reflection"
```

### Pushing to Production
Per the strict project instructions, the AI assistant **never pushes to remote repositories**. Please deploy your verified changes to GitHub and Firebase Hosting by running:
```bash
git push origin main
```
