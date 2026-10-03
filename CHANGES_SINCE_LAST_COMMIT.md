# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): enforce strict session isolation in print roll, match signatures to subject columns, and verify approval pipeline`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally.

---

## Architectural Purpose & Issues Resolved

### 1. Fix for Class 10th Deleted Awards in Consolidated Printout
- **Root Cause**:
  - In `AwardsSummaryView` (the web table), submissions were strictly queried by `normalizePracticalSession(querySess)` (`2025-26`), which properly excluded deleted or historical awards.
  - However, in `printConsolidatedAwardRoll` (`src/utils/practicalsPdfGenerator.js`), `isSubDocMatch` and `hasSubjectPracticalSubmission` were missing strict session checks and did not check `!s.isDeleted`. When no current submissions existed for Class 10th (`subsWithMarks.length === 0`), `activeSubs` fell back to `candidateSubs` (which includes 10th Mathematics and Science), and `submissions.find(isSubDocMatch)` matched historical/deleted submissions.
- **Resolution**:
  - Added `session` parameter and strict normalized comparison (`normalizePracticalSession`) to `hasSubjectPracticalSubmission`.
  - Added strict session check and `!s.isDeleted && s.status !== 'deleted'` guard to `isSubDocMatch`.
  - Prevented deleted or cross-session records from ever leaking into the matrix cells or row hash totals.

### 2. Signatures Dynamically Matched to Subject Columns in All Classes
- **Resolution**:
  - In `printConsolidatedAwardRoll`, `examinerSignaturesHtml` directly maps over `activeSubs` (the exact subject columns appearing in the matrix table).
  - For each subject column:
    - Renders `${idx + 1}. ${subDisplayName} (${sub.code}): ....................................`
    - Resolves examiner name strictly using `isSubDocMatch(s)` so only live, non-deleted, session-matched submissions provide examiner names.
    - If no live submission exists for that subject, renders a clean blank dotted line for manual signing on paper.
  - Responsive grid layout (`1, 2, 3, or 4` columns based on subject count) ensures clean alignment across all classes (10th, 11th, and 12th).

### 3. Verification of Re-submission & Approval Window Pipeline
- **Verification**:
  - Confirmed that when an admin deletes a submission (moving it to the Practicals Recycle Bin), the teacher's slot in `PracticalsPage.jsx` is completely freed.
  - When the teacher re-submits, the award document is created with ID `pending_${docId}` and status `'pending_approval'`.
  - On admin load, this is filtered into `pendingApprovals` and rendered in the **Pending Award Approvals Tray** at the top of the "Faculty & Submissions" tab with full candidate details, Inspect, Approve, and Reject actions.
  - The tab navigation button displays the total submissions including pending (`submissions.length + pendingApprovals.length`), with an animated amber counter badge alerting the admin to pending actions.

### 4. Consolidated Architecture for Faculty & Submissions
- Inside `FacultySubmissionsView`, submissions and faculty are unified:
  - Each faculty member row presents their contact details, phone editing, and subject submissions badges (Internal & External) with record counts and pending alerts.
  - Inline Audit Drawers allow expanding full document details per teacher or expanding all at once.

---

## Files Changed

1. `src/utils/practicalsPdfGenerator.js`:
   - Updated `hasSubjectPracticalSubmission` to accept `session` and check `!s.isDeleted`.
   - Updated `isSubDocMatch` in `printConsolidatedAwardRoll` to strictly check session and deletion status.
   - Updated `examinerSignaturesHtml` to use `isSubDocMatch`, ensuring signatures match subject columns and never pull stale/deleted examiner names.
   - Cleaned up unused variable warning (`targetType`).
2. `src/portal/admin/AdminPracticals.jsx`:
   - Enhanced faculty matching by email and normalized name.
   - Added pending approval status badges and approval actions inside document audit rows.
3. `src/utils/practicalsSettingsManager.js`:
   - Added `normalizePracticalSession` for consistent session key normalization across the application.
4. `src/utils/practicalsCsvManager.js`:
   - Synchronized Word `.docx` exports with dynamic subject column signatures and institutional certificate text.

---

## Verification & Build Details
- **Production Build**:
  - `npm run build` -> `Exit Code 0` (Zero breaking errors).
- **SEO & Static Checks**:
  - 11 static pages generated, canonical redirects, routing, and sitemap verified.

---

## Instructions for User

### Reviewing the Local Commit
To inspect the changes made in this commit:
```bash
git log -n 1 --stat
git show HEAD
```

### Amending or Re-committing (Optional)
If you wish to make additional adjustments before pushing:
```bash
git reset --soft HEAD~1
# Make desired adjustments
git add .
git commit -m "fix(practicals): enforce strict session isolation in print roll, match signatures to subject columns, and verify approval pipeline"
```

### Pushing Changes
Whenever you are ready to update the remote repository, run:
```bash
git push origin main
```
*(As per repository safety guidelines, remote git pushes are performed exclusively by the user.)*
