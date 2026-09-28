# Changes Log & Commit Reference

## Current Working Changes

### 1. Direct Print / "Save as PDF" Trigger (0 Extra Clicks & No Stray Tabs)
- **Problem:**
  - Clicking the **Print** button (e.g. on `/portal/teacher/practicals` or in administrative practical award roll views) previously opened a new browser popup window/tab via `window.open('', '_blank')` and attempted `pwin.document.write(...)`.
  - In modern browsers, `window.onload` does not reliably fire in dynamically written `about:blank` popup tabs. As a result, the native print dialog never appeared automatically, forcing the teacher to click inside the new tab and press Ctrl+P or find a print button manually (requiring a second click).
- **Resolution:**
  - In [practicalsPdfGenerator.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/practicalsPdfGenerator.js):
    - Refactored `triggerPrintWindow` to utilize an isolated, hidden `iframe` directly on the active document body (matching the proven pattern in [certificateExportUtils.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/utils/certificateExportUtils.js)).
    - Content is written directly to the iframe document; all images and web typography are awaited via `document.fonts.ready`.
    - Temporarily updates the top-level document title to the award roll's official title so that the browser's "Save as PDF" dialog automatically suggests the exact file name (e.g. `Official Practical Award Roll — Physics (PH) — Class 11th.pdf`).
    - Immediately focuses and triggers `iframe.contentWindow.print()`. The browser's native Print / Save as PDF modal opens in-place on the very first click with 0 extra clicks, and automatically cleans up the iframe upon print completion or cancellation.
  - In [ConsolidatedGazetteView.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/ConsolidatedGazetteView.jsx):
    - Upgraded `handlePrintGazette` from popup window writing to the same hidden iframe print architecture.

---

### 2. Comprehensive Resolution for Password Reset Link "Expired or Used Wrongly"
- **Problem:**
  - Teachers reported that when receiving a password reset link and clicking it from their email, the portal displayed:
    *"Link Expired or Already Used"* / *"The 2-step verification link is invalid, expired, or has already been used. Please sign in again."*
  - Multiple underlying causes were diagnosed:
    1. **Missing Top-Level Firebase Action Link Routes:** Firebase Auth emails send links to `https://<auth-domain>/__/auth/action?mode=resetPassword&oobCode=...`. Because `firebase.json` rewrites all requests to `/index.html`, React Router received `/__/auth/action` or `/auth/action`. React Router only had `/portal/auth/action`, causing the router to match the bottom catch-all `/:pageId` (`DynamicPage`), leading to 404 / broken page states.
    2. **LoginPage Misinterpreting Reset Links as 2SV Handshakes:** When a reset link arrived at or redirected to `/portal/login`, `LoginPage.jsx` checked for `oobCode` in the URL and treated it as an admin 2-step email sign-in link (`isSignInWithEmailLink`). It failed with *"The 2-step verification link is invalid, expired, or has already been used. Please sign in again."*
    3. **AuthActionPage Premature 'Invalid' State & StrictMode Guard:** In `AuthActionPage.jsx`, any network lag or error in `verifyPasswordResetCode` or `confirmPasswordReset` caught `_` and unconditionally displayed *"Link Expired or Already Used"*. Even during password entry, if a teacher entered a weak password or experienced a network glitch, they were permanently locked out with "Link Expired".
    4. **Continue URL Misalignment:** `sendPasswordResetEmail` in `staffAuthService.js`, `ForgotPasswordPage.jsx`, and `AdvancedReports.jsx` passed `url: /portal/login`, pointing users to the login page instead of the dedicated auth action interface.
- **Resolution:**
  - In [App.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/App.js):
    - Mounted `<AuthActionPage />` at top-level routes `/__/auth/action` and `/auth/action` alongside `/portal/auth/action`.
  - In [LoginPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/LoginPage.jsx):
    - Added an immediate forwarder: when `mode === 'resetPassword' || mode === 'verifyEmail' || mode === 'recoverEmail'` and `oobCode` is present, instantly redirects to `/portal/auth/action` with all query and hash parameters preserved.
    - Exempted auth action URLs from the 2-step verification ref guard (`isEmailVerificationTabRef`) and the Window 2 verification handshake.
  - In [AuthActionPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/AuthActionPage.jsx):
    - Added support for extracting action codes from both URL query search and URL hash fragments.
    - Added `hasVerifiedRef` guard to prevent React 18 StrictMode double-verification and race conditions.
    - Implemented specific error code handling (`auth/expired-action-code`, `auth/invalid-action-code`, `auth/network-request-failed`).
    - Calibrated password requirements to 8+ characters with letters and numbers (consistent with portal standard), and retained the form state during weak password or connection errors rather than falsely claiming the link expired.
    - Provided intuitive "Request a Fresh Link" button pre-populating the teacher's email, plus a "Retry Verification" action for transient network issues.
  - In [staffAuthService.js](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/services/staffAuthService.js), [ForgotPasswordPage.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/ForgotPasswordPage.jsx), and [AdvancedReports.jsx](file:///d:/Shk_Gulfam/Projects/hss_shangus/src/portal/admin/AdvancedReports.jsx):
    - Updated `sendPasswordResetEmail` to point its continue URL explicitly to `${origin}/portal/auth/action`.

---

## Files Modified
- `src/utils/practicalsPdfGenerator.js`
- `src/portal/admin/ConsolidatedGazetteView.jsx`
- `src/App.js`
- `src/portal/LoginPage.jsx`
- `src/portal/AuthActionPage.jsx`
- `src/services/staffAuthService.js`
- `src/portal/ForgotPasswordPage.jsx`
- `src/portal/admin/AdvancedReports.jsx`
- `CHANGES_SINCE_LAST_COMMIT.md`

---

## Local Commit Message
```bash
git commit -m "fix(portal): direct print as PDF on single click and fix password reset link expiration handling"
```

---

## How to Review or Manually Manage Commits

### To review staged changes before commit:
```bash
git diff --staged
```

### If you want to commit manually:
```bash
git add .
git commit -m "fix(portal): direct print as PDF on single click and fix password reset link expiration handling"
```

### To amend or edit this commit:
```bash
git reset --soft HEAD~1
# Make desired adjustments, then re-commit:
git commit -m "fix(portal): direct print as PDF on single click and fix password reset link expiration handling"
```

### Remote Push (STRICT MANUAL STEP):
- Per repository rules, the AI assistant is strictly prohibited from running `git push`.
- To push to GitHub / remote origin, run:
```bash
git push origin main
```
