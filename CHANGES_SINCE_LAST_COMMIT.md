# Changes Log & Commit Reference

## Latest Commit: Scoped Practicals Portal to Practical Data and Established Dedicated School Based Assessment Portal

**Commit Message:** `feat(assessments): restrict practicals portal to practical data and expand school based assessment portal with teacher and admin approvals`

---

### Context & Requirements Addressed

1. **Strict End-to-End Practicals Containment**:
   - The user requested that the **Practicals & Award Rolls Portal** (at both Teacher and Admin sides) hold **ONLY practical data**: Internal Assessment and External Practical.
   - All other examination types (Pre-Board Examinations, Golden Tests, Unit Tests, Mid-term Tests, Term End Examinations, and Competitive/OMR assessments) must not be handled by the Practicals portal.
   - The administrative approval and integration workflow for Pre-Board and non-practical school exams must not reside in the Practicals portal, but in the newly expanded School Based Assessment portal.

2. **Rebranding & Dedicated 3rd Teacher Portal**:
   - Rebranded "Competitive Exams & OMR" into **"School Based Assessment"** (`School-Based Assessments & Examinations`).
   - Added a dedicated 3rd portal card on the Teacher Workspace (`/portal/teacher/assessments`) alongside Attendance and Practicals.
   - Provided full assessment marksheets, draft saving, submission to administration, award roll generation, and historical submission tracking for teachers.

3. **Admin School Based Assessment Approvals Suite**:
   - Created a dedicated approvals sub-tab (`SchoolAssessmentApprovalsView`) within the Admin School Based Assessment module.
   - Enables administrative inspection, mark verification, instant 1-click approval/gazette integration, rejection/revision requests, and printable institutional award rolls for school-based evaluations.

4. **Confidentiality & Security Boundary**:
   - Added Section 8 ("Practicals & Academic Evaluation Data Boundary Rule") to [AGENTS.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/AGENTS.md) and [.agents/AGENTS.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/.agents/AGENTS.md).
   - Hardened `firestore.rules` so that `/practicalsData/{documentId}` and `/practicalsBin/{documentId}` are accessible exclusively by authenticated teachers and admins.
   - Hardened `netlify/functions/public-result.js` to strictly disallow internal and external practical results from ever being queried or retrieved via public endpoints.

---

### Solutions Implemented

1. **Central Evaluation Type Classifier** ([src/utils/evaluationTypes.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/evaluationTypes.js)):
   - Defined `PRACTICAL_EVALUATION_TYPES` (`['Internal Assessment', 'External Practical']`).
   - Created `isPracticalEvaluationType(type)` and `isSchoolAssessmentType(type)` to enforce authoritative classification across the entire platform.

2. **Practicals Settings & Helpers** ([src/utils/practicalsSettingsManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSettingsManager.js)):
   - Re-exported evaluation type classifiers.
   - Added `getPracticalEvaluationTypes()` strictly returning practical options.
   - Added `getSchoolEvaluationTypesForTeacher()` ensuring only non-practical school exams are provided to the School Based Assessment module.

3. **Teacher Practicals Portal** ([src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx)):
   - Restricted evaluation type dropdown to practical evaluation types.
   - Filtered teacher roster loading and previous submission history to practical-only documents.

4. **Teacher School Based Assessment Portal** ([src/portal/teacher/TeacherAssessmentsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherAssessmentsPage.jsx)):
   - Built a comprehensive standalone portal for teachers to conduct Pre-Board examinations, Golden Tests, Unit Tests, and Term examinations.
   - Features student marksheets, absent toggling, real-time draft saving, institutional award roll printing, and submission to admin.

5. **Teacher Dashboard Navigation** ([src/portal/teacher/TeacherDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherDashboard.jsx)):
   - Expanded navigation grid to 3 cards:
     1. Class Attendance
     2. Practicals & Award Rolls (Internal & External Practical only)
     3. School Based Assessment (Pre-Board, Unit Tests, Golden Tests, Term Exams)
   - Filtered and routed previous submissions log to either the Practicals page or the Assessments page according to evaluation type.

