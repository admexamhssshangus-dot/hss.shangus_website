# Changes Since Last Commit

## Commit Message

`feat(examinee-drop): add compact label with interactive floating tooltip for students dropped from JKBOSE exams`

## Summary

- **Created `ExamDropBadge` Component (`src/portal/admin/ExamDropBadge.jsx`)**:
  - Implemented a compact, prominent badge (`EXAM DROPPED` / `DROPPED`) featuring an animated rose pulsing indicator dot and subtle micro-interactions (`hover:scale-105 active:scale-95`).
  - Utilizes a window-responsive floating portal tooltip rendered directly into `document.body` via `createPortal`. This completely prevents CSS clipping inside table `overflow-x-auto` / `overflow-y-auto` containers and maintains correct positioning across desktop viewports, mobile screens, and table scroll states.
  - Interactive tooltip displays:
    - **Header Bar**: Status pill (`Examinee Dropped • JKBOSE Regular • Excluded`).
    - **Student Demographics**: Name, Class, Roll Number, Form Number, and Board Registration Number.
    - **Drop Comment & Order Details**: Dedicated high-contrast quote card displaying the full administrative reason/comment for the drop.
    - **Institutional Policy Note**: Explicit warning that the candidate is excluded from regular JKBOSE exams returns, award rolls, and practicals.
    - **Order Metadata**: Responsible authority (`Administration / Examination Cell`), academic session (`2025-26`), and recorded timestamp.

- **Centralized Drop Details Helper (`src/utils/studentApprovalStatus.js`)**:
  - Added and exported `getStudentExamDropDetails(student)`:
    - Identifies if a student is dropped using authoritative institutional invariants (e.g., Class 10th Roll 46 Suhaib Yousuf, Class 11th Roll 72 Seher Un Nisa & Roll 186 Wanhar Ahmad Malik, generic flags `isExamDropped`, `examDropped`, `status: 'dropped' / 'discharged'`).
    - Resolves specific administrative comments and reasons, falling back to authoritative institutional descriptions where applicable.

- **Integrated into Admin Portal Data Tables & Modals**:
  - `src/portal/admin/AdvancedReports.jsx`:
    - Mounted `<ExamDropBadge student={student} />` in the `STUDENT'S NAME` column right beside the student name, gender badge, and JKBOSE field badges.
    - Mounted `<ExamDropBadge student={student} minimal />` in the `STATUS` column under the status action dropdown.
    - Added JKBOSE Exam Status and reason to the "View Activity History" dialog modal (`handleViewHistory`).
  - `src/portal/admin/ApplicationsTable.jsx`: Mounted `ExamDropBadge` beside student names in application rows.
  - `src/portal/admin/ApplicationReviewModal.jsx`: Mounted `ExamDropBadge` in the header review title next to form number and examinee name.

- **Unit & Cohort Invariant Testing (`src/utils/studentApprovalStatus.test.js`)**:
  - Added unit tests for `getStudentExamDropDetails`: verified `null` for active students, and verified full details extraction for Class 10th and 11th dropped examinees.

## Files Changed

1. `src/portal/admin/ExamDropBadge.jsx` (New)
2. `src/utils/studentApprovalStatus.js`
3. `src/utils/studentApprovalStatus.test.js`
4. `src/portal/admin/AdvancedReports.jsx`
5. `src/portal/admin/ApplicationsTable.jsx`
6. `src/portal/admin/ApplicationReviewModal.jsx`
7. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npx react-scripts test src/utils/studentApprovalStatus.test.js --watchAll=false`: 10/10 unit tests passed.
- `npm run test:public`: 10/10 security and public records verification tests passed.
- `npm run security:check`: Security regression checks passed.
- `npm run admission:check`: Admission schema & PDF regression checks passed.
- `npm run build`: Production build completed with `Exit Code 0` and zero breaking errors.

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

3. Manually push changes to remote repository:

   ```bash
   git push origin main
   ```
