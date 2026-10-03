# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(practicals): grant full operational module parity to standard admins and protect superadmin permissions`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Firestore Security Rules Deployed (`Exit Code 0`).

---

## Architectural Purpose & Issues Resolved

### 1. Root Cause of "Failed to load practicals data" and Empty Student Cohort
1. **Unbounded Firestore Fetch in `AdminPracticals.jsx`**:
   - `getDocs(collection(db, 'adminPracticalsSettings'))` was run inside `Promise.all` with no error boundary or `.catch()` fallback.
   - `match /adminPracticalsSettings/{documentId}` in Firestore rules did not grant global read to authenticated standard admins or teachers, throwing a runtime `permission-denied` rejection.
   - This rejected the entire `Promise.all([fetchPracticals, fetchSettings, getStaffDirectory, admissionsData, masterRegistersData])`, landing directly in the outer catch block (`showAlert('error', 'Failed to load practicals data.')`) and leaving `students` as an empty array `[]`.
2. **`canUseAny(modules)` and Admin Operations Parity**:
   - Standard admins are intended to have operational parity with SuperAdmin across all 24 administrative modules in `ADMIN_MODULE_CATALOG`.
   - Checking brittle `perms.hasAny(modules)` on standard admins caused permission rejections whenever new modules were accessed or perms arrays fell out of sync.
   - Standard admins (`isAdmin()`) now inherit unrestricted operational module access across all 24 modules, just like SuperAdmin.
3. **Master SuperAdmin Protection**:
   - Standard admins can manage staff accounts (teachers, examiners, and standard admins) in `StaffPermissionsManager.jsx`, but cannot edit, toggle permissions on, or delete the Master Super Administrator account (`adm.exam.hss.shangus@gmail.com`).
   - Firestore security rules strictly protect `users/adm.exam.hss.shangus@gmail.com` from mutations or deletions by standard admins (`userId != 'adm.exam.hss.shangus@gmail.com'`), while allowing standard admins to manage non-superadmin accounts and update `adminSettings/permissions`.

---

## Changes Implemented

### 1. Firestore Security Rules Enhancements & Rules Deployment
- File: [firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules)
  - Updated `canUseAny(modules)` to grant access if `isAdmin()`, ensuring all 24 administrative modules are immediately accessible to both SuperAdmin and Standard Admins without per-module permissions barriers.
  - Simplified `canReadStudents()` to `isTeacher() || isAdmin()`, and `canEditStudents()` to `isAdmin()`.
  - Updated `match /adminPracticalsSettings/{documentId}` with `allow read: if isTeacher() || isAdmin() || (documentId == 'config');`, `allow create, update: if (isTeacher() || isAdmin()) && hasNoCredentialFields(request.resource.data);`, and `allow delete: if isAdmin();`.
  - Updated `match /adminSettings/{documentId}` to permit standard admins to read and update `permissions` (`documentId == 'permissions' && isAdmin() && hasNoCredentialFields(request.resource.data)`), while preserving delete as SuperAdmin-only.
  - Hardened `match /users/{userId}` to allow standard admins to list and manage staff accounts (`validAdminManagedUser(request.resource.data)`), while strictly barring standard admins from creating, editing, or deleting the SuperAdmin document (`userId != 'adm.exam.hss.shangus@gmail.com'`).
  - Automatically deployed updated rules via `npm run deploy:rules` with `Exit Code 0`.

### 2. Admin Practicals Data Fetch Resilience
- File: [src/portal/admin/AdminPracticals.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminPracticals.jsx)
  - Isolated individual fetch operations (`fetchPracticals`, `fetchSettings`, `getStaffDirectory`, `admissionsData`, `masterRegistersData`) with local `.catch()` handlers so that a secondary query failure cannot abort student cohort hydration.
  - Added safe optional chaining `(ts?.docs || [])` when mapping teacher directory documents.

### 3. Admin Tools Module Launcher Parity
- File: [src/portal/admin/AdminToolsDropdown.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminToolsDropdown.jsx)
  - Updated `isUserPermittedForModule` so that any administrator (`role === 'admin' || role === 'administrator' || user.isAdmin === true || isStandardAdminEmail(email) || isBootstrapAdminEmail(email)`) has unrestricted access to all 24 modules, while preserving scoped permission checks for teachers.
  - Maintained `if (!user) return false;` assertion required by automated security regression checks.

### 4. Staff Permissions Manager SuperAdmin Protection
- File: [src/portal/admin/StaffPermissionsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffPermissionsManager.jsx)
  - Added `isCurrentSuperAdmin` detection based on the authenticated user's email.
  - Guarded `handleOpenEditAdmin`, `togglePermission`, and `setAllPermissionsForUser` so standard admins cannot alter SuperAdmin's role or permissions.
  - Disabled the edit button, modules toggle, and password reset buttons for SuperAdmin when viewed by a standard admin, displaying a clear "SuperAdmin (Master Protected)" badge.
  - In `handleApplyPermissions`, ensured standard admins do not write to `users/adm.exam.hss.shangus@gmail.com`, preventing Firestore permission rejections while syncing other staff accounts.

---

## Files Changed

1. `firestore.rules`:
   - Updated `isStandardAdmin`, `canUseAny`, `canReadStudents`, `canEditStudents`, `adminPracticalsSettings`, `adminSettings`, and `users/{userId}` with SuperAdmin protection.
2. `src/portal/admin/AdminPracticals.jsx`:
   - Added fault-tolerant fetch boundaries and safe chaining in `loadData`.
3. `src/portal/admin/AdminToolsDropdown.jsx`:
   - Granted full 24-module operational access to standard admins in `isUserPermittedForModule`.
4. `src/portal/admin/StaffPermissionsManager.jsx`:
   - Enforced SuperAdmin protection in UI and sync handlers against edits by standard admins.
5. `CHANGES_SINCE_LAST_COMMIT.md`:
   - Documented all changes, root causes, test results, and user instructions.

---

## Verification & Build Details
- **Build Verification**:
  - `npm run build` -> Exit Code 0 (zero breaking errors).
- **Regression Checks**:
  - `npm run security:check` -> Exit Code 0 (Security regression checks passed).
  - `npm run admission:check` -> Exit Code 0 (Admission regression checks passed).
  - `npm run seo:check` -> Exit Code 0 (SEO checks passed).
- **Security Rules Deployment**:
  - `npm run deploy:rules` -> Exit Code 0 (`released rules firestore.rules to cloud.firestore`).

---

## Instructions for User

### Inspect the Commit
To view the commit history and changes made locally:
```bash
git show HEAD
# or
git log -n 1 --stat
```

### Amending or Re-committing (Optional)
If you wish to adjust the commit message or add more files before pushing:
```bash
git reset --soft HEAD~1
git commit -m "fix(practicals): grant full operational module parity to standard admins and protect superadmin permissions"
```

### Manual Push to Remote (Required)
As per project safety policies, the assistant is strictly prohibited from pushing directly to remote repositories. Please push the changes when ready:
```bash
git push origin main
```