6. **Admin Practicals Management** ([src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)):
   - Filtered pending approvals and live gazette integration strictly to practical data.
   - Removed Pre-Board selection options from evaluation filters and award roll printing.

7. **Admin School Based Assessment Approvals** ([src/portal/admin/AdminGkTestManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminGkTestManager.jsx) & [src/portal/admin/SchoolAssessmentApprovalsView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAssessmentApprovalsView.jsx)):
   - Integrated an "Approvals & Award Rolls" tab with dynamic pending count badge into the Admin School Based Assessment suite.
   - Enabled admin to inspect teacher submissions, approve with automated gazette/result generation, return with feedback, and print award rolls.

8. **Routing & Module Catalog** ([src/App.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/App.js) & [src/portal/admin/adminModuleCatalog.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/adminModuleCatalog.js)):
   - Added routes `/portal/teacher/assessments` and `/portal/teacher/school-assessments`.
   - Rebranded module ID `gkTest` to "School Based Assessment" with aliases `schoolAssessment`, `schoolBasedAssessment`, and updated role presets and permissions.

9. **Firestore Rules & Backend Security** ([firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules) & [netlify/functions/public-result.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/netlify/functions/public-result.js)):
   - Ensured Firestore rules strictly restrict `practicalsData` and `practicalsBin` read/write to authenticated teachers and administrators.
   - Deployed updated rules to Firebase production via `npm run deploy:rules`.
   - Prevented public functions from ever returning practical evaluation records.

---

### Exact List of Files Changed

- [.agents/AGENTS.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/.agents/AGENTS.md) (Added Section 8 Practicals & Academic Evaluation Data Boundary Rule)
- [AGENTS.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/AGENTS.md) (Added Section 8 Practicals & Academic Evaluation Data Boundary Rule)
- [firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules) (Secured practicalsData and practicalsBin to teacher/admin authorization)
- [netlify/functions/public-result.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/netlify/functions/public-result.js) (Blocked practical evaluation records from public lookup)
- [src/App.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/App.js) (Registered lazy-loaded routes for TeacherAssessmentsPage)
- [src/portal/admin/AdminGkTestManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminGkTestManager.jsx) (Integrated approvals tab and badge into School Based Assessment suite)
- [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx) (Strictly scoped practicals approvals and filters to practicals)
- [src/portal/admin/SchoolAssessmentApprovalsView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAssessmentApprovalsView.jsx) (Created admin approval workflow for non-practical school exams)
- [src/portal/admin/adminModuleCatalog.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/adminModuleCatalog.js) (Rebranded gkTest to School Based Assessment with backward-compatible aliases)
- [src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx) (Restricted practical evaluation types and history)
- [src/portal/teacher/TeacherAssessmentsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherAssessmentsPage.jsx) (Created dedicated 3rd teacher portal for school-based exams)
- [src/portal/teacher/TeacherDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherDashboard.jsx) (Added School Based Assessment card and routing)
- [src/utils/evaluationTypes.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/evaluationTypes.js) (Created evaluation type helpers and constants)
- [src/utils/practicalsSettingsManager.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsSettingsManager.js) (Added practical and school assessment type query helpers)
- [CHANGES_SINCE_LAST_COMMIT.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/CHANGES_SINCE_LAST_COMMIT.md) (Updated commit memory log)

---

### Build & Deployment Verification

1. **Build Verification**:
   - Executed `npm run build`: Production build compiled with **Exit Code 0** (zero breaking errors).
   - Generated 11 public HTML pages, canonical redirects, and sitemap.xml.
   - All SEO regression checks passed.

2. **Firebase Rules Deployment**:
   - Executed `npm run deploy:rules`:
   - Deployed updated `firestore.rules` to production Firebase project `hsssdb` successfully.

---

### Manual Review & Push Instructions

To review or amend this local commit:
```bash
# Check current local commit
git log -1 --stat

# If you wish to amend or re-commit:
git reset --soft HEAD~1
git commit -m "feat(assessments): restrict practicals portal to practical data and expand school based assessment portal with teacher and admin approvals"
```

To push changes to GitHub:
```bash
git push origin main
```
