# Changes Log & Commit Reference

## Latest Commit: Enforce Strict Practical vs School Assessment Separation in Teacher Submissions History per Rule 8

**Commit Message:** `fix(teacher): strictly isolate practical submissions from school-based assessments in history logs`

---

### Context & Root Cause Analysis

The user reported:
> *"why history still shows preboard under practicals portal"*

When opening the Submissions Log from Card 2 (**Practical Evaluation Portal**) on the Teacher Dashboard, the modal listed:
1. `11th • Botany Pre-Board Test`
2. `12th • Botany Pre-Board Test`
3. `11th • Botany (BO) external`
4. `12th • Botany (BO) internal`
5. `11th • Botany (BO) internal`

#### Root Cause:
1. While `PracticalsPage.jsx` and `TeacherAssessmentsPage.jsx` already had strict evaluation-type filtering, the initial submissions query in `src/portal/teacher/TeacherDashboard.jsx` was missing the `isPracticalEvaluationType(...)` filter in `fetchSubmissionHistory`.
2. As a result, both Pre-Board examination entries and Practical entries from `practicalsData` were lumped together into the Practical Submissions count and modal.
3. This violated **Rule 8 (Practicals & Academic Evaluation Data Boundary Rule)**, which mandates clean end-to-end separation: practical portals hold ONLY practical data (Internal Assessment & External Practical), while all other exams (Pre-Board, Golden Test, Term End, Unit Tests) belong exclusively to School-Based Assessment.

---

### Changes Made

1. **`src/portal/teacher/TeacherDashboard.jsx`**:
   - Added strict `isPracticalEvaluationType(evalTypeRaw)` check inside `fetchSubmissionHistory`.
   - Pre-Board, Golden Tests, and other non-practical examinations are now strictly excluded from the Practical Submissions count and modal.
   - Updated modal title to **"My Practical Submissions Log"** with subtitle explicitly stating: *"Your submitted practical awards (Internal Assessment & External Practical only)"*.
   - Added a dedicated **"Submissions Log"** link to Card 3 (**School Based Assessment**), enabling teachers to directly access their School-Based Assessment submissions (Pre-Board Tests, Golden Tests, Unit Tests, etc.) in the correct portal.

2. **`src/portal/teacher/TeacherAssessmentsPage.jsx`**:
   - Added auto-open effect for `?history=true` and `state.openHistory`, allowing seamless navigation from Card 3's Submissions Log link directly into the School-Based Assessment drawer.

3. **`src/portal/teacher/PracticalsPage.jsx`**:
   - Clarified submissions modal header to **"My Practical Submissions Log"** (*Internal Assessment & External Practical only*).

---

### Exact List of Files Changed

- [src/portal/teacher/TeacherDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherDashboard.jsx) (Enforced `isPracticalEvaluationType` filter on practical history and added School-Based Assessment Submissions Log link)
- [src/portal/teacher/TeacherAssessmentsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/TeacherAssessmentsPage.jsx) (Enabled auto-open of assessments history drawer on navigation)
- [src/portal/teacher/PracticalsPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/teacher/PracticalsPage.jsx) (Clarified modal title to My Practical Submissions Log)
- [CHANGES_SINCE_LAST_COMMIT.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/CHANGES_SINCE_LAST_COMMIT.md) (Updated memory log)

---

### Build Verification & Metrics

- `npm run build`: **Exit Code 0** (production bundle built cleanly; passed all 11 static SEO checks).

---

### Manual Review & Push Instructions

To review or amend this local commit:
```bash
# Check current local commit
git log -1 --stat

# If you wish to amend or re-commit:
git reset --soft HEAD~1
git commit -m "fix(teacher): strictly isolate practical submissions from school-based assessments in history logs"

# Push manually whenever ready (DO NOT push automatically):
git push origin main
```
