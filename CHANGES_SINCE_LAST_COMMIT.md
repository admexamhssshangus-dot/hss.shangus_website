# Changes Log & Commit Reference

## Current Working Changes

### 1. Database Audit: Zero Previous Sessions Overwritten
- **Audit Findings (Verified Against Live Firestore REST API via `scripts/deep_audit_previous_sessions.mjs`):**
  - **`masterRegisters`**:
    - Updates executed on Sep 30, 2026 for Session 2025-26: **399** (Class 12th: 203, Class 11th: 196).
    - Updates executed on Sep 30, 2026 for Previous Sessions: **0**.
    - **Confirmed**: ZERO previous session records in `masterRegisters` were overwritten.
  - **`admissions`**:
    - Updates executed on Sep 30, 2026 for Previous Sessions: **0**.
    - **Confirmed**: ZERO previous session admissions documents were overwritten.
  - **Inspection of `Umair Bin Shabir Lone` (Session 2024-25 Oct-Nov, Class 9th, Roll 19, `docId: chunk_003`)**:
    - In Firestore database, his fields were completely untouched: `currExamRollNo: undefined`, `boardRollNo: undefined`, `examRollNo: undefined`, `updatedAt: undefined`.
    - His physical Firestore document was never modified.

### 2. Root Cause & Fix for False Tooltip on Previous Session Students
- **Root Cause:**
  - In `src/utils/jkboseTraceability.js`:
    - `loadRecentJkboseBatchTraceability` extracted candidate identifiers from batch entry locators, including `entry.locator?.identity?.roll` (e.g. `'19'`).
    - `computeStudentJkboseStatusMap` looked up `batchTraceabilityMap` using an array of student identifiers that included un-scoped `student.classRollNo` (`'19'`).
    - Umair Bin Shabir Lone in 9th class (2024-25) has class roll number `19`. Candidate #19 in the 2025-26 12th class batch update had exam roll `301003046`.
    - Because `classRollNo` was compared as a plain un-scoped string, the badge for candidate 19 in 9th class collided with the batch audit log entry for candidate 19 in 12th class.
- **Fix in `src/utils/jkboseTraceability.js`:**
  - Removed plain un-scoped `student.classRollNo` and `entry.locator?.identity?.roll` from global batch matching.
  - Replaced roll matching with strictly cohort-scoped key: `${session}_${className}_${roll}` (using canonical session and class normalizers from `recordIdentity`).
  - Scoped matching strictly to immutable authorities: `documentId`, `regNo` / `boardRegNo`, `formNo`, `admNo`, and scoped roll.
  - Completely eliminated cross-session and cross-class badge collisions.

### 3. Root Cause & Fix for Blank `EXAM R.NO.` in Admin Table for 2025-26 Students
- **Root Cause:**
  - The 399 exam roll numbers for 2025-26 were originally saved into the `masterRegisters` collection.
  - In `localhost:3000/portal/admin`, the student list displays active `admissions` records (`APPR (ADM)`).
  - In `admissions` for 2025-26, the documents had `currExamRollNo: null`.
  - In `src/portal/admin/AdvancedReports.jsx`, `COLUMN_DEFS` did not have a custom `render` function for `currExamRollNo`, causing it to simply render `s['currExamRollNo'] ?? '—'`.
  - The admissions mapping in `AdvancedReports.jsx` mapped `currExamRollNo` from active record `a` without checking `masterMatch`.
  - Consequently, the cell showed `—`, while the badge next to it displayed the tooltip with `MASTER: 301004037`.
- **Fix in `src/portal/admin/AdvancedReports.jsx`:**
  - Added a dedicated `render` function to `currExamRollNo` in `COLUMN_DEFS` that formats the roll number in bold monospace and automatically falls back to `student?.currExamRollNo || student?.boardRollNo || student?.examRollNo || student?.['Exam R.No. (Current)'] || status?.newValue`.
  - Enriched the active admissions mapper to check `masterMatch?.currExamRollNo || masterMatch?.boardRollNo || masterMatch?.examRollNo || masterMatch?.['Exam R.No. (Current)'] || masterMatch?.['Board Roll Number']`.
  - Also enriched `currResult` and `currMarksReapp` with fallback to `masterMatch`.
- **Database Synchronization to `admissions` Collection:**
  - Executed `scripts/sync_rolls_to_admissions.mjs` using Firestore REST API `batchWrite`.
  - Matched 448 active 2025-26 admissions candidates (446 by Board Registration Number, 2 by verified Name + Class).
  - Wrote `currExamRollNo`, `boardRollNo`, `examRollNo`, `lastBoardSyncAt`, and `boardSyncSource` directly into each student's admission document in Firestore.
  - Verified on student `Faizan Bilal Najar` (`adm_250402`): roll `301004015` is now stored directly in his Firestore record.

---

## Files Added / Modified
- `src/utils/jkboseTraceability.js` (Modified)
- `src/portal/admin/AdvancedReports.jsx` (Modified)
- `scripts/sync_rolls_to_admissions.mjs` (Added)
- `scripts/deep_audit_previous_sessions.mjs` (Added)
- `scripts/audit_database_sessions.mjs` (Added)
- `scripts/inspect_adm_fields.mjs` (Added)
- `CHANGES_SINCE_LAST_COMMIT.md` (Modified)

---

## Local Commit Message
```bash
fix(records): resolve cross-session tooltip collision and sync 2025-26 exam roll numbers into admissions
```

---

## Instructions for User: Review & Push
All changes have been built and verified locally (`npm run build` completed with Exit Code 0), staged, and committed to your local Git repository.

### How to Inspect the Local Commit:
```bash
git log -1 --stat
git show HEAD
```

### How to Amend or Re-commit (if desired):
```bash
git reset --soft HEAD~1
# Make any additional changes if needed
git commit -m "fix(records): resolve cross-session tooltip collision and sync 2025-26 exam roll numbers into admissions"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
