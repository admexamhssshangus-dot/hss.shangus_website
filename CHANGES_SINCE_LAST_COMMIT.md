# Changes Log & Commit Reference

## Latest Commit: Class 10th Practicals Management (7 Subjects) & Practicals Recycle Bin Delete Actions

**Commit Message:** `feat(practicals): add Class 10th practicals support with 7 core subjects and submission delete recycle bin`

---

### Context & User Requests

1. **Class 10th Practicals Management**:
   - The user requested: *"moreover the practicals portal will now manage class 10th practicals also.....class 10th class 7 subjects in total"*
   - Authoritative 7 subjects for Secondary Class 10th:
     - 5 Compulsory Core Subjects: English (`EN`), Mathematics (`MA`), Science (`SC`), Social Science (`SS`), Urdu (`UR`).
     - 2 Vocational Electives: Healthcare (`HTC`), IT and ITES (`ITE`).

2. **Submission Delete & Recycle Bin**:
   - The user asked *"where is delete option"* with a screenshot of the submission inspection/review modal.
   - When reviewing a submission in `SelectedSubmissionModal`, there was no option to delete or soft-delete the submission, requiring users to exit and find rows in the underlying tables.
   - Pending approval cards and modal footers previously only displayed "Inspect", "Reject / Revision", and "Approve".

---

### Solutions Implemented

1. **Integrated Class 10th Practicals in Admin Portal**:
   - Added `Class 10th` tab alongside `Class 11th` and `Class 12th` in the main segmented toolbar of [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx).
   - Rendered `<AwardsSummaryView cls="10th" ... />` when the `Class 10th` tab is selected.
   - In `AwardsSummaryView`, dynamically resolved `activeCodesList` for Class 10th to the authoritative 7 subjects: `['EN', 'MA', 'SC', 'SS', 'UR', 'HTC', 'ITE']`.
   - Updated `isClassMatch` and `getRollNo` to parse Class 10th identifiers (including Roman numeral `X`, text `ten`, and `Class Roll No (Class 10th)`).
   - Preserved `Subjects to be taken in Class 10th` in `cleanStudentData` normalization.
   - Added `Class 10th` to the flat document audit filter dropdown in `FacultySubmissionsView`.

2. **Direct Delete & Practicals Recycle Bin Across Modals & Cards**:
   - Passed `onDelete` to `<SelectedSubmissionModal>` in [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx), triggering the recoverable confirmation modal and moving documents to `practicalsRecycleBin`.
   - Added a prominent red **Delete** button in the top-right toolbar of `SelectedSubmissionModal` (next to "Print Award Roll").
   - Added a **Delete** button in the modal footer next to "Request Revision / Reject".
   - Added quick delete trash icons directly on each pending approval card in `FacultySubmissionsView`.
   - Added a delete button to the inspection modal footer in [src/portal/admin/SchoolAssessmentApprovalsView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAssessmentApprovalsView.jsx).

3. **Recycle Bin Service & Firestore Security Rules**:
   - Created [src/portal/admin/PracticalsRecycleBinModal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/PracticalsRecycleBinModal.jsx) with search, filter, restore to live database, and permanent purge capabilities.
   - Integrated `practicalsBinService.js` with `moveSubmissionToRecycleBin`, `getPracticalsRecycleBinItems`, `restoreSubmissionFromBin`, and `purgeSubmissionFromBin`.
   - Updated [firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules) with RBAC rules for `practicalsRecycleBin` collection.
   - Deployed updated security rules to Firebase `hsssdb` successfully.

---

### Exact List of Files Changed

- [firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules) (Added `practicalsRecycleBin` collection security rules)
- [src/services/practicalsBinService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/practicalsBinService.js) (Added soft-delete, restore, and purge services)
- [src/portal/admin/PracticalsRecycleBinModal.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/PracticalsRecycleBinModal.jsx) (Recycle bin modal interface)
- [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx) (Class 10th tabs, 7 subjects, modal delete button, pending card delete buttons, recycle bin launcher)
- [src/portal/admin/SchoolAssessmentApprovalsView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/SchoolAssessmentApprovalsView.jsx) (Inspect modal footer delete button)
- [CHANGES_SINCE_LAST_COMMIT.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/CHANGES_SINCE_LAST_COMMIT.md) (Updated memory log)

---

### Build Verification & Metrics

- `npm run build`: **Exit Code 0**
- `npx -y firebase-tools deploy --only firestore:rules`: **Released successfully to Firebase `hsssdb`**

---

### Manual Review & Push Instructions

To review or amend this local commit:
```bash
# Check current local commit
git log -1 --stat

# If you wish to amend or re-commit:
git reset --soft HEAD~1
git commit -m "feat(practicals): add Class 10th practicals support with 7 core subjects and submission delete recycle bin"

# Push manually whenever ready:
git push origin main
```
