# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `feat(assessments): add full filter parity and dual-source roster loader in teacher assessments`
- **Date**: October 02, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally.

---

## Files Changed & Impact

### 1. `src/portal/teacher/PracticalsPage.jsx`
- **Exports Added**:
  - Exported standard evaluation helper functions to guarantee exact cross-portal matching parity:
    - `extractRawAdmNo`: Robust admission number sanitizer and resolver across all schemas.
    - `isClassMatch`: Strict class matching (`11th`, `11`, `Class 11`).
    - `getSessionEndYear`: Academic session range parser (`2025-26` -> `2026`).
    - `isSessionMatch`: Multi-format session matcher handling regular, Oct-Nov, Mar-Apr, and annual sessions.
    - `isSubjectOrStreamMatch`: Canonical subject code/stream and compulsory subject matcher.
    - `extractStudentClass`: Class resolver across multiple form/admission keys.
    - `hasAssignedClassRoll`: Comprehensive roll number validator filtering unallotted/placeholder rows.
    - `getStudentName`: Robust student name accessor.
    - `getRegNo`: JKBOSE dual registration number extractor.
    - `getExamRoll`: Class-specific board exam roll extractor.
    - `numberToWords`: Converts numbers to formal words representation with absent handling.
    - `renderSubjectsWithHighlight`: Renders student enrolled subjects with the active filter subject highlighted in bold red.

### 2. `src/portal/teacher/TeacherAssessmentsPage.jsx`
- **Root Cause Fix for Low Student Count & Missing Roll Numbers**:
  - Replaced the flawed single-source `masterDocs` query with the proven dual-source loader querying BOTH `masterRegisters` (via `getMasterRegistersScoped({ forceAll: false })`) and `admissions` (via `getCachedCollection('admissions', false)`).
  - Built rich multi-key indexes (`richByReg`, `richByForm`, `richByRoll`, `richByBoard`, `richByAdm`, `richByName`).
  - Added strict class roll resolution (`st['Class Roll No']`, `st['Class R.No.']`, etc.) so all examinees display their legitimate Class Roll Numbers (`Roll 3`, `Roll 4`...) instead of `-`.
  - Added subject/stream filtering via `isSubjectOrStreamMatch` with support for `rosterScope` (`'stream'` vs `'all_class'`), ensuring all **89 enrolled students** for Class 11th Botany (2025-26) appear seamlessly.
- **Full Functional & Filter Parity with Practicals Portal**:
  - **Master Action Toolbar**:
    - Select All checkbox (`[ ] All`) with indeterminate state.
    - Sort dropdown with options: `Roll ↑`, `Roll ↓`, `Name A-Z`, `Form #`.
    - Collapsible `Filters (X Students)` toggle button with dynamic student counter and fail indicators.
    - `⚡ Fill` button triggering the Quick Bulk Fill drawer.
    - `🖨️ Print` button triggering the official School-Based Assessment Award Roll generator.
  - **Secondary Filter Panel**:
    - Target Class dropdown (`Class 11th`, `Class 12th`, `Class 10th`, `Class 9th`).
    - Roster Scope dropdown (`Subject / Stream Only` vs `All Class Students`).
    - Subject selector with class-assigned subject priority.
    - Examination/Assessment Type selector (`Pre-Board Examination`, `Golden Test`, `Mid-term Test`, `Unit Assessment`, etc.).
    - Academic Session selector (`2025-26`, `2024-25`, etc.).
    - Live Search bar (searches across Name, Roll No, Form #, Reg #, Exam Roll #, Parentage, Subjects).
    - "Show Reappear / Absent Only" filter toggle.
  - **Quick Bulk Fill Drawer**:
    - Supports assigning marks to Empty Only, Selected Only, or All Examinees, with preset chips and clear option.
    - Fast select shortcuts (`All`, `Empty Only`, `Clear Selection`).
  - **Rich Student Cards & Table Rows**:
    - Individual selection checkboxes (`[ ] #1`, `[ ] #2`...).
    - Prominent purple/indigo Roll No badges (`Roll 3`, `Roll 4`...).
    - Student details display: Name, `Form #`, `Reg #`, `Exam Roll #`.
    - `Subs:` badge showing all enrolled subjects with the active test subject highlighted in a distinct colored pill.
    - Keyboard-friendly score input (`0-X / A`) with Enter key auto-advancing to the next student.
    - Absent (`AB`) toggle button and in-words mark translation badge.

---

## Instructions for the User

### 1. Review Local Commit
To inspect the changes made in this commit:
```bash
git show HEAD
# or view status
git status
```

### 2. Amend / Re-commit (If desired)
If you wish to modify the commit message or make additional edits:
```bash
git reset --soft HEAD~1
git commit -m "feat(assessments): add full filter parity and dual-source roster loader in teacher assessments"
```

### 3. Push Changes (STRICT MANUAL RULE)
The assistant is strictly prohibited from pushing to remote repositories. Push whenever you are ready:
```bash
git push origin main
```
