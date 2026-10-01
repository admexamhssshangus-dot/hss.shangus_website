# Changes Log & Commit Reference

## Latest Commit: Restrict socialshiftz@gmail.com Exclusively to Teacher Role and Enforce Strict RBAC Portal Isolation

**Commit Message:** `fix(security): restrict socialshiftz@gmail.com to teacher role and enforce strict rbac isolation`

---

### Context & Root Cause Analysis

The user reported:
> *"check again socialshiftz@gmail.com is teacher email not admin...teacher can never access admin portal not student can access eirther of two....i mean login is role specific"*
> *"why it shows open admin panel....something has broken here? check the security deeply and strictly"*

#### Root Cause:
1. `socialshiftz@gmail.com` (Faculty member Sheikh Gulfam, Botany, Class 11th & 12th) was erroneously listed inside `BOOTSTRAP_ADMINS` in `src/utils/authRoles.js` and `isBootstrapAdmin()` in `firestore.rules`.
2. In `src/services/staffAuthService.js`, `FALLBACK_STAFF_PROFILES['socialshiftz@gmail.com']` had `isAdmin: true` and `perms: ['reports']` instead of teacher permissions `['attendanceMgmt', 'practicals']`.
3. Because `isAdmin` evaluated to `true`, the Teacher Dashboard rendered an administrative guidance banner ("Open Admin Portal") and an "Admin Portal" navigation button, and the top-right Navbar displayed the user badge as "ADMIN" linking to `/portal/admin`.
4. Furthermore, role-specific login routing and tab guards needed explicit redirection and isolation to prevent any role crossover between Students, Teachers, and Administrators.

---

### Changes Made

1. **`src/utils/authRoles.js`**:
   - Removed `'socialshiftz@gmail.com'` from `BOOTSTRAP_ADMINS`.
   - `isBootstrapAdminEmail('socialshiftz@gmail.com')` now strictly returns `false`.

2. **`src/services/staffAuthService.js`**:
   - Updated `FALLBACK_STAFF_PROFILES['socialshiftz@gmail.com']`:
     - `name`: `'Sheikh Gulfam'`
     - `role`: `'Teacher'`
     - `isTeacher`: `true`
     - `isAdmin`: `false`
     - `subject`: `'Botany'`
     - `teachingSubject`: `'Botany'`
     - `assignedClasses`: `['11th', '12th']`
     - `perms`: `['attendanceMgmt', 'practicals']`
   - Added an institutional safety guard in `resolveStaffRoleAndPerms` that guarantees `socialshiftz@gmail.com` always resolves to `role: 'Teacher'` and `isAdmin: false`, overriding any stale or legacy administrative records in remote documents.

3. **`firestore.rules`**:
   - Removed `'socialshiftz@gmail.com'` from `isBootstrapAdmin()`.
   - Retained `'socialshiftz@gmail.com'` in `verifiedStaffIdentity()` so that authentic faculty responsibilities (attendance logging and practical marks submission) remain fully authorized under Cloud Firestore security rules.
   - Successfully deployed updated rules to Firebase via `npm run deploy:rules`.

4. **`src/portal/LoginPage.jsx`**:
   - Updated Google Sign-In and Email/Password Sign-In to enforce explicit, role-specific redirections:
     - Teachers are directed to `/portal/teacher`.
     - Students are directed to `/portal/student`.
     - Admins are directed to `/portal/admin`.
   - Maintained strict tab guards ensuring students and teachers cannot authenticate on administrative tabs.

5. **`src/portal/teacher/TeacherDashboard.jsx` & Navbar**:
   - With `user.isAdmin`, `isBootstrapAdminEmail`, and `isSuperAdminEmail` now evaluating to `false` for `socialshiftz@gmail.com`, `isAdminUser` evaluates to `false`.
   - The "Open Admin Portal" banner and header switch button are completely hidden for `socialshiftz@gmail.com`.
   - In Navbar, the badge displays `TEACHER` and links exclusively to `/portal/teacher`.

---

### Exact List of Files Changed

- [src/utils/authRoles.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/authRoles.js) (Removed `socialshiftz@gmail.com` from `BOOTSTRAP_ADMINS`)
- [src/services/staffAuthService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/staffAuthService.js) (Set `isAdmin: false`, `role: 'Teacher'`, `perms: ['attendanceMgmt', 'practicals']` for `socialshiftz@gmail.com`)
- [firestore.rules](file:///d:/Shk_Gulfam/Projects/hss_shangus/firestore.rules) (Removed `socialshiftz@gmail.com` from `isBootstrapAdmin()`, deployed to Firebase)
- [src/portal/LoginPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/LoginPage.jsx) (Enforced explicit role-specific redirect pathways for student, teacher, and admin logins)
- [CHANGES_SINCE_LAST_COMMIT.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/CHANGES_SINCE_LAST_COMMIT.md) (Updated memory log)

---

### Build Verification & Metrics

- `npm run build`: **Exit Code 0** (production bundle built cleanly; passed all 11 static SEO checks).
- `npm run deploy:rules`: **Exit Code 0** (`+ firestore: released rules firestore.rules to cloud.firestore`).

---

### Manual Review & Push Instructions

1. **Inspect Commit History**:
   ```bash
   git log -n 1 --stat
   ```

2. **Amend or Re-commit if Desired**:
   ```bash
   # If you wish to adjust the commit message or files:
   git reset --soft HEAD~1
   git commit -m "fix(security): restrict socialshiftz@gmail.com to teacher role and enforce strict rbac isolation"
   ```

3. **Push to Remote**:
   ```bash
   git push origin main
   ```
