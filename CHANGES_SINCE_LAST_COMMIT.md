# Changes Since Last Commit

## Commit Message

`fix(students): harmonize Malika Tariq Environmental Science enrollment across both classes, catalog and Firestore`

## Files Changed

1. **[src/data/verifiedStudentsCatalog.json](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/data/verifiedStudentsCatalog.json)**
   - Updated Form `250271` (Malika Tariq) subject 5 from Physical Education (`PD`) to Environmental Science (`ES`).
   - Synchronized verified student name to `"Malika Tariq"`, father's name to `"Tariq Ahmad Wani"`, board registration number to `"2301010000900057"`, and current JKBOSE exam roll number to `"301003042"`.

2. **[src/portal/teacher/PracticalsPage.test.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.test.jsx)**
   - Added automated test verifying that a student who has Environmental Science in both Class 11th and Class 12th matches `ES` and never matches `PD` in both class evaluations (all 27 tests passing).

3. **[scripts/check_recent_firestore_edits.mjs](file:///d:/Shk_Gulfam/Projects/hss_shangus/scripts/check_recent_firestore_edits.mjs)**
   - Added null-safety check for document name resolution during Firestore document parsing.

4. **Firestore Database Live Updates (Directly Synchronized)**:
   - **`admissions/adm_250271`**:
     - Updated `"Subjects Studied in Class 11th"` and `"Subjects to be taken in Class 11th"` from Physical Education to `"General English, Physics, Chemistry, Biology, Environmental Science"`.
     - Confirmed both Class 11th and Class 12th subject fields now reflect Environmental Science (`ES`).
   - **`masterRegisters/mr_2025-26_12th_reg_2301010000900057`**:
     - Updated `Subjects5` and `subjects5` to `"Environmental Science"`, `subjects` to `"GE, PH, CH, BI, ES"`, and `Subs` to `"General English, Physics, Chemistry, Biology, Environmental Science"`.
     - Harmonized student name to `"Malika Tariq"`, father's name to `"Tariq Ahmad Wani"`, and mother's name to `"Tanveera Banoo"`.
   - **`practicalsData/12th_Physical Education_Pre-Board Test_2025-26`**:
     - Removed Malika Tariq from the submitted Physical Education practicals list (records reduced from 76 to 75).
   - **`practicalsData/12th_Environmental Science_Pre-Board Test_2025-26`**:
     - Added Malika Tariq to the Environmental Science practicals award roll at Roll No. 7 in proper sequential order (records increased from 20 to 21).

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
git commit -m "fix(students): harmonize Malika Tariq Environmental Science enrollment across both classes, catalog and Firestore"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
