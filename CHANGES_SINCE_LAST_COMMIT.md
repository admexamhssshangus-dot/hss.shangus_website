# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `feat(realtime): enable targeted real-time firestore sync for practicals, assessments, and attendance without refresh`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Automated Security, Admission, and SEO regression checks passed (`Exit Code 0`).

---

## Architectural Purpose & Issues Resolved

### Problem Statement
Faculty and administrators reported that statuses across the academic modules did not reflect in real-time:
1. **Practicals & Award Rolls**: When a teacher submitted an award list (e.g., Class 12th Botany Internal Assessment), the banner displayed `Submission Pending Administrator Approval [UNDER REVIEW]`. Once the administrator approved or requested revision, the teacher's screen did not reflect the new status until they manually refreshed, logged out and back in.
2. **School-Based Assessments**: School-Based Assessment submissions (Pre-Board, Golden Tests, Unit Assessments) remained static in teacher and admin views without live synchronization.
3. **Daily Attendance & Global Settings**: When attendance was marked/confirmed or when administrators toggled `attendanceSubmissionOpen` in system settings, teachers had to reload the page to see the updated lock or saved status.

### Spark Plan Quota Compliance (< 50,000 reads/day)
To prevent exceeding Firebase's Spark free tier daily quota of 50,000 reads:
- **Zero Full-Collection Listeners on Faculty Portals**: Unbounded `onSnapshot(collection(db, ...))` queries were strictly avoided on teacher screens. Otherwise, a single submission would trigger reads across all teachers logged into the school system.
- **Targeted On-Demand Document Listeners**: Teachers only attach `onSnapshot(doc(db, ...))` to the specific 1–2 documents actively rendered on their screen (`pendingDocId` and `canonicalDocId`, or active date `attendance` doc).
- **Automatic Lifecycle Unsubscribe**: When teachers switch classes, subjects, or dates, previous document listeners are cleanly torn down and replaced with the new single target.
- **Admin Tray Optimization**: Administrator approval queues attach listeners strictly while the admin approval modal/tab is mounted.

---

## Changes Implemented

### 1. Teacher Practicals & Award Rolls Real-time Synchronization
- File: [src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)
  - Attached targeted `onSnapshot` listener to `doc(db, 'practicalsData', pendingDocId)`:
    - Detects administrator approval (pending document deleted/cleared) and immediate status updates.
    - If rejected, captures `rejectionReason` and renders the feedback notice in real time.
  - Attached targeted `onSnapshot` listener to `doc(db, 'practicalsData', docId)`:
    - When approved, `cData.status === 'approved'` automatically clears the pending under-review banner and activates the live `Live in Database` badge.
    - Syncs updated marks into the active table if administrator adjusted any marks.
  - Attached targeted `onSnapshot` listener to `doc(db, 'adminPracticalsSettings', 'config')`:
    - Reflects administrator-granted subject permissions and deadline extensions instantaneously.

### 2. Teacher School-Based Assessment Real-time Synchronization
- File: [src/portal/teacher/TeacherAssessmentsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherAssessmentsPage.jsx)
  - Imported `onSnapshot` and attached targeted listeners on `pendingDocId` and `canonicalDocId`.
  - When administrator approves a Pre-Board or Term Test in the SBA suite, `submissionStatus` immediately turns to `'approved'` ("Approved & Live in Gazette") with green checkmark badge.
  - If revision is requested, status immediately switches to `'rejected'` with administrative remarks visible.

### 3. Teacher Daily Attendance & System Settings Sync
- File: [src/portal/teacher/AttendancePage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/AttendancePage.jsx)
  - Imported `onSnapshot` from `firebase/firestore`.
  - Added targeted real-time sync for `doc(db, 'site', 'settings')`:
    - When an administrator toggles `attendanceSubmissionOpen` on or off, `isAttendanceOpen` updates immediately on the teacher's screen without requiring page refresh.
  - Added targeted real-time sync on `doc(db, 'attendance', primaryDocId)`:
    - Tracks `${clsNorm}_${selectedDate}_${selectedSubject || 'general'}`.
    - Whenever attendance is confirmed, saved, or updated by faculty or administrators, `isEditingSaved` and individual student status badges (`P`, `A`, `L`) update immediately.

### 4. Admin School-Based Assessment Approvals Tray
- File: [src/portal/admin/SchoolAssessmentApprovalsView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAssessmentApprovalsView.jsx)
  - Imported `onSnapshot` and attached live collection listener for `practicalsData` while the approvals view is open.
  - Submissions from teachers immediately populate the approval tray, and approved/rejected submissions update live.

### 5. Admin Attendance Overview & Config Sync
- File: [src/portal/admin/AdminAttendance.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminAttendance.jsx)
  - Added targeted real-time listeners for `doc(db, 'systemSettings', 'attendanceSummary')` and `doc(db, 'systemSettings', 'attendanceConfig')`.
  - Overview cards and system attendance modes reflect instant database state changes.

---

## Verification & Build Results
- **Production Build**: Verified with `npm run build` (`Exit Code 0`).
- **Targeted Quota Consumption**: ~1-2 document reads per active view; well within Spark Plan limits.
- **Firebase Security Rules**: Confirmed compliant with academic evaluation boundaries (Practicals strictly confidential, SBA isolated).

---

## Instructions for the User

### 1. Inspect the Local Commit
You can review the staged and committed changes anytime by running:
```bash
git log -1 --stat
```
or to inspect the exact line-by-line diff:
```bash
git show HEAD
```

### 2. Amend / Re-commit (Optional)
If you would like to edit or amend the commit message:
```bash
git reset --soft HEAD~1
git commit -m "your custom commit message"
```

### 3. Push to Remote Repository
As per project rules, the assistant does NOT push to remote repositories. When you are ready to publish these changes, please run:
```bash
git push origin main
```
