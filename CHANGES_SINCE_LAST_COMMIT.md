# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `feat(practicals): auto-archive superseded pending overwrite submissions to recycle bin for data consistency`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Automated Security, Admission, and SEO regression checks passed (`Exit Code 0`).

---

## Architectural Purpose & Issues Resolved

### Problem Statement
When a faculty member submits an overwrite / rewrite submission (for Practicals & Award Rolls or School-Based Assessments) and the administrator has not reviewed or approved it yet, and before administrator approval the teacher submits *another* overwrite request:
- Previously, the new submission payload would directly overwrite the pending document, causing the prior unapproved submission to be lost without an audit trail.
- If discrepancies or questions arose later regarding what was previously entered versus the latest submission, there was no historical snapshot for reference or auditability.

### Solution: Automatic Recycle Bin Archival of Superseded Submissions
1. **Latest Always Remains Active**:
   - The newest submission becomes the active pending record (`pendingDocId`) in `practicalsData`, cleanly awaiting administrator review and integration into the master gazettes.
2. **Prior Unreviewed Submission Auto-Archived**:
   - Before the new payload is written to `pendingDocId`, any prior pending submission is automatically detected (both in component state and verified directly against live Firestore).
   - The prior submission—including all its student marks, candidate records, author details, and submission timestamps—is safely cloned and archived into `practicalsRecycleBin` as a `superseded_pending` record.
   - It is also captured in the 3-version rollback history (`practicalsBin`), ensuring 100% data consistency and complete institutional auditability.
3. **Dedicated Status Identification**:
   - In the Practicals Recycle Bin, superseded items display a dedicated `Superseded Overwrite` badge in purple with full context ("Superseded by newer teacher overwrite request before admin approval").
   - Administrators reviewing both Practicals and School-Based Assessments can open the Recycle Bin directly from their respective approval dashboards.

---

## Changes Implemented

### 1. Dedicated Superseded Submission Archiving Engine
- File: [src/services/practicalsBinService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/practicalsBinService.js)
  - Created and exported `archiveSupersededPendingSubmission(pendingDoc, userMeta, canonicalDocId)`.
  - Creates a timestamped document `pbin_superseded_<docId>_<timestamp>` in `practicalsRecycleBin`.
  - Preserves entire `submissionData`, `recordsCount`, `submittedBy`, `submittedByEmail`, `originalStatus: 'superseded_pending'`, and `isSuperseded: true`.
  - Links to `saveVersionToBin` for rollback history.
  - Logs administrative audit trail via `logAdminActivity`.

### 2. Teacher Practicals Resubmission / Overwrite Safeguard
- File: [src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)
  - Imported `archiveSupersededPendingSubmission` and `getDoc`.
  - In `handleFinalSubmit`:
    - Checks whether an unapproved pending submission is currently awaiting review at `pendingDocId`.
    - If present, automatically archives it to the Recycle Bin via `archiveSupersededPendingSubmission` before writing the latest submission payload.
    - Also archives the canonical approved award to Version Bin.

### 3. Teacher School-Based Assessment Resubmission Safeguard
- File: [src/portal/teacher/TeacherAssessmentsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherAssessmentsPage.jsx)
  - Imported `archiveSupersededPendingSubmission` and `saveVersionToBin`.
  - In `handleSubmitFinal`:
    - Verifies whether a prior pending assessment (Pre-Board, Unit Assessment, Golden Test) was waiting for administrator approval.
    - If found, auto-archives the prior unapproved submission to `practicalsRecycleBin` and version history before saving the latest record.

### 4. Admin Recycle Bin Modal UI Enhancements
- File: [src/portal/admin/PracticalsRecycleBinModal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/PracticalsRecycleBinModal.jsx)
  - Updated `StatusBadge` to render `Superseded Overwrite` in purple with a descriptive tooltip.
  - In the expanded document inspection row, displays `Archived Context: item.archivedReason`.

### 5. Admin School-Based Assessment Suite Integration
- File: [src/portal/admin/SchoolAssessmentApprovalsView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAssessmentApprovalsView.jsx)
  - Imported `PracticalsRecycleBinModal`.
  - Added a "Recycle Bin" button to the approvals toolbar with a trash icon and purple badge.
  - Mounted `PracticalsRecycleBinModal` for seamless inspection and reference of superseded submissions.

---

## Verification & Build Results
- **Production Build**: Verified with `npm run build` (`Exit Code 0`).
- **Static Asset Generation**: 11 public pages, canonical redirects, sitemap, and SEO regression checks passed.
- **Firebase Security Rules & RBAC**: Academic evaluation boundaries intact; practicals confidential to teachers and admins.

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
