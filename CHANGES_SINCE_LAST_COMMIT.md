# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(teacher): reflect assigned subjects in school assessment portal and open history modal directly on dashboard`
- **Date**: October 02, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally.

---

## Architectural Purpose: Assigned Subjects Visibility & Dashboard History Modal Parity

### Problems Solved:
1. **Assigned Subject Reflection in School-Based Assessment Portal**:
   - When a teacher (e.g. `socialshiftz@gmail.com` with assigned subject `Botany`) navigated to `/portal/teacher/assessments`, the portal defaulted to `General English`.
   - Cause: `useState` ran once on mount before `user` had finished hydrating from Firebase Auth, leaving `teacherClassAssignedSubjects` empty on initial render with no reactive synchronizer.
   - The Subject selector dropdown listed all subjects as a flat list with no visual distinction for the teacher's assigned subjects.
   - The Header Card lacked the educator's assigned subject badge.

2. **Submissions Log Background Navigation on Teacher Dashboard**:
   - On `TeacherDashboard.jsx`, Card 3 (School-Based Assessment Portal) used `<Link to="/portal/teacher/assessments?history=true">` instead of opening the dashboard's own history modal.
   - Clicking "Submissions Log" navigated the browser to the assessment portal route, mounting the full assessment page in the DOM behind the modal. Closing the modal left the user on the assessment portal rather than the dashboard.

---

## Files Changed & Synchronizations Completed

### 1. `src/portal/teacher/TeacherDashboard.jsx`
- Replaced `<Link to="/portal/teacher/assessments?history=true">` on Card 3 with `<button onClick={() => handleOpenHistoryModal('assessments')}>`.
- Clicking "Submissions Log" on Card 3 now opens the history modal directly on the dashboard, keeping the teacher on the dashboard without loading the assessment portal route in the background.
- Dynamic modal styling: The history modal dynamically adapts title, subtitle, icon, badges, and Load button styling between practicals (Indigo theme) and school assessments (Purple theme).
- Displays live submission counts directly on both cards: `Submissions Log (X)`.

### 2. `src/portal/teacher/TeacherAssessmentsPage.jsx`
- **Reactive Subject Synchronization**: Added a `useEffect` that monitors `user`, `selectedClass`, `teacherClassAssignedSubjects`, `allTeacherAssignedSubjects`, and `displaySubjects`. When the profile hydrates or the teacher switches classes, `selectedSubject` automatically defaults to the educator's assigned subject for that class (e.g. `Botany` for Class 11th/12th).
- **Manual Override Memory**: Uses `userHasManuallySelectedSubjectRef` so that if the teacher explicitly chooses another subject, their selection is honored. When switching classes, the ref resets so the new class defaults to their assigned subject.
- **Top Header Card Badge**: Displays the teacher's registered subject badge (`Assigned: Botany`) alongside `Faculty Entry`.
- **Subject Selector Dropdown Partitioning**: Groups subjects into `<optgroup label="⭐ Your Assigned Subjects">` (with star prefix and `— Assigned` suffix) and `<optgroup label="All Curriculum Subjects">`.
- **Live Status Badges**: Displays `✓ Assigned Subject` (teal) or `Cross-Subject` (amber) in both the filter toolbar and the assessment info banner.
- **Payload Enhancement**: Automatically records `isCrossSubject: !isCurrentSubjectAssigned` in both draft and final submission payloads so audit logs and administrators know if an evaluation was for an assigned or cross-curriculum subject.
- **Submissions Drawer**: Shows the `Cross` badge for historical cross-subject evaluations and preserves selection refs on record loading.

### 3. `src/utils/practicalsSettingsManager.js`
- Cleaned up imports and exports of evaluation type utilities (`PRACTICAL_EVALUATION_TYPES`, `DEFAULT_SCHOOL_ASSESSMENT_TYPES`, `isPracticalEvaluationType`, `isSchoolAssessmentType`) ensuring proper scope binding and zero unused-variable warnings.

---

## Verification & Build Details
- **Production Build**:
  - `npm run build` -> `Exit Code 0`
  - All 11 static pages, SEO regression check, and bundle chunks verified.

---

## Instructions for User

### 1. Inspect the Local Commit
To inspect the local commit:
```bash
git log -n 1 --stat
```

### 2. Manually Amend / Re-commit (Optional)
If you wish to adjust the commit message or files before pushing:
```bash
git reset --soft HEAD~1
# Make desired changes
git add .
git commit -m "fix(teacher): reflect assigned subjects in school assessment portal and open history modal directly on dashboard"
```

### 3. Push to Remote Repository (Manual Action)
As per institutional policy, the assistant never pushes to remote repositories:
```bash
git push origin main
```
