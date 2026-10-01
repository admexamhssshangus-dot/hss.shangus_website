# Changes Log & Commit Reference

## Latest Commit: Fix Role Precedence & Add Dual-Role Workspace Switcher for Standard Admins

**Commit Message:** `fix(auth): prioritize admin dashboard routing for dual-role staff and add workspace switcher`

---

### Root Cause Analysis

1. **Dual Responsibility of Nawaz Ahmad Shah (`shahnawaz13678@gmail.com`)**:
   - In administrative settings (`adminSettings/permissions`, `staffAuthService.js`, and `authRoles.js`), Nawaz is registered as a **Standard Admin** (`role: 'Admin'`, permissions: `reports`, `analyticsReports`, `officialLetter`, `certStudio`).
   - Concurrently, in school practical evaluation registers (`cleanPracticalsSeedData.js`), Nawaz is also an authorized **Faculty Evaluator** for Political Science laboratory practicals and classroom attendance.

2. **Why the Teacher Dashboard Appeared**:
   - **Login Tab Selection (`/portal/login`)**:
     On the login portal, if the user or browser session opened with the *Faculty / Teacher* tab active, `LoginPage.jsx` set `redirectPath = '/portal/teacher'`. Because Nawaz has faculty evaluator privileges, the system validated the session and routed him directly to `/portal/teacher`.
     Conversely, signing in with the *Administration* tab active set `redirectPath = '/portal/admin'`, loading the Admin Dashboard (`Analytics & Statistical Reports Suite`).
   - **Student Tab Fallback Auto-Detection**:
     In `LoginPage.jsx`, if someone entered credentials on the *Student* tab, the handler checked `if (isTeacher && selectedRole === 'student')` and set `redirectPath = '/portal/teacher'` without checking `isAdmin` first.
   - **Role Priority Inversion in `staffAuthService.js`**:
     Line 256 previously checked `isTeacher ? 'Teacher' : (isAdmin ? 'Admin' : 'Teacher')`, which prioritized `'Teacher'` over `'Admin'` whenever educator or subject flags were present.
   - **Missing Bootstrap Admin Check in `PortalLayout.jsx`**:
     `PortalLayout._redirectToDashboard` only verified `isBootstrapSuperAdminEmail` on mount/restore, omitting `isBootstrapAdminEmail`, allowing dual-role accounts to default to teacher routes if session state varied.
   - **No Dual-Role Navigation Switcher on `TeacherDashboard.jsx`**:
     In `App.js`, `RoleGuard` intentionally allows administrators (`portalArea(role) === 'admin'`) to access `/portal/teacher`. However, `TeacherDashboard.jsx` previously had no button to return to `/portal/admin`, nor did it indicate that an administrator was viewing the educator workspace.

---

### Summary of Changes

1. **Role Precedence Optimization (`src/services/staffAuthService.js`)**:
   - Updated `resolveStaffRoleAndPerms` to evaluate `isAdmin` before `isTeacher`.
   - Guaranteed that administrative privileges remain dominant (`role: 'Admin'` or `'SuperAdmin'`), while retaining `isAdmin: true` and `isTeacher: true` for full educator workflow capabilities.

2. **Login Routing & Account Auto-Recognition (`src/portal/LoginPage.jsx`)**:
   - Updated `isLikelyTeacherEmail` to exclude all bootstrap administrators and superadmins, preventing teacher role hints on admin accounts.
   - In `handlePasswordSignIn`: Added automatic admin detection on the *Student* tab (`isAdmin && selectedRole === 'student'`) to set `redirectPath = '/portal/admin'` before checking teacher fallbacks.

3. **Session Dashboard Routing Gate (`src/portal/layout/PortalLayout.jsx`)**:
   - Updated `_redirectToDashboard` to verify both `isBootstrapSuperAdminEmail` and `isBootstrapAdminEmail`, ensuring standard administrators are consistently routed to `/portal/admin`.

4. **Dual-Role Recognition & Portal Switcher (`src/portal/teacher/TeacherDashboard.jsx`)**:
   - Detected `isAdminUser` using `user.isAdmin`, `isBootstrapAdminEmail`, `isSuperAdminEmail`, and role strings.
   - Rendered an `Admin & Educator` role badge instead of a generic `Educator` tag when administrators access the workspace.
   - Added a direct **"Admin Portal"** switch button in the header card beside the Logout button.
   - Added an administrative guidance banner explaining that the user is currently in the practical evaluation & attendance module, with a 1-click button to jump to the Admin Dashboard.

5. **Quick Navigation from Admin Dashboard (`src/portal/admin/AdminDashboard.jsx`)**:
   - Added a `Teacher Portal` header button beside the `Modules` dropdown, enabling administrators with teaching duties to quickly switch to attendance and practical evaluation.

---

### Exact List of Files Changed

- `src/services/staffAuthService.js`
- `src/portal/LoginPage.jsx`
- `src/portal/layout/PortalLayout.jsx`
- `src/portal/teacher/TeacherDashboard.jsx`
- `src/portal/admin/AdminDashboard.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

### Verification & Build Status

- **Build Verification**: `npm run build` completed with **Exit Code 0** and zero breaking errors.
- **Firebase Security Rules**: Unchanged (`firestore.rules` and `storage.rules` remain synced with remote).

---

### Instructions for User: Manual Review, Amend & Push

1. **Inspect Commit History**:
   ```bash
   git log -n 1 --stat
   ```
2. **Review Code Diff**:
   ```bash
   git diff HEAD~1
   ```
3. **Amend Commit Message (if desired)**:
   ```bash
   git reset --soft HEAD~1
   git commit -m "fix(auth): prioritize admin dashboard routing for dual-role staff and add workspace switcher"
   ```
4. **Push to Remote (STRICT MANUAL RULE)**:
   ```bash
   git push origin main
   ```
