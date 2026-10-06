# Changes Since Last Commit

## Commit Message

`fix(auth): exempt email approval from auth header and clear login alerts on tab switch`

## Summary

- **Exempted `approveAdminVerification` from Missing Authorization Header Check**: In `netlify/functions/staff-command.js`, the unauthenticated email verification link handler (`approveAdminVerification`) was blocked when neither an `Authorization` header nor an `X-Firebase-AppCheck` header was present, resulting in `401: {"error": "App verification is required."}`. Updated line 55 to exempt `approveAdminVerification` from the authorization header requirement (matching line 64), allowing one-time cryptographic email approval links to complete successfully.
- **Added Regression Unit Test for Unauthenticated Link Approval**: Updated `scripts/staff-command.test.cjs` to verify that `approveAdminVerification` successfully dispatches to business logic even when both `Authorization` and `X-Firebase-AppCheck` headers are omitted.
- **Synchronized Cloud Firestore `site/settings` Document**: Directly updated Cloud Firestore document `/site/settings` to set `enableAdmin2StepVerification: false`, aligning it with `public/slides/settings.json` and allowing direct administrator sign-in without forced 2SV link dispatch loops.
- **Cleared Stale Error Alerts on Login Role Tab Switches**: In `src/portal/LoginPage.jsx`, added `setAlert(null)` when switching between Student, Teacher, and Admin/SuperAdmin tabs and when typing credentials, preventing stale errors (such as previous verification failures) from persisting across different login roles.

## Files Changed

1. `netlify/functions/staff-command.js`
2. `scripts/staff-command.test.cjs`
3. `src/portal/LoginPage.jsx`
4. `CHANGES_SINCE_LAST_COMMIT.md`

## Verification

- `node --test scripts/staff-command.test.cjs`: passed (7/7 tests, including unauthenticated link approval without App Check).
- `node --test scripts/public-records.test.cjs`: passed (10/10 tests, including 2SV conditional enforcement).
- Cloud Firestore REST verification: confirmed `/site/settings` has `enableAdmin2StepVerification: false`.
- `npm run build`: completed with exit code 0; production bundle, 11 public HTML pages, and SEO checks passed.

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

3. Push manually when ready. This project workflow strictly prohibits automatic pushes:

   ```bash
   git push origin main
   ```
