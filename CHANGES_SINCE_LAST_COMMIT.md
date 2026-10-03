# Changes Summary Since Last Commit

## Commit Summary
- **Commit Message**: `feat(admin-security-and-reports): add Full DB Search confirmation dialog & enforce 2SV for all admins when enabled (default disabled)`
- **Date**: October 03, 2026
- **Status**: Production Build Passed (`Exit Code 0`), verified locally; Automated Jest test suites passed (`59/59 passed`, `Exit Code 0`).

---

## 1. Full Database Search Confirmation Modal

### User Requirement
- When clicking **"⚡ Full DB Search"** in the Advanced Reports / Admission Register Suite, prompt the administrator with a proper, high-contrast confirmation modal before activating high-resource mode.

### Implementation
- **File**: [src/portal/admin/AdvancedReports.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdvancedReports.jsx)
  - Updated `handleToggleFullDbSearch`:
    - When toggling ON, opens the unified `ConfirmModal` (`type: 'warning'`) displaying:
      - Title: `⚡ Enable Full Database Search?`
      - Message: `Search across all 20+ years of historical student archives (2006–2026). This scans tens of thousands of archived records and operates in high-resource mode.`
      - Consequence Note: `⚠️ High Resource Mode: This will increase cloud database read operations, memory usage, and query latency. For day-to-day operations, the default Fast Mode (Recent 3 Cycles) is recommended.`
      - Action Buttons: `⚡ Enable Full DB Search` (Primary Amber) and `Stay in Fast Mode` (Secondary/Cancel).
    - When confirmed: activates Full DB Search, triggers historical record loading, and displays an informational toast.
    - When toggling OFF (from the button or warning banner): immediately switches back to standard Fast Search mode without extra prompts.
  - Enhanced `ConfirmModal` call at the root of `AdvancedReports.jsx` to pass `consequence` and `cancelText` props.

---

## 2. Admin Security & 2-Step Verification Controls

### User Requirement
- If 2-step verification is enabled, admins must require 2-step verification to log in with email and password.
- By default, 2-step verification must be disabled, allowing admins to log in with email and password directly.
- Sign In with Google continues to allow direct authenticated login.

### Root Cause & Diagnosis
1. **Initial State Mismatch**: In [src/portal/admin/ControlsAndSubjects.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/ControlsAndSubjects.jsx), the initial state was `useState(true)`. Even though `settingsLoader.js` had `false`, `ControlsAndSubjects.jsx` defaulted to `true` in component state.
2. **SuperAdmin Exemption Bypass**: In [src/portal/LoginPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/LoginPage.jsx), line 933 checked `if (require2Step && !isSuper)`. Super Admins (including institutional root admin `adm.exam.hss.shangus@gmail.com`) were exempted from 2SV, allowing them to sign in directly with password even when 2SV was enabled.
3. **`beginAdminLogin` Profile Check Bug**: In [src/portal/LoginPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/LoginPage.jsx) line 661, `beginAdminLogin` checked `if (!profile?.isAdmin) return false;`. The profile object returned from `resolveStaffRoleAndPerms` had `{ role: 'SuperAdmin' | 'Admin' }` rather than a boolean `.isAdmin` property, causing `beginAdminLogin` to return `false` early and fall through to direct password sign-in.
4. **General / Student Tab Bypass**: Logging in on the general/student tab did not check `require2Step` before auto-routing to `/portal/admin`.

### Implemented Fix
- **File**: [src/portal/LoginPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/LoginPage.jsx)
  - Fixed `beginAdminLogin` to authoritatively recognize Admin and SuperAdmin accounts using canonical role helpers:
    ```javascript
    const strictRole = getStrictCanonicalRole(cleanEmail, profile);
    const isSuper = strictRole === ROLES.SUPER_ADMIN || profile?.role === 'SuperAdmin' || isBootstrapSuperAdminEmail(cleanEmail);
    const isAdmin = isSuper || strictRole === ROLES.STANDARD_ADMIN || profile?.isAdmin || profile?.role === 'Admin';
    if (!isAdmin) return false;
    ```
  - Removed `&& !isSuper` from `handleSubmit`: When 2SV is enabled (`require2Step === true`), **all admins** logging in with password require email link verification.
  - Added 2SV enforcement on the student tab auto-router as well.
  - When 2SV is disabled (`require2Step === false`, default), all admins sign in directly with email & password.
- **File**: [src/portal/admin/ControlsAndSubjects.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/ControlsAndSubjects.jsx)
  - Changed default state to `useState(false)`.
  - Added fallback `else setEnableAdmin2StepVerification(false)`.
  - Clarified UI subtext: `Disabled (Default): Admins sign in directly with Email & Password without link verification.` vs `Active: All admins require a 15-minute verification link sent to their email.`

---

## 3. Strict Subject Code Matching in Composite Biology Award Matrix
- **File**: [src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js)
  - Replaced remaining naive `codeStr === 'BO' || codeStr.includes('BO')` and `codeStr === 'ZO' || codeStr.includes('ZO')` at lines 1378–1385 with authoritative `isMatchingSubjectCode(codeStr, 'BO')` and `isMatchingSubjectCode(codeStr, 'ZO')`.

---

## List of Files Changed
1. [src/portal/admin/AdvancedReports.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdvancedReports.jsx) (Full DB Search confirmation modal & consequence styling)
2. [src/portal/LoginPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/LoginPage.jsx) (enforced 2SV for all admins when enabled, direct password login when disabled)
3. [src/portal/admin/ControlsAndSubjects.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/ControlsAndSubjects.jsx) (set 2SV default to disabled, updated UI descriptions)
4. [src/utils/practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js) (applied `isMatchingSubjectCode` for composite BO & ZO lookups)
5. [CHANGES_SINCE_LAST_COMMIT.md](file:///d:/Shk_Gulfam/Projects/hss_shangus/CHANGES_SINCE_LAST_COMMIT.md) (documentation update)

---

## Verification & Testing
- **Jest Unit Tests**:
  - `src/utils/practicalsSubjectMatching.test.js`: `7 passed, 7 total` (`Exit Code 0`).
  - `src/portal/teacher/PracticalsPage.test.jsx`: `24 passed, 24 total` (`Exit Code 0`).
  - `src/pages/PublicResultLookup.test.jsx`: `21 passed, 21 total` (`Exit Code 0`).
  - `src/utils/studentApprovalStatus.test.js`: `7 passed, 7 total` (`Exit Code 0`).
  - **Total**: `59 passed, 59 total` (`Exit Code 0`).
- **Production Build**:
  - Command: `npm run build`
  - Output: `Compiled successfully`, `Exit Code 0`, zero breaking errors.
  - SEO validation: 11 public pages, canonical redirects, sitemap, offline navigation passed.

---

## Instructions for User

### Reviewing the Local Commit
To review the local commit once made:
```bash
git log -1 --stat
git show HEAD
```

### Amending or Re-committing (Optional)
If you wish to modify or redo the commit manually:
```bash
git reset --soft HEAD~1
git add .
git commit -m "feat(admin-security-and-reports): add Full DB Search confirmation dialog & enforce 2SV for all admins when enabled (default disabled)"
```

### Pushing Changes to Remote (Manual Step Required)
As per security policy, the assistant never executes `git push`. When ready, push manually to remote:
```bash
git push origin main
```
