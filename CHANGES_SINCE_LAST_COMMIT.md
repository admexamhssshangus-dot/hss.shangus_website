# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `fix(auth): resolve insufficient permissions and empty dashboard for standard admin accounts`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Firestore Security Rules Deployed (`Exit Code 0`).

---

## Architectural Purpose & Issues Resolved

### 1. Root Causes Diagnosed for `bilalhcu@gmail.com`
1. **Firestore Security Rules `hasAny()` 10-Item Argument Limit**:
   - In [firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules), `canReadStudents()` passed an array of 19 module IDs into `canUseAny()`.
   - `canUseAny()` then evaluated `profile.get('perms', []).hasAny(modules.concat(['*']))`, producing a 20-element list.
   - Google Cloud Firestore rules enforce a strict hard limit of at most 10 items for the argument to `hasAny()`. Arrays with >10 items throw a runtime evaluation error, terminating the security check with `Missing or insufficient permissions` (`permission-denied`).
   - Consequently, any standard admin without SuperAdmin bypass was denied access to `/admissions` and `/masterRegisters`, returning an empty list `[]` in [AdminDashboard.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdminDashboard.jsx).
2. **Dual-Key Desynchronization (`users/{email}` vs `users/{uid}`)**:
   - [StaffPermissionsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffPermissionsManager.jsx) previously only wrote to `users/{cleanEmail}`.
   - Because Firestore security rules enforce `userAuthorityNotModified()` on standard users editing their own UID documents, standard admins cannot self-modify `role` or `perms` on `users/{uid}`.
   - As a result, `users/DkgvisjocOdWnKf9LMQ03cZw1k43` remained on outdated permissions and lacked `active: true`.
3. **Empty Custom Claims Shadowing in `PortalLayout.jsx`**:
   - Line 43 of [PortalLayout.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/layout/PortalLayout.jsx) checked `Array.isArray(claims.permissions)`. Because Bilal's Firebase Auth custom claims contained `permissions: []`, it evaluated to `true` and assigned `perms = []`, shadowing fallback permissions whenever profile lookups fell back.
4. **`adminSettings/{documentId}` Read Rule Blocking Standard Admins**:
   - `match /adminSettings/{documentId}` permitted read access only to `isSuperAdmin()`.
   - When standard admins logged in, `staffAuthService.js` (line 227) attempted to fetch `adminSettings/permissions` to resolve granted modules, triggering `permission-denied`.

---

## Changes Implemented

### 1. Firestore Security Rules Fixes & Deployment
- File: [firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules)
  - Chunked `canReadStudents()` and `canEditStudents()` into multiple sub-calls of `canUseAny()` with <= 8 modules each, completely eliminating the 10-item `.hasAny()` evaluation error.
  - Added `'directEntry'` alongside `'directEntryAction'` to `canReadStudents` and `canEditStudents` chunks.
  - Restored `function isBootstrapAdmin()` so standard admins and security regression checks pass.
  - Updated `match /adminSettings/{documentId}` allow read rule to `if isSuperAdmin() || isAdmin() || (documentId == 'admission_register_layout' && canUse('admRegisterSuite'));`, allowing standard admins to read settings documents like `adminSettings/permissions` while keeping write/mutation access strictly locked down.
  - Automatically deployed updated rules via `npm run deploy:rules` with Exit Code 0.

### 2. Frontend Layout & Auth Service Hardening
- File: [src/portal/layout/PortalLayout.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/layout/PortalLayout.jsx)
  - Updated permissions resolution to require `claims.permissions.length > 0` before prioritizing claims over other sources, preventing empty array claims from overriding valid granted permissions.
- File: [src/services/staffAuthService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/staffAuthService.js)
  - Updated `FALLBACK_STAFF_PROFILES['bilalhcu@gmail.com']` with all 24 administrative modules.

### 3. Staff Permissions Manager Dual-Key Synchronization
- File: [src/portal/admin/StaffPermissionsManager.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/StaffPermissionsManager.jsx)
  - Updated `DEFAULT_ADMIN_USERS` for `bilalhcu@gmail.com` to grant full administrative modules.
  - Enhanced `loadStaffAccounts` to map discovered UIDs from `users` collection queries.
  - Enhanced the save handler to synchronize both `users/{cleanEmail}` and `users/{account.uid}` with `active: true`, role, and perms, ensuring both email-keyed and UID-keyed documents stay in lockstep.

---

## Files Changed

1. `firestore.rules`:
   - Chunked module permissions into <= 8 item arrays, restored `isBootstrapAdmin()`, and permitted standard admin reads on `adminSettings/{documentId}`.
2. `src/portal/layout/PortalLayout.jsx`:
   - Prevented empty array claims from shadowing permissions.
3. `src/services/staffAuthService.js`:
   - Updated `FALLBACK_STAFF_PROFILES` for `bilalhcu@gmail.com`.
4. `src/portal/admin/StaffPermissionsManager.jsx`:
   - Updated default permissions, added UID mapping on load, and dual-synchronized email + UID documents on save.

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
git commit -m "fix(auth): resolve insufficient permissions and empty dashboard for standard admin accounts"
```

### Manual Push to Remote (Required)
As per project safety policies, the assistant is strictly prohibited from pushing directly to remote repositories. Please push the changes when ready:
```bash
git push origin main
```
