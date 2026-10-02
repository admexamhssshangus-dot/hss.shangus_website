# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `feat(practicals): group attendance and award roll into awards export menu with subject scope control`
- **Date**: October 02, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally.

---

## Architectural Purpose & Enhancements

### 1. Grouped Attendance & Award Roll into Unified `Awards / Export` Menu
- **Problem**: The standalone `[Attendance]` and `[Award Roll]` buttons occupied excessive horizontal space on the toolbar alongside `[Awards / Export ▾]`, `[Fail / Absent]`, and `[Settings]`, causing horizontal overflow or multi-line button wrapping on standard laptops and mobile screens.
- **Solution**:
  - Removed the standalone `[Attendance]` and `[Award Roll]` buttons from the `AwardsSummaryView` toolbar.
  - Reorganized all print and export utilities inside a clean, modern dropdown menu under `[Awards / Export ▾]`.
  - Added clear institutional labels and explanatory subtitles for every print and export option:
    1. **Print Marks Record Award Roll**: Pract Copy / Assignment, Viva Voce & Total columns (7 institutional columns).
    2. **Print Attendance Sheet**: Candidate Signature sheet with Exam Roll No.
    3. **Print Official 2-Column Award Rolls**: Official 50/page JKBOSE layout (Figures & Words).
    4. **Print Consolidated Cover Letter & Matrix**: Forwarding letter + subject hash totals matrix.
    5. **Export Consolidated Excel (.xlsx)**: Sheet 1 (Cover Letter) + Sheet 2 (Awards Matrix).
    6. **Export Official Word Doc (.docx)**: Native Word (.docx) with official styling.
    7. **Export Blank Teacher Roster (.xlsx)**: Prefilled student list for offline marks entry.

### 2. Integrated Subject Target Control (Particular Subject vs. All Active Subjects)
- **Requirement**: Users needed intuitive, one-click control to print or export awards/attendance sheets either for **All Active Subjects** or for a **Particular Subject**.
- **Solution**:
  - Added an integrated **Target Subject Control** header block at the top of the `Awards / Export` dropdown menu:
    - **`All Subjects (X)` Button**: Quickly sets the target scope to all active subjects.
    - **`Particular Subject... ▾` Select Dropdown**: Allows instant selection of any specific subject (e.g. Physics, Chemistry, Biology, Zoology, Botany, Urdu, Education, etc.).
    - **Live Badge & Header Feedback**: Clearly indicates the active target (e.g., `Target Subject: Physics (PH)` vs `Target Subject: All Active Subjects (15)`).
    - **Auto-Synchronization**: Automatically switches to the single subject if the user has filtered down to exactly one subject via the subject filter pill.
  - Dynamically updates action labels to reflect the current scope (e.g. `Print Attendance Sheets (All 15 Subs)` vs `Print Attendance Sheet — Physics`, `Print Marks Record — Chemistry`, etc.).

### 3. PDF Generator Multi-Subject Batch Attendance Support
- **Enhancement in `practicalsPdfGenerator.js`**:
  - Upgraded `printAttendanceSheet` to accept `selectedSubjectCodes` in addition to `subjectCode`:
    - When `selectedSubjectCodes` is provided (All Subjects mode), it automatically iterates through each subject, selects students enrolled in that subject, and builds separate pages with clean `@media print` page breaks.
    - When a single subject is targeted (`subjectCode`), it omits the redundant `Subject(s)` column and expands the `Candidate Signature` column to 46% width for optimal signing space.
  - Verified `printMarksRecordAwardRoll` seamlessly handles both single-subject and multi-subject batch printing.

---

## Files Changed & Synchronizations Completed

### 1. `src/portal/admin/AdminPracticals.jsx`
- Removed standalone `[Attendance]` and `[Award Roll]` buttons from the `AwardsSummaryView` toolbar.
- Added `exportSubjectTarget` state (defaulting to `'all'`) with an auto-synchronizer for single-subject filters.
- Implemented the Target Subject Control pill/selector at the top of the `Awards / Export` dropdown.
- Grouped options into two distinct, beautifully styled sections: `Evaluation & Attendance Prints` and `Export Spreadsheets & Docs`.
- Wired print and export actions to respect `exportSubjectTarget`.

### 2. `src/utils/practicalsPdfGenerator.js`
- Added multi-subject batch pagination to `printAttendanceSheet` when `selectedSubjectCodes` is passed.
- Refined single-subject attendance table formatting (removed redundant `Subject(s)` column when filtering by subject and widened signature area).

---

## Verification & Build Details
- **Production Build**:
  - `npm run build` -> `Exit Code 0`
  - All static pages, SEO regression checks, and bundle chunks verified.

---

## Instructions for User

### 1. Inspect the Local Commit
To inspect the local commit:
```bash
git log -n 1 --stat
```

### 2. Manually Amend / Re-commit (Optional)
If you wish to adjust the commit message or files before pushing:
```bash
git reset --soft HEAD~1
# Make desired changes
git add .
git commit -m "feat(practicals): group attendance and award roll into awards export menu with subject scope control"
```

### 3. Manually Push to Remote Repository
As per project policy, the assistant never pushes to remote repositories. Please push manually when ready:
```bash
git push origin main
```
