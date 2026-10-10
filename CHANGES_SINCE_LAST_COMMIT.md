# Changes Since Last Commit

## Commit Message

`fix(practicals): resolve 11th Botany roster discovery and add offline catalog fallback`

## Files Changed

1. **[src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)**
   - Added `mapCatalogStudentToRecord` helper converting verified student entries into complete practical candidate objects.
   - Added `verifiedStudentsCatalog` fallback into `allCandidates`, `uniqueStudents`, and `subjectFiltered` pipelines.
   - Preserved `Subs` and `Subjects1`–`Subjects5` across the `uniqueMap` de-duplication merge so subject matchers retain full column awareness.
   - Expanded evaluation status filter allowance to explicitly include `submitted` alongside `approved`/`confirmed`, ensuring students with assigned class rolls in 11th are never dropped by status filters.

2. **[src/services/dbCache.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/dbCache.js)**
   - Added `getCatalogFallbackStudents(session, className, stream)` ensuring `getAdmissionsBySession` and `getMasterRegistersByScope` seamlessly seed registered student records from `verifiedStudentsCatalog.json` if Firestore queries return 0 records or encounter offline/quota limits.

3. **[src/portal/teacher/PracticalsPage.test.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.test.jsx)**
   - Added automated unit tests verifying catalog mapping and Botany subject resolution for Class 11th (all 28/28 tests passing).

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
git commit -m "fix(practicals): resolve 11th Botany roster discovery and add offline catalog fallback"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
