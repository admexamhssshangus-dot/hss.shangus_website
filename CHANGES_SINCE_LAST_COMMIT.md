# Changes Since Last Commit

## Commit Message

`feat(cms,practicals): add notice up/down reordering in CMS and fix teacher practical printing with blank award roll and attendance sheets`

## Summary of Changes

1. **Website CMS Notices Reordering (`src/pages/AdminPortal.jsx`)**:
   - **Up/Down Ordering Handlers (`handleMoveNoticeUp`, `handleMoveNoticeDown`)**:
     - Allows administrators to seamlessly shift notices up or down by one position.
     - Preserves inline editing state if an active row is reordered.
     - Automatically notifies the administrator to save changes to persist live.
   - **Table UI Controls**:
     - Added `#` (Rank / S.No.) column displaying the live ordinal sequence (`1`, `2`, `3`...).
     - Added `ArrowUp` and `ArrowDown` action buttons with proper bounds disabling (disabled at top/bottom boundary).
     - Expanded table header to `Order & Action` with comfortable minimum width to prevent row wrapping.
     - Reordering persists directly to Cloud Firestore, local preview storage, and cache busting when clicking "Save Notices".

2. **Teacher Practicals Printing Fixes & Expansion (`src/portal/teacher/PracticalsPage.jsx` & `src/utils/practicalsPdfGenerator.js`)**:
   - **Roster Attribute Preservation**: Fixed student roster projection in `fetchRosterAndExistingAward` to keep all student record attributes (`...st`, `raw: st`, `_rawStudent: st`, `class`, `className`, `stream`, `session`, `isApproved: true`, `subjectsAbbr`, `rawSubjects`), preventing students from being dropped during practical subject checks.
   - **Blank Award Roll (Official 2-Column JKBOSE Layout)**: Added `handlePrintBlankAwardRoll` in teacher portal for manual examiner mark entry during practical exams.
   - **Attendance Sheet (Candidate Signatures)**: Added `handlePrintAttendanceSheet` scoped strictly to the teacher's assigned practical subject.
   - **Teacher Print Dropdown Menu**: Expanded to 4 options:
     1. *Print Blank Marks Record Sheets*
     2. *Print Blank Award Roll (Official 2-Column)*
     3. *Print Attendance Sheet (Candidate Signatures)*
     4. *Print Official Award Roll (With Entered Marks)*
   - **PDF Generator Resiliency**: Hardened `resolveStudentSubjectsRaw` & `resolveStudentStream` to inspect `st.rawSubjects` & `st.subjectsAbbr`, and fall back cleanly when single subject rosters are already pre-filtered.

## Files Changed

1. `src/pages/AdminPortal.jsx`
2. `src/portal/teacher/PracticalsPage.jsx`
3. `src/utils/practicalsPdfGenerator.js`
4. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- **Production Build**: Verified locally with `npm run build` (`Exit Code 0`, 12 public HTML pages generated, all SEO/sitemap/metadata checks passed).
- **Manual Git Push Policy (Rule 5)**: Never executed automatically.

## Manual Git Push Instructions

1. Inspect the local commit:
   ```bash
   git log -1 --stat
   ```
2. If you wish to inspect or re-execute the commit:
   ```bash
   git reset --soft HEAD~1
   git commit -m "feat(cms,practicals): add notice up/down reordering in CMS and fix teacher practical printing with blank award roll and attendance sheets"
   ```
3. Push changes to GitHub (strictly manual):
   ```bash
   git push origin main
   ```
