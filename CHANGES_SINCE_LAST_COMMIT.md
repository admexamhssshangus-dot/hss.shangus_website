# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals-and-results): isolate Healthcare from History, fix candidate lookup & explain evaluation boundary`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Automated Jest test suites passed (`59/59 passed`, `Exit Code 0`).

---

## 1. Healthcare (`HTC`) vs History (`HT`) Infiltration Diagnosis & Resolution

### Root Cause
- The JKBOSE subject code for **History** is `HT`.
- The JKBOSE vocational subject code for **Healthcare** is `HTC`.
- Multiple core files (`AdminPracticals.jsx`, `practicalsPdfGenerator.js`, `practicalsCsvManager.js`) relied on naive substring checks:
  ```javascript
  codeStr === subCode || codeStr.includes(subCode)
  ```
- Because in JavaScript `'HTC'.includes('HT') === true`:
  - Whenever an admin filtered by **History (`HT`)**, all **Healthcare (`HTC`)** teacher submissions and audit records matched.
  - In the tabular marks ledger, `getSubjectMarkForStudent(st, 'HT')` matched `11th_Healthcare_Internal Assessment`, pulling Healthcare marks into the History column for students taking both subjects.
  - In `subjectsWithSubmissions`, History was highlighted as having submitted marks even when only Healthcare had been submitted.
  - In PDF/CSV/Word export generators, History documents and matrices were contaminated with Healthcare entries.

### Implemented Fix
- Added and exported authoritative function `isMatchingSubjectCode(docSubjOrCode, targetCode)` in [src/utils/practicalsSettingsManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSettingsManager.js):
  - **Strict History (`HT`) Guard**: Strictly rejects any string containing `HTC`, `HC`, or `HEALTH`/`HEALTHCARE`. Matches only genuine `HT`, `HIST`, or `HISTORY`.
  - **Strict Healthcare (`HTC`) Guard**: Accurately matches `HTC`, `HC`, `HEALTHCARE`, and `HEALTH CARE`.
  - **Strict Education (`ED`) Guard**: Strictly isolates from `PD`, `PED`, and `PHYSICAL EDUCATION`.
  - **General Biology (`BI`) Composite**: Cleanly resolves `BO` (Botany) and `ZO` (Zoology).
  - Handles non-alphanumeric boundary matches (`(^|[^A-Za-z0-9])`) to properly parse Firestore doc IDs containing underscores (e.g. `11th_Healthcare_Internal Assessment`).
- Applied `isMatchingSubjectCode` across:
  - [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx) (submissions memo, mark resolution, teacher filters, and document audit log).
  - [src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js) (individual award rolls, cover letters, hash matrices, audit summaries).
  - [src/utils/practicalsCsvManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsCsvManager.js) (Excel, CSV, and Word export generators).
- Created comprehensive unit test suite in [src/utils/practicalsSubjectMatching.test.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSubjectMatching.test.js) (7/7 tests passing).

---

## 2. Results Portal End-to-End Investigation

### A. Why "No candidate record found for '2101003000300030' in Class 12th (2025–26)" Occurred
- **Root Cause**: Student **Mhosin Wakeel** (Class 12th, Roll 154, Admission Form 250446) had an empty string for `"boardRegNo": ""` in [src/data/verifiedStudentsCatalog.json](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/data/verifiedStudentsCatalog.json). When live Firestore encountered quota exhaustion (`429 RESOURCE_EXHAUSTED`), the lookup fell back to the local catalog which had a blank registration number.
- **Fix**: Populated `"boardRegNo": "2101003000300030"` for Mhosin Wakeel in `verifiedStudentsCatalog.json`, enabling immediate offline and fallback resolution.

### B. Why Student Scorecards Show "Awaiting Award"
- **Institutional Evaluation Boundary (Rule 8)**:
  - The results lookup in the user screenshot was configured for: `Pre-Board Test • Session 2025-26 • Class 11th`.
  - Teacher Shakira Khurshid's submission in Firestore was for `Internal Assessment` (Practicals Portal).
  - Per **Rule 8 (Practicals & Academic Evaluation Data Boundary Rule)**:
    - Internal Assessment and External Practical marks are strictly confidential institutional JKBOSE data and are **never published on the public results portal or accessible to students**.
    - Pre-Board Examinations and School-Based Assessments are managed and published exclusively through the **School Based Assessment Portal**.
  - Because Class 11th teachers have not yet submitted `Pre-Board Test` marks in the School-Based Assessment Suite, the portal correctly and securely displays **"Awaiting Award"** for unsubmitted subjects rather than leaking confidential practical marks.
- **Query Resiliency**:
  - Enhanced [src/pages/PublicResultLookup.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/pages/PublicResultLookup.jsx) so live queries gracefully fall back to full collection retrieval when class-filtered composite queries fail, and properly update the in-memory cache `livePracticalsDocs`.

---

## List of Files Changed & Added
1. [src/utils/practicalsSettingsManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSettingsManager.js) (added `isMatchingSubjectCode`, Healthcare aliases in `normalizeSubjectIdentity`, and hardened `isTeacherSubjectMatch`)
2. [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx) (isolated Healthcare from History in submission memos, mark lookup, teacher filters, and doc audit log)
3. [src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js) (applied `isMatchingSubjectCode` across all PDF print pipelines)
4. [src/utils/practicalsCsvManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsCsvManager.js) (applied `isMatchingSubjectCode` across Excel/CSV/Word exports)
5. [src/data/verifiedStudentsCatalog.json](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/data/verifiedStudentsCatalog.json) (assigned `boardRegNo: "2101003000300030"` to Mhosin Wakeel)
6. [src/pages/PublicResultLookup.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/pages/PublicResultLookup.jsx) (enhanced query fallback resiliency and cache population)
7. [src/utils/practicalsSubjectMatching.test.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSubjectMatching.test.js) (new unit test suite for subject code isolation)
8. [CHANGES_SINCE_LAST_COMMIT.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/CHANGES_SINCE_LAST_COMMIT.md) (documentation update)

---

## Verification & Testing
- **Jest Unit Tests**:
  - `src/utils/practicalsSubjectMatching.test.js`: `7 passed, 7 total` (`Exit Code 0`).
  - `src/portal/teacher/PracticalsPage.test.jsx`: `24 passed, 24 total` (`Exit Code 0`).
  - `src/pages/PublicResultLookup.test.jsx`: `21 passed, 21 total` (`Exit Code 0`).
  - `src/utils/studentApprovalStatus.test.js`: `7 passed, 7 total` (`Exit Code 0`).
  - **Total**: `59 passed, 59 total` (`Exit Code 0`).
- **Production Build**:
  - Command: `npm run build`
  - Output: `Compiled successfully`, `Exit Code 0`, zero breaking errors.
  - SEO validation: 11 public pages, canonical redirects, sitemap, offline navigation passed.

---

## Instructions for User

### Reviewing the Local Commit
To review the local commit once made:
```bash
git log -1 --stat
git show HEAD
```

### Amending or Re-committing (Optional)
If you wish to modify or redo the commit manually:
```bash
git reset --soft HEAD~1
git add .
git commit -m "fix(practicals-and-results): isolate Healthcare from History, fix candidate lookup & explain evaluation boundary"
```

### Pushing Changes to Remote (Manual Step Required)
As per security policy, the assistant never executes `git push`. When ready, push manually to remote:
```bash
git push origin main
```
