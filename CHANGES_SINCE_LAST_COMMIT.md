# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): correct student enrollment counts, guarantee PH/CH for science students, and separate Enrolled and Evaluated columns in reports`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Automated Security, Admission, SEO regression checks, and Jest test suite passed (`Exit Code 0`, 21/21 tests passed).

---

## Architectural Purpose & Issues Resolved

### Problem Statement
1. **Under-Calculated Physics & Chemistry Enrollment in Class 12th**:
   - In Class 12th, there are **134 Medical students** (Botany/Zoology) and **24 Non-Medical students** (Mathematics), totaling **158 Science students**.
   - In JKBOSE Higher Secondary curriculum, **Physics (PH) and Chemistry (CH) are mandatory foundation subjects for all Science stream students**.
   - However, 14 Medical students had their database subject string entered as only their chosen electives (e.g. `"Botany, Zoology, Environmental Science"`), omitting the explicit words "Physics" or "Chemistry".
   - `isStudentEnrolledInPracticalSubject` in `practicalsPdfGenerator.js`, `isStudentEnrolledInSubject` in `AdminPracticals.jsx`, and `isSubjectOrStreamMatch` in `PracticalsPage.jsx` strictly required `"PH"`/`"Physics"` to be explicitly written in the student's text string when non-empty. This caused 14 Science students to be excluded from Physics and Chemistry, incorrectly reflecting only **144** students enrolled instead of the true count of **158**.
2. **Ambiguous and Reversed Progress Display in Fail / Absent Printout**:
   - The table header in the Institutional Award Submissions overview was labeled `Enrolled / Evaluated`, but the cell values were formatted in reverse: `${sObj.evaluatedCount} / ${sObj.enrolledCount}` (e.g. `15 / 144`, `105 / 134`).
   - This caused confusion where `15` appeared to be the enrolled count and `144` the evaluated count.
   - For unsubmitted subjects, it displayed `144 enrolled` instead of progress metrics.
3. **Class 12th Record Enrichment & Previous Class Inheritance**:
   - Registration number matching for Class 11th inheritance only checked `st['Board Registration Number'] || st.regNo`, missing aliases like `st['Board Reg. No.']`, `st.boardRegNo`, etc.
   - Incomplete subject strings (e.g. `"Same as in Class 11th"`, single placeholders like `"General English"`) prevented the full 5-subject list from being inherited from Class 11th records.

---

## Changes Implemented

### 1. Robust Science Stream Foundation & Subject Enrollment Logic
- File: [src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js)
  - **`resolveStudentStream`**: Added a helper that inspects all stream field aliases (`Stream for Class 12th`, `Stream Studied in Class 11th`, `Selected Stream`, etc.) and accurately infers Medical / Non-Medical / Humanities / Commerce from subject tokens.
  - **`resolveStudentSubjectsRaw`**: Enhanced candidate resolution to prefer complete 3+ subject records over single placeholder entries (e.g. `"General English"`).
  - **`getAbbreviatedSubjects`**: For Higher Secondary Science students, guarantees that `EN, PH, CH` are always present, and `BI` is present for Medical students, while maintaining strict isolation against Arts-only electives.
  - **`isStudentEnrolledInPracticalSubject`**:
    - For Secondary School (9th & 10th): Strictly limits to the core 5 compulsory subjects (`EN, MA, SC, SS, UR`) and vocational subjects (`HTC, ITE`).
    - For Higher Secondary (11th & 12th):
      - General English (`EN`) is compulsory for 100% of students across all streams.
      - Any student offering Medical subjects (`BO`, `ZO`, `BI`) or in the Science stream is automatically enrolled in Physics (`PH`) and Chemistry (`CH`).
      - Botany (`BO`) and Zoology (`ZO`) are linked through Biology equivalence.
      - Mathematics (`MA`) is enrolled for Non-Medical and explicit Math takers.
      - Science students are strictly prevented from Arts electives (`ED`, `HT`, `PS`, etc.).

- File: [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)
  - **`isStudentEnrolledInSubject`**: Synchronized the same authoritative enrollment rules for admin tables, matrices, and reports.
  - **Enhanced Class 11th Inheritance**: Added `extractReg` to check all registration number aliases. Replaces incomplete/placeholder subject strings with the complete 5-subject list from Class 11th records, and ensures stream is properly flagged as Science.
  - **`getStudentSubjectsStr`**: Prefer complete subject listings over 1-word placeholders when searching candidate fields.

- File: [src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)
  - **`isSubjectOrStreamMatch`**: Updated Physics (`PH`) and Chemistry (`CH`) checks to include all Science students (`isScienceStrict || hasMedicalSubs`), ensuring the teacher evaluation roster displays all 158 Science students.

### 2. Crystal-Clear Overview Table Formatting
- File: [src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js)
  - Split the confusing single column into **two dedicated, unambiguous columns**:
    - **`Enrolled`**: Displays the exact eligible candidate count (e.g., `158` for Physics/Chemistry, `134` for Botany/Zoology, `24` for Math, `296` for English).
    - **`Evaluated`**: Displays evaluation progress with clear completion percentages (e.g., `15 (9%)`, `105 (78%)`, or `0 (Awaiting)`).

### 3. Comprehensive Automated Tests
- File: [src/portal/teacher/PracticalsPage.test.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.test.jsx)
  - Added unit test verifying that Class 12th Medical students with elective-only subjects are enrolled in `PH`, `CH`, `BO`, `ZO`, `EN`, and excluded from `ED`, `HT`, `MA`.
  - Added unit test verifying that Arts students are never enrolled in Science subjects (`PH`, `CH`, `BO`, `ZO`).
  - Added unit test verifying that `studentWith11Placeholder` resolves `PH` and `CH`.
  - All 21 tests in the suite passed with zero errors.

---

## Files Changed
1. `src/portal/admin/AdminPracticals.jsx` (Accurate enrollment calculation, comprehensive registration matching, Class 11th inheritance)
2. `src/portal/teacher/PracticalsPage.jsx` (Physics/Chemistry enrollment matching for Science cohorts in teacher roster)
3. `src/portal/teacher/PracticalsPage.test.jsx` (21 unit tests covering all enrollment rules and stream boundaries)
4. `src/utils/practicalsPdfGenerator.js` (resolveStudentStream helper, science foundation PH/CH guarantee, distinct Enrolled and Evaluated columns)
5. `CHANGES_SINCE_LAST_COMMIT.md` (Updated memory file of changes)

---

## Verification & Build Results
- **Jest Test Suite**: Verified locally with `react-scripts test` (`21 passed, 21 total`, `Exit Code 0`).
- **Production Build**: Verified locally with `npm run build` (`Exit Code 0`).
- **ESLint & Compiler**: Zero breaking errors, zero unresolved imports.
- **SEO & Routing Check**: Passed all 11 static pages, sitemaps, and canonical redirects.

---

## Git Review, Amend & Push Instructions

### 1. Inspect the Local Commit
To review the changes in this commit:
```bash
git show HEAD
# or view the log
git log -1 --stat
```

### 2. Amend or Re-Commit (Optional)
If you wish to modify the commit message or make adjustments:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "fix(practicals): correct student enrollment counts, guarantee PH/CH for science students, and separate Enrolled and Evaluated columns in reports"
```

### 3. Push to Remote Repository
When you are ready to publish these changes to production:
```bash
git push origin main
```
