# Changes Since Last Commit

## Commit Message

`fix(practicals): resolve IT & ITES matching and enrollment showing empty across admin and teacher portals`

## Files Changed

1. **[src/utils/practicalsSettingsManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSettingsManager.js)**
   - **`isMatchingSubjectCode` Dedicated ITE Guard**: Added strict, authoritative matching for `ITE`, `IT`, `ITES`, `IT & ITES`, `IT and ITES`, `IT&ITES`, `IT / ITES`, `Information Technology`, and underscore-delimited document IDs (e.g. `12th_26_IT_internal`, `12th_26_ITE_internal`, `12th_IT & ITES_internal_2025-26`). Prevents false negatives where awards and submissions showed as "Empty" instead of "Live".
   - **`normalizeSubjectIdentity` Enhancement**: Explicitly catches standalone `'it'`, `'ite'`, `'ites'`, and variations before falling into fuzzy substring matching (which previously caused false-positive collisions with "Security" or "Political Science").

2. **[src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)**
   - **Multi-Field Subject String Matching**: Updated `subjectsWithSubmissions` and `subDoc` lookup to check an array of candidate strings (`s.subjectCode`, `s.subject`, `s.subjectName`, `s.Subject`, `s.id`, `s.docId`) against `isMatchingSubjectCode`.
   - **Vocational Enrollment Resolution in `getStudentSubjectsStr`**: Appends separate vocational fields (`Vocational Subject`, `vocationalSubject`, `Vocational`, `Vocational Trade`, `NSQF Subject`, etc.) to the student's subjects string, ensuring students with vocational trade assignments are recognized.
   - **Secondary & Higher Secondary `isStudentEnrolledInSubject`**: Upgraded vocational matching for both `ITE` and `HTC` to check both the subjects string and dedicated vocational fields with boundary-safe regular expressions.

3. **[src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)**
   - **Vocational Candidate Document IDs**: Added candidate document IDs for `IT`, `ITES`, and `IT & ITES` variants when `targetSubjCode === 'ITE'`.
   - **`isStudentEligibleForSubject` Upgrades**: Aggregated vocational fields into `rawSubjStr` and enhanced `hasToken` checks for `ITE` / `IT` / `ITES`.
   - **Unified Matching Parity**: Imported and utilized `isMatchingSubjectCode` during candidate submission evaluation.

4. **[src/utils/practicalsSubjectMatching.test.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSubjectMatching.test.js)**
   - Added unit test cases for `isMatchingSubjectCode`, `normalizeSubjectIdentity`, and `isTeacherSubjectMatch` specifically covering `ITE`, `IT`, `ITES`, `IT & ITES`, and document IDs (all 10 tests passing).

---

## Instructions for the User

### 1. How to Review the Local Commit
You can review the changes and commit log locally:
```bash
git log -1 --stat
git show HEAD
```

### 2. How to Amend or Re-commit (Optional)
If you wish to edit the commit message or make adjustments:
```bash
git reset --soft HEAD~1
# Make desired adjustments...
git add .
git commit -m "fix(practicals): resolve IT & ITES matching and enrollment showing empty across admin and teacher portals"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
