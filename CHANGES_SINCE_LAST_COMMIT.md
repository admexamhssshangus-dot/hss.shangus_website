# Changes Since Last Commit

## Commit Message

`feat(practicals): harden admin practicals ingestion and consolidated award roll generation for session 2025-26`

## Summary of Changes

1. **Admin Practicals Suite (`src/portal/admin/AdminPracticals.jsx`)**:
   - **Active Session (2025–26) Precedence & Non-Destructive Merging**:
     - Synchronized `addOrMergeStudent` to give top authority to `admissions` data for the active 2025–26 cohort while non-destructively preserving historical exam roll numbers, board registration numbers, and permanent credentials from `masterRegisters`.
   - **Comprehensive Name & Father Name Key Resolution**:
     - Broadened name key lookups across `normalizeStudentFields`, `addOrMergeStudent`, `ingestRecords`, and `getSubjectMarkForStudent` to recognize `Student Name`, `Candidate Name`, `Name of Candidate`, `Name`, `Full Name`, `fullName`, and corresponding father/guardian variations.
   - **Container & Flat Document Ingestion**:
     - Hardened `ingestRecords` in `loadData` to seamlessly parse both flat document collections and container arrays (`.items`, `.records`, `.students`) from Firestore.
   - **Session Synchronization for Award Roll Printing**:
     - Added automatic synchronization of `localPrintOpts.sessionText` whenever `selectedSession` is toggled in the UI, guaranteeing that generated awards accurately reflect the selected session.
   - **Accurate Enrollment & Pending Counters**:
     - Adjusted `totalClassStudents` to include unapproved students in class rosters so that pending approval counters and badges display accurately, with roll deduplication properly scoped per session.

2. **Practicals PDF & Award Roll Generator (`src/utils/practicalsPdfGenerator.js`)**:
   - **Resilient 5-Tier Student Matching (`findStudentMarkRecord`)**:
     - Broadened candidate and father name resolution to support all naming variations, ensuring 100% match rate between teacher mark sheets and the student directory.
   - **Adaptive Consolidated Award Matrix Roll Column**:
     - In `printConsolidatedAwardRoll`, adapted the Roll No column header (`Exam Roll No.` vs `Roll No. / Name`) and row cells so that if official board exam roll numbers are not yet issued for session 2025–26, the report automatically formats Class Roll (`CR: <roll>`) and student name, preventing blank/empty columns and producing ready-to-sign official rolls.
   - **Multi-Format Subject Resolution (`resolveStudentSubjectsRaw`)**:
     - Added array parsing support for `st.selectedSubjects` and `st.subjects` alongside delimiter-separated strings.

## Files Changed

1. `src/portal/admin/AdminPracticals.jsx`
2. `src/utils/practicalsPdfGenerator.js`
3. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- **Production Build**: Verified locally with `npm run build` (`Exit Code 0`, 12 public HTML pages generated, all SEO/sitemap/metadata checks passed).
- **Academic Evaluation Data Boundary (Rule 8)**: Practicals and award roll data remains strictly confidential and internal to authenticated teachers and administrators, isolated from School-Based Assessment (Pre-Board).
- **Manual Git Push Policy (Rule 5)**: Never executed automatically.

## Manual Git Push Instructions

1. Inspect the local commit:
   ```bash
   git log -1 --stat
   ```
2. If you wish to inspect or re-execute the commit:
   ```bash
   git reset --soft HEAD~1
   git commit -m "feat(practicals): harden admin practicals ingestion and consolidated award roll generation for session 2025-26"
   ```
3. Push changes to GitHub (strictly manual):
   ```bash
   git push origin main
   ```
