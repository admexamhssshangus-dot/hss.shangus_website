# Changes Since Last Commit

## Commit Message

`feat(practicals): add student and parent contact numbers to absent and fail defaulters list`

## Files Changed

1. **[src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js)**
   - Added `cleanContactNumber(val)`, `extractStudentContact(st, rec)`, `extractParentContact(st, rec)`, and `renderContactCell(studentContact, parentContact)`.
   - Built cohort contact lookup map (`contactLookup`) to resolve student and parent mobile numbers across admissions, master registers, and marks documents.
   - Enhanced `failRecords` generation to attach `studentContact` and `parentContact` to each absentee and failing candidate record.
   - Added dedicated `Contact Nos. (Student / Parent)` column in the Defaulters List table (`<thead>` and `<tbody>`) with clean monospace badges (`S:` for Student, `P:` for Parent, and combined badge when identical).
   - Adjusted table layout and empty state `colspan` to 8 columns.

2. **[src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)**
   - Explicitly preserved `mobile` and `parentMobile` during `addOrMergeStudent` so student and parent contact information is never overwritten during register merges.
   - Passed full cohort `allStudents: students` in `printDetails` when calling `printFailList` for maximum contact resolution.

3. **[src/utils/practicalsDefaultersContact.test.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsDefaultersContact.test.js)**
   - Added 14 automated unit tests verifying contact number cleaning, multi-key extraction, combined/individual cell formatting, and contact badge rendering.

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
git commit -m "feat(practicals): add student and parent contact numbers to absent and fail defaulters list"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
