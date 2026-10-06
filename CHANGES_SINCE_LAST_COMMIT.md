# Changes Since Last Commit

## Commit Message

`fix(auth): restore direct admin login and unlock devtools for admin accounts`

## Summary

- **Restored Direct Admin Sign-In**: When 2-step verification (`enableAdmin2StepVerification`) is disabled in institutional controls (the default), administrators logging in with email/password, Google OAuth, or auto-routing from the student tab can log in directly without being blocked by an external server handshake.
- **Dynamic 2-Step Verification Gate**: Updated `requireVerifiedAdminSession` in `staffAuthService.js` and `createVerifiedSession` in `LoginPage.jsx` to only enforce `adminSessions` verification when `siteSettings.enableAdmin2StepVerification` is explicitly turned on.
- **F12 & Developer Tools Unlocked for All Admins**: Updated `securityGuardrails.js` (`isSuperAdminLoggedIn` and `isAdminLoggedIn`) to recognize both Super Admins and Standard Admins, active Firebase Auth admin accounts (`auth.currentUser`), stored admin credentials, and pending admin sessions so that F12, inspect element, developer shortcuts, and right-click context menus are fully permitted.
- **Exam Terminal Admin Exemption**: Exempted administrator accounts on `GkTestRegistration.jsx` from shortcut and context menu restrictions.
- **Backend Access Hardening**: Updated `functions/access.js` to recognize foundational bootstrap administrator identities and resolve staff profiles across `users/{uid}`, `users/{email}`, `adminSettings/permissions`, and hardcoded fallbacks without failing when `users/{uid}` has not yet been indexed.
- **Netlify Serverless Dependencies**: Added missing `firebase-functions` and `nodemailer` to `netlify/functions/package.json` and improved error logging and feedback in `netlify/functions/staff-command.js`.

## Files Changed

1. `functions/access.js`
2. `netlify/functions/package.json`
3. `netlify/functions/staff-command.js`
4. `src/pages/GkTestRegistration.jsx`
5. `src/portal/LoginPage.jsx`
6. `src/services/staffAuthService.js`
7. `src/utils/securityGuardrails.js`
8. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `npm run security:check`: passed with all security assertions verified.
- `node scripts/staff-command.test.cjs`: passed (6 tests).
- `npm run test:public`: passed (9 tests).
- `npm run admission:check`: passed (83 schema fields classified).
- `npm run performance:check`: passed.
- `npm run build`: completed with exit code 0; production bundle, 11 public HTML pages, and SEO regression checks passed.
- `git diff --check`: passed with zero whitespace or line ending errors.

## Instructions for the User

1. Review the local commit:

   ```bash
   git show --stat HEAD
   git log -1 -p
   ```

2. Amend or recreate the commit if you prefer another message:

   ```bash
   git reset --soft HEAD~1
   git commit -m "Your custom commit message"
   ```

3. Push manually when ready. This project workflow deliberately never pushes automatically:

   ```bash
   git push origin main
   ```
