# Changes Since Last Commit

## Commit Message

`feat(academics): add end-to-end Class 9th support for attendance, practicals, and school assessments`

## Files Changed

1. **[src/portal/admin/AdminAttendance.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminAttendance.jsx)**
   - **Secondary Core Subjects Added**: Added `SC` (Science), `SS` (Social Studies), and `HN` (Hindi) to `MASTER_SUBJECT_NAMES` and lookup formatters.
   - **Multi-Class Configuration State**: Added `9th` and `10th` to default `attendanceConfig` portal controls and `classCounts` summary state.
   - **Summary Aggregation Engine**: Updated `computeAndSaveSummary` to aggregate and index logs across all classes (`9th`, `10th`, `11th`, `12th`).
   - **Administrative Controls Panel**: Rendered individual live submission toggles for `9th`, `10th`, `11th`, and `12th`.
   - **Overview Analytics KPI Bar**: Expanded the top analytics grid into a 6-card display presenting Total Logs, Class 9th Logs, Class 10th Logs, Class 11th Logs, Class 12th Logs, and Overall Present Rate.
   - **Filter Toolbar**: Added Class `9th` and `10th` pills to the Overview class filter control (`['all', '9th', '10th', '11th', '12th']`).

2. **[src/portal/teacher/AttendancePage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/AttendancePage.jsx)**
   - **Master Subject Definitions**: Added `Science` (`SC`), `Social Studies` (`SS`), and `Hindi` (`HN`) to `MASTER_SUBJECTS`.
   - **Subject Code Resolution**: Enhanced `resolveTeacherSubjectCode` to resolve `Science` & `SC`, `Social Studies` & `SST` & `SS`, and `Hindi` & `HN`.
   - **Secondary Stream & Subject Matching**: Upgraded `isSubjectMatch` to identify secondary students (Classes 9th and 10th) taking core curriculum, and removed `'sc'` from the higher-secondary stream guard so secondary Science daily roll call is never blocked.
   - **Real-Time Administrative Gateway Synchronization**: Added listener for `systemSettings/attendanceConfig` so that if an administrator disables submissions for Class 9th, the warning banner and save button lock are enforced in real time.

3. **[src/portal/teacher/TeacherDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherDashboard.jsx)**
   - **Card Subtitle Update**: Updated attendance card subtitle from "Class 11th & 12th Classroom Attendance" to "Classes 9th to 12th Daily Attendance, Leaves & Holiday Management".

4. **[src/utils/practicalsSettingsManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSettingsManager.js)**
   - **Class 9th Practical Marks Configuration**: Added `'9th'` to `DEFAULT_PRACTICAL_MARKS_CONFIG` configured under the official secondary JKBOSE scheme (core subjects internal max 20, pass 7; vocational external max 50, pass 16).
   - **Class Normalization**: Updated `getSubjectMarksConfig` so `normClass` explicitly checks for `9th` (`rawCls.includes('9') ? '9th' : ...`).
   - **Default Submission Windows**: Added `'9th': true` to `DEFAULT_PRACTICAL_SUBMISSION_WINDOWS`.

5. **[src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)**
   - **Top Navigation Switcher**: Added Class 9th tab button to the top Class Switcher Segmented Control.
   - **Awards Summary View Mounting**: Mounted `<AwardsSummaryView cls="9th" ... />` when `tab === 'class9'`.
   - **Secondary Subject Recognition**: Updated `activeCodesList` and `getDefaultCheckedCodes` in `AwardsSummaryView` to recognize Class 9th alongside Class 10th for secondary core subjects (`EN, MA, SC, SS, UR, HTC, ITE`).
   - **Submission Window Controls**: Added Class 9th card to the live practical submission windows panel with a responsive 4-column layout.
   - **Marks Configuration Switcher**: Added Class 9th button to the Marks Configuration class switcher.
   - **Print Headers Configuration**: Added Class 9th card to the Print Headers configuration panel.

6. **[src/portal/admin/SchoolAssessmentsHub.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAssessmentsHub.jsx)**
   - **Fallback Classes Harmonization**: Updated fallback `classes` arrays across assessment edit modal, assessment scope pills, and paper scale override class selector to include `['9th', '10th', '11th', '12th']`.

7. **[src/pages/PublicResultLookup.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/pages/PublicResultLookup.jsx)**
   - **Lookup Fallback Classes**: Updated fallback evaluation classes array to include `['9th', '10th', '11th', '12th']`.

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
git commit -m "feat(academics): add end-to-end Class 9th support for attendance, practicals, and school assessments"
```

### 3. How to Push to Remote Repository
In accordance with our strict Git safety rules, the assistant never executes `git push`. When you are ready, please push the commit manually:
```bash
git push origin main
```
