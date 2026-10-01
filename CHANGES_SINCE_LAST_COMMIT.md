# Changes Log & Commit Reference

## Latest Commit: Synchronize Web Preview and Print Roll Numbers & Make Actions & Exports Ultra-Compact on Single Row

**Commit Message:** `fix(roster): synchronize web preview and print roll numbers and make actions & exports ultra compact on single row`

---

### Context & Requirements Addressed

- **User Requests**:
  1. *"if class roll no is active why not updating in preview/print"*
  2. *"print and web are not consistent.... arrange all on same row using compact design for Actions & Exports"*

- **Root Causes Identified**:
  1. **Web Preview & Print Inconsistency**:
     - In Web Preview (`CustomRosterDocumentBuilderView.jsx`), the 2-column attendance sheet checked `hasExamRollCol = activeColumns.some(c => c.key === 'examRollNo')`. If `examRollNo` was present in `activeColumns` (even if positioned after `classRollNo`), it blindly forced the header to `Exam R.No.` and displayed the JKBOSE Exam Roll Number (`row.examRollNo`), completely ignoring the user's active `classRollNo`.
     - In Print (`customRosterExportUtils.js`), `buildTwoColumnAttendanceHtml` was not receiving `rollColInfo`, causing `hasExamRollCol` to default to `false` and rendering `R.No.` with `st.classRollNo` (`1, 2, 3...`).
     - Result: The web preview displayed `Exam R.No.` (`201003072, 201003073...`), while the browser print dialog displayed `R.No.` (`1, 2, 3...`)!
  2. **Actions & Exports Card Layout**:
     - Card 4 ("Actions & Exports") previously stacked 6 controls into 3 separate vertical rows (a giant full-width print button, a 3-button export grid, and a 2-button inclusion toggle row), consuming excessive vertical space in the right control sidebar.

---

### Solutions Implemented

1. **Universal Attendance Roll Number Resolution (`resolveAttendanceRollCol` & `getAttendanceStudentRoll`)**:
   - Added shared resolution logic in `src/utils/customRosterExportUtils.js`:
     - Checks the positions of `classRollNo` and `examRollNo` in `activeColumns`.
     - If only `classRollNo` is active: renders `R.No.` with student's class roll number.
     - If only `examRollNo` is active: renders `Exam R.No.` with student's JKBOSE exam roll number.
     - If **both** are active: respects user's explicit column order (`classIdx < examIdx` prioritizes `classRollNo`, and vice versa).
   - Wired seamlessly across:
     - **Web Preview** (`CustomRosterDocumentBuilderView.jsx`)
     - **Browser Print Dialog** (`customRosterExportUtils.js` - `buildTwoColumnAttendanceHtml`)
     - **Word (.docx) Export** (`customRosterDocxGenerator.js` - `generateTwoColumnAttendanceDocx`)
     - **Excel (.xlsx) Export** (`customRosterExportUtils.js` - `exportCustomRosterExcel`)
     - **CSV Export** (`customRosterExportUtils.js` - `exportCustomRosterCsv`)
   - All 5 formats are now 100% synchronized and consistent.

2. **Quick Roll Number Mode Switcher & Interactive Header**:
   - Added an explicit `Roll No: [ Class R.No. ✓ ] [ Exam R.No. ]` pill toggle directly inside the `Examination Attendance Sheet Setup` toolbar.
   - Administrators can instantly switch between Class Roll No and Exam Roll No with a single click.
   - Clicking the table header (`th`) in the live preview also toggles between Class Roll No and Exam Roll No with smooth hover feedback.

3. **Ultra-Compact Single-Row Actions & Exports Bar**:
   - Redesigned Card 4 ("Actions & Exports") into a sleek, unified single-row toolbar:
     - `[ 🖨️ Print / PDF (Ctrl+P) ] [ 📊 Excel ] [ 📄 Word ] [ ⬇ CSV ] [ ☑ All / Deselect ] [ 👁 Skipped ]`
     - Eliminates multi-row vertical stacking and saves valuable screen space on both desktop and tablet views.

---

### Exact List of Files Changed

- `src/portal/admin/CustomRosterDocumentBuilderView.jsx`
- `src/utils/customRosterExportUtils.js`
- `src/utils/customRosterDocxGenerator.js`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

### Verification & Build Status

- **Build Command**: `npm run build`
- **Result**: `Exit Code 0` (Zero breaking errors, production bundle compiled cleanly with SEO checks passed).

---

### Manual Inspection & Git Instructions for User

```bash
# 1. Review the committed changes
git status
git log -n 1 --stat

# 2. (Optional) If you want to amend or re-execute the commit:
git reset --soft HEAD~1
git commit -m "fix(roster): synchronize web preview and print roll numbers and make actions & exports ultra compact on single row"

# 3. Push to remote repository (STRICT MANUAL PUSH RULE)
git push origin main
```
