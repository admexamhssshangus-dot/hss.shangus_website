# Changes Since Last Commit

## Commit Message

`fix(practicals): resolve student subject isolation across classes and teacher award submission authorization`

## Files Changed

1. **[src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)**
   - **Class-Specific Subject Isolation in `isSubjectOrStreamMatch`**: Updated `isSubjectOrStreamMatch(st, targetSubjectCode, targetSubjectName, targetClass = '')` to accept and prioritize `targetClass`. For Class 12th, the student's authoritative Class 12th subject fields (`Subjects to be taken in Class 12th`, `Stream & Subjects for Class 12th`, `Subjects in Class 12th`) are evaluated first and isolated from Class 11th fields. This fixes the issue where students who changed subjects (e.g. Malika Tariq, who switched from Physical Education in 11th to Environmental Science in 12th) were erroneously matching Physical Education (`PD`) under the 12th teacher login.
   - **Secondary School Subject Boundaries**: Fixed secondary class checks so Class 9th/10th students only match secondary curriculum subjects (`EN`, `MA`, `SC`, `SS`, `UR`, `HN`) and verified vocational electives (`HTC`, `ITE`), strictly preventing secondary students from leaking into Higher Secondary subject rosters (`PD`, `BO`, `ZO`, `CH`, `PH`, `ES`, `PS`, etc.).
   - **Method 2 Overlay & Historical Submission Subject Guard**: Updated the Method 2 previous submission loader and final candidate filter to enforce `isSubjectOrStreamMatch` and `isSubjectMatch` with `selectedClass`, ensuring students whose subjects were corrected are immediately removed from old subject drafts and moved to their correct subject roster.

2. **[src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js)**
   - **Class-Specific Subject Precedence in `resolveStudentSubjectsRaw`**: Moved Class 12th, 11th, 10th, and 9th subject fields to the very top of the candidate hierarchy before generic `Subs` / `subs`. This guarantees that `getAbbreviatedSubjects` and `isStudentEnrolledInPracticalSubject` resolve the student's corrected 12th subject (`ES`) rather than obsolete 11th `Subs` (`PD`).

3. **[src/portal/teacher/TeacherAssessmentsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherAssessmentsPage.jsx)**
   - **Passed `selectedClass` to Subject Filter**: Updated `matchSubjOrAll` to call `isSubjectOrStreamMatch(st, targetSubjCode, targetSubjName, selectedClass)`, preventing secondary students and wrong-subject electives from showing up in School Based Assessment rosters.

4. **[functions/academicRecords.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/functions/academicRecords.js)**
   - **Robust Teacher Assignment Checking (`checkTeacherAssignment`)**: Added `normalizeStaffClasses` to handle arrays, comma-delimited tokens (e.g. `11th,12th`), and prefixes.
   - **Subject & Alias Matching (`isStaffSubjectMatch`)**: Added comprehensive alias and code matching for subjects (`PD` <-> `Physical Education`, `ES`/`EVS` <-> `Environmental Science`, `ITE`/`IT` <-> `IT and ITES`, `BI`/`BO`/`ZO` <-> `Botany`/`Zoology`/`Biology`, `SC` <-> `Science`, `SS`/`SST` <-> `Social Science`, etc.), checking `staff.subject`, `staff.assignedSubjects`, `staff.subjects`, and `staff.assignedSubjectCodes`.
   - **Secondary Science Subject Definition Lookup**: Fixed subject definition lookup to match by code or name so `"Science"` (`SC`) and `"Social Science"` (`SS`) match `"Science (Class 10th)"` and `"Social Science (Class 10th)"`.
   - **Cross-Subject Staged Submissions**: Allowed `isCrossSubjectAllowed` for practical submissions staged as `pending_approval` or drafts so that teacher submissions for admin approval do not throw `"This class and subject are not assigned to your account"`.
   - **Safe Cohort Matching**: Updated cohort record lookup from `matches.length !== 1` to `matches.length === 0`, picking the primary admissions record if a student appears in both `admissions` and `masterRegisters`.

5. **[functions/academicRecords.test.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/functions/academicRecords.test.js)**
   - Added Node.js test suite verifying class normalization, subject alias matching, and teacher assignment checks (all passing).

6. **[src/portal/teacher/PracticalsPage.test.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.test.jsx)**
   - Added unit tests specifically verifying:
     - Malika Tariq's subject change (11th Physical Education -> 12th Environmental Science) matches `ES` in 12th and `PD` in 11th, and never appears in the wrong class roster.
     - Secondary student boundaries prevent core 9th/10th students from matching higher secondary subjects, and require actual vocational enrollment for `HTC` and `ITE` (all 26 tests passing).

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
git commit -m "fix(practicals): resolve student subject isolation across classes and teacher award submission authorization"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
