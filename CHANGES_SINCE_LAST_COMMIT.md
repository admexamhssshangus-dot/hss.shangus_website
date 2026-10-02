# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(auth): strictly enforce mutually exclusive single role per email across portal and firestore`
- **Date**: October 02, 2026
- **Status**: Production Build Passed (`Exit Code 0`), Firebase Security Rules Deployed (`Exit Code 0`), verified locally.

---

## Architectural Purpose: Strict Single Institutional Role per Email

### 4 Strictly Mutually Exclusive Roles:
1. **Super Admin (`SuperAdmin`)**:
   - Master institutional administrator (`adm.exam.hss.shangus@gmail.com`).
   - Root privilege across administrative tools and security rules.
2. **Standard Admin (`Admin`)**:
   - Institutional administrators with specific modular permissions (`BOOTSTRAP_ADMINS` or explicitly assigned `Admin`).
   - Strictly isolated from Teacher/Educator attributes (cannot hold assigned classes or teaching subjects).
3. **Teacher (`Teacher`)**:
   - Faculty & educators exclusively focused on educational modules, attendance, and practical evaluations.
   - Strictly denied administrative role/access (`isAdmin = false`, cannot enter Admin portal, cannot evaluate as admin).
4. **Student (`Student`)**:
   - Students & applicants exclusively focused on admissions, admit cards, and student services.
   - Strictly denied teacher/staff privileges (`isAdmin = false`, `isTeacher = false`, `isStaff = false`).

Zero dual-role leaking or role stacking is permitted: an email evaluates to one and only one canonical role everywhere.

---

## Files Changed & Enhancements

### 1. `src/utils/authRoles.js`
- Added canonical `ROLES` enumeration (`SUPER_ADMIN`, `STANDARD_ADMIN`, `TEACHER`, `STUDENT`).
- Added `isStandardAdminEmail(email)` to isolate standard admins from the super administrator.
- Added `getStrictCanonicalRole(email, profile)` to authoritatively determine the exact single role.
- Added `enforceStrictRoleAttributes(userOrProfile)` guaranteeing mutually exclusive flags (`isSuperAdmin`, `isAdmin`, `isTeacher`, `isStudent`, `isStaff`) and clearing teacher-specific attributes from non-teacher accounts.

### 2. `src/services/staffAuthService.js`
- Updated fallback staff profiles with explicit, mutually exclusive role attributes.
- Refactored `resolveStaffRoleAndPerms` to strictly resolve canonical single roles without dual-flagging.
- Updated `createStaffAccount` and `updateStaffAccount` to strictly enforce role properties and clear teacher attributes for standard admins.

### 3. `src/portal/LoginPage.jsx`
- Updated `createVerifiedSession` and role resolution to enforce canonical single roles.
- Enhanced `handleGoogleSignIn` and `handleEmailPasswordSignIn` with strict portal cross-checks:
  - **Teacher Tab**: Strictly rejects non-teachers with clear, descriptive alerts.
  - **Admin Tab**: Strictly requires standard admin or super admin privileges; rejects teachers or students.
  - **Student Tab**: Automatically detects staff/teacher emails and redirects them to their proper dedicated portals without creating invalid student sessions.

### 4. `src/portal/RegisterPage.jsx`
- Added pre-registration check preventing any staff email (`SuperAdmin`, `Admin`, `Teacher`) from registering a conflicting Student account.
- Handled Google Sign-Up for staff emails by redirecting them directly to their appropriate dashboard instead of overwriting staff profiles.

### 5. `src/App.js`
- Upgraded `RoleGuard` to enforce strict canonical role validation:
  - Admins (Standard & Super) can access `/portal/admin` only.
  - Teachers can access `/portal/teacher` only (Admins can no longer access Teacher portal).
  - Students can access `/portal/student` only.
  - Unauthorized role navigation triggers automatic redirection to the user's canonical portal.

### 6. `src/portal/teacher/TeacherDashboard.jsx`
- Removed the "Admin & Educator" badge, admin portal switcher link, and administrator guidance banner to ensure a clean, purely faculty-focused workspace.

### 7. `src/portal/admin/StaffPermissionsManager.jsx`
- Updated `handleApplyPermissions` and `handleSaveAdminForm` to enforce strict role attributes.
- Prevented assigning teacher subjects/classes to standard admin accounts, keeping administrative accounts cleanly separated from educator attributes.

### 8. `firestore.rules`
- Cleaned up role helper functions (`isSuperAdmin`, `isStandardAdmin`, `isAdmin`, `isTeacher`, `isStudent`):
  - `isSuperAdmin()`: strictly checks for master super admin.
  - `isStandardAdmin()`: strictly checks for standard admin identity while enforcing `!isSuperAdmin()`.
  - `isAdmin()`: `isSuperAdmin() || isStandardAdmin()`.
  - `isTeacher()`: strictly checks faculty identity while enforcing `!isAdmin()`.
  - `isStudent()`: strictly checks authenticated identity while enforcing `!isAdmin() && !isTeacher()`.
- Updated collection rules (`attendance`, `holidays`, `adminPracticalsSettings`, `generatedDocumentHistory`, `documentHistory`) to allow admin permissions explicitly where required without conflating admins with teachers.
- Successfully deployed to Firebase (`npm run deploy:rules`).

---

## Verification & Build Details
1. **Firebase Security Rules**:
   - `npm run deploy:rules` -> `Exit Code 0`
   - Rules compiled and released to cloud.firestore.
2. **Production Build**:
   - `npm run build` -> `Exit Code 0`
   - Static pages generated, SEO regression check passed.

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
git commit -m "fix(auth): strictly enforce mutually exclusive single role per email across portal and firestore"
```

### 3. Push to Remote Repository (Manual Action)
As per institutional policy, the assistant never pushes to remote repositories:
```bash
git push origin main
```
