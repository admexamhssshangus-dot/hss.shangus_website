# Changes Log & Commit Reference

## Current Working Changes

### 1. Multi-Select Cohort Checkbox Filters & Full Student Identity Display
- **User Requests Addressed:**
  - *"why all labels not not shown like class, name, session etc..."*
  - *"and why shows 386 instead of 399 overwrite for class 11th and 12th....."*
  - *"morever all check box drop down to chose custom filter"*
  - *".see two modules seems to be not needed now as integrated into Analytics & Statistical Reports Suite....if already addressed then ignore"*
- **Context & Root Cause Analysis:**
  1. **Missing Student Labels (Name, Class, Session, Stream, Roll, Parentage):**
     - In `BulkFieldOverwriteModal.jsx`, the preview table cell only looked for `st.studentName || st["Student's Name"]` and `st.selectedClass || st.Class`.
     - In the institutional database, student records often store these attributes under `"Student's Name (as per school records)"`, `className`, `"Admission sought for class"`, `classRollNo`, etc.
     - Father's name, session, stream, and roll number were omitted from the table cell entirely.
  2. **386 vs 399/400 Overwrite Discrepancy:**
     - The cohort filter previously used a single `<select>` HTML element restricted to one class at a time (e.g. `11th`).
     - Uploading a combined 400-row spreadsheet for both Class 11th and Class 12th resulted in 8 Class 12th students failing `sameCohort()`, getting classified as `8 Out of Cohort` with disabled checkboxes.
     - Out-of-cohort matches did not attach `matchedStudent`, so their diffs were never calculated.
     - 6 records failed to match because `rawReg` and `cleanReg` missed aliases such as `Registration No. (allotted by JKBOSE)` or had floating `.0` suffixes from Excel numeric formatting (`386 + 8 + 6 = 400`).
  3. **Custom Filter Request:**
     - The user requested checkbox dropdowns for Cohort filtering so multiple classes (e.g. 11th and 12th together) can be selected simultaneously.
  4. **Redundant Launcher Module:**
     - `jkboseSubjectRolls` was present as a standalone launcher module in the navigation menu while already integrated into `Analytics & Statistical Reports Suite`.

- **Key Implementations:**
  1. **Authoritative Student Extractors (`BulkFieldOverwriteModal.jsx`)**:
     - `getStudentDisplayName(st)`: Unified lookup across 10+ student name keys (`"Student's Name (as per school records)"`, `studentName`, `name`, `Candidate Name`, etc.).
     - `getStudentDisplayFather(st)`: Unified lookup across `"Father's/Guardian's Name (as per school records)"`, `fatherName`, `parentName`, `parentage`, etc.
     - `getStudentDisplayClass(st)`: Resolves `selectedClass`, `className`, `Class`, `class`, `classCanonical`, `"Admission sought for class"`.
     - `getStudentDisplaySession(st)`: Resolves `selectedSession`, `Session`, `session`, `academicSession`.
     - `getStudentProperStream(st)`: Resolves verified stream with historical reg number fallback.
     - `getStudentDisplayRollNo(st)`: Resolves `classRollNo`, `rollNo`, `RL. NO.`, `Class R.No.`.
     - `getStudentDisplayFormNo(st)`: Resolves `formNo`, `Form Number`, `fNo`.
     - `getStudentDisplayRegNo(st)`: Resolves all 20+ Board and DIET registration aliases and strips trailing `.0+`.
  2. **Multi-Select Checkbox Dropdown Component (`CohortCheckboxDropdown`)**:
     - Custom dropdown with multi-select checkboxes, `All` toggle, and `Clear` reset button.
     - Quick preset buttons: `11th & 12th (Sr Sec)` and `9th & 10th (Secondary)`.
     - Item-level live candidate counts and click-outside dismissal.
  3. **Multi-Select Cohort Evaluation & Engine Matching**:
     - State updated to `selectedClasses` (defaulting to `['12th', '11th']` so senior secondary is selected simultaneously), `selectedSessions`, `selectedStreams`, and `selectedStatuses`.
     - Evaluates incoming students against `isStudentInSelectedCohort(st)`.
     - Out-of-cohort matches bind `matchedStudent = universalMatch`, calculate diffs, display out-of-cohort warnings, and keep row checkboxes enabled for administrative overwrite.
  4. **Rich 2-Line Matched Student Details in Diff Table**:
     - Line 1: **Student Name** (bold) + `S/D of [Father's Name]` + Warning badges (`⚠️ Name in File`, `Matched by Name`, `⚠️ Out of Cohort`).
     - Line 2: Clean badge metadata: `Class: [cls]` • `Session: [sess]` • `Stream: [stream]` • `Roll: [roll]` • `Form: [form]`.
     - Inspect profile modal displays full student name, class, and session in header.
  5. **Menu Redundancy Cleanup (`adminModuleCatalog.js`)**:
     - Set `launcher: false` on `jkboseSubjectRolls` to hide it from the modules dropdown, unifying access within the Analytics & Statistical Reports Suite.

---

## Files Added / Modified
- `src/portal/admin/BulkFieldOverwriteModal.jsx` (Modified)
- `src/portal/admin/adminModuleCatalog.js` (Modified)
- `CHANGES_SINCE_LAST_COMMIT.md` (Modified)

---

## Local Commit Message
```bash
feat(ingestion-hub): add multi-select cohort filters, full student labels, and out-of-cohort matching
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
git commit -m "feat(ingestion-hub): add multi-select cohort filters, full student labels, and out-of-cohort matching"
```

### Manual Push (Mandatory Policy):
Per project rules, automatic remote pushes are strictly disabled. When you are ready to publish these changes to remote, please run:
```bash
git push origin main
```
