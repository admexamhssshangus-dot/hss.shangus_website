# Changes Since Last Commit

## Commit Message

`feat(academics): complete end-to-end Class 9th integration across Gazette, Analytics, and Practicals`

## Files Changed

1. **[src/portal/admin/ConsolidatedGazetteView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/ConsolidatedGazetteView.jsx)**
   - **Tabular Scope**: Added `'9th'` to `CLASSES = ['12th', '11th', '10th', '9th']`.
   - **Examinee Matching**: Added `targetClass === '9' && (rawCls.includes('9') || rawCls.includes('ix'))` to the gazette document matching filter.
   - **Secondary Curriculum Standard**: Class 9th automatically maps to the standard 7 secondary subjects (`EN`, `MA`, `SC`, `SS`, `UR`, `HTC`, `ITE`) for consolidated tabulation, ranking, export, and official printouts.

2. **[src/portal/admin/AnalyticsSuiteModal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AnalyticsSuiteModal.jsx)**
   - **Selection Sync**: Updated `useEffect` synchronization to include `'9th'` in `['9th', '10th', '11th', '12th']` when syncing examinee classes.
   - **Subject Roll Class Tabs**: Added `{ id: '9th', label: 'Class 9th' }` to the JKBOSE Subject Roll Return class switcher.
   - **Dropper Manager Class Bar**: Added `{ id: '9th', label: 'Class 9th' }` to the Dropper Manager class filter bar.

3. **[src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)**
   - **Max Marks Export**: Exported `DEFAULT_MX9` computed from `DEFAULT_PRACTICAL_MARKS_CONFIG['9th']`.
   - **Subject Normalization**: Added `subjects9` extraction (`'Subjects to be taken in Class 9th'`, `'Subjects in Class 9th'`, `'Subjects Studied in Class 9th'`) to `normalizeStudentFields`.
   - **Default Settings & Print Headers**: Initialized `nonPractical9: ''` and added default Class 9th print details to the admin practicals settings state.
   - **Settings UI**: Added dedicated "Class 9th Non-Practical Subjects" input field in the Settings panel and updated scheme reset modal description and submission windows badge to include Class 9th.

4. **[src/pages/PublicResultLookup.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/pages/PublicResultLookup.jsx)**
   - **Secondary Subject Aliases**: Added `SC` (Science), `SS` (Social Studies), and `HN` (Hindi) to `isSubjectEnrolledByStudent` so secondary students checking their Pre-Board or school-based assessment results match their enrolled subjects accurately.

5. **[src/portal/admin/CustomRosterDocumentBuilderView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/CustomRosterDocumentBuilderView.jsx)**
   - **Quick Filter Pills**: Added a dedicated `9th & 10th` quick preset shortcut to the Applicable Classes dropdown in the Custom Roster Document Builder.

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
git commit -m "feat(academics): complete end-to-end Class 9th integration across Gazette, Analytics, and Practicals"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
