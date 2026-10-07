# Changes Since Last Commit

## Commit Message

`feat(staff): allow account deactivation for transferred teachers and enable award succession`

## Summary of Changes

1. **Account Deactivation & Transfer Lifecycle (`functions/staffSecurity.js` & `src/services/staffAuthService.js`)**:
   - **Authoritative Cloud Function Workflow**: Extended `manageStaffAccount` to support `action: 'deactivate'` and `action: 'reactivate'`.
   - **Access Revocation & Disabling**:
     - Deactivation marks the profile with `active: false`, `deactivated: true`, `deactivatedReason: data.reason || 'Transferred / Relieved'`, and timestamp `deactivatedAt`.
     - Revokes Firebase Auth refresh tokens, disables the Firebase Auth account (`disabled: true`), sets claims role to `'Student'` with empty permissions, and removes active admin sessions.
     - Retains the user record in `adminSettings/permissions.users` marked as deactivated rather than wiping it out, ensuring complete institutional accountability.
     - Reactivation restores Firebase Auth account (`disabled: false`), sets `active: true`, `deactivated: false`, restores role and permissions, and clears deactivation reasons.
     - Audited via `staff_deactivate` and `staff_reactivate` entries in `securityAuditLogs`.
   - **Practicals Configuration Synchronization**: Automatically syncs `adminPracticalsSettings/config.deactivatedTeachers` array in Cloud Functions and client service so the evaluation subsystem knows which teachers have been transferred.
   - **Client Login Gate**: `resolveStaffRoleAndPerms` immediately intercepts deactivated accounts, blocking login and cached sessions with a clear, polite explanation: *"This staff account has been deactivated / transferred (Reason: ...). Please contact the school administration."*

2. **Staff & Permissions Manager UI (`src/portal/admin/StaffPermissionsManager.jsx`)**:
   - **Status Filter Segmented Controls**: Added status filter tabs: `Active (${activeStaffCount})`, `Deactivated / Transferred (${deactivatedStaffCount})`, and `All Status (${adminUsers.length})` alongside existing role filters (`Teachers`, `Admins`, `SuperAdmin`).
   - **Deactivated Staff Card Styling**:
     - Deactivated accounts display distinct rose-tinted border styling and an avatar icon with `UserX`.
     - Prominent `Transferred / Deactivated` badge with the recorded reason (e.g. `Transferred to another institution`).
     - Reset password button is safely disabled for deactivated accounts.
     - `Reactivate` button (`RotateCcw`) allows 1-click reactivation by administrators.
   - **Active Staff Card Deactivation**: Added a `Deactivate` button (`UserX`) on active staff cards (SuperAdmin accounts remain protected).
   - **Dedicated Deactivation Modal**:
     - Displays confirmation modal explaining access revocation and how it prevents duplicate award submissions.
     - Quick-select reason pills: `"Transferred to another institution"`, `"Relieved from duties / Retired"`, `"Subject reallocated to new faculty"`, `"Contract / Assignment ended"`, with a custom write-in input field.
   - **Reactivation Confirmation Modal**: Confirms account reactivation and permission restoration.
   - **Edit Staff Profile Modal**: Added an **Account Operational Status** toggle (`Active` vs `Transferred / Deactivated`) with custom transfer reason input for existing staff profiles.

3. **Practicals Award Succession & Zero Duplicate Guarantee (`src/portal/teacher/PracticalsPage.jsx` & `src/utils/practicalsPdfGenerator.js`)**:
   - **Authorized Successor Resolution (`isSubmissionOwnedByTeacher`)**:
     - When an evaluation award was submitted by a teacher who is now listed in `practicalsSettings.deactivatedTeachers` (or flagged transferred), and the current authenticated teacher is active and assigned to that subject and class, `isSubmissionOwnedByTeacher` recognizes the new teacher as the **authorized successor**.
     - Prevents lockout: new teachers are NOT blocked by `lockedOtherTeacherAward`.
   - **Faculty Handover Notice Banner**:
     - When the successor teacher opens the subject, a prominent notification banner appears above the student roster:
       *"Faculty Handover Active: Existing Award Record Adopted. This award roll was previously initiated by [Previous Teacher Name] (Transferred/Deactivated). As the appointed faculty member for [Subject], your draft or final submission will adopt and update this single canonical record. Zero duplicate award rolls will be generated."*
   - **Canonical In-Place Update (Zero Duplicates)**:
     - Draft and final submissions update the exact canonical document `formatPracticalDocId(selectedClass, selectedSubject, practicalType, yearSuffix)`.
     - Stamped with the new teacher's identity (`submittedByName`, `submittedByEmail`) while archiving previous teacher details in `previousAwardSummary` / `handoverFrom`.
   - **Submissions History & PDF Printing**:
     - Successor teachers can review, reload, and print official PDF award rolls from `submissionHistory` for their assigned subject even if initiated by the transferred teacher.
   - **Account Deactivation Guards**:
     - Added strict runtime checks in `handleSaveDraft`, `handleInitiateFinalSubmit`, and `executeFinalSubmit` ensuring that any inactive or deactivated account is immediately prevented from modifying or submitting marks.

## Files Changed

1. `functions/staffSecurity.js`
2. `src/portal/admin/StaffPermissionsManager.jsx`
3. `src/portal/teacher/PracticalsPage.jsx`
4. `src/services/staffAuthService.js`
5. `src/utils/practicalsPdfGenerator.js`
6. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- **Production Build**: Verified with `npm run build` (Exit Code 0, all 12 public HTML pages generated, zero breaking errors, zero SEO regression issues).
- **Security Boundary**: Adheres strictly to Practicals & Academic Evaluation Data Boundary Rule (Rule 8): practicals data remains confidential institutional data accessible exclusively to authenticated teachers and administrators, strictly segregated from School Based Assessment (Pre-Board).

## Manual Git Push Instructions

1. Inspect the local commit:
   ```bash
   git log -1 --stat
   ```
2. If you wish to amend or re-commit:
   ```bash
   git reset --soft HEAD~1
   git commit -m "feat(staff): allow account deactivation for transferred teachers and enable award succession"
   ```
3. Push changes to GitHub (strictly manual):
   ```bash
   git push origin main
   ```
